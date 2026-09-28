// 復習リストの保存係。間違えた問題の一覧をブラウザ（localStorage）に保存し、読み込むだけ。
// 何を入れて何を消すかの決まりは core/mistake-book.js が決める。main.js がこの2つをつなぐ。
//
// プライベートブラウズなどで保存できない環境でも、アプリ自体は止まらないようにしている。
const KEY = 'spi-practice-mistakes-v1';

export function loadMistakes() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveMistakes(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 保存できなくても練習は続けられるので何もしない
  }
}
