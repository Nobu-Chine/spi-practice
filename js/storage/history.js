// 成績の保存係。練習の結果をブラウザ（localStorage）に保存し、読み込み・消去する。
// quiz.js が1回終わるごとに保存し、main.js がトップ画面の成績表のために読み込む。
//
// プライベートブラウズなどで保存できない環境でも、アプリ自体は止まらないようにしている。
const KEY = 'spi-practice-history-v1';
const MAX_SESSIONS = 200;

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveResult(result) {
  try {
    const list = [...loadHistory(), result].slice(-MAX_SESSIONS);
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 保存できなくても練習は続けられるので何もしない
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上
  }
}
