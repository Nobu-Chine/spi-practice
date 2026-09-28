// 4択を組み立てる係。問題づくり（generators/）が出した正解と「よくあるミス」から、選択肢を4つ作って並べ替える。
// quiz.js と tests/check.js から呼ばれる。ミスの数が足りないときは、正解の近くの値で補う。値の比べ方・判定は values.js に任せる。
import { valueKey, isUsableValue, shiftedValue } from './values.js';

const WRONG_COUNT = 3;

export function buildChoices(problem, rand) {
  const { answer } = problem;
  const used = new Set([valueKey(answer)]);
  const wrongs = [];

  function add(value, mistake) {
    if (wrongs.length < WRONG_COUNT && isUsableValue(value) && !used.has(valueKey(value))) {
      used.add(valueKey(value));
      wrongs.push({ value, mistake });
    }
  }

  for (const w of problem.wrongs) add(w.value, w.mistake);

  // 足りない分は正解の近くの値で補う。
  // 正解をはさんで等間隔に並ぶと「真ん中が正解」とバレるので、先にランダムに選んだ片側（1倍→2倍）から使う
  const side = rand.pick([1, -1]);
  for (const offset of [side, side * 2, -side, -side * 2]) add(shiftedValue(answer, offset), null);
  // 小さすぎる答えなどで上の4つが使えなかったときの予備（check.js で離れすぎを検出できる）。
  // 答えがおかしいと永遠に見つからないので、回数に上限をつけて止める（check.js が「4つでない」と検出する）
  for (let k = 3; wrongs.length < WRONG_COUNT && k < 100; k++) add(shiftedValue(answer, k), null);

  const options = rand.shuffle([{ value: answer, mistake: null, correct: true }, ...wrongs]);
  return {
    ...problem,
    choices: options.map(({ value, mistake }) => ({ value, mistake })),
    answerIndex: options.findIndex((o) => o.correct),
  };
}
