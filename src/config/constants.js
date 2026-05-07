// ============================================
// API ENDPOINTS
// ============================================
export const CEREBRAS_ENDPOINT = 'https://api.cerebras.ai/v1/chat/completions';
export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const GITHUB_API_BASE = 'https://api.github.com/repos';

// ============================================
// MODEL NAMES
// ============================================
export const CEREBRAS_MODEL = 'llama3.1-8b';
export const GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';
export const GROQ_AUDITOR_MODEL = 'llama-3.1-8b-instant';
export const GROQ_SUMMARY_MODEL = 'llama-3.3-70b-versatile';

// ============================================
// TOKEN BUDGETS
// ============================================
export const MAX_TOKENS_PER_REQUEST = 10000;
export const TOKEN_BUDGETS = {
    readme: 1500,
    files: 6000,
    conversation: 1500,
    claims: 300,
    question: 200,
    systemPrompt: 500
};
export const AVG_CHARS_PER_TOKEN = 4;
export const MAX_FILE_TOKENS = 1500;

// ============================================
// VENDOR PATHS TO EXCLUDE
// ============================================
export const VENDOR_EXCLUDE_PATTERNS = [
    /^vendor\//,              // vendor/ directory
    /\/vendor\//,             // any path containing /vendor/
    /^node_modules\//,         // node_modules/ directory
    /\/node_modules\//,       // any path containing /node_modules/
    /^\.git\//,                // .git/ directory
    /\/\.git\//,               // any path containing /.git/
    /^dist\//,                 // dist/ directory
    /^build\//,                // build/ directory
    /^coverage\//,             // coverage/ directory
    /^\.vscode\//,             // .vscode/ directory
    /^\.idea\//,               // .idea/ directory
    /composer\.lock$/,        // composer.lock
    /package-lock\.json$/,    // package-lock.json
    /yarn\.lock$/,            // yarn.lock
    /\/language\/phpmailer\.lang-.*\.php$/, // PHPMailer language files
];

export const META_FILES_EXCLUDE = [
    'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COMMITMENT', 'SECURITY.md',
    'SMTPUTF8.md', 'VERSION', 'CHANGELOG.md', 'CHANGELOG', 'CONTRIBUTING.md'
];

export const VENDOR_DIRECTORIES = [
    'node_modules', '.git', 'dist', 'build', 'coverage', '.vscode', '.idea', 'vendor'
];

// ============================================
// LANGUAGE DETECTION
// ============================================
export const LANGUAGE_RULES = [
    { name: 'PHP', files: ['composer.json', 'composer.lock'], ext: '.php' },
    { name: 'Node.js', files: ['package.json', 'package-lock.json'], ext: '.js' },
    { name: 'Python', files: ['requirements.txt', 'pyproject.toml', 'setup.py'], ext: '.py' },
    { name: 'Go', files: ['go.mod', 'go.sum'], ext: '.go' },
    { name: 'Ruby', files: ['Gemfile', 'Gemfile.lock'], ext: '.rb' },
    { name: 'Java', files: ['pom.xml', 'build.gradle'], ext: '.java' }
];

export const LANGUAGE_CONFIGS = {
    'PHP': ['composer.json', 'composer.lock'],
    'Node.js': ['package.json', 'package-lock.json'],
    'Python': ['requirements.txt', 'pyproject.toml', 'setup.py'],
    'Go': ['go.mod', 'go.sum'],
    'Ruby': ['Gemfile', 'Gemfile.lock'],
    'Java': ['pom.xml', 'build.gradle'],
    'Unknown': ['package.json', 'requirements.txt', 'go.mod', 'Gemfile', 'pom.xml']
};

export const COMMON_CONFIGS = [
    'README.md', 'README', 'Dockerfile', 'docker-compose.yml',
    '.gitignore', 'Makefile', 'tsconfig.json'
];

export const SUPPORTED_CODE_EXTENSIONS = [
    '.js', '.ts', '.jsx', '.tsx', '.php', '.py', '.go', '.rb', '.java',
    '.c', '.cpp', '.h', '.rs', '.swift', '.kt', '.scala'
];

// ============================================
// TECHNICAL KEYWORDS FOR FILE SCORING
// ============================================
export const TECH_KEYWORDS = [
    'auth', 'login', 'logout', 'middleware', 'database', 'db', 'api', 'route',
    'router', 'controller', 'model', 'view', 'component', 'service', 'handler',
    'utils', 'helper', 'config', 'settings', 'env', 'environment', 'test', 'spec',
    'async', 'await', 'promise', 'error', 'catch', 'try', 'signup', 'register',
    'delete', 'remove', 'fetch', 'get', 'post', 'put', 'patch', 'create', 'update',
    'read', 'write', 'import', 'export', 'default', 'class', 'function', 'const',
    'let', 'var'
];

// ============================================
// BINARY FILE EXTENSIONS
// ============================================
export const BINARY_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf',
    '.eot', '.mp3', '.mp4', '.pdf', '.zip', '.tar', '.gz'
];

// ============================================
// README VARIANTS
// ============================================
export const README_VARIANTS = [
    'README.md', 'readme.md', 'Readme.md', 'README.MD',
    'README.rst', 'README.txt'
];

// ============================================
// CONVERSATION SETTINGS
// ============================================
export const MAX_CONVERSATION_HISTORY = 6; // Last 3 turns (user + assistant each)
export const CLAIMS_TO_SHOW = 5;
export const SUMMARY_INTERVAL = 5; // Generate summary every N turns
export const MAX_FILE_SIZE = 500000; // 500KB

// ============================================
// AUDIT TRUST LEVELS
// ============================================
export const TRUST_LEVELS = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
};
