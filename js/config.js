// 設定の係。1回の問題数・1問の制限時間・電卓あり/なしをここで決める。
// main.js が読み込んで、進行役（quiz.js）や問題づくり（generators/）に渡す。
export const settings = {
  // false = 電卓なし（暗算しやすい数字）、true = 電卓あり（大きめ・半端な%も出る）
  calculator: false,
  secondsPerQuestion: 60,
  questionsPerSession: 10,
};
