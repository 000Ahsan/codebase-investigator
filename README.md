# Codebase Investigator

A browser-based AI agent for investigating public GitHub repositories through plain English conversation. Every answer is grounded in real files and line numbers, and independently audited by a second AI model.

## How It Works

Paste a public GitHub URL, ask questions about the code, and get answers with specific file and line citations. A separate auditor model then reviews every answer for hallucinated citations, logical gaps, and whether suggested fixes would break anything else.

## Stack

- **Frontend**: Vite + Vanilla JS (deploys as static files)
- **Investigator**: Cerebras API — cycles through 4 models on rate limit
- **Auditor**: Groq API — llama-3.1-8b-instant (independent model)
- **Code Source**: GitHub REST API (public repos, no auth needed)

## Investigator Model Chain (Cerebras)

Automatically tries these models in order if rate limited:
1. llama3.1-8b (primary)
2. gpt-oss-120b (fallback 2)
3. qwen-3-235b-a22b-instruct-2507 (fallback 3)
4. zai-glm-4.7 (fallback 4)

## Auditor Model (Groq)

llama-3.1-8b-instant — separate model, separate API, separate prompt. No self-scoring.

## Key Features

- Automatic language detection (PHP, JS, Python, Go, Ruby, Java)
- File existence guard — model can only cite real files
- README-first context strategy for accurate common answers
- Running claim log to catch contradictions across turns
- Smart 10K token budget per request
- 4-model Cerebras fallback chain for high availability
- Color coded audit results (HIGH / MEDIUM / LOW trust)
- Clickable citations open file viewer at exact line

## API Keys Required

| Key | Where to get | Used for |
|-----|-------------|---------|
| Cerebras | cloud.cerebras.ai | Investigation (free) |
| Groq | console.groq.com | Auditing (free) |

Both are free with no credit card required.

## Getting Started

```bash
npm install
npm run dev
```

Then open http://localhost:5173, enter your API keys, paste a GitHub URL and start investigating.

## Deploy

```bash
npm run build
# Upload dist/ folder to Vercel, Netlify, or any static host
```

## Limitations

- Public repos only (no OAuth yet)
- Cerebras free tier: 1M tokens/day, 8K context cap
- Groq free tier: limited tokens per minute for auditing
- Keyword-based file search (no semantic embeddings yet)

## Future Improvements

- GitHub OAuth for private repos
- Semantic file search using embeddings
- Persistent sessions via IndexedDB
- Diff viewer for suggested code changes
- Export conversation and audit trail as PDF

## License

MIT
