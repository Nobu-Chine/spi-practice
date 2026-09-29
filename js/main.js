// つなぎ役（司令塔）の係。アプリを開くと最初に動き、画面（view.js）・進行役（quiz.js）・保存係（history.js・mistakes.js）・共有係（share.js）などをつなぐ。
// 自分では計算も表示もせず、「ボタンが押されたら quiz.js を呼び、返ってきた結果を view.js に渡す」だけ。
import { settings } from './config.js';
import { categories, generateProblem } from './generators/index.js';
import { createRandom } from './core/random.js';
import { createQuiz } from './core/quiz.js';
import { analyzeHistory } from './core/stats.js';
import { loadHistory, saveResult, clearHistory } from './storage/history.js';
import { loadMistakes, saveMistakes } from './storage/mistakes.js';
import { createMistakeBook } from './core/mistake-book.js';
import { createView } from './ui/view.js';
import { copyText } from './ui/clipboard.js';
import { shareSite } from './ui/share.js';
import { buildAskText } from './core/ask-text.js';

const categoryIds = categories.map((c) => c.id);
const categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));

// 全分野ミックスは、分野が2つ以上あるときだけ出す
const modes = [
  ...categories.map((c) => ({ id: c.id, label: c.label })),
  ...(categories.length >= 2 ? [{ id: 'mix', label: '全分野ミックス' }] : []),
];

const mistakeBook = createMistakeBook({ load: loadMistakes, save: saveMistakes });

const quiz = createQuiz({
  categoryIds,
  generate: generateProblem,
  settings,
  rand: createRandom(),
  saveResult,
  mistakeBook,
  onTick: (left, total) => view.showTime(left, total),
  onTimeUp: (feedback) => view.showFeedback(feedback),
});

const view = createView({
  categoryLabels,
  // 復習リストが空になっていたら（別のタブで解き終えたときなど）トップ画面に戻る
  onStart: (mode) => {
    const question = mode === 'review' ? quiz.startReview() : quiz.start(mode);
    if (question) view.showQuestion(question);
    else showHome();
  },
  onChoose: (index) => view.showFeedback(quiz.answer(index)),
  onNext: () => {
    const question = quiz.next();
    if (question) view.showQuestion(question);
    else view.showResult(quiz.finish());
  },
  onQuit: () => {
    quiz.abort();
    showHome();
  },
  onHome: () => showHome(),
  onClearHistory: () => {
    clearHistory();
    showHome();
  },
  // iPhone はボタンを押した流れの中でないとコピーできないので、押されたらすぐ copyText を呼ぶ
  onCopy: () => {
    const review = quiz.review();
    if (review) copyText(buildAskText(review)).then((ok) => view.showCopyResult(ok));
  },
  // 共有メニューもボタンを押した流れの中でないと開けないので、押されたらすぐ呼ぶ
  onShare: () => shareSite().then((result) => view.showShareResult(result)),
});

function showHome() {
  view.showHome({ modes, settings, summary: analyzeHistory(loadHistory(), categoryIds), reviewCount: mistakeBook.count() });
}

showHome();
