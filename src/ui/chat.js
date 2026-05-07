export function formatMarkdown(text) {
    // Basic markdown formatting
    return text
        .replace(/### (.*)/g, '<h3>$1</h3>')
        .replace(/## (.*)/g, '<h2>$1</h2>')
        .replace(/# (.*)/g, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n- (.*)/g, '</p><ul><li>$1</li></ul><p>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

export function makeCitationsClickable(text, onCitationClick) {
    return text.replace(
        /\[([^\]]+?):(\d+)(?:-(\d+))?\]/g,
        (match, file, start, end) => {
            const endLine = end || start;
            return `<a class="citation" data-file="${file}" data-start="${start}" data-end="${endLine}" href="#">[${file}:${start}-${endLine}]</a>`;
        }
    );
}

export function renderUserMessage(chatArea, text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message user';
    messageEl.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    chatArea.appendChild(messageEl);
    chatArea.scrollTop = chatArea.scrollHeight;
    return messageEl;
}

export function renderInvestigatorMessage(chatArea, text, claims = [], onCitationClick) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message investigator';

    // Convert citations to clickable links
    let processedContent = makeCitationsClickable(text, onCitationClick);

    // Format markdown-like content
    processedContent = formatMarkdown(processedContent);

    // Remove claims summary section from display (it's in the claim log)
    processedContent = processedContent.replace(/###?\s*CLAIMS SUMMARY[\s\S]*$/i, '');

    messageEl.innerHTML = `
        <div class="message-avatar">🔍</div>
        <div class="message-content">${processedContent}</div>
    `;

    // Add click handlers for citations
    const citations = messageEl.querySelectorAll('.citation');
    citations.forEach(citation => {
        citation.addEventListener('click', (e) => {
            e.preventDefault();
            const file = citation.dataset.file;
            const start = parseInt(citation.dataset.start);
            const end = parseInt(citation.dataset.end);
            if (onCitationClick) {
                onCitationClick(file, start, end);
            }
        });
    });

    chatArea.appendChild(messageEl);
    chatArea.scrollTop = chatArea.scrollHeight;
    return messageEl;
}

export function renderSystemMessage(chatArea, text) {
    const messageEl = document.createElement('div');
    messageEl.className = 'message system';
    messageEl.innerHTML = `
        <div class="message-avatar">⚙️</div>
        <div class="message-content">${text}</div>
    `;
    chatArea.appendChild(messageEl);
    chatArea.scrollTop = chatArea.scrollHeight;
    return messageEl;
}

export function addSkeleton(chatArea, status) {
    const id = 'skeleton-' + Date.now();
    const skeletonEl = document.createElement('div');
    skeletonEl.className = 'skeleton';
    skeletonEl.id = id;
    skeletonEl.innerHTML = `
        <div class="message-avatar">🔍</div>
        <div class="skeleton-content">
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="status-text">${status}</div>
        </div>
    `;
    chatArea.appendChild(skeletonEl);
    chatArea.scrollTop = chatArea.scrollHeight;
    return id;
}

export function removeSkeleton(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

export function addAuditingIndicator(messageEl) {
    const id = 'auditing-' + Date.now();
    const indicator = document.createElement('div');
    indicator.id = id;
    indicator.className = 'status-text';
    indicator.textContent = 'Auditing...';
    messageEl.querySelector('.message-content').appendChild(indicator);
    return id;
}

export function removeAuditingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

export function renderLoadingState(chatArea, step) {
    const statusMap = {
        'fetching': 'Fetching repository...',
        'investigating': 'Investigating...',
        'auditing': 'Auditing...'
    };
    return addSkeleton(chatArea, statusMap[step] || 'Loading...');
}

export function renderError(chatArea, message, retryCallback) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.innerHTML = `
        <div class="error-title">Error</div>
        <div>${escapeHtml(message)}</div>
        ${retryCallback ? '<button class="btn btn-primary" style="margin-top: 8px;">Retry</button>' : ''}
    `;

    if (retryCallback) {
        const btn = errorEl.querySelector('button');
        btn.addEventListener('click', retryCallback);
    }

    chatArea.appendChild(errorEl);
    chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
