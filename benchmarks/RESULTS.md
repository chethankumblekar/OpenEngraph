# Token-Reduction Benchmark Results

Last run: 2026-08-04
Measured at commit: `7d0d20c63ccfa2a9baaf06ec59fea8790626e964`
Embedding model: `Xenova/all-MiniLM-L6-v2`

Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question's keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).

Baseline corpus: source files only. The grep runs with the pathspec exclusions `:!docs` `:!*.md` `:!benchmarks`, so this project's own Markdown -- design docs, plans, specs, `README.md` -- and the benchmark package itself are **not** counted. Those files are internal planning prose rather than code an agent would read to answer these questions; counting them roughly tripled the measured baseline. Excluding `benchmarks/` also keeps runs idempotent, since `benchmarks/RESULTS.md` is git-tracked and contains every grep term used here.

| Question | Mode | OpenEngraph tokens | Baseline files | Baseline tokens | Reduction |
|---|---|---|---|---|---|
| What does hybridQuery call? | structural | 95 | 3 | 2093 | 95.5% |
| What does buildGraph call? | structural | 54 | 6 | 8627 | 99.4% |
| Where is embedding-based search implemented? | semantic | 268 | 14 | 8377 | 96.8% |
| How are CLI errors formatted for the user? | semantic | 221 | 3 | 1711 | 87.1% |
| How does the plugin loader validate a plugin manifest before loading it? | semantic | 244 | 3 | 1129 | 78.4% |
| What depends on the SQLite storage schema? | hybrid | 706 | 10 | 6040 | 88.3% |
| What code is involved in indexing a changed file? | hybrid | 815 | 10 | 11205 | 92.7% |
| How does the MCP server expose graph, semantic, and hybrid queries as tools? | hybrid | 451 | 3 | 675 | 33.2% |

**Average reduction across all 8 questions: 83.9%**
