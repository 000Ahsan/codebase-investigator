# Codebase Investigator

An AI-powered tool that investigates GitHub repositories and answers questions about their codebase with citations to specific files and line numbers. Every answer is audited by a separate AI for accuracy and completeness.

![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF?logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)

## Features

- **Dual AI Architecture**: Uses Cerebras (llama3.1-8b) as primary investigator with Groq (llama-3.3-70b-versatile) as fallback
- **AI Auditing**: Every answer is cross-checked by a separate Groq-based auditor for citation accuracy, logic soundness, and contradictions
- **README-First Intelligence**: Prioritizes README content for answers before analyzing raw code
- **File Existence Guard**: Only references files that actually exist in the repository (numbered file list)
- **Smart Token Budgeting**: Enforces 10K token limit with allocation: 500 system, 1500 README, 6000 files, 1500 conversation, 300 claims
- **Vendor Filtering**: Automatically excludes vendor, node_modules, and lock files from context
- **Clickable Citations**: Click any `[file:lines]` citation to open the file viewer at the exact line
- **Claim Tracking**: Maintains a claim log across conversation turns for consistency
- **Language Detection**: Auto-detects project language from dependency files (composer.json, package.json, etc.)

## API Requirements

The app requires two AI APIs (free tiers available):

| Provider | Purpose | Free Tier | Get Key |
|----------|---------|-----------|---------|
| **Cerebras** | Primary Investigator | 60,000 TPM | [cloud.cerebras.ai](https://cloud.cerebras.ai) |
| **Groq** | Fallback + Auditor | 12,000 TPM | [console.groq.com](https://console.groq.com/keys) |

Optional: GitHub token for higher rate limits and private repositories.

## Installation

```bash
# Clone the repository
git clone https://github.com/000Ahsan/codebase-investigator.git
cd codebase-investigator

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173/`.

## Usage

1. **Enter a GitHub URL** in the header input (e.g., `github.com/owner/repo`)
2. **Configure API Keys** by clicking the "⚙️ API Keys" button
   - Add your Cerebras API key (primary)
   - Add your Groq API key (fallback + auditor)
   - Optionally add GitHub token for private repos
3. **Ask Questions** about the codebase
   - The investigator will cite specific files and line numbers
   - Click citations to view the source code
   - Review the audit panel under each answer for trust verification

## Project Structure

```
codebase-investigator/
├── src/
│   ├── api/              # API clients
│   │   ├── github.js     # GitHub API integration
│   │   ├── investigator.js # Cerebras/Groq investigator
│   │   └── auditor.js    # Groq audit logic
│   ├── config/
│   │   └── constants.js  # Token budgets, model names, vendor patterns
│   ├── core/             # Core business logic
│   │   ├── repoLoader.js # Repository loading
│   │   ├── contextBuilder.js # Token budgeting & context assembly
│   │   ├── claimLog.js   # Claim tracking
│   │   └── conversationManager.js # Chat history & summarization
│   ├── ui/               # UI rendering modules
│   │   ├── chat.js       # Message rendering
│   │   ├── auditPanel.js # Audit display
│   │   ├── fileViewer.js # Source code viewer
│   │   ├── repoTree.js   # File tree sidebar
│   │   └── repoSummaryCard.js # README summary
│   ├── utils/            # Utilities
│   │   ├── tokenCounter.js
│   │   ├── languageDetector.js
│   │   └── fileFilter.js
│   ├── styles/
│   │   └── main.css      # Dark theme styles
│   └── main.js           # App entry point
├── index.html            # HTML skeleton
├── package.json          # Vite project config
└── vite.config.js        # Vite build config
```

## Key Technical Details

### Token Budgeting Strategy
- **System Prompt**: 500 tokens (investigator instructions)
- **README**: 1500 tokens (always included first for project context)
- **Files**: 6000 tokens (scored by keyword relevance, truncated at 1500 tokens/file)
- **Conversation**: 1500 tokens (last 3 turns, with auto-summarization every 5 turns)
- **Claims**: 300 tokens (last 5 claims for consistency)
- **Question**: 200 tokens (user input)
- **Total Hard Cap**: ~10,000 tokens

### Cerebras → Groq Fallback
When Cerebras hits rate limits or errors:
1. A "⚡ Using Groq fallback" indicator appears
2. The request automatically retries with Groq
3. Both APIs use the same prompt structure for consistency

### Vendor File Exclusions
The following are automatically excluded from context:
- `vendor/` and `node_modules/` directories
- `.git/`, `dist/`, `build/`, `coverage/` directories
- Lock files: `composer.lock`, `package-lock.json`, `yarn.lock`
- Binary files: images, fonts, archives
- Meta files (unless root): `LICENSE`, `CHANGELOG.md`, etc.

### Citation Format
The investigator generates citations in the format:
```
[filename:23-45]
```

Clicking opens the file viewer with lines 23-45 highlighted in yellow.

## Development

### Build for production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

### Environment Variables
Copy `.env.example` to `.env` and add your keys:
```bash
cp .env.example .env
```

Note: In the browser environment, API keys are stored in `localStorage` for persistence across refreshes.

## License

MIT
