// 「AIに質問用にコピー」で使う文章を組み立てる。
// 受け取るのは quiz.review() のデータだけで、画面やクリップボードのことは知らない。
import { formatValue, explanationLineText } from './format.js';

const LETTERS = 'ABCD';

export function buildAskText(review) {
  const { categoryLabel, text, choices, unit, prefix, chosenIndex, timedOut, answerIndex, explanation } = review;
  const choiceText = (i) => `${LETTERS[i]}. ${formatValue(choices[i], unit, prefix)}`;

  let myAnswer;
  if (timedOut) myAnswer = '時間切れで答えられなかった';
  else myAnswer = `${choiceText(chosenIndex)}（${chosenIndex === answerIndex ? '正解' : '不正解'}）`;

  // 解説の番号は画面と同じく文字の行だけに振り、表には振らない
  let number = 0;
  const steps = explanation.map((line) =>
    typeof line === 'string' ? `${++number}. ${line}` : `（表）${explanationLineText(line)}`,
  );

  return [
    `SPI非言語の練習問題（分野：${categoryLabel}）`,
    '',
    '【問題】',
    text,
    '',
    '【選択肢】',
    ...choices.map((_, i) => choiceText(i)),
    '',
    '【自分の答え】',
    myAnswer,
    '',
    '【正解】',
    choiceText(answerIndex),
    '',
    '【解説】',
    ...steps,
    '',
    'この問題について質問です：',
  ].join('\n');
}
