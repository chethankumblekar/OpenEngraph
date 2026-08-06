# Token-Reduction Benchmark Results

Last run: 2026-08-06
Measured at commit: `f91b7e4b3c80a515adcdc9f47d0fc9db1a0f2e63` **(working tree dirty -- numbers may not be reproducible from this commit)**
Embedding model: `Xenova/all-MiniLM-L6-v2`

Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question's keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).

Baseline corpus: source files only. The grep runs with the pathspec exclusions `:!docs` `:!*.md` `:!benchmarks`, so this project's own Markdown -- design docs, plans, specs, `README.md` -- and the benchmark package itself are **not** counted. Those files are internal planning prose rather than code an agent would read to answer these questions; counting them would have inflated the measured baseline ~6.2x on aggregate (up to 50.3x on individual rows) in this run. Excluding `benchmarks/` also keeps runs idempotent, since `benchmarks/RESULTS.md` is git-tracked and contains every grep term used here.

Question provenance: 2 of the 8 questions below were revised after an initial run, disclosed here rather than left to be found in the git history. In both cases the initial phrasing produced a misleading *answer*, not an inconvenient percentage: the real answer ranked just outside the top-K cutoff used to seed semantic retrieval, so the published answer omitted the code that actually answers the question (the Go plugin's `extract()` at rank 6 of the "how does the Go plugin distinguish methods from functions" seed search, and `createMcpServer` at rank 8 of the "what does the MCP server expose to AI assistants" one). Both were reworded for answer relevance, not for score, and re-measuring the retired phrasings against this corpus (at commit `84e4333`, using the same `computeBaseline` and `QueryRouter` the table below uses) shows the swaps cost more than they gained. The retired Go question scores **100%** today -- its grep terms `method_declaration`/`function_declaration` match the tree-sitter `.wasm` grammars, giving it a 1.6M-token baseline -- against 78.4% for the plugin-manifest question that replaced it. The MCP rewording moved its own row the other way, 24% to 33.2%, by returning an answer that actually contains `createMcpServer`. Net across both, the revisions lower the headline from 85.5% to the 84.1% published here. In this run the 2 revised questions are the lowest-scoring rows in the table (78.4% and 33.2%), and the top-scoring row (99.5%, "What does buildGraph call?") is one of the 6 untouched questions. The other 6 questions are unchanged since they were first written.

| Question | Mode | OpenEngraph tokens | Baseline files | Baseline tokens | Reduction |
|---|---|---|---|---|---|
| What does hybridQuery call? | structural | 95 | 3 | 2093 | 95.5% |
| What does buildGraph call? | structural | 54 | 7 | 10137 | 99.5% |
| Where is embedding-based search implemented? | semantic | 268 | 14 | 9109 | 97.1% |
| How are CLI errors formatted for the user? | semantic | 221 | 3 | 1711 | 87.1% |
| How does the plugin loader validate a plugin manifest before loading it? | semantic | 244 | 3 | 1129 | 78.4% |
| What depends on the SQLite storage schema? | hybrid | 758 | 10 | 6585 | 88.5% |
| What code is involved in indexing a changed file? | hybrid | 815 | 11 | 12715 | 93.6% |
| How does the MCP server expose graph, semantic, and hybrid queries as tools? | hybrid | 451 | 3 | 675 | 33.2% |

**Average reduction across all 8 questions: 84.1%**
