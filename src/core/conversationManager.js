import { MAX_CONVERSATION_HISTORY, SUMMARY_INTERVAL, GROQ_ENDPOINT, GROQ_SUMMARY_MODEL } from '../config/constants.js';

let conversation = [];
let turnNumber = 0;
let summary = null;

function getGroqKey() {
    return localStorage.getItem('groq_key') || '';
}

export function addTurn(role, content, claims = [], auditResult = null) {
    turnNumber++;
    const turn = {
        role,
        content,
        claims,
        auditResult,
        turnNumber,
        timestamp: Date.now()
    };
    conversation.push(turn);

    // Check if we need to generate summary
    if (turnNumber % SUMMARY_INTERVAL === 0) {
        summarizeIfNeeded();
    }

    return turn;
}

export function getHistory() {
    return [...conversation];
}

export function getTrimmedHistory(maxTurns = MAX_CONVERSATION_HISTORY / 2) {
    // Return last N turns (user + assistant pairs)
    return conversation.slice(-maxTurns * 2);
}

export function getRecentTurnsForMessages() {
    // Returns last 3 turns as formatted messages for API
    const recent = conversation.slice(-MAX_CONVERSATION_HISTORY);
    return recent.map(msg => ({
        role: msg.role === 'investigator' ? 'assistant' : 'user',
        content: msg.content
    }));
}

export function getTurnNumber() {
    return turnNumber;
}

export function getSummary() {
    return summary;
}

export function hasOlderConversation() {
    return summary && conversation.length > MAX_CONVERSATION_HISTORY;
}

export function getSystemSummaryMessage() {
    if (!summary || conversation.length <= MAX_CONVERSATION_HISTORY) {
        return null;
    }
    return `Earlier in this conversation: ${summary}`;
}

export async function summarizeIfNeeded() {
    const groqKey = getGroqKey();
    if (!groqKey) return;

    const summaryPrompt = `Summarize this conversation about a codebase investigation in 200 words or less:

${conversation.slice(-10).map(m => `${m.role}: ${m.content.substring(0, 500)}...`).join('\n\n')}`;

    try {
        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: GROQ_SUMMARY_MODEL,
                messages: [
                    { role: 'user', content: summaryPrompt }
                ],
                temperature: 0.2,
                max_tokens: 500
            })
        });

        if (response.ok) {
            const data = await response.json();
            summary = data.choices[0].message.content;
        }
    } catch (e) {
        console.error('Summary generation failed:', e);
    }
}

export function reset() {
    conversation = [];
    turnNumber = 0;
    summary = null;
}
