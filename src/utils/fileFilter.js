import {
    VENDOR_EXCLUDE_PATTERNS,
    META_FILES_EXCLUDE,
    VENDOR_DIRECTORIES,
    BINARY_EXTENSIONS,
    SUPPORTED_CODE_EXTENSIONS
} from '../config/constants.js';

export function isVendorFile(path) {
    // Check vendor patterns
    for (const pattern of VENDOR_EXCLUDE_PATTERNS) {
        if (pattern.test(path)) return true;
    }

    // Check meta files (exclude unless root-level)
    const filename = path.split('/').pop();
    if (META_FILES_EXCLUDE.includes(filename) && path.includes('/')) {
        return true;
    }

    return false;
}

export function isVendorContent(path) {
    return isVendorFile(path) || path.startsWith('vendor/') || path.includes('/vendor/');
}

export function isVendorDirectory(dirName) {
    return VENDOR_DIRECTORIES.includes(dirName);
}

export function isBinaryFile(filename) {
    return BINARY_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

export function isCodeFile(path) {
    return SUPPORTED_CODE_EXTENSIONS.some(ext => path.toLowerCase().endsWith(ext));
}

export function isCoreFile(path) {
    return !isVendorFile(path);
}

export function filterVendor(fileList) {
    const filtered = new Map();
    for (const [path, meta] of fileList) {
        if (!isVendorFile(path)) {
            filtered.set(path, meta);
        }
    }
    return filtered;
}

export function splitFileList(fileList) {
    const coreFiles = new Map();
    const vendorFiles = new Map();

    for (const [path, meta] of fileList) {
        if (isVendorFile(path)) {
            vendorFiles.set(path, meta);
        } else {
            coreFiles.set(path, meta);
        }
    }

    return { coreFiles, vendorFiles };
}
