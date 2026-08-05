import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '@openengraph/core/storage/db.js';
import { QueryRouter } from '@openengraph/core/query/router.js';
import { countTokens } from './tokenCount.js';
import { computeBaseline, computeUnfilteredBaseline, BASELINE_EXCLUDED_PATHSPECS } from './baseline.js';
import { BENCHMARK_QUESTIONS, REVISED_QUESTION_IDS } from './queries.js';

/**
 * Kept in sync with `getExtractor()` in `core/src/embeddings/index.ts`. Recorded
 * in RESULTS.md because every semantic and hybrid row depends on it: a
 * different model reranks the seed search and changes the published numbers.
 */
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const thisDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(thisDir, '..', '..'); // benchmarks/src -> benchmarks -> repo root
const cliEntry = join(repoRoot, 'cli', 'dist', 'index.js');

interface RowResult {
  id: string;
  question: string;
  mode: string;
  openEngraphTokens: number;
  baselineFileCount: number;
  baselineTokens: number;
  /** Same grep terms with no path exclusions — only used to derive the live "how much did excluding docs/benchmarks shrink this?" figures below, never published as its own column. */
  unfilteredBaselineTokens: number;
  reductionPct: number;
}

/**
 * `npm run run -w benchmarks` builds only the benchmarks package, but this
 * script shells out to the compiled CLI. On a fresh clone that file does not
 * exist yet, and without this check the failure surfaces as an opaque
 * `Cannot find module` from the spawned node process. Fail fast with the fix.
 */
function requireBuiltCli(): void {
  if (existsSync(cliEntry)) return;
  console.error(
    `cli/dist/index.js not found -- run \`npm run build\` at the repo root first, then re-run this benchmark.\n` +
      `(Looked for: ${cliEntry})\n` +
      'The benchmark indexes this repository through the real CLI, so `cli` and its dependencies must be compiled;\n' +
      '`npm run run -w benchmarks` builds only the benchmarks package itself.'
  );
  process.exit(1);
}

async function main(): Promise<void> {
  requireBuiltCli();

  // Captured before indexing so RESULTS.md records exactly the tree the
  // numbers were measured on. A dirty tree is recorded explicitly rather than
  // silently publishing a SHA that does not correspond to the code that ran.
  // RESULTS.md itself is excluded from this check: it is this script's own
  // output, always about to be overwritten by the current run, so it being
  // uncommitted relative to its *previous* content is not a reproducibility
  // problem -- only uncommitted changes to the code that produced the
  // numbers are.
  const commit = git(['rev-parse', 'HEAD']);
  const dirty = git(['status', '--porcelain', '--', '.', ':!benchmarks/RESULTS.md']).length > 0;

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

    // An empty baseline means the grep terms matched nothing -- a broken
    // question or a broken corpus filter, not a real 0% result. Fail loudly
    // rather than publish a meaningless row.
    if (baselineTokens === 0) {
      throw new Error(
        `Baseline for "${q.id}" is empty: grep terms [${q.grepTerms.join(', ')}] matched no file. ` +
          'Refusing to publish a 0% row -- fix the question or the corpus exclusions.'
      );
    }

    const unfilteredBaselineTokens = computeUnfilteredBaseline(repoRoot, q.grepTerms).tokenCount;
    const reductionPct = Math.round((1 - openEngraphTokens / baselineTokens) * 1000) / 10;

    rows.push({
      id: q.id,
      question: q.question,
      mode: q.mode,
      openEngraphTokens,
      baselineFileCount: baseline.files.length,
      baselineTokens,
      unfilteredBaselineTokens,
      reductionPct
    });
    console.log(`${q.id}: OpenEngraph=${openEngraphTokens} baseline=${baselineTokens} reduction=${reductionPct}%`);
  }

  db.close();
  writeResults(rows, commit, dirty);
}

/**
 * The question-provenance disclosure. Counts (`N of M revised`, `K
 * untouched`) are always derived from `REVISED_QUESTION_IDS.length` and
 * `rows.length`, never hand-typed, so they can't silently go stale if that
 * list ever changes. The specific historical narrative below it (the Go and
 * MCP rewordings, their retired scores, commit `84e4333`) documents one
 * specific past event and is not re-derivable in general -- there is no way
 * to recompute "what would a retired question score today" without the
 * retired code, so if a *third* question is ever revised, this paragraph's
 * narrative sentences need a manual update alongside `REVISED_QUESTION_IDS`,
 * same as any other changelog entry. What's guaranteed to stay accurate on
 * its own is the placement/ranking claim, computed fresh from this run.
 */
