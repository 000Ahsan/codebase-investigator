import { GROQ_ENDPOINT, GROQ_SUMMARY_MODEL } from '../config/constants.js';

function getGroqKey() {
    return localStorage.getItem('groq_key') || '';
}

export async function generateSummary(readmeContent) {
    const groqKey = getGroqKey();
    if (!groqKey || !readmeContent) return null;

    try {
        const prompt = `Read this README and give a 3-line summary:
Line 1: What this project is (one sentence)
Line 2: Primary language and main packages/frameworks used
Line 3: One sentence on how it is structured or deployed

README:
${readmeContent.substring(0, 4000)}`;

        const response = await fetch(GROQ_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
                model: GROQ_SUMMARY_MODEL,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant that summarizes README files concisely.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 300
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (e) {
        console.error('Failed to generate README summary:', e);
        return null;
    }
}

export function renderSummaryCard(chatArea, summary) {
    // Remove existing card if any
    const existing = document.getElementById('readmeSummaryCard');
    if (existing) existing.remove();

    const card = document.createElement('div');
    card.id = 'readmeSummaryCard';
    card.className = 'readme-summary';
    card.innerHTML = `
        <div class="readme-summary-title">📦 Repo Summary</div>
        <button class="readme-summary-dismiss">✕ dismiss</button>
        <div class="readme-summary-content">${escapeHtml(summary).replace(/\n/g, '<br>')}</div>
    `;

    // Add dismiss handler
    const dismissBtn = card.querySelector('.readme-summary-dismiss');
    dismissBtn.addEventListener('click', () => card.remove());

    // Insert after welcome message, before first chat message
    chatArea.insertBefore(card, chatArea.children[1]);
}

export function dismissCard() {
    const existing = document.getElementById('readmeSummaryCard');
    if (existing) existing.remove();
}

export function updateReadmeIndicator(hasReadme) {
    const indicator = document.getElementById('readmeIndicator');
    if (!indicator) return;

    if (hasReadme) {
        indicator.className = 'readme-indicator found';
        indicator.innerHTML = '📄 README loaded';
    } else {
        indicator.className = 'readme-indicator missing';
        indicator.innerHTML = '⚠️ No README found — answers may be less accurate';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
