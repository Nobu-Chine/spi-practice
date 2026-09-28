// 検査の決まりの自己チェック係。正常な問題を1か所ずつわざと壊し、check-rules.js がちゃんと NG を出すか（検査がゆるくなっていないか）を確かめる。
// tests/check.js が最初に自動で呼ぶ。単独でも node tests/check-selftest.js で動く。問題は generators/ と choices.js で作る。
//
// 分数（確率）と文字（推論）の問題は、特定の分野に頼らないよう、このファイルの中のチェック専用テンプレートで作る。
import { pathToFileURL } from 'node:url';
import { categories } from '../js/generators/index.js';
import { buildChoices } from '../js/core/choices.js';
import { createRandom } from '../js/core/random.js';
import { fraction, label } from '../js/core/values.js';
import { checkProblem, checkAskText } from './check-rules.js';

// チェック専用の分数の問題（5個中2個が当たり → 2/5）
const fractionTemplate = {
  id: 'selftest-fraction',
  generate() {
    return {
      params: { hit: 2, total: 5 },
      text: '5個の玉のうち2個が赤玉である。1個取り出したとき、赤玉である確率はいくらか。',
      answer: fraction(2, 5),
      unit: '',
      wrongs: [
        { value: fraction(2, 3), mistake: '赤玉と白玉の個数の比にしてしまった' },
        { value: fraction(3, 5), mistake: '白玉の確率を答えてしまった' },
        { value: fraction(1, 5), mistake: '1個分だけを数えてしまった' },
      ],
      explanation: ['確率 ＝ 2/5'],
    };
  },
  solve: ({ hit, total }) => fraction(hit, total),
};
// チェック専用の文字の答えの問題（推論の形。正解は「イだけ」）
const labelTemplate = {
  id: 'selftest-label',
  generate() {
    return {
      params: { correct: 'イだけ' },
      text: 'AはBより背が高く、BはCより背が高い。\n次の推論のうち、必ず正しいものはどれか。\nア：Aが一番低い\nイ：Aが一番高い',
      answer: label('イだけ'),
      unit: '',
      wrongs: [
        { value: label('アだけ'), mistake: '背の高さの向きを逆に読んでしまった' },
        { value: label('アとイ'), mistake: 'アが成り立たないことを確かめていない' },
        { value: label('どれも必ず正しいとはいえない'), mistake: 'イが必ず成り立つことに気づいていない' },
      ],
      explanation: ['高い順に A → B → C なので、イだけが必ず正しい'],
    };
  },
  solve: ({ correct }) => label(correct),
};
const selftestCategory = { id: 'selftest', label: '自己チェック', templates: [fractionTemplate, labelTemplate] };

function findTemplate(id) {
  for (const category of [...categories, selftestCategory]) {
    const template = category.templates.find((t) => t.id === id);
    if (template) return { category, template };
  }
  throw new Error(`テンプレートが見つからない: ${id}`);
}

function makeProblem(id) {
  const { category, template } = findTemplate(id);
  const rand = createRandom(1);
  return { category, template, q: structuredClone(buildChoices(template.generate(rand, { calculator: false }), rand)) };
}

const wrongIndex = (q) => q.choices.findIndex((_, i) => i !== q.answerIndex);
const INT = 'ratio-whole-from-part';
const FRAC = 'selftest-fraction';
const LABEL = 'selftest-label';
const TABLE = 'sets-neither';

