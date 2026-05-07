import { CLAIMS_TO_SHOW } from '../config/constants.js';

let claims = [];

export function addClaims(newClaims, turnNumber) {
    const claimsWithTurn = newClaims.map(c => ({
        ...c,
        turnNumber
    }));
    claims.push(...claimsWithTurn);
}

export function getClaims(limit = CLAIMS_TO_SHOW) {
    return claims.slice(-limit);
}

export function getAllClaims() {
    return [...claims];
}

export function formatClaimsForPrompt() {
    const recent = getClaims(CLAIMS_TO_SHOW);
    if (recent.length === 0) return '';

    return `=== ESTABLISHED FACTS ===\n${recent.map(c =>
        `- ${c.claim} [${c.source}] (confidence: ${c.confidence})`
    ).join('\n')}\n\n`;
}

export function clearAll() {
    claims = [];
}
