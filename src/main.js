import './styles/main.css';

import { loadRepo, getRepoState, findFilePath, fetchAndCacheFile, reset as resetRepo } from './core/repoLoader.js';
import { buildContext, getLastContextTokens } from './core/contextBuilder.js';
import { addTurn, getTurnNumber, getHistory, getRecentTurnsForMessages, getSystemSummaryMessage, reset as resetConversation } from './core/conversationManager.js';
import { addClaims, getAllClaims, clearAll as clearClaims, formatClaimsForPrompt } from './core/claimLog.js';
import { callInvestigator, buildInvestigatorPrompt, extractClaims, extractCitations, formatFileListForPrompt } from './api/investigator.js';
import { callAuditor } from './api/auditor.js';
import { generateSummary, renderSummaryCard, dismissCard } from './ui/repoSummaryCard.js';
import { renderTree, clearTree } from './ui/repoTree.js';
import { renderUserMessage, renderInvestigatorMessage, renderSystemMessage, addSkeleton, removeSkeleton, addAuditingIndicator, removeAuditingIndicator, renderError } from './ui/chat.js';
import { renderAuditPanel } from './ui/auditPanel.js';
import { openCitation } from './ui/fileViewer.js';
import { estimateTotal, formatForDisplay, getCssColor } from './utils/tokenCounter.js';
import { getDependencyFiles } from './utils/languageDetector.js';

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    repoInput: document.getElementById('repoInput'),
    loadRepoBtn: document.getElementById('loadRepoBtn'),
    apiKeysBtn: document.getElementById('apiKeysBtn'),
    apiKeysModal: document.getElementById('apiKeysModal'),
    closeModalBtn: document.getElementById('closeModalBtn'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    githubToken: document.getElementById('githubToken'),
    cerebrasKey: document.getElementById('cerebrasKey'),
    groqKey: document.getElementById('groqKey'),
    chatArea: document.getElementById('chatArea'),
    welcomeMessage: document.getElementById('welcomeMessage'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    fileTree: document.getElementById('fileTree'),
    fileViewer: document.getElementById('fileViewer'),
    fileHeader: document.getElementById('fileHeader'),
    fileName: document.getElementById('fileName'),
    fileContent: document.getElementById('fileContent'),
    claimLog: document.getElementById('claimLog'),
    tokenCount: document.getElementById('tokenCount'),
    progressContainer: document.getElementById('progressContainer'),
    progressBar: document.getElementById('progressBar'),
    progressText: document.getElementById('progressText'),
    sidebarTabs: document.querySelectorAll('.sidebar-tab')
};

let isLoading = false;

// ============================================
// INITIALIZATION
// ============================================
function init() {
    // Load saved API keys
    elements.githubToken.value = localStorage.getItem('github_token') || '';
    elements.cerebrasKey.value = localStorage.getItem('cerebras_key') || '';
    elements.groqKey.value = localStorage.getItem('groq_key') || '';

    // Event listeners
    elements.loadRepoBtn.addEventListener('click', handleLoadRepo);
    elements.repoInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLoadRepo();
    });

    elements.apiKeysBtn.addEventListener('click', () => {
        elements.apiKeysModal.classList.add('active');
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.apiKeysModal.classList.remove('active');
    });

    elements.saveKeysBtn.addEventListener('click', saveApiKeys);

    elements.sendBtn.addEventListener('click', sendMessage);
    elements.messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    elements.messageInput.addEventListener('input', updateTokenCount);

    elements.sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => switchSidebarTab(tab.dataset.tab));
    });

    // Close modal on overlay click
    elements.apiKeysModal.addEventListener('click', (e) => {
        if (e.target === elements.apiKeysModal) {
            elements.apiKeysModal.classList.remove('active');
        }
    });
}

function saveApiKeys() {
    localStorage.setItem('github_token', elements.githubToken.value.trim());
    localStorage.setItem('cerebras_key', elements.cerebrasKey.value.trim());
    localStorage.setItem('groq_key', elements.groqKey.value.trim());
    elements.apiKeysModal.classList.remove('active');
}

