import { LANGUAGE_RULES, LANGUAGE_CONFIGS, COMMON_CONFIGS } from '../config/constants.js';

export function detect(fileList) {
    const paths = Array.from(fileList.keys());

    for (const lang of LANGUAGE_RULES) {
        // Check for dependency files
        for (const file of lang.files) {
            if (paths.some(p => p.toLowerCase().endsWith(file.toLowerCase()))) {
                return { name: lang.name, dependencyFile: file };
            }
        }
        // Check for source files in root or src/
        const hasSource = paths.some(p => {
            const isRoot = !p.includes('/') && p.toLowerCase().endsWith(lang.ext);
            const inSrc = p.toLowerCase().startsWith('src/') && p.toLowerCase().endsWith(lang.ext);
            return isRoot || inSrc;
        });
        if (hasSource) {
            return { name: lang.name, dependencyFile: lang.files[0] };
        }
    }
    return { name: 'Unknown', dependencyFile: null };
}

export function getDependencyFiles(language) {
    const langSpecific = LANGUAGE_CONFIGS[language || 'Unknown'] || LANGUAGE_CONFIGS['Unknown'];
    return [...langSpecific, ...COMMON_CONFIGS];
}

export function getLanguageConfig(language) {
    return LANGUAGE_CONFIGS[language || 'Unknown'] || LANGUAGE_CONFIGS['Unknown'];
}
