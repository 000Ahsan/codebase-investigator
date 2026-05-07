import {
    CEREBRAS_ENDPOINT,
    GROQ_ENDPOINT,
    CEREBRAS_MODEL,
    GROQ_FALLBACK_MODEL
} from '../config/constants.js';

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

function getGroqKey() {
    return localStorage.getItem('groq_key') || '';
}

function showFallbackIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'fallbackIndicator';
    indicator.textContent = '⚡ Using Groq fallback';
    indicator.style.cssText = 'position: fixed; top: 10px; right: 10px; background: var(--warning); color: #000; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; z-index: 1000;';
    document.body.appendChild(indicator);

    setTimeout(() => {
        indicator.remove();
    }, 5000);
}

export async function callInvestigator(messages) {
    const cerebrasKey = getCerebrasKey();
    const groqKey = getGroqKey();

    if (!cerebrasKey && !groqKey) {
        throw new Error('No AI API key configured — add Cerebras (primary) or Groq (fallback) key');
    }

    // Try Cerebras first (primary provider)
    if (cerebrasKey) {
        try {
            const response = await fetch(CEREBRAS_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cerebrasKey}`
                },
                body: JSON.stringify({
                    model: CEREBRAS_MODEL,
                    messages: messages,
                    temperature: 0.2,
                    max_tokens: 8192
                })
            });

            // Handle Cerebras errors
            if (response.status === 429) {
                console.log('Cerebras rate limit hit, trying Groq fallback...');
            } else if (response.status === 401) {
                throw new Error('Invalid Cerebras API key — check your key at cloud.cerebras.ai');
            } else if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                const errorMsg = error.error?.message || '';
                console.log('Cerebras error:', errorMsg || 'API error');
                // Check for model_not_found error
                if (errorMsg.includes('model_not_found') || errorMsg.includes('not found')) {
                    throw new Error('⚠️ Cerebras model error — check model name at inference-docs.cerebras.ai/models');
                }
                // Try Groq fallback for other non-auth errors
            } else {
                // Success on Cerebras
                const data = await response.json();
                return data.choices[0].message.content;
            }
        } catch (cerebrasError) {
            console.log('Cerebras request failed:', cerebrasError.message);
            if (cerebrasError.message.includes('model error')) {
                throw cerebrasError; // Don't retry on model errors
            }
            // Continue to Groq fallback
        }
    }

    // Fallback to Groq (if Cerebras failed, rate limited, or no Cerebras key)
    if (!groqKey) {
        throw new Error('Cerebras rate limit hit and no Groq API key configured for fallback');
    }

    // Show fallback indicator
    showFallbackIndicator();

    const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`
        },
        body: JSON.stringify({
            model: GROQ_FALLBACK_MODEL,
            messages: messages,
            temperature: 0.2,
            max_tokens: 8192
        })
    });

    if (response.status === 429) {
        throw new Error('Both Cerebras and Groq rate limits hit — wait a minute and retry');
    }
    if (response.status === 401) {
        throw new Error('Invalid Groq API key — check your key at console.groq.com');
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        if (error.error?.message?.includes('model')) {
            throw new Error('Both AI models temporarily unavailable');
        }
        throw new Error(error.error?.message || 'Groq API error');
    }

    const data = await response.json();
    return data.choices[0].message.content;
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
