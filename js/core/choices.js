// 4択を組み立てる。
// 生成器が出した「誤答の候補」から、使えるものを優先順に3つ選び、足りなければ正解の近くの数で補う。

const WRONG_COUNT = 3;

// 選択肢として使える数：正の整数だけ
function isUsable(value) {
  return Number.isInteger(value) && value > 0;
}

// 補充用のずらし幅：正解の桁に合わせたキリのいい数（300なら50、48なら5）
function fillerStep(answer) {
  const digits = Math.floor(Math.log10(answer));
  return Math.max(1, 10 ** digits / 2);
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

  // 正解をはさんで等間隔に並ぶと「真ん中が正解」とバレるので、ずらす向きと幅をばらばらにする
  const step = fillerStep(answer);
  for (let tries = 0; wrongs.length < WRONG_COUNT && tries < 100; tries++) {
    add(answer + rand.pick([1, -1]) * step * rand.int(1, 4), null);
  }
  for (let k = 1; wrongs.length < WRONG_COUNT; k++) add(answer + step * k, null);

  const options = rand.shuffle([{ value: answer, mistake: null, correct: true }, ...wrongs]);
  return {
    ...problem,
    choices: options.map(({ value, mistake }) => ({ value, mistake })),
    answerIndex: options.findIndex((o) => o.correct),
  };
}