// ============================================
// REPO LOADING
// ============================================
async function handleLoadRepo() {
    const url = elements.repoInput.value.trim();
    if (!url) {
        renderError(elements.chatArea, 'Please enter a GitHub repository URL');
        return;
    }

    showProgress(true);
    setProgress(0, 'Fetching repository structure...');

    try {
        const result = await loadRepo(url);
        setProgress(100, 'Complete');

        // Render file tree
        clearTree(elements.fileTree);
        renderTree(result.coreFileList, elements.fileTree, handleFileClick);

        // Enable chat
        enableChat();

        // Hide welcome, show initial message
        elements.welcomeMessage.style.display = 'none';

        const langMsg = result.langInfo.name !== 'Unknown' ? ` (${result.langInfo.name} project)` : '';
        const readmeIndicator = result.repoReadme
            ? ' <span class="readme-indicator found">📄 README loaded</span>'
            : ' <span class="readme-indicator missing">⚠️ No README found — answers may be less accurate</span>';

        renderSystemMessage(elements.chatArea, `Loaded ${result.repo.owner}/${result.repo.repo}${langMsg} — ${result.coreFileList.size} core files (+${result.allFileList.size - result.coreFileList.size} vendor files excluded).${readmeIndicator} Ask me anything about the codebase.`);

        // Generate and show README summary
        if (result.repoReadme) {
            const summary = await generateSummary(result.repoReadme);
            if (summary) {
                renderSummaryCard(elements.chatArea, summary);
            }
        }

        setTimeout(() => hideProgress(), 500);
    } catch (error) {
        hideProgress();
        if (error.message.includes('rate limit')) {
            renderError(elements.chatArea, 'GitHub rate limit hit — add a GitHub token for higher limits');
        } else {
            renderError(elements.chatArea, `Failed to load repository: ${error.message}`);
        }
    }
}

function handleFileClick(path) {
    const { coreFileList, fileCache } = getRepoState();
    const meta = coreFileList.get(path);
    if (!meta) return;

    // Fetch and display file content
    fetchAndCacheFile(path).then(content => {
        if (!content) {
            elements.fileContent.innerHTML = '<div style="padding: 20px; color: var(--text-muted);">File content unavailable</div>';
            switchSidebarTab('viewer');
            return;
        }

        elements.fileName.textContent = path;
        const lines = content.split('\n');
        elements.fileContent.innerHTML = lines.map((line, i) => `
            <div class="line" data-line="${i + 1}">
                <span class="line-number">${i + 1}</span>
                <span class="line-content">${escapeHtml(line)}</span>
            </div>
        `).join('');

        switchSidebarTab('viewer');
    });
}

function handleCitationClick(file, startLine, endLine) {
    const { coreFileList } = getRepoState();
    openCitation(file, startLine, endLine, coreFileList, findFilePath, handleFileClick, switchSidebarTab, {
        fileName: elements.fileName,
        fileContent: elements.fileContent
    });
}

