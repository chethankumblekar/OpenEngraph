# Token-Reduction Benchmark Results

Last run: 2026-08-04

Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question's keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).

| Question | Mode | OpenEngraph tokens | Baseline tokens | Reduction |
|---|---|---|---|---|
| What does hybridQuery call? | structural | 95 | 31774 | 99.7% |
| What does buildGraph call? | structural | 54 | 38308 | 99.9% |
| Where is embedding-based search implemented? | semantic | 269 | 42592 | 99.4% |
| How are CLI errors formatted for the user? | semantic | 221 | 11296 | 98% |
| How does the plugin loader validate a plugin manifest before loading it? | semantic | 244 | 22053 | 98.9% |
| What depends on the SQLite storage schema? | hybrid | 706 | 33929 | 97.9% |
| What code is involved in indexing a changed file? | hybrid | 815 | 40886 | 98% |
| What does the MCP server expose to AI assistants? | hybrid | 513 | 28564 | 98.2% |

**Average reduction across all 8 questions: 98.8%**
