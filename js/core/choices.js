// 4択を組み立てる。
// 生成器が出した「誤答の候補」から、使えるものを優先順に3つ選び、足りなければ正解の近くの数で補う。

const WRONG_COUNT = 3;

// 補充した選択肢は正解から「10%」か「2」の大きいほうまでしか離さない（tests/check.js もこの値で確かめる）
export function fillerLimit(answer) {
  return Math.max(answer * 0.1, 2);
}

// 選択肢として使える数：正の整数だけ
function isUsable(value) {
  return Number.isInteger(value) && value > 0;
}

// 補充用のずらし幅：正解の約5%以下で最大の「1・2・5 × 10のn乗」（100なら5、1020なら50）。
// 1倍・2倍ずらしても正解の±10%以内に収まる
function fillerStep(answer) {
  let step = 1;
  for (let unit = 1; unit <= answer; unit *= 10) {
    for (const m of [1, 2, 5]) {
      if (unit * m <= answer * 0.05) step = unit * m;
    }
  }
  return step;
}

export function buildChoices(problem, rand) {
  const { answer } = problem;
  const used = new Set([answer]);
  const wrongs = [];

  function add(value, mistake) {
    if (wrongs.length < WRONG_COUNT && isUsable(value) && !used.has(value)) {
      used.add(value);
      wrongs.push({ value, mistake });
    }
  }

  for (const w of problem.wrongs) add(w.value, w.mistake);

  // 足りない分は正解の近くの数で補う。
  // 正解をはさんで等間隔に並ぶと「真ん中が正解」とバレるので、先にランダムに選んだ片側（1倍→2倍）から使う
  const step = fillerStep(answer);
  const side = rand.pick([1, -1]);
  for (const offset of [side, side * 2, -side, -side * 2]) add(answer + step * offset, null);
  // 小さすぎる答えなどで上の4つが使えなかったときの予備（check.js で離れすぎを検出できる）
  for (let k = 3; wrongs.length < WRONG_COUNT; k++) add(answer + step * k, null);

  const options = rand.shuffle([{ value: answer, mistake: null, correct: true }, ...wrongs]);
  return {
    ...problem,
    choices: options.map(({ value, mistake }) => ({ value, mistake })),
    answerIndex: options.findIndex((o) => o.correct),
  };
}
