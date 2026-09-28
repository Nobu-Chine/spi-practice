// 問題の自動チェック係。全分野の問題を大量に作り、検査の決まり（check-rules.js）に通して、おかしな問題がないか確かめる。
// 最初に check-selftest.js で検査の決まり自体を確かめる。アプリ本体と同じ generators/・choices.js を使うので、本番と同じ問題を確かめられる。
//
// 使い方： node tests/check.js          … 全分野をチェックし、見本は全分野から
//         node tests/check.js profit   … 全分野をチェックし、見本は損益算だけ
//         node tests/check.js speed-travelers … 見本を旅人算のテンプレートだけに絞る
import { categories, generateProblem } from '../js/generators/index.js';
import { buildChoices } from '../js/core/choices.js';
import { createRandom } from '../js/core/random.js';
import { formatValue } from '../js/core/format.js';
import { checkProblem, checkAskText, lineText } from './check-rules.js';
import { runSelfTest } from './check-selftest.js';

const RUNS = 1000;
const SAMPLE_COUNT = 5;

// まず検査の決まり自体がゆるくなっていないかを確かめる（わざと壊した問題が NG になるか）
const selftest = runSelfTest();
console.log(`=== 検査の決まりの自己チェック：${selftest.total}件中 ${selftest.total - selftest.failures.length}件が期待どおり ===`);
for (const f of selftest.failures) console.log(`× ${f.name}（期待：${f.expected}）→ ${f.errors.join(' / ') || 'NGなし'}`);

let totalFailures = 0;
const rows = [];

categories.forEach((category, ci) => {
  category.templates.forEach((template, ti) => {
    for (const calculator of [false, true]) {
      let ok = 0;
      let fillerCount = 0;
      const failures = [];
      for (let i = 0; i < RUNS; i++) {
        // 失敗したときに同じ問題を再現できるよう、1問ごとに seed を決めておく
        const seed = (ci + 1) * 1_000_000 + ti * 100_000 + (calculator ? 50_000 : 0) + i;
        const rand = createRandom(seed);
        const q = buildChoices(template.generate(rand, { calculator }), rand);
        const errors = [...checkProblem(template, q, { calculator }), ...checkAskText(category, q)];
        if (errors.length) failures.push({ seed, errors, text: q.text });
        else ok++;
        fillerCount += q.choices.filter((c, idx) => idx !== q.answerIndex && c.mistake === null).length;
      }
      totalFailures += failures.length;
      rows.push({
        分野: category.label,
        テンプレート: template.id,
        電卓: calculator ? 'あり' : 'なし',
        OK: ok,
        NG: failures.length,
        '誤答のうちミス由来': `${Math.round((1 - fillerCount / (RUNS * 3)) * 100)}%`,
      });
      for (const f of failures.slice(0, 3)) {
        console.log(`NG seed=${f.seed} ${template.id}: ${f.text}`);
        for (const e of f.errors) console.log(`   - ${e}`);
      }
    }
  });
});

console.log(`\n=== チェック結果（各 ${RUNS} 問） ===`);
console.table(rows);
console.log(totalFailures === 0 ? '→ すべてOK' : `→ NG が ${totalFailures} 件あります`);

// テンプレートの出やすさ（weight）どおりに出ているか：各分野で1万問作って割合を数える
console.log('\n=== テンプレートの出る割合（各分野1万問） ===');
const weightRand = createRandom(1);
for (const category of categories.filter((c) => c.templates.some((t) => t.weight))) {
  const counts = Object.fromEntries(category.templates.map((t) => [t.id, 0]));
  for (let i = 0; i < 10000; i++) counts[generateProblem(category.id, weightRand, { calculator: false }).templateId]++;
  const totalWeight = category.templates.reduce((sum, t) => sum + (t.weight ?? 1), 0);
  for (const t of category.templates) {
    const expected = Math.round(((t.weight ?? 1) / totalWeight) * 100);
    console.log(`  ${category.label} ${t.id}: ${Math.round(counts[t.id] / 100)}%（予定 ${expected}%）`);
  }
}

// 見本の問題（電卓なし）。テンプレートを順番に使う。
// 引数は分野のid（例：speed）でも、テンプレートのid（例：speed-travelers）でもよい
const sampleFilter = process.argv[2];
const allTemplates = categories
  .flatMap((c) => c.templates.map((t) => ({ category: c, template: t })))
  .filter(({ category, template }) => !sampleFilter || category.id === sampleFilter || template.id === sampleFilter);
if (allTemplates.length === 0) throw new Error(`分野・テンプレートが見つからない: ${sampleFilter}`);
console.log(`\n=== 見本の問題 ${SAMPLE_COUNT}問（電卓なし） ===`);
const sampleRand = createRandom(20260926);
for (let i = 0; i < SAMPLE_COUNT; i++) {
  const { category, template } = allTemplates[i % allTemplates.length];
  const q = buildChoices(template.generate(sampleRand, { calculator: false }), sampleRand);
  console.log(`\n【${i + 1}】${category.label}（${template.id}）`);
  console.log(q.text);
  q.choices.forEach((c, idx) => {
    const mark = idx === q.answerIndex ? '← 正解' : c.mistake ? `← ミス: ${c.mistake}` : '← 近い数（補充）';
    console.log(`  ${'ABCD'[idx]}. ${formatValue(c.value, q.unit, q.prefix)}  ${mark}`);
  });
  console.log('  解説:');
  for (const line of q.explanation) console.log(`   ・${lineText(line)}`);
}

process.exitCode = totalFailures === 0 && selftest.failures.length === 0 ? 0 : 1;
