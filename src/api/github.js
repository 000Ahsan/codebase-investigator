import { GITHUB_API_BASE, BINARY_EXTENSIONS, MAX_FILE_SIZE } from '../config/constants.js';
import { isBinaryFile, isVendorDirectory, isVendorFile, isVendorContent } from '../utils/fileFilter.js';

function getGithubKey() {
    return localStorage.getItem('github_token') || '';
}

export async function fetchRepoTree(owner, repo) {
    const allFiles = new Map();
    const coreFiles = new Map();
    const headers = {};
    const token = getGithubKey();
    if (token) {
        headers.Authorization = `token ${token}`;
    }

    await fetchRepoStructureRecursive(owner, repo, '', headers, allFiles, coreFiles);

    return { allFiles, coreFiles };
}

async function fetchRepoStructureRecursive(owner, repo, path, headers, allFiles, coreFiles) {
    const response = await fetch(
        `${GITHUB_API_BASE}/${owner}/${repo}/contents/${path}`,
        { headers }
    );

    if (response.status === 403) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        if (resetTime) {
            const resetDate = new Date(resetTime * 1000);
            throw new Error(`rate limit — resets at ${resetDate.toLocaleTimeString()}`);
        }
        throw new Error('rate limit');
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const items = await response.json();

    for (const item of items) {
        if (item.type === 'file') {
            // Skip binary files
            if (isBinaryFile(item.name)) {
                continue;
            }

            const meta = {
                size: item.size,
                downloadUrl: item.download_url,
                fetched: false,
                isLarge: item.size > MAX_FILE_SIZE
            };

            // Always add to allFiles
            allFiles.set(item.path, meta);

            // Only add to coreFiles if not a vendor file
            if (!isVendorFile(item.path)) {
                coreFiles.set(item.path, meta);
            }
        } else if (item.type === 'dir') {
            // Skip vendor directories entirely (don't even recurse)
            if (isVendorDirectory(item.name)) {
                continue;
            }

            await fetchRepoStructureRecursive(owner, repo, item.path, headers, allFiles, coreFiles);
        }
    }
}

export async function fetchFileContent(path, fileList, fileCache) {
    // NEVER fetch vendor file content
    if (isVendorContent(path)) {
        console.log(`Blocked vendor file: ${path}`);
        return null;
    }

    const meta = fileList.get(path);
    if (!meta) return null;

    // Check cache first
    if (fileCache.has(path)) {
        return fileCache.get(path);
    }

    const headers = {};
    const token = getGithubKey();
    if (token) {
        headers.Authorization = `token ${token}`;
    }

    try {
        const response = await fetch(meta.downloadUrl, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const content = await response.text();

        // Cache the content
        fileCache.set(path, content);
        meta.fetched = true;
        return content;
    } catch (e) {
        console.error(`Failed to fetch ${path}:`, e);
        return null;
    }
}

export function findReadme(fileList) {
    const README_VARIANTS = [
        'README.md', 'readme.md', 'Readme.md', 'README.MD',
        'README.rst', 'README.txt'
    ];

    for (const variant of README_VARIANTS) {
        // Check root level only
        if (fileList.has(variant)) {
            return variant;
        }
        // Check without case sensitivity
        for (const path of fileList.keys()) {
            if (path.toLowerCase() === variant.toLowerCase() && !path.includes('/')) {
                return path;
            }
        }
    }
    return null;
}

export function findFilePath(fileName, fileList) {
    // Try exact match first
    if (fileList.has(fileName)) return fileName;

    // Try basename match
    for (const path of fileList.keys()) {
        if (path.endsWith('/' + fileName) || path === fileName) {
            return path;
        }
    }

    // Try partial match
    for (const path of fileList.keys()) {
        if (path.includes(fileName)) {
            return path;
        }
    }

    return null;
}