// [壊し方, 使う問題, 壊す処理, 出てほしい NG の言葉（null は「NGが出ないこと」）]
const CASES = [
  ['【対照】壊していない整数の問題', INT, () => {}, null],
  ['【対照】壊していない分数の問題', FRAC, () => {}, null],
  ['【対照】壊していない表つきの問題', TABLE, () => {}, null],
  ['【対照】壊していない文字の答えの問題', LABEL, () => {}, null],
  ['選択肢が重複している', INT, (q) => { q.choices[wrongIndex(q)].value = q.answer; }, '選択肢が重複'],
  ['補充が正解から離れすぎ（整数）', INT, (q) => { q.choices[wrongIndex(q)] = { value: q.answer * 3, mistake: null }; }, '離れすぎ'],
  ['答えが検算と合わない', INT, (q) => { q.answer += 1; q.choices[q.answerIndex].value = q.answer; }, '検算と答えが合わない'],
  ['正解の位置がずれている', INT, (q) => { q.answerIndex = (q.answerIndex + 1) % 4; }, '正解の位置がずれている'],
  ['選択肢が3つしかない', INT, (q) => {
    const i = wrongIndex(q);
    q.choices.splice(i, 1);
    if (q.answerIndex > i) q.answerIndex--;
  }, '選択肢が4つでない'],
  ['選択肢に小数（2.5）がある', INT, (q) => { q.choices[wrongIndex(q)].value = 2.5; }, '選択肢に使えない値'],
  ['選択肢に0がある', INT, (q) => { q.choices[wrongIndex(q)].value = 0; }, '選択肢に使えない値'],
  ['分数の答えが約分されていない', FRAC, (q) => {
    q.answer = { num: q.answer.num * 2, den: q.answer.den * 2 };
    q.choices[q.answerIndex].value = q.answer;
  }, '約分されていない'],
  ['分数の選択肢に「確率1」がある', FRAC, (q) => { q.choices[wrongIndex(q)].value = { num: 1, den: 1 }; }, '選択肢に使えない値'],
  ['分数の問題に整数の選択肢がまざる', FRAC, (q) => { q.choices[wrongIndex(q)].value = 3; }, '種類のちがう値'],
  ['補充が正解から離れすぎ（分数）', FRAC, (q) => { q.choices[wrongIndex(q)] = { value: { num: 99, den: 100 }, mistake: null }; }, '離れすぎ'],
  ['文字の答えに、ミスの説明がない選択肢がまざる', LABEL, (q) => {
    q.choices[wrongIndex(q)] = { value: label('ウだけ'), mistake: null };
  }, 'ミスの説明がない選択肢'],
  ['文字の問題に数字の選択肢がまざる', LABEL, (q) => { q.choices[wrongIndex(q)].value = 3; }, '種類のちがう値'],
  ['文字の選択肢が空', LABEL, (q) => { q.choices[wrongIndex(q)].value = label(''); }, '選択肢に使えない値'],
  ['文字の答えが検算と合わない', LABEL, (q) => { q.params.correct = 'アだけ'; }, '検算と答えが合わない'],
  ['表の色付きのマスが答えと違う', TABLE, (q) => {
    const table = q.explanation.find((line) => typeof line !== 'string');
    table.cells[table.highlight] = '999人';
  }, '色付きのマスが答えと違う'],
  ['問題文に NaN が入っている', INT, (q) => { q.text += '（NaN人）'; }, '文章が壊れている'],
  ['解説に [object Object] が入っている', INT, (q) => { q.explanation.push(`${{}}`); }, '文章が壊れている'],
  ['解説が空', INT, (q) => { q.explanation = []; }, '解説が空'],
  ['損益算で赤字の組み合わせ', 'profit-amount', (q) => { q.params.a = 10; q.params.b = 30; }, '赤字'],
  ['コピー文が崩れる（数字の前に { が付く）', INT, (q) => { q.prefix = '{'; }, 'コピー文'],
];

// 全部の壊し方を試し、期待どおりにならなかったものの一覧を返す
export function runSelfTest() {
  const failures = [];
  for (const [name, id, breakIt, expected] of CASES) {
    const { category, template, q } = makeProblem(id);
    breakIt(q);
    const errors = [...checkProblem(template, q, { calculator: false }), ...checkAskText(category, q)];
    const ok = expected === null ? errors.length === 0 : errors.some((e) => e.includes(expected));
    if (!ok) failures.push({ name, expected: expected ?? 'NGなし', errors });
  }
  return { total: CASES.length, failures };
}

// 単独で実行されたときだけ、結果を表示する
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { total, failures } = runSelfTest();
  for (const f of failures) console.log(`× ${f.name}（期待：${f.expected}）→ ${f.errors.join(' / ') || 'NGなし'}`);
  console.log(`検査の決まりの自己チェック：${total}件中 ${total - failures.length}件が期待どおり`);
  process.exitCode = failures.length ? 1 : 0;
}
