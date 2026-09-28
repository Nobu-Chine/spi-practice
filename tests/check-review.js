// 復習機能のテスト係。quiz.js と mistake-book.js を、ニセモノの時計と保存場所で動かし、間違えた問題の出し入れが決まりどおりかを確かめる。
// tests/check.js が自動で呼ぶ。単独でも node tests/check-review.js で動く。問題は generators/ で本物を作る。
//
// 保存場所は、本物と同じように JSON 文字列を通して出し入れする（分数や文字の答えが保存で崩れないかも確かめるため）。
import { pathToFileURL } from 'node:url';
import { generateProblem } from '../js/generators/index.js';
import { buildChoices } from '../js/core/choices.js';
import { createRandom } from '../js/core/random.js';
import { createQuiz } from '../js/core/quiz.js';
import { createMistakeBook, problemKey } from '../js/core/mistake-book.js';
import { sameValue, valueKind } from '../js/core/values.js';
import { formatValue } from '../js/core/format.js';

const SETTINGS = { calculator: false, secondsPerQuestion: 60, questionsPerSession: 10 };

// JSON を通して保存するニセモノの保存場所
function fakeStorage() {
  let stored = '[]';
  return { load: () => JSON.parse(stored), save: (list) => { stored = JSON.stringify(list); } };
}

function makeQuiz(book, seed = 1) {
  const saved = [];
  let clock = 0;
  const quiz = createQuiz({
    categoryIds: ['ratio', 'profit', 'speed', 'sets', 'counting', 'probability', 'reasoning'],
    generate: generateProblem,
    settings: SETTINGS,
    rand: createRandom(seed),
    saveResult: (r) => saved.push(r),
    mistakeBook: book,
    onTick: () => {},
    onTimeUp: () => {},
    now: () => (clock += 1000),
  });
  return { quiz, saved };
}

// 今の問題の、正解の選択肢の番号（答えたあとに review() でわかる正解の位置を使わず、答える前に知るため、答えの値から探す）
function correctIndexOf(question, answerValue) {
  return question.choices.findIndex((v) => sameValue(v, answerValue));
}

