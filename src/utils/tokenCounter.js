import { AVG_CHARS_PER_TOKEN, MAX_TOKENS_PER_REQUEST, TOKEN_BUDGETS } from '../config/constants.js';

export function estimate(text) {
    return Math.ceil((text?.length || 0) / AVG_CHARS_PER_TOKEN);
}

export function formatForDisplay(count) {
    return `~${count.toLocaleString()} tokens`;
}

export function getColor(count) {
    if (count > MAX_TOKENS_PER_REQUEST) {
        return 'danger';
    } else if (count > MAX_TOKENS_PER_REQUEST * 0.8) {
        return 'caution';
    }
    return 'safe';
}

export function getCssColor(count) {
    const level = getColor(count);
    switch (level) {
        case 'danger': return 'var(--error)';
        case 'caution': return 'var(--warning)';
        default: return 'var(--text-muted)';
    }
}

export function estimateTotal(question) {
    const questionTokens = estimate(question);
    return (
        TOKEN_BUDGETS.systemPrompt +
        TOKEN_BUDGETS.readme +
        TOKEN_BUDGETS.files +
        TOKEN_BUDGETS.claims +
        questionTokens
    );
}