// ============================================
// MESSAGE SENDING
// ============================================
async function sendMessage() {
    const question = elements.messageInput.value.trim();
    if (!question || isLoading) return;

    isLoading = true;

    // Add user message
    renderUserMessage(elements.chatArea, question);
    elements.messageInput.value = '';
    elements.messageInput.disabled = true;
    elements.sendBtn.disabled = true;

    // Show skeleton
    const skeletonId = addSkeleton(elements.chatArea, 'Investigating...');

    try {
        // Build context
        const context = await buildContext(question);

        // Update token count display
        const tokens = getLastContextTokens();
        if (tokens) {
            elements.tokenCount.textContent = formatForDisplay(tokens) + ' in this request';
            elements.tokenCount.style.color = getCssColor(tokens);
        }

        // Build messages for investigator
        const { repo, detectedLanguage, coreFileList } = getRepoState();
        const langSpecific = getDependencyFiles(detectedLanguage);
        const dependencyFile = langSpecific[0] || 'none';
        const actualFilesList = formatFileListForPrompt(coreFileList);

        const systemPrompt = buildInvestigatorPrompt(detectedLanguage, dependencyFile, actualFilesList, repo);

        const messages = [{ role: 'system', content: systemPrompt }];

        // Add summary as system message if we have older conversation
        const summaryMsg = getSystemSummaryMessage();
        if (summaryMsg) {
            messages.push({ role: 'system', content: summaryMsg });
        }

        // Add recent turns
        const recentTurns = getRecentTurnsForMessages();
        messages.push(...recentTurns);

        // Add current question
        messages.push({
            role: 'user',
            content: `Repository files:\n\n${context}\n\nUser question: ${question}`
        });

        // Ask Investigator
        const answer = await callInvestigator(messages);

        // Remove skeleton
        removeSkeleton(skeletonId);

        // Extract claims and citations
        const turnNum = getTurnNumber() + 1;
        const claims = extractClaims(answer, turnNum);
        const citations = extractCitations(answer);

        // Render message
        const messageEl = renderInvestigatorMessage(elements.chatArea, answer, claims, handleCitationClick);

        // Update claim log
        addClaims(claims, turnNum);
        renderClaimLog();

        // Fetch cited files for audit
        const { coreFileList: files, fileCache, repoReadme } = getRepoState();
        const citedFiles = [];
        for (const c of citations) {
            const fullPath = findFilePath(c.file);
            if (!fullPath) {
                citedFiles.push({ path: c.file, content: '[File not found]', lines: c });
                continue;
            }
            let content = fileCache.get(fullPath);
            if (!content) {
                content = await fetchAndCacheFile(fullPath);
            }
            citedFiles.push({
                path: fullPath,
                content: content || '[File content unavailable]',
                lines: c
            });
        }

        // Show auditing indicator
        const auditId = addAuditingIndicator(messageEl);

        // Run audit
        const claimLog = getAllClaims();
        const auditResult = await callAuditor(question, answer, citedFiles, claimLog, files, repoReadme);

        // Render audit panel
        removeAuditingIndicator(auditId);
        renderAuditPanel(messageEl, auditResult);

        // Store in conversation
        addTurn('investigator', answer, claims, auditResult);

    } catch (error) {
        removeSkeleton(skeletonId);
        renderError(elements.chatArea, `Error: ${error.message}`);
    } finally {
        isLoading = false;
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.focus();
    }
}

// ============================================
// UI HELPERS
// ============================================
function updateTokenCount() {
    const { coreFileList } = getRepoState();
    if (!coreFileList || coreFileList.size === 0) return;

    const question = elements.messageInput.value.trim();
    if (!question) {
        elements.tokenCount.textContent = '';
        return;
    }

    const estimated = estimateTotal(question);
    elements.tokenCount.textContent = formatForDisplay(estimated) + ' estimated';
    elements.tokenCount.style.color = getCssColor(estimated);
}

function renderClaimLog() {
    const claims = getAllClaims();
    if (claims.length === 0) {
        elements.claimLog.innerHTML = '<div class="no-claims">No claims yet. Start a conversation to see the claim log.</div>';
        return;
    }

    elements.claimLog.innerHTML = claims.slice().reverse().map(claim => `
        <div class="claim-item">
            <div class="claim-text">${escapeHtml(claim.claim)}</div>
            <div class="claim-meta">
                <span class="claim-source">${escapeHtml(claim.source)}</span>
                <span class="claim-confidence ${claim.confidence}">${claim.confidence}</span>
                <span>turn ${claim.turnNumber}</span>
            </div>
        </div>
    `).join('');
}

function switchSidebarTab(tab) {
    elements.sidebarTabs.forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    document.getElementById('fileTree').classList.remove('active');
    document.getElementById('fileViewer').classList.remove('active');
    document.getElementById('claimLog').classList.remove('active');

    if (tab === 'files') document.getElementById('fileTree').classList.add('active');
    if (tab === 'viewer') document.getElementById('fileViewer').classList.add('active');
    if (tab === 'claims') document.getElementById('claimLog').classList.add('active');
}

function enableChat() {
    elements.messageInput.disabled = false;
    elements.sendBtn.disabled = false;
}

function showProgress(show) {
    elements.progressContainer.style.display = show ? 'block' : 'none';
    elements.progressText.style.display = show ? 'block' : 'none';
}

function setProgress(percent, text) {
    elements.progressBar.style.width = `${percent}%`;
    elements.progressText.textContent = text;
}

function hideProgress() {
    setTimeout(() => showProgress(false), 300);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize app
init();
