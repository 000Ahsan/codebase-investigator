import { GROQ_ENDPOINT, GROQ_AUDITOR_MODEL } from '../config/constants.js';
import { formatFileListForPrompt } from './investigator.js';

// System prompt for the auditor
const AUDITOR_SYSTEM_PROMPT = `You are a skeptical senior code reviewer auditing an AI-generated answer about a codebase.
You will be given: the original question, the AI's answer, and the actual file contents it cited.
Your job is to find problems. Be harsh but fair.`;

function buildAuditorUserMessage(question, answer, limitedCitedFiles, claimLog, actualFilesList, readmeContent) {
    const claims = claimLog.slice(-5).map(c => `- ${c.claim}`).join('\n');

    return `ORIGINAL QUESTION: ${question}

AI ANSWER TO AUDIT:
${answer}

ACTUAL FILE CONTENTS FOR VERIFICATION:
${limitedCitedFiles.map(f => `--- ${f.path} ---\n${f.content}`).join('\n\n')}

ESTABLISHED FACTS FROM PRIOR TURNS:
${claims}

ACTUAL FILES IN REPOSITORY (cite only these):
${actualFilesList}

REPOSITORY README CONTENT:
${readmeContent}

AUDIT TASKS:
1. CITATION CHECK: For each [file:lines] citation in the answer, verify the cited lines
   actually exist and say what the answer claims. Mark each: VERIFIED / HALLUCINATED / PARTIAL

FILE EXISTENCE CHECK: For every file cited in the answer, verify it appears in the ACTUAL FILES IN REPOSITORY list above.
If a cited file is NOT in this list, mark it as: ❌ HALLUCINATED FILE — this file does not exist in the repository

README CHECK: When auditing answers about project purpose, packages, or architecture:
- Check if the answer matches what the README actually says
- If the answer contradicts the README, flag it as: ⚠️ CONTRADICTS README
- If the answer ignores the README and cites code instead for something the README covers, flag as: ⚠️ UNNECESSARY — README covers this

2. LOGIC CHECK: Is the reasoning sound? Are there gaps or unsupported leaps?
3. IMPACT CHECK: If any code changes were suggested, would they break anything visible in the files?
4. CONTRADICTION CHECK: Does anything in this answer conflict with established facts?
5. CONFIDENCE RATING: Overall trust score: HIGH / MEDIUM / LOW and why in one sentence.

Format your response as JSON:
{
  "citationChecks": [{"citation": "file:lines", "status": "VERIFIED/HALLUCINATED/PARTIAL", "note": "..."}],
  "logicCheck": "...",
  "impactCheck": "...",
  "contradictionCheck": "...",
  "overall": "HIGH/MEDIUM/LOW",
  "reason": "..."
}`;
}

function getGroqKey() {
    return localStorage.getItem('groq_key') || '';
}

export async function callAuditor(question, answer, citedFiles, claimLog, coreFileList, repoReadme) {
    const groqKey = getGroqKey();

    if (!groqKey) {
        return {
            overall: 'LOW',
            reason: 'Groq API key not configured',
            citationChecks: [],
            logicCheck: 'Unable to audit',
            impactCheck: 'Unable to audit',
            contradictionCheck: 'Unable to audit'
        };
    }

    // Get compact core file list for existence check
    const actualFilesList = formatFileListForPrompt(coreFileList);

    // Limit README and cited files to stay within token budget
    const readmeContent = repoReadme ? repoReadme.substring(0, 2000) : 'No README found in this repository.';

    // Limit cited file content (max 3000 tokens total for file contents)
    const limitedCitedFiles = citedFiles.slice(0, 5).map(f => ({
        path: f.path,
        content: f.content.substring(0, 8000) // ~2000 tokens per file max
    }));

    const userMessage = buildAuditorUserMessage(
        question, answer, limitedCitedFiles, claimLog, actualFilesList, readmeContent
    );

    try {
        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: GROQ_AUDITOR_MODEL,
                messages: [
                    { role: 'system', content: AUDITOR_SYSTEM_PROMPT },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.1,
                max_tokens: 4096,
                response_format: { type: 'json_object' }
            })
        });

        if (response.status === 429) {
            throw new Error('Groq rate limit hit during audit');
        }
        if (response.status === 401) {
            throw new Error('Invalid Groq API key');
        }
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            if (error.error?.message?.includes('model')) {
                throw new Error('Auditor model temporarily unavailable');
            }
            throw new Error('Groq API error');
        }

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        let reason;
        if (error.message.includes('rate limit')) {
            reason = '⚠️ Audit unavailable — Groq rate limit hit. Answer not independently verified.';
        } else if (error.message.includes('Invalid Groq API key')) {
            reason = '⚠️ Invalid Groq API key — audit skipped';
        } else {
            reason = `⚠️ Audit failed: ${error.message}`;
        }

        return {
            overall: 'LOW',
            reason: reason,
            citationChecks: [],
            logicCheck: 'Error',
            impactCheck: 'Error',
            contradictionCheck: 'Error'
        };
    }
}

export function parseTrustLevel(auditResult) {
    const level = auditResult.overall?.toLowerCase() || 'low';
    return {
        level,
        isHigh: level === 'high',
        isMedium: level === 'medium',
        isLow: level === 'low'
    };
}
