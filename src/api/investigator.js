import {
    CEREBRAS_ENDPOINT,
    CEREBRAS_MODEL_CHAIN
} from '../config/constants.js';

// Track which model was used for the last successful call
let lastUsedModel = null;

// System prompt for the investigator
export function buildInvestigatorPrompt(detectedLanguage, dependencyFile, actualFilesList, repo) {
    return `You are a senior software engineer investigating a codebase for a user.
You have been given real file contents from the repository.

PROJECT CONTEXT:
This is a ${detectedLanguage || 'Unknown'} project. Only reference files and package managers that exist in ${detectedLanguage || 'Unknown'} projects. The dependency file is ${dependencyFile}. NEVER reference package.json for PHP projects. NEVER reference composer.json for Node.js projects.

CRITICAL RULE - FILE EXISTENCE GUARD:
REPO FILES (cite only these):
${actualFilesList}

If a file is not in this list, it does not exist. Do NOT reference it, do NOT guess its contents, do NOT say 'typically this file contains'. If you cannot find the relevant file, say explicitly: 'I could not find this file in the repository. The repo contains: [list closest relevant files].'

ANSWER PRIORITY ORDER:
1. First check README.md for the answer — if it's there, cite it and stop
2. If README partially answers the question, cite it then supplement with code
3. Only go to raw code files if README has no relevant information

For questions about:
- Project purpose → README only
- Package/dependency list → README first, then ${dependencyFile}/package.json
- Setup/installation → README only
- Architecture overview → README first, then folder structure
- Tech stack → README first, then dependency files

RULES:
1. Every non-trivial claim MUST cite a specific file and line range: [auth/middleware.js:23-45]
2. If you are not sure, say so explicitly — never fabricate file names or line numbers
3. For opinion/suggestion questions, clearly separate OBSERVATION (what the code does)
   from OPINION (what you'd change and why)
4. For each answer, end with a CLAIMS SUMMARY section listing your key factual claims
   in this format:
   CLAIM: [short claim] | SOURCE: [file:lines] | CONFIDENCE: [high/medium/low]
5. Never repeat information already established in prior turns unless the user asks
6. If a question contradicts something established earlier, flag it explicitly

Repository: ${repo.owner}/${repo.repo}`;
}

function getCerebrasKey() {
    return localStorage.getItem('cerebras_key') || '';
}

function showModelIndicator(model) {
    // Remove any existing indicator
    const existing = document.getElementById('modelIndicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.id = 'modelIndicator';
    indicator.textContent = `⚡ Using ${model}`;
    indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: var(--accent); color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; z-index: 1000;';
    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.remove();
    }, 5000);
}

export async function callInvestigator(messages) {
    const cerebrasKey = getCerebrasKey();

    if (!cerebrasKey) {
        throw new Error('Cerebras API key not configured — add key at cloud.cerebras.ai');
    }

    // Try each model in the chain
    for (let i = 0; i < CEREBRAS_MODEL_CHAIN.length; i++) {
        const model = CEREBRAS_MODEL_CHAIN[i];

        try {
            const response = await fetch(CEREBRAS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cerebrasKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    temperature: 0.2,
                    max_tokens: 8192
                })
            });

            // Handle errors
            if (response.status === 429) {
                console.log(`Cerebras ${model} rate limit hit, trying next model...`);
                continue; // Try next model in chain
            }

            if (response.status === 401) {
                throw new Error('Invalid Cerebras API key — check your key at cloud.cerebras.ai');
            }

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const errorMsg = error.error?.message || '';
                console.log(`Cerebras ${model} error:`, errorMsg || 'API error');

                // Check for model_not_found error — try next model
                if (errorMsg.includes('model_not_found') || errorMsg.includes('not found') || errorMsg.includes('Model')) {
                    console.log(`Model ${model} unavailable, trying next...`);
                    continue;
                }

                // Other errors — stop and report
                throw new Error(`Cerebras API error: ${errorMsg || response.statusText}`);
            }

            // Success!
            const data = await response.json();
            lastUsedModel = model;

            // Show indicator if using a fallback model (not the primary)
            if (i > 0) {
                showModelIndicator(model);
            }

            return {
                content: data.choices[0].message.content,
                model: model
            };

        } catch (error) {
            // If it's an auth error, stop immediately
            if (error.message.includes('Invalid Cerebras API key')) {
                throw error;
            }

            // For other errors on the last model, throw
            if (i === CEREBRAS_MODEL_CHAIN.length - 1) {
                throw new Error(`All Cerebras models failed. Last error: ${error.message}`);
            }

            // Otherwise continue to next model
            console.log(`Cerebras ${model} failed:`, error.message);
        }
    }

    // All models exhausted
    throw new Error(`⚠️ All Cerebras models are currently rate limited. Please wait a minute and try again, or check your usage at cloud.cerebras.ai`);
}

export function getLastUsedModel() {
    return lastUsedModel || CEREBRAS_MODEL_CHAIN[0];
}

export function extractClaims(answer, turnNumber) {
    const claims = [];
    const regex = /CLAIM:\s*(.+?)\s*\|\s*SOURCE:\s*(.+?)\s*\|\s*CONFIDENCE:\s*(high|medium|low)/gi;
    let match;

    while ((match = regex.exec(answer)) !== null) {
        claims.push({
            claim: match[1].trim(),
            source: match[2].trim(),
            confidence: match[3].toLowerCase(),
            turnNumber
        });
    }

    return claims;
}

export function extractCitations(answer) {
    const citations = [];
    const regex = /\[([^\]]+?):(\d+)(?:-(\d+))?\]/g;
    let match;

    while ((match = regex.exec(answer)) !== null) {
        citations.push({
            file: match[1],
            startLine: parseInt(match[2]),
            endLine: match[3] ? parseInt(match[3]) : parseInt(match[2])
        });
    }

    return citations;
}

export function formatFileListForPrompt(files) {
    const paths = Array.from(files.keys()).sort();
    if (paths.length === 0) return 'No files available.';
    return paths.map((p, i) => `${i + 1}. ${p}`).join('\n');
}
