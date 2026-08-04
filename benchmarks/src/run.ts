import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { QueryRouter } from '@openengraph/core/query/router.js';
import { countTokens } from './tokenCount.js';
import { computeBaseline } from './baseline.js';
import { BENCHMARK_QUESTIONS } from './queries.js';

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, '..', '..'); // benchmarks/src -> benchmarks -> repo root
const cliEntry = join(repoRoot, 'cli', 'dist', 'index.js');

interface RowResult {
  id: string;
  question: string;
  mode: string;
  openEngraphTokens: number;
  baselineTokens: number;
  reductionPct: number;
}

async function main(): Promise<void> {
  console.log(`Indexing ${repoRoot} via the real CLI...`);
  execFileSync('node', [cliEntry, 'index', repoRoot], { cwd: repoRoot, stdio: 'inherit' });

  const db = openDatabase(join(repoRoot, '.openengraph', 'graph.db'));
  const router = new QueryRouter(db);

  const rows: RowResult[] = [];
  for (const q of BENCHMARK_QUESTIONS) {
    const answer = await q.resolve(router, db);
    const openEngraphTokens = countTokens(JSON.stringify(answer));

    const baseline = computeBaseline(repoRoot, q.grepTerms);
    const baselineTokens = baseline.tokenCount;

    const reductionPct = baselineTokens === 0 ? 0 : Math.round((1 - openEngraphTokens / baselineTokens) * 1000) / 10;

    rows.push({ id: q.id, question: q.question, mode: q.mode, openEngraphTokens, baselineTokens, reductionPct });
    console.log(`${q.id}: OpenEngraph=${openEngraphTokens} baseline=${baselineTokens} reduction=${reductionPct}%`);
  }

  db.close();
  writeResults(rows);
}

function writeResults(rows: RowResult[]): void {
  const avgReduction = Math.round((rows.reduce((sum, r) => sum + r.reductionPct, 0) / rows.length) * 10) / 10;
  const date = new Date().toISOString().slice(0, 10);

  const lines = [
    '# Token-Reduction Benchmark Results',
    '',
    `Last run: ${date}`,
    '',
    'Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question\'s keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).',
    '',
    '| Question | Mode | OpenEngraph tokens | Baseline tokens | Reduction |',
    '|---|---|---|---|---|',
    ...rows.map(
      (r) => `| ${r.question} | ${r.mode} | ${r.openEngraphTokens} | ${r.baselineTokens} | ${r.reductionPct}% |`
    ),
    '',
    `**Average reduction across all ${rows.length} questions: ${avgReduction}%**`,
    ''
  ];

  writeFileSync(join(repoRoot, 'benchmarks', 'RESULTS.md'), lines.join('\n'));
  console.log(`\nWrote benchmarks/RESULTS.md (average reduction: ${avgReduction}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
