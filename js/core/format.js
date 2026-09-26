// 数字や解説を文字にする道具。画面・コピー用の文章・check.js で同じ書き方を使う。

// 答えの書き方。prefix は「時速48km」の「時速」のように数字の前につく言葉
export function formatValue(value, unit, prefix = '') {
  return `${prefix}${value.toLocaleString('ja-JP')}${unit}`;
}

// 解説の1行を文字にする。表は「見出し：値」を ｜ で並べ、答えのマスに mark をつける。
// 見出しの ​（画面での折り返し位置の目印）は取り除く
export function explanationLineText(line, { mark = '（答え）' } = {}) {
  if (typeof line === 'string') return line;
  return line.headers
    .map((h, i) => `${h.replace(/​/g, '')}：${line.cells[i]}${i === line.highlight ? mark : ''}`)
    .join(' ｜ ');
}
