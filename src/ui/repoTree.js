export function renderTree(fileList, fileTree, onFileClick) {
    const tree = {};

    for (const path of fileList.keys()) {
        const parts = path.split('/');
        let current = tree;
        for (const part of parts) {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
        current.__file = true;
        current.__path = path;
    }

    function renderNode(node, name, depth = 0) {
        const isFile = node.__file;
        const icon = isFile ? '📄' : '📁';

        const div = document.createElement('div');
        div.className = 'tree-item';
        div.style.paddingLeft = `${12 + depth * 12}px`;
        div.innerHTML = `<span class="tree-icon ${isFile ? '' : 'folder'}">${icon}</span> ${name}`;

        if (isFile) {
            div.addEventListener('click', () => onFileClick(node.__path));
        }

        fileTree.appendChild(div);

        // Recurse into subdirectories
        for (const [childName, childNode] of Object.entries(node)) {
            if (!childName.startsWith('__')) {
                renderNode(childNode, childName, depth + 1);
            }
        }
    }

    fileTree.innerHTML = '';
    for (const [name, node] of Object.entries(tree)) {
        renderNode(node, name);
    }
}

export function markFileAsLoaded(path, fileTree) {
    // Find the tree item with this path and add a visual indicator
    const items = fileTree.querySelectorAll('.tree-item');
    items.forEach(item => {
        const itemPath = item.textContent.trim().replace(/^📄\s*|^📁\s*/, '');
        if (itemPath === path || itemPath.endsWith('/' + path)) {
            item.style.opacity = '1';
        }
    });
}

export function clearTree(fileTree) {
    fileTree.innerHTML = '';
}
