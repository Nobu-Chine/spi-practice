// 起動役。部品同士をつなぐだけで、中身の処理はしない。
import { settings } from './config.js';
import { categories, generateProblem } from './generators/index.js';
import { createRandom } from './core/random.js';
import { createQuiz } from './core/quiz.js';
import { analyzeHistory } from './core/stats.js';
import { loadHistory, saveResult, clearHistory } from './storage/history.js';
import { createView } from './ui/view.js';

const categoryIds = categories.map((c) => c.id);
const categoryLabels = Object.fromEntries(categories.map((c) => [c.id, c.label]));

// 全分野ミックスは、分野が2つ以上あるときだけ出す
const modes = [
  ...categories.map((c) => ({ id: c.id, label: c.label })),
  ...(categories.length >= 2 ? [{ id: 'mix', label: '全分野ミックス' }] : []),
];

const quiz = createQuiz({
  categoryIds,
  generate: generateProblem,
  settings,
  rand: createRandom(),
  saveResult,
  onTick: (left, total) => view.showTime(left, total),
  onTimeUp: (feedback) => view.showFeedback(feedback),
});

const view = createView({
  categoryLabels,
  onStart: (mode) => view.showQuestion(quiz.start(mode)),
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
});

function showHome() {
  view.showHome({ modes, settings, summary: analyzeHistory(loadHistory(), categoryIds) });
}

showHome();
