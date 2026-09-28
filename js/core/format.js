// 書き方の係。「時速48km」「3/10」のような答えの書き方と、解説の表を1行の文字にする方法をまとめている。
// 画面（view.js）・コピー用の文章（ask-text.js）・チェック（tests/check.js）が同じ書き方を使うために1か所に分けた。

import { isFraction } from './values.js';

// 答えの書き方。prefix は「時速48km」の「時速」のように数字の前につく言葉。分数（確率）は「3/10」と書く
export function formatValue(value, unit, prefix = '') {
  const body = isFraction(value) ? `${value.num}/${value.den}` : value.toLocaleString('ja-JP');
  return `${prefix}${body}${unit}`;
}

// 解説の1行を文字にする。表は「見出し：値」を ｜ で並べ、答えのマスに mark をつける。
// 見出しの ​（画面での折り返し位置の目印）は取り除く
export function explanationLineText(line, { mark = '（答え）' } = {}) {
  if (typeof line === 'string') return line;
  return line.headers
    .map((h, i) => `${h.replace(/​/g, '')}：${line.cells[i]}${i === line.highlight ? mark : ''}`)
    .join(' ｜ ');
}
