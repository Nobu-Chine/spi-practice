// 成績の保存と読み込みだけを担当する（ブラウザの localStorage を使う）。
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
