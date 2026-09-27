// 問題の自動チェック係。全分野の問題を大量に作り、答え・選択肢・解説・コピー用の文章がおかしくないか確かめる。
// アプリ本体と同じ generators/・choices.js・ask-text.js を使うので、本番と同じ問題を確かめられる。
//
// 使い方： node tests/check.js          … 全分野をチェックし、見本は全分野から
//         node tests/check.js profit   … 全分野をチェックし、見本は損益算だけ
import { categories } from '../js/generators/index.js';
import { buildChoices, fillerLimit } from '../js/core/choices.js';
import { createRandom } from '../js/core/random.js';
import { formatValue, explanationLineText } from '../js/core/format.js';
import { buildAskText } from '../js/core/ask-text.js';

const RUNS = 1000;
const SAMPLE_COUNT = 5;
const BROKEN_TEXT = /NaN|undefined|Infinity|\{|\}|\[object/;
const ASK_LAST_LINE = 'この問題について質問です：';

// 解説の1行を文字にする（表の答えのマスには ★）
const lineText = (line) => explanationLineText(line, { mark: '★' });

// quiz.review() と同じ形のデータを作る
function reviewOf(category, q, chosenIndex) {
  return {
    categoryLabel: category.label,
    text: q.text,
    choices: q.choices.map((c) => c.value),
    unit: q.unit,
    prefix: q.prefix ?? '',
    chosenIndex,
    timedOut: chosenIndex === null,
    answerIndex: q.answerIndex,
    explanation: q.explanation,
  };
}

// 「AIに質問用にコピー」の文章：必要な情報がそろっていて、崩れていないか
function checkAskText(category, q) {
  const errors = [];
  const wrongIndex = q.choices.findIndex((_, i) => i !== q.answerIndex);
  for (const chosen of [wrongIndex, null]) {
    const ask = buildAskText(reviewOf(category, q, chosen));
    const label = chosen === null ? '時間切れ' : '不正解';
    const must = [
      `分野：${category.label}`,
      q.text,
      ...q.choices.map((c) => formatValue(c.value, q.unit, q.prefix)),
      chosen === null ? '時間切れ' : '（不正解）',
    ];
    for (const part of must) if (!ask.includes(part)) errors.push(`コピー文（${label}）に「${part}」がない`);
    if (!ask.endsWith(ASK_LAST_LINE)) errors.push(`コピー文（${label}）の最後が「${ASK_LAST_LINE}」でない`);
    if (BROKEN_TEXT.test(ask) || ask.includes('​')) errors.push(`コピー文（${label}）が壊れている`);
  }
  return errors;
}

function checkProblem(template, q, settings) {
  const errors = [];
  if (!Number.isInteger(q.answer) || q.answer <= 0) errors.push(`答えが正の整数でない: ${q.answer}`);
  const solved = template.solve(q.params);
  if (solved !== q.answer) errors.push(`検算と答えが合わない: 検算=${solved} 答え=${q.answer}`);

  const values = q.choices.map((c) => c.value);
  if (values.length !== 4) errors.push(`選択肢が4つでない: ${values.length}個`);
  if (new Set(values).size !== values.length) errors.push(`選択肢が重複: ${values}`);
  if (values.some((v) => !Number.isInteger(v) || v <= 0)) errors.push(`選択肢に正の整数でないもの: ${values}`);
  if (values[q.answerIndex] !== q.answer) errors.push('正解の位置がずれている');

  // 補充した選択肢（ミス由来でないもの）が正解から離れすぎていないか
  q.choices.forEach((c, idx) => {
    if (idx === q.answerIndex || c.mistake !== null) return;
    if (Math.abs(c.value - q.answer) > fillerLimit(q.answer)) {
      errors.push(`補充の選択肢が正解から離れすぎ: 正解=${q.answer} 補充=${c.value}（許容 ±${fillerLimit(q.answer)}）`);
    }
  });

  for (const line of [q.text, ...q.explanation.map(lineText)]) {
    if (BROKEN_TEXT.test(line)) errors.push(`文章が壊れている: ${line}`);
  }
  // 解説の表：列の数がそろっているか、色付きのマスが答えになっているか
  for (const t of q.explanation.filter((line) => typeof line !== 'string')) {
    if (t.headers.length !== t.cells.length) errors.push('解説の表の列の数が合わない');
    if (t.highlight !== undefined && parseInt(t.cells[t.highlight], 10) !== q.answer) {
      errors.push(`解説の表の色付きのマスが答えと違う: ${t.cells[t.highlight]}`);
    }
  }
  if (q.explanation.length === 0) errors.push('解説が空');
  // テンプレート独自のルール（例：損益算の赤字禁止）
  errors.push(...(template.validate?.(q.params, settings) ?? []));
  return errors;
}

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

// 見本の問題（電卓なし）。テンプレートを順番に使う
const sampleCategoryId = process.argv[2];
const sampleCategories = sampleCategoryId ? categories.filter((c) => c.id === sampleCategoryId) : categories;
if (sampleCategories.length === 0) throw new Error(`分野が見つからない: ${sampleCategoryId}`);
console.log(`\n=== 見本の問題 ${SAMPLE_COUNT}問（電卓なし） ===`);
const sampleRand = createRandom(20260926);
const allTemplates = sampleCategories.flatMap((c) => c.templates.map((t) => ({ category: c, template: t })));
for (let i = 0; i < SAMPLE_COUNT; i++) {
  const { category, template } = allTemplates[i % allTemplates.length];
  const q = buildChoices(template.generate(sampleRand, { calculator: false }), sampleRand);
  console.log(`\n【${i + 1}】${category.label}（${template.id}）`);
  console.log(q.text);
  q.choices.forEach((c, idx) => {
    const mark = idx === q.answerIndex ? '← 正解' : c.mistake ? `← ミス: ${c.mistake}` : '← 近い数（補充）';
    console.log(`  ${'ABCD'[idx]}. ${q.prefix ?? ''}${c.value}${q.unit}  ${mark}`);
  });
  console.log('  解説:');
  for (const line of q.explanation) console.log(`   ・${lineText(line)}`);
}

process.exitCode = totalFailures === 0 ? 0 : 1;
