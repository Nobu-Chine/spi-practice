// 検査の決まりの係。1問の問題を受け取って、答え・選択肢・解説・コピー用の文章におかしな点がないかを調べ、見つけた問題点の一覧を返す。
// tests/check.js が大量の問題に使う。値の判定は values.js、書き方は format.js、コピー文は ask-text.js と、アプリ本体と同じものを使う。
import { isFraction, isLabel, valueKind, valueKey, sameValue, isUsableValue, isNearAnswer } from '../js/core/values.js';
import { gcd } from '../js/core/math.js';
import { formatValue, explanationLineText } from '../js/core/format.js';
import { buildAskText } from '../js/core/ask-text.js';

const BROKEN_TEXT = /NaN|undefined|Infinity|\{|\}|\[object/;
const ASK_LAST_LINE = 'この問題について質問です：';

// 解説の1行を文字にする（表の答えのマスには ★）
export const lineText = (line) => explanationLineText(line, { mark: '★' });

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
export function checkAskText(category, q) {
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

// 問題1問：答え・検算・選択肢・補充・文章・解説の表・テンプレート独自のルールを調べる
export function checkProblem(template, q, settings) {
  const errors = [];
  const answerText = valueKey(q.answer);
  // 答えは正の整数か、0より大きく1より小さい約分済みの分数（確率）か、空でない文字（推論）
  if (!isUsableValue(q.answer)) errors.push(`答えが使えない値: ${answerText}`);
  if (isFraction(q.answer) && gcd(q.answer.num, q.answer.den) !== 1) errors.push(`答えの分数が約分されていない: ${answerText}`);
  const solved = template.solve(q.params);
  if (!sameValue(solved, q.answer)) errors.push(`検算と答えが合わない: 検算=${valueKey(solved)} 答え=${answerText}`);

  const values = q.choices.map((c) => c.value);
  const keys = values.map(valueKey);
  if (values.length !== 4) errors.push(`選択肢が4つでない: ${values.length}個`);
  if (new Set(keys).size !== keys.length) errors.push(`選択肢が重複: ${keys}`);
  if (values.some((v) => !isUsableValue(v))) errors.push(`選択肢に使えない値: ${keys}`);
  if (values.some((v) => valueKind(v) !== valueKind(q.answer))) errors.push(`選択肢に種類のちがう値（整数・分数・文字）がまざっている: ${keys}`);
  if (!sameValue(values[q.answerIndex], q.answer)) errors.push('正解の位置がずれている');

  // 補充した選択肢（ミス由来でないもの）が正解から離れすぎていないか。
  // 文字の答えには「近い値」がないので、誤答は全部ミスの説明つきでなければいけない
  q.choices.forEach((c, idx) => {
    if (idx === q.answerIndex || c.mistake !== null) return;
    if (isLabel(q.answer)) {
      errors.push(`文字の答えなのに、ミスの説明がない選択肢がある: ${valueKey(c.value)}`);
    } else if (!isNearAnswer(c.value, q.answer)) {
      errors.push(`補充の選択肢が正解から離れすぎ: 正解=${answerText} 補充=${valueKey(c.value)}`);
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
