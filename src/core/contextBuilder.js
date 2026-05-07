import {
    MAX_TOKENS_PER_REQUEST,
    TOKEN_BUDGETS,
    AVG_CHARS_PER_TOKEN,
    MAX_FILE_TOKENS,
    TECH_KEYWORDS
} from '../config/constants.js';
import { getDependencyFiles } from '../utils/languageDetector.js';
import { isVendorContent } from '../utils/fileFilter.js';
import { estimate } from '../utils/tokenCounter.js';
import { getRepoState, fetchAndCacheFile } from './repoLoader.js';
import { getSummary, getSystemSummaryMessage, hasOlderConversation } from './conversationManager.js';
import { formatClaimsForPrompt } from './claimLog.js';

let lastContextTokens = 0;
let lastContextBreakdown = null;

export function extractKeywords(question) {
    const lower = question.toLowerCase();
    const keywords = new Set();

    // Extract tech keywords
    TECH_KEYWORDS.forEach(kw => {
        if (lower.includes(kw)) keywords.add(kw);
    });

    // Extract file/function names (alphanumeric with underscores, dots)
    const identifiers = lower.match(/[a-z_][a-z0-9_]*\.[a-z0-9_]+|[a-z_][a-z0-9_]*/g) || [];
    identifiers.forEach(id => {
        if (id.length > 2 && !TECH_KEYWORDS.includes(id)) keywords.add(id);
    });

    // Extract path fragments
    const paths = lower.match(/[\w\-\/]+\/[\w\-\/\.]+/g) || [];
    paths.forEach(p => {
        p.split('/').forEach(part => {
            if (part.length > 2) keywords.add(part.replace(/\.\w+$/, ''));
        });
    });

    return Array.from(keywords);
}

export function scoreFile(path, keywords, content = null, detectedLanguage) {
    const lowerPath = path.toLowerCase();
    const filename = path.split('/').pop().toLowerCase();
    const basename = filename.replace(/\.\w+$/, '');
    let score = 0;

    // Config file bonus (+1) - language-aware
    const configFiles = getDependencyFiles(detectedLanguage);
    if (configFiles.some(cfg => filename === cfg.toLowerCase())) {
        score += 1;
    }

    // Bonus for language-appropriate dependency files (+2 extra)
    const langSpecific = getDependencyFiles(detectedLanguage);
    if (langSpecific.some(cfg => filename === cfg.toLowerCase())) {
        score += 2;
    }

    // Path matches (+3 per keyword)
    keywords.forEach(kw => {
        if (lowerPath.includes(kw)) score += 3;
    });

    // Filename matches (+5 per keyword)
    keywords.forEach(kw => {
        if (basename.includes(kw)) score += 5;
    });

    // Content matches (+2 per match, capped at +10)
    if (content) {
        let contentMatches = 0;
        keywords.forEach(kw => {
            const matches = (content.toLowerCase().match(new RegExp(kw, 'g')) || []).length;
            contentMatches += matches;
        });
        score += Math.min(contentMatches * 2, 10);
    }

    return score;
}

export function truncateContent(content, maxTokens = MAX_FILE_TOKENS) {
    const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
    if (content.length <= maxChars) return content;

    const lines = content.split('\n');
    const totalLines = lines.length;

    // Keep first 60% and last 20%
    const firstKeep = Math.floor(totalLines * 0.6);
    const lastKeep = Math.floor(totalLines * 0.2);
    const omittedStart = firstKeep + 1;
    const omittedEnd = totalLines - lastKeep;

    const firstPart = lines.slice(0, firstKeep).join('\n');
    const lastPart = lines.slice(totalLines - lastKeep).join('\n');

    return `${firstPart}\n\n... [TRUNCATED: lines ${omittedStart}-${omittedEnd} omitted for brevity] ...\n\n${lastPart}`;
}

