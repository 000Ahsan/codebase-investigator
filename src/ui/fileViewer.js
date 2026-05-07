import { getRepoState, fetchAndCacheFile } from '../core/repoLoader.js';

let currentFile = null;

export function openFile(path, fileList, fileCache, fileName, fileContent, switchSidebarTab) {
    const meta = fileList.get(path);
    if (!meta) return;

    // Fetch content if not cached
    let content = fileCache.get(path);
    if (!content && !meta.isLarge) {
        content = fetchAndCacheFile(path);
    }

    if (!content) {
        fileContent.innerHTML = '<div style="padding: 20px; color: var(--text-muted);">File content unavailable</div>';
        switchSidebarTab('viewer');
        return;
    }

    currentFile = path;
    fileName.textContent = path;

    const lines = content.split('\n');
    fileContent.innerHTML = lines.map((line, i) => `
        <div class="line" data-line="${i + 1}">
            <span class="line-number">${i + 1}</span>
            <span class="line-content">${escapeHtml(line)}</span>
        </div>
    `).join('');

    switchSidebarTab('viewer');
}

export function highlightLines(fileContent, startLine, endLine) {
    const end = endLine || startLine;
    const lines = fileContent.querySelectorAll('.line');

    lines.forEach(line => {
        const lineNum = parseInt(line.dataset.line);
        if (lineNum >= startLine && lineNum <= end) {
            line.classList.add('highlighted');
            if (lineNum === startLine) {
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            line.classList.remove('highlighted');
        }
    });
}

export function addLineNumbers(content) {
    const lines = content.split('\n');
    return lines.map((line, i) => `${i + 1} | ${line}`).join('\n');
}

export async function openCitation(fileName, startLine, endLine, fileList, findFilePath, openFileFn, switchSidebarTab, elements) {
    const path = findFilePath(fileName);
    if (!path || !fileList.has(path)) {
        alert(`File not found: ${fileName}`);
        return;
    }

    // Use the openFile function with highlighting
    const meta = fileList.get(path);
    const { fileCache } = getRepoState();
    let content = fileCache.get(path);

    if (!content && !meta.isLarge) {
        content = await fetchAndCacheFile(path);
    }

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

    // Highlight after a short delay to ensure DOM is ready
    setTimeout(() => {
        highlightLines(elements.fileContent, startLine, endLine || startLine);
    }, 100);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
