// クイズの進行役。10問を用意し、答えを採点し、タイマーを動かし、最後に結果をまとめる。
// 問題づくりは generators/、選択肢は choices.js、時間は timer.js、集計は stats.js に任せる。画面のことは知らない。
import { buildChoices } from './choices.js';
import { createTimer } from './timer.js';
import { summarizeSession } from './stats.js';

export function createQuiz({ categoryIds, generate, settings, rand, saveResult, onTick, onTimeUp, now = Date.now }) {
  const count = settings.questionsPerSession;
  const limitMs = settings.secondsPerQuestion * 1000;
  const timer = createTimer({
    seconds: settings.secondsPerQuestion,
    onTick,
    onTimeUp: () => onTimeUp(answer(null)),
    now,
  });

  let mode = null;
  let questions = [];
  let index = 0;
  let records = [];
  let shownAt = 0;
  let answered = false;
  let lastChoice = null;

  // 出題する分野の並び。全分野ミックスは均等に配る（4分野なら 3・3・2・2 問）
  function pickCategoryIds(modeId) {
    if (modeId !== 'mix') return Array(count).fill(modeId);
    const ids = [];
    while (ids.length < count) ids.push(...rand.shuffle(categoryIds));
    return rand.shuffle(ids.slice(0, count));
  }

  // 同じ回に同じ数字の問題が出ないようにする（場面の文章だけ違う問題もかぶりとみなす）
  function makeQuestions(ids) {
    const seen = new Set();
    const keyOf = (p) => `${p.templateId}:${JSON.stringify(p.params)}`;
    return ids.map((id) => {
      let problem;
      for (let tries = 0; tries < 10; tries++) {
        problem = generate(id, rand, settings);
        if (!seen.has(keyOf(problem))) break;
      }
      seen.add(keyOf(problem));
      return buildChoices(problem, rand);
    });
  }

  function current() {
    const q = questions[index];
    return {
      number: index + 1,
      total: questions.length,
      categoryLabel: q.categoryLabel,
      text: q.text,
      choices: q.choices.map((c) => c.value),
      unit: q.unit,
      prefix: q.prefix ?? '',
    };
  }

  function show() {
    answered = false;
    shownAt = now();
    const view = current();
    timer.start();
    return view;
  }

  function start(modeId) {
    mode = modeId;
    questions = makeQuestions(pickCategoryIds(modeId));
    index = 0;
    records = [];
    return show();
  }

  // choiceIndex が null なら時間切れ（不正解あつかい）
  function answer(choiceIndex) {
    if (answered) return null;
    answered = true;
    timer.stop();

    const q = questions[index];
    const timedOut = choiceIndex === null;
    const correct = !timedOut && choiceIndex === q.answerIndex;
    lastChoice = choiceIndex;
    records.push({ category: q.category, correct, timedOut, timeMs: Math.min(now() - shownAt, limitMs) });

    return {
      correct,
      timedOut,
      chosenIndex: choiceIndex,
      answerIndex: q.answerIndex,
      answer: q.answer,
      unit: q.unit,
      prefix: q.prefix ?? '',
      mistake: correct || timedOut ? null : q.choices[choiceIndex].mistake,
      explanation: q.explanation,
      isLast: index === questions.length - 1,
    };
  }

  // 答えたあとの今の問題を、ふり返り用（AIへの質問のコピーなど）にまとめて返す
  function review() {
    if (records.length !== index + 1) return null; // 今の問題にまだ答えていない
    const q = questions[index];
    const last = records[records.length - 1];
    return {
      ...current(),
      chosenIndex: last.timedOut ? null : lastChoice,
      timedOut: last.timedOut,
      answerIndex: q.answerIndex,
      explanation: q.explanation,
    };
  }

  function next() {
    if (index >= questions.length - 1) return null;
    index++;
    return show();
  }

  function finish() {
    const result = { date: new Date().toISOString(), mode, ...summarizeSession(records) };
    saveResult(result);
    return result;
  }

  // 途中でやめる（記録は残さない）
  function abort() {
    timer.stop();
    answered = true;
  }

  return { start, answer, review, next, finish, abort };
}
