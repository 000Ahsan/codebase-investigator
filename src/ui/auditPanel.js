import { CEREBRAS_MODEL, GROQ_AUDITOR_MODEL } from '../config/constants.js';

export function getAuditColor(trustLevel) {
    const level = trustLevel?.toLowerCase() || 'low';
    switch (level) {
        case 'high': return 'audit-high';
        case 'medium': return 'audit-medium';
        case 'low': return 'audit-low';
        default: return 'audit-low';
    }
}

export function renderAuditPanel(messageEl, auditResult) {
    const level = auditResult.overall?.toLowerCase() || 'low';
    const panel = document.createElement('div');
    panel.className = `audit-panel audit-${level}`;

    const header = document.createElement('div');
    header.className = 'audit-header';
    header.innerHTML = `Audit: ${auditResult.overall} — ${auditResult.reason}`;
    header.addEventListener('click', () => panel.classList.toggle('expanded'));

    const content = document.createElement('div');
    content.className = 'audit-content';

    let checksHtml = '';

    if (auditResult.citationChecks?.length > 0) {
        checksHtml += `
            <div class="audit-section">
                <div class="audit-section-title">Citation Verification</div>
                ${auditResult.citationChecks.map(c => `
                    <div class="citation-check ${c.status.toLowerCase()}">
                        ${c.status === 'VERIFIED' ? '✅' : c.status === 'HALLUCINATED' ? '❌' : '⚠️'}
                        [${c.citation}] — ${c.note}
                    </div>
                `).join('')}
            </div>
        `;
    }

    checksHtml += `
        <div class="audit-section">
            <div class="audit-section-title">Logic Check</div>
            <div>${auditResult.logicCheck}</div>
        </div>
        <div class="audit-section">
            <div class="audit-section-title">Impact Check</div>
            <div>${auditResult.impactCheck}</div>
        </div>
        <div class="audit-section">
            <div class="audit-section-title">Contradiction Check</div>
            <div>${auditResult.contradictionCheck}</div>
        </div>
        <div class="audit-section" style="border-top: 1px solid rgba(255,255,255,0.2); font-size: 11px; color: var(--text-muted); text-align: center;">
            Investigated by ${CEREBRAS_MODEL} (Cerebras) · Audited by ${GROQ_AUDITOR_MODEL} (Groq)
        </div>
    `;

    content.innerHTML = checksHtml;
    panel.appendChild(header);
    panel.appendChild(content);

    messageEl.querySelector('.message-content').appendChild(panel);
}

export function renderAuditLoading() {
    return '<div class="status-text">Auditing...</div>';
}