export async function buildContext(userQuestion) {
    const { coreFileList, fileCache, detectedLanguage, repoReadme } = getRepoState();

    const keywords = extractKeywords(userQuestion);

    // Score all files and fetch content for high-scoring ones
    const fileScores = [];
    for (const [path, meta] of coreFileList) {
        if (meta.isLarge) continue; // Skip very large files

        // For already-cached files, use content in scoring
        let content = fileCache.get(path);
        let score = scoreFile(path, keywords, content, detectedLanguage);

        // If file scores high and not cached, fetch it
        if (score > 3 && !content && !meta.fetched) {
            content = await fetchAndCacheFile(path);
            if (content) {
                score = scoreFile(path, keywords, content, detectedLanguage); // Rescore with content
            }
        }

        fileScores.push({ path, score, content, meta });
    }

    // Sort by score descending
    fileScores.sort((a, b) => b.score - a.score);

    // Build context
    let context = '';
    let tokenCount = 0;
    let filesIncluded = 0;
    let configIncluded = false;
    let codeFilesIncluded = 0;

    // README ALWAYS FIRST - Primary source for project context (max 1500 tokens)
    if (repoReadme) {
        const readmeContent = repoReadme.substring(0, TOKEN_BUDGETS.readme * AVG_CHARS_PER_TOKEN);
        const readmeSection = `=== REPOSITORY OVERVIEW (README.md) ===\n${readmeContent}${repoReadme.length > readmeContent.length ? '\n[README truncated due to length]' : ''}\n=== END README ===\n\nUse the above README as your primary source for:\n- What this project does\n- What language/framework it uses\n- What packages/dependencies it mentions\n- How it is structured\n- Any architecture decisions the author documented\n\nOnly look at code files to answer questions the README does not cover.\n\n`;
        context += readmeSection;
        tokenCount += estimate(readmeSection);
    } else {
        const noReadmeSection = `=== REPOSITORY OVERVIEW ===\nNo README found in this repository. Infer project purpose from file structure and dependency files only. Do not guess or hallucinate project purpose.\n=== END ===\n\n`;
        context += noReadmeSection;
        tokenCount += estimate(noReadmeSection);
    }

    // Add conversation summary for older turns (max 1500 tokens budget)
    const summaryText = getSystemSummaryMessage();
    if (summaryText && hasOlderConversation()) {
        const summarySection = `=== PRIOR CONVERSATION ===\n${summaryText.substring(0, TOKEN_BUDGETS.conversation * AVG_CHARS_PER_TOKEN)}\n\n`;
        context += summarySection;
        tokenCount += estimate(summarySection);
    }

    // Add last 5 claims only (max 300 tokens budget)
    const claimsSection = formatClaimsForPrompt();
    if (claimsSection) {
        context += claimsSection;
        tokenCount += estimate(claimsSection);
    }

    // Include files up to budget (max 6000 tokens for file contents)
    const filesTokenBudget = TOKEN_BUDGETS.files;
    let filesTokenCount = 0;
    const configFiles = getDependencyFiles(detectedLanguage);

    for (const file of fileScores) {
        const isConfig = configFiles.some(cfg =>
            file.path.split('/').pop().toLowerCase() === cfg.toLowerCase()
        );

        // Check overall limit
        const remainingTokens = MAX_TOKENS_PER_REQUEST - tokenCount;
        if (remainingTokens < 500) break;

        // Check files-specific budget
        if (filesTokenCount >= filesTokenBudget) {
            context += `\n[Additional files omitted: file content budget reached]`;
            break;
        }

        // Enforce minimums after we've included enough high-priority files
        if (filesIncluded >= 3) {
            if (!configIncluded && !isConfig) continue; // Need at least 1 config
            if (codeFilesIncluded < 2 && isConfig) continue; // Need at least 2 code files
        }

        // Get content (may need to fetch) - NEVER fetch vendor content
        if (isVendorContent(file.path)) continue;

        let content = file.content;
        if (!content && !file.meta.isLarge && file.score > 2) {
            content = await fetchAndCacheFile(file.path);
        }
        if (!content) continue;

        // Truncate if needed (1500 tokens max per file)
        const truncated = truncateContent(content, MAX_FILE_TOKENS);
        const fileSection = `=== FILE: ${file.path} ===\n${truncated}\n\n`;
        const sectionTokens = estimate(fileSection);

        if (tokenCount + sectionTokens > MAX_TOKENS_PER_REQUEST) {
            context += `\n[Additional files omitted: context limit reached]`;
            break;
        }

        context += fileSection;
        tokenCount += sectionTokens;
        filesTokenCount += sectionTokens;
        filesIncluded++;

        if (isConfig) configIncluded = true;
        else codeFilesIncluded++;
    }

    // Calculate total request tokens including question and system prompt
    const questionTokens = estimate(userQuestion);
    const estimatedTotal = tokenCount + questionTokens + TOKEN_BUDGETS.systemPrompt;

    // Store token count for UI
    lastContextTokens = Math.round(estimatedTotal);
    lastContextBreakdown = {
        readme: estimate(repoReadme ? repoReadme.substring(0, TOKEN_BUDGETS.readme * AVG_CHARS_PER_TOKEN) : 100),
        files: filesTokenCount,
        conversation: estimate(getSummary() || ''),
        claims: 0, // Will be set by caller
        question: questionTokens,
        system: TOKEN_BUDGETS.systemPrompt
    };

    return context;
}

export function getLastContextTokens() {
    return lastContextTokens;
}

export function getLastContextBreakdown() {
    return lastContextBreakdown;
}

export function resetContextStats() {
    lastContextTokens = 0;
    lastContextBreakdown = null;
}
