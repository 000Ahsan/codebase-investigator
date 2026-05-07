import { fetchRepoTree, fetchFileContent, findReadme } from '../api/github.js';
import { detect } from '../utils/languageDetector.js';

let repo = null;
let coreFileList = new Map();
let allFileList = new Map();
let fileCache = new Map();
let detectedLanguage = null;
let repoReadme = null;

export async function loadRepo(githubUrl) {
    const match = githubUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
        throw new Error('Invalid GitHub URL. Format: github.com/owner/repo');
    }

    const [, owner, rawRepo] = match;
    const repoName = rawRepo.replace(/\.git$/, '');
    repo = { owner, repo: repoName };

    // Fetch repository structure
    const { coreFiles, allFiles } = await fetchRepoTree(owner, repoName);
    coreFileList = coreFiles;
    allFileList = allFiles;
    fileCache.clear();

    // Detect language from core files
    const langInfo = detect(coreFileList);
    detectedLanguage = langInfo.name;

    // Find and fetch README
    const readmePath = findReadme(coreFileList);
    if (readmePath) {
        repoReadme = await fetchFileContent(readmePath, coreFileList, fileCache);
    } else {
        repoReadme = null;
    }

    return {
        repo,
        coreFileList,
        allFileList,
        fileCache,
        detectedLanguage,
        langInfo,
        repoReadme,
        readmePath
    };
}

export function getRepoState() {
    return {
        repo,
        coreFileList,
        allFileList,
        fileCache,
        detectedLanguage,
        repoReadme
    };
}

export function getFileContent(path) {
    return fileCache.get(path) || null;
}

export async function fetchAndCacheFile(path) {
    const content = await fetchFileContent(path, coreFileList, fileCache);
    return content;
}

export function getFileMeta(path) {
    return coreFileList.get(path) || null;
}

export function fileExists(path) {
    return coreFileList.has(path);
}

export function findFilePath(fileName) {
    // Try exact match first
    if (coreFileList.has(fileName)) return fileName;

    // Try basename match
    for (const path of coreFileList.keys()) {
        if (path.endsWith('/' + fileName) || path === fileName) {
            return path;
        }
    }

    // Try partial match
    for (const path of coreFileList.keys()) {
        if (path.includes(fileName)) {
            return path;
        }
    }

    return null;
}

export function reset() {
    repo = null;
    coreFileList = new Map();
    allFileList = new Map();
    fileCache = new Map();
    detectedLanguage = null;
    repoReadme = null;
}