function describeQuestionProvenance(rows: RowResult[], avgReduction: number): string {
  const revisedCount = REVISED_QUESTION_IDS.length;
  const untouchedCount = rows.length - revisedCount;

  if (revisedCount === 0) {
    return `Question provenance: none of the ${rows.length} questions below have been revised since they were first written.`;
  }

  const byReduction = [...rows].sort((a, b) => b.reductionPct - a.reductionPct);
  const revised = byReduction.filter((r) => REVISED_QUESTION_IDS.includes(r.id));
  const ranks = revised.map((r) => byReduction.indexOf(r) + 1);
  const allAtBottom = ranks.every((rank) => rank > rows.length - revised.length);
  const placement = allAtBottom
    ? 'the lowest-scoring rows in the table'
    : `ranked #${ranks.join(' and #')} of ${rows.length} by reduction`;

  const top = byReduction[0];
  const topIsRevised = REVISED_QUESTION_IDS.includes(top.id);
  const rankingClaim =
    `In this run the ${revisedCount === 1 ? 'revised question is' : `${revisedCount} revised questions are`} ${placement} ` +
    `(${revised.map((r) => `${r.reductionPct}%`).join(' and ')}), and the top-scoring row ` +
    `(${top.reductionPct}%, "${top.question}") is ` +
    `${topIsRevised ? '**one of the revised questions**.' : `one of the ${untouchedCount} untouched questions.`}`;

  return (
    `Question provenance: ${revisedCount} of the ${rows.length} questions below were revised after an initial run, ` +
    'disclosed here rather than left to be found in the git history. In both cases the initial phrasing produced a ' +
    'misleading *answer*, not an inconvenient percentage: the real answer ranked just outside the top-K cutoff used ' +
    'to seed semantic retrieval, so the published answer omitted the code that actually answers the question (the ' +
    'Go plugin\'s `extract()` at rank 6 of the "how does the Go plugin distinguish methods from functions" seed ' +
    'search, and `createMcpServer` at rank 8 of the "what does the MCP server expose to AI assistants" one). Both ' +
    'were reworded for answer relevance, not for score, and re-measuring the retired phrasings against this corpus ' +
    '(at commit `84e4333`, using the same `computeBaseline` and `QueryRouter` the table below uses) shows the swaps ' +
    'cost more than they gained. The retired Go question scores **100%** today -- its grep terms ' +
    '`method_declaration`/`function_declaration` match the tree-sitter `.wasm` grammars, giving it a 1.6M-token ' +
    'baseline -- against 78.4% for the plugin-manifest question that replaced it. The MCP rewording moved its own ' +
    'row the other way, 24% to 33.2%, by returning an answer that actually contains `createMcpServer`. Net across ' +
    `both, the revisions lower the headline from 85.5% to the ${avgReduction}% published here. ` +
    `${rankingClaim} The other ${untouchedCount} question${untouchedCount === 1 ? '' : 's'} ${
      untouchedCount === 1 ? 'is' : 'are'
    } unchanged since ${untouchedCount === 1 ? 'it was' : 'they were'} first written.`
  );
}

function writeResults(rows: RowResult[], commit: string, dirty: boolean): void {
  const avgReduction = Math.round((rows.reduce((sum, r) => sum + r.reductionPct, 0) / rows.length) * 10) / 10;
  const date = new Date().toISOString().slice(0, 10);

  // Computed from this run's actual numbers, not hand-typed, so this figure
  // can't silently understate itself as the corpus grows (it did: an earlier
  // draft said "up to 40x", measured against a smaller docs/ tree than the
  // one any later run -- including this one -- actually has).
  const totalFiltered = rows.reduce((sum, r) => sum + r.baselineTokens, 0);
  const totalUnfiltered = rows.reduce((sum, r) => sum + r.unfilteredBaselineTokens, 0);
  const aggregateContaminationRatio = Math.round((totalUnfiltered / totalFiltered) * 10) / 10;
  const maxRowContaminationRatio =
    Math.round(Math.max(...rows.map((r) => r.unfilteredBaselineTokens / r.baselineTokens)) * 10) / 10;

  const lines = [
    '# Token-Reduction Benchmark Results',
    '',
    `Last run: ${date}`,
    `Measured at commit: \`${commit}\`${dirty ? ' **(working tree dirty -- numbers may not be reproducible from this commit)**' : ''}`,
    `Embedding model: \`${EMBEDDING_MODEL}\``,
    '',
    'Methodology: indexes this repository via `openengraph index`, answers each question through `QueryRouter` (the same API the MCP server uses), and compares the token cost of that answer against a simulated naive-agent baseline (`git grep -l` for the question\'s keywords, then the full content of every matching file). Tokens counted with `gpt-tokenizer` (cl100k_base).',
    '',
    `Baseline corpus: source files only. The grep runs with the pathspec exclusions \`${BASELINE_EXCLUDED_PATHSPECS.join(
      '` `'
    )}\`, so this project's own Markdown -- design docs, plans, specs, \`README.md\` -- and the benchmark package itself are **not** counted. Those files are internal planning prose rather than code an agent would read to answer these questions; counting them would have inflated the measured baseline ~${aggregateContaminationRatio}x on aggregate (up to ${maxRowContaminationRatio}x on individual rows) in this run. Excluding \`benchmarks/\` also keeps runs idempotent, since \`benchmarks/RESULTS.md\` is git-tracked and contains every grep term used here.`,
    '',
    describeQuestionProvenance(rows, avgReduction),
    '',
    '| Question | Mode | OpenEngraph tokens | Baseline files | Baseline tokens | Reduction |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.question} | ${r.mode} | ${r.openEngraphTokens} | ${r.baselineFileCount} | ${r.baselineTokens} | ${r.reductionPct}% |`
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