export function runReviewTest() {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });

  // 1. 通常の回：間違えた問題・時間切れの問題だけが入り、正解した問題は入らない。
  // 正解と不正解の両方を必ず含めるため、5回（50問）続けて、選ぶ位置も変えていく
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const wrongTexts = [];
    const rightTexts = [];
    let timedOut = 0;
    let lastResult = null;
    let savedCount = 0;
    for (let session = 0; session < 5; session++) {
      const { quiz, saved } = makeQuiz(book, 100 + session);
      let q = quiz.start('mix');
      for (let i = 0; i < 10; i++) {
        // 5問に1問は時間切れ、それ以外は選ぶ位置を順にずらす（正解かどうかは答えてからわかる）
        const isTimeout = i % 5 === 4;
        const fb = isTimeout ? quiz.answer(null) : quiz.answer((i + session) % 4);
        if (isTimeout) timedOut++;
        (fb.correct ? rightTexts : wrongTexts).push(q.text);
        q = quiz.next();
      }
      lastResult = quiz.finish();
      savedCount += saved.length;
    }
    const savedTexts = store.load().map((p) => p.text);
    check('テストに正解と不正解の両方が含まれている', rightTexts.length > 0 && wrongTexts.length > 0, `正解${rightTexts.length}問・不正解${wrongTexts.length}問（うち時間切れ${timedOut}問）`);
    check('間違えた問題・時間切れの問題が全部入る', wrongTexts.every((t) => savedTexts.includes(t)), `入った${savedTexts.length}問`);
    check('正解した問題は入らない', rightTexts.every((t) => !savedTexts.includes(t)));
    check('入った数が間違えた数と同じ', savedTexts.length === wrongTexts.length);
    check('通常の回の成績は記録される', savedCount === 5 && lastResult.recorded === true);
    check('結果に復習リストの残りの数がつく', lastResult.reviewLeft === wrongTexts.length);
  }

  // 2. 同じ問題は2回入らない
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const rand = createRandom(5);
    const problem = buildChoices(generateProblem('ratio', rand, SETTINGS), rand);
    book.add(problem);
    book.add(problem);
    book.add({ ...problem, text: '場面の文章だけ違う' });
    check('同じ問題（数字が同じ）は2回入らない', book.count() === 1, `入った数 ${book.count()}`);
  }

  // 3. 復習の回：正解すると消え、間違えると残る。成績は記録されない。選択肢の並び順は変わりうる
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const rand = createRandom(7);
    const problems = ['ratio', 'profit', 'probability', 'reasoning'].map((id) => buildChoices(generateProblem(id, rand, SETTINGS), rand));
    problems.forEach((p) => book.add(p));

    const { quiz, saved } = makeQuiz(book, 11);
    let q = quiz.startReview();
    check('復習はリストの数だけ出る（10問より少ないとき）', q.total === 4, `出題数 ${q.total}`);
    const outcome = [];
    for (let i = 0; i < 4; i++) {
      const original = problems.find((p) => p.text === q.text);
      const right = correctIndexOf(q, original.answer);
      // 1問目と3問目は正解、2問目と4問目はわざと間違える
      const choose = i % 2 === 0 ? right : (right + 1) % 4;
      const fb = quiz.answer(choose);
      outcome.push({ key: problemKey(original), correct: fb.correct });
      q = quiz.next();
    }
    const result = quiz.finish();
    const left = store.load().map(problemKey);
    check('復習で正解した問題はリストから消える', outcome.filter((o) => o.correct).every((o) => !left.includes(o.key)));
    check('復習で間違えた問題はリストに残る', outcome.filter((o) => !o.correct).every((o) => left.includes(o.key)));
    check('復習の回の成績は記録されない', saved.length === 0 && result.recorded === false && result.mode === 'review');
    check('復習の結果の残り数が正しい', result.reviewLeft === 2, `残り ${result.reviewLeft}`);
  }

  // 4. 選択肢の並び順：同じ問題を何回か復習すると、正解の位置が変わることがある
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const rand = createRandom(3);
    const problem = buildChoices(generateProblem('speed', rand, SETTINGS), rand);
    book.add(problem);
    const positions = new Set();
    for (let seed = 0; seed < 20; seed++) {
      const { quiz } = makeQuiz(book, seed);
      const q = quiz.startReview();
      positions.add(correctIndexOf(q, problem.answer));
      quiz.abort();
    }
    check('復習のたびに選択肢が並べ替えられる', positions.size > 1, `20回で正解の位置 ${[...positions].sort().join('・')}`);
  }

  // 5. 100問を超えたら古いものから消える。復習は古い順に出る
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const base = buildChoices(generateProblem('ratio', createRandom(9), SETTINGS), createRandom(9));
    for (let i = 0; i < 105; i++) book.add({ ...base, params: { ...base.params, n: i } });
    const list = store.load();
    check('最大100問まで', book.count() === 100, `入った数 ${book.count()}`);
    check('あふれたら古いものから消える', list[0].params.n === 5 && list[99].params.n === 104);
    check('復習は古い順に出る', book.take(3).map((p) => p.params.n).join(',') === '5,6,7');
  }

  // 6. 保存して読み込んでも、整数・分数・文字の答えや問題文が崩れない
  {
    const store = fakeStorage();
    const book = createMistakeBook(store);
    const rand = createRandom(21);
    const originals = ['ratio', 'probability', 'reasoning'].map((id) => buildChoices(generateProblem(id, rand, SETTINGS), rand));
    originals.forEach((p) => book.add(p));
    const loaded = store.load();
    const intact = originals.every((o, i) => {
      const l = loaded[i];
      return l.text === o.text && sameValue(l.answer, o.answer) && valueKind(l.answer) === valueKind(o.answer)
        && l.answerIndex === o.answerIndex && JSON.stringify(l.explanation) === JSON.stringify(o.explanation)
        && l.choices.every((c, j) => formatValue(c.value, l.unit, l.prefix) === formatValue(o.choices[j].value, o.unit, o.prefix) && c.mistake === o.choices[j].mistake);
    });
    check('保存しても整数・分数・文字の答えと問題文が崩れない', intact, loaded.map((l) => valueKind(l.answer)).join('・'));
  }

  // 7. リストが空なら復習は始まらない
  {
    const { quiz } = makeQuiz(createMistakeBook(fakeStorage()));
    check('リストが空なら復習は始まらない（null）', quiz.startReview() === null);
  }

  return results;
}

// 単独で実行されたときだけ、結果を表示する
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const results = runReviewTest();
  for (const r of results) console.log(`${r.ok ? '○' : '×'} ${r.name}${r.detail ? `（${r.detail}）` : ''}`);
  const ng = results.filter((r) => !r.ok).length;
  console.log(`復習機能のテスト：${results.length}件中 ${results.length - ng}件OK`);
  process.exitCode = ng ? 1 : 0;
}
