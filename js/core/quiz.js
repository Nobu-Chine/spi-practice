// クイズの進行役。10問を用意し、答えを採点し、タイマーを動かし、最後に結果をまとめる。
// 問題づくりは generators/、選択肢は choices.js、時間は timer.js、集計は stats.js、復習リストは mistake-book.js に任せる。画面のことは知らない。
//
// 間違えた問題（時間切れも）は復習リストに入れ、復習で正解した問題はリストから消す。復習の回の成績は記録しない。
import { buildChoices, shuffleChoices } from './choices.js';
import { createTimer } from './timer.js';
import { summarizeSession } from './stats.js';
import { problemKey } from './mistake-book.js';

// 復習リストを使わないとき（テストなど）の代わり
const NO_MISTAKE_BOOK = { add() {}, remove() {}, take: () => [], count: () => 0 };

export function createQuiz({ categoryIds, generate, settings, rand, saveResult, onTick, onTimeUp, now = Date.now, mistakeBook = NO_MISTAKE_BOOK }) {
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
    return ids.map((id) => {
      let problem;
      for (let tries = 0; tries < 10; tries++) {
        problem = generate(id, rand, settings);
        if (!seen.has(problemKey(problem))) break;
      }
      seen.add(problemKey(problem));
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

  // 復習の回を始める：復習リストから古い順に最大10問。選択肢は並べ替える（正解の位置を覚えないように）。
  // リストが空なら null を返す
  function startReview() {
    const saved = mistakeBook.take(count);
    if (saved.length === 0) return null;
    mode = 'review';
    questions = saved.map((q) => shuffleChoices(q, rand));
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

    // 間違えた問題は復習リストへ。復習の回で正解した問題はリストから消す
    if (!correct) mistakeBook.add(q);
    else if (mode === 'review') mistakeBook.remove(q);

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

  // 結果をまとめる。復習の回は、同じ問題の解き直しで正答率が高く出て苦手分野の判定が狂うので、成績には記録しない
  function finish() {
    const result = { date: new Date().toISOString(), mode, ...summarizeSession(records) };
    const recorded = mode !== 'review';
    if (recorded) saveResult(result);
    return { ...result, recorded, reviewLeft: mistakeBook.count() };
  }

  // 途中でやめる（記録は残さない）
  function abort() {
    timer.stop();
    answered = true;
  }

  return { start, startReview, answer, review, next, finish, abort };
}
