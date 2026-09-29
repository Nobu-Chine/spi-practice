// 「推論」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解（「アとイ」などの文字）・よくあるミス・解説をセットで返す。
// 文字の答えは values.js の label() で作る。
//
// どの型も同じ流れで作る：本当の答え（並び方・内訳）を1つ決め、それに合う条件を足していき、条件に合うものが2〜6通りになったら止める。
// 推論ア・イ・ウは、条件に合うもの全部で成り立つか（必ず正しい）を調べて答えを決める。
// 条件1つだけで正誤が決まってしまう推論（条件の言い換え）と、ほかの条件からわかる無駄な条件は使わない。
// 検算（solve）は、問題を作る側とは別に書いた判定で、考えられるもの全部を数え上げて確かめる。
//
// 型ごとの違い（考えられるものの一覧・条件と推論の判定・条件の作り方）は「パズル」としてまとめ、共通の流れに渡す。
import { label } from '../core/values.js';

const MARKS = ['ア', 'イ', 'ウ'];
const MIN_MATCHES = 2;
const MAX_MATCHES = 6;

const circled = (i) => '①②③④⑤⑥'[i];

// ア・イ・ウのうち「必ず正しい」ものの組を、選択肢の文字にする
function answerText(indexes) {
  if (indexes.length === 0) return 'どれも必ず正しいとはいえない';
  const names = indexes.map((i) => MARKS[i]);
  return names.length === 1 ? `${names[0]}だけ` : names.join('と');
}

// ==== 共通の流れ（パズル puzzle = { worlds, holds, randomCondition, statements, word }） ====
// worlds：考えられるもの全部（並び方・内訳）　holds(条件か推論, ひとつ)：成り立つか　word：解説での呼び方（「並び方」「内訳」）

// 条件を足していき、条件に合うものが MIN〜MAX 通りになった組を返す
function pickConditions(puzzle, rand, hidden) {
  for (let tries = 0; tries < 200; tries++) {
    const conditions = [];
    let matching = puzzle.worlds;
    for (let step = 0; step < 60 && conditions.length < 4 && matching.length > MAX_MATCHES; step++) {
      const c = puzzle.randomCondition(rand, hidden);
      if (!c) continue;
      const next = matching.filter((w) => puzzle.holds(c, w));
      if (next.length === matching.length || next.length < MIN_MATCHES) continue; // 役に立たない・絞りすぎの条件は使わない
      conditions.push(c);
      matching = next;
    }
    if (matching.length >= MIN_MATCHES && matching.length <= MAX_MATCHES) {
      return { conditions: dropRedundant(puzzle, conditions), matching };
    }
  }
  throw new Error('条件を作れなかった');
}

// ほかの条件から自動的にわかる条件（外しても結果が変わらないもの）は、読む時間が増えるだけなので取り除く
function dropRedundant(puzzle, conditions) {
  const count = (list) => puzzle.worlds.filter((w) => list.every((c) => puzzle.holds(c, w))).length;
  let kept = [...conditions];
  for (const c of conditions) {
    const without = kept.filter((k) => k !== c);
    if (without.length > 0 && count(without) === count(kept)) kept = without;
  }
  return kept;
}

// 条件1つだけで正誤が決まる推論か（条件の言い換え・すぐ否定できるもの）
function decidedByOneCondition(puzzle, statement, conditions) {
  return conditions.some((c) => {
    const withC = puzzle.worlds.filter((w) => puzzle.holds(c, w));
    const truth = withC.map((w) => puzzle.holds(statement, w));
    return truth.every(Boolean) || truth.every((t) => !t);
  });
}

// 推論の分類：always（必ず正しい）・sometimes（ありうる）・never（ありえない）
function classify(puzzle, statement, matching) {
  const count = matching.filter((w) => puzzle.holds(statement, w)).length;
  if (count === matching.length) return 'always';
  return count === 0 ? 'never' : 'sometimes';
}

// 「必ず正しい」推論の数ごとの出やすさ（0個・3個はたまに）
const ALWAYS_COUNTS = [0, 1, 1, 1, 2, 2, 2, 3];

function pickStatements(puzzle, rand, conditions, matching) {
  const usable = puzzle.statements
    .filter((s) => !decidedByOneCondition(puzzle, s, conditions))
    .map((s) => ({ ...s, kind: classify(puzzle, s, matching) }));
  const always = rand.shuffle(usable.filter((s) => s.kind === 'always'));
  const sometimes = rand.shuffle(usable.filter((s) => s.kind === 'sometimes'));
  const never = rand.shuffle(usable.filter((s) => s.kind === 'never'));
  const want = rand.pick(ALWAYS_COUNTS);
  if (always.length < want) return null;
  // 必ず正しくない推論は、主に「ありうる」から選ぶ（定番のひっかけ）。たまに「ありえない」も混ぜる
  const others = [];
  for (let i = 0; i < 3 - want; i++) {
    const pool = rand.next() < 0.8 && sometimes.length ? sometimes : never.length ? never : sometimes;
    if (!pool.length) return null;
    others.push(pool.shift());
  }
  return rand.shuffle([...always.slice(0, want), ...others]);
}

// 正解以外の7通りの組それぞれに、どんなミスでそれを選ぶかの説明をつける。
// 1つだけちがう組（1つ多く選んだ・1つ見落とした）を先に並べる
function buildWrongs(puzzle, statements, correct, matching) {
  const { word } = puzzle;
  const results = [];
  for (let mask = 0; mask < 8; mask++) {
    const picked = [0, 1, 2].filter((i) => mask & (1 << i));
    if (answerText(picked) === answerText(correct)) continue;
    const extra = picked.filter((i) => !correct.includes(i));
    const missed = correct.filter((i) => !picked.includes(i));
    const reasons = [
      ...extra.map((i) => {
        if (statements[i].kind === 'never') return `${MARKS[i]}はどの${word}でも成り立たない`;
        const counter = matching.findIndex((w) => !puzzle.holds(statements[i], w));
        return `${MARKS[i]}は成り立つ${word}もあるが、${circled(counter)}では成り立たない（必ずではない）`;
      }),
      ...missed.map((i) => `${MARKS[i]}はどの${word}でも成り立つのに、見落としてしまった`),
    ];
    // ひっかけ（ありうるを選ぶ）を一番先、次に見落とし、ちがいが多いものほど後
    const score = extra.length + missed.length + (extra.some((i) => statements[i].kind === 'sometimes') ? 0 : 0.5);
    results.push({ value: label(answerText(picked)), mistake: reasons.join('。'), score });
  }
  return results.sort((a, b) => a.score - b.score).map(({ value, mistake }) => ({ value, mistake }));
}

// 条件・推論・誤答・解説をまとめて1問にする（どの型でも同じ形）
function buildProblem(puzzle, { intro, conditions, statements, matching, conditionText, statementText, worldText, listHeader }) {
  const { word } = puzzle;
  const correct = statements.map((st, i) => (st.kind === 'always' ? i : -1)).filter((i) => i >= 0);
  const result = (st) => {
    if (st.kind === 'always') return `どの${word}でも成り立つ → 必ず正しい`;
    if (st.kind === 'never') return `どの${word}でも成り立たない → 正しくない`;
    const yes = matching.map((w, i) => (puzzle.holds(st, w) ? circled(i) : null)).filter(Boolean).join('');
    const no = matching.map((w, i) => (puzzle.holds(st, w) ? null : circled(i))).filter(Boolean).join('');
    return `${yes}では成り立つが${no}では成り立たない → 必ずとはいえない`;
  };

  return {
    params: {
      conditions,
      statements: statements.map(({ kind, ...rest }) => rest),
    },
    text: [
      intro,
      ...conditions.map((c) => `・${conditionText(c)}`),
      '次の推論ア、イ、ウのうち、必ず正しいものはどれか。',
      ...statements.map((st, i) => `${MARKS[i]}：${statementText(st)}`),
    ].join('\n'),
    answer: label(answerText(correct)),
    unit: '',
    wrongs: buildWrongs(puzzle, statements, correct, matching),
    explanation: [
      // 書き出しは1つの行にまとめる（解説の番号と①②が2重にならないように、行の中で改行する）
      [`${listHeader}は、次の${matching.length}通り`, ...matching.map((w, i) => `${circled(i)} ${worldText(w)}`)].join('\n'),
      ...statements.map((st, i) => `${MARKS[i]}「${statementText(st)}」：${result(st)}`),
      `よって、必ず正しいのは「${answerText(correct)}」`,
      `ポイント：「必ず正しい」は、考えられる${word}すべてで成り立つもの。1つでも成り立たない${word}（反例）があれば選ばない`,
    ],
  };
}

// check.js が使う独自チェック：条件に合うものが2〜6通りか、条件1つだけで決まる推論がないか、同じ推論が2回出ていないか、無駄な条件がないか
function validatePuzzle(puzzle, { conditions, statements }) {
  const errors = [];
  const matchCount = (list) => puzzle.worlds.filter((w) => list.every((c) => puzzle.holds(c, w))).length;
  const count = matchCount(conditions);
  if (count < MIN_MATCHES || count > MAX_MATCHES) errors.push(`条件に合う${puzzle.word}が${count}通り`);
  statements.forEach((st, i) => {
    if (decidedByOneCondition(puzzle, st, conditions)) errors.push(`${MARKS[i]}が条件1つだけで決まる（言い換え）`);
  });
  if (new Set(statements.map((st) => JSON.stringify(st))).size !== statements.length) errors.push('同じ推論が2回出ている');
  conditions.forEach((c, i) => {
    if (matchCount(conditions.filter((_, j) => j !== i)) === count) errors.push(`条件${i + 1}はほかの条件からわかる（なくても同じ）`);
  });
  return errors;
}

// ==== A. 順位 ====

const PEOPLE = ['A', 'B', 'C', 'D', 'E'];

// 場面ごとの言い方（「先に」＝順位が上）
const RANK_SCENES = [
  {
    intro: 'A、B、C、D、Eの5人が徒競走をした。同時にゴールした人はいない。次のことがわかっている。',
    before: (x, y) => `${x}は${y}より先にゴールした`,
    justAfter: (x, y) => `${y}は${x}のすぐ後にゴールした`,
    rank: (x, k) => `${x}は${k}位だった`,
    between: (x, y) => `${x}と${y}の間に1人だけゴールした`,
    sBefore: (x, y) => `${x}は${y}より先にゴールした`,
  },
  {
    intro: 'A、B、C、D、Eの5人がテストを受けた。同じ点数の人はいない。点数の高い順の順位について、次のことがわかっている。',
    before: (x, y) => `${x}は${y}より点数が高かった`,
    justAfter: (x, y) => `${y}は${x}のすぐ下の順位だった`,
    rank: (x, k) => `${x}は${k}位だった`,
    between: (x, y) => `${x}と${y}の順位の間に1人だけいた`,
    sBefore: (x, y) => `${x}は${y}より点数が高い`,
  },
];

// 5人の並び方120通り（配列の0番目が1位）
function allOrders() {
  const result = [];
  (function walk(rest, picked) {
    if (rest.length === 0) return result.push(picked);
    rest.forEach((p, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, p]));
  })(PEOPLE, []);
  return result;
}

const rankIn = (order, person) => order.indexOf(person) + 1;

const rankPuzzle = {
  word: '並び方',
  worlds: allOrders(),
  // 条件・推論が、ある並び方で成り立つか（問題を作る側の判定）
  holds(item, order) {
    const r = (p) => rankIn(order, p);
    switch (item.type) {
      case 'before': return r(item.x) < r(item.y);
      case 'justAfter': return r(item.y) === r(item.x) + 1;
      case 'rank': return r(item.x) === item.k;
      case 'between': return Math.abs(r(item.x) - r(item.y)) === 2;
      case 'top3': return r(item.x) <= 3;
      default: throw new Error(`知らない種類: ${item.type}`);
    }
  },
  randomCondition(rand, order) {
    const [x, y] = rand.shuffle(PEOPLE);
    const type = rand.pick(['before', 'before', 'justAfter', 'rank', 'between']);
    const r = (p) => rankIn(order, p);
    if (type === 'rank') return { type, x, k: r(x) };
    if (type === 'before') return r(x) < r(y) ? { type, x, y } : { type, x: y, y: x };
    if (type === 'justAfter') {
      // 本当の順位で x のすぐ後の人を y にする（x が最下位なら作れない）
      const next = order[r(x)];
      return next ? { type, x, y: next } : null;
    }
    // between：本当の順位で2つ離れた人
    const partner = order[r(x) + 1] ?? order[r(x) - 3];
    return partner ? { type, x, y: partner } : null;
  },
  statements: (() => {
    const list = [];
    for (const x of PEOPLE) {
      for (let k = 1; k <= 5; k++) list.push({ type: 'rank', x, k });
      list.push({ type: 'top3', x });
      for (const y of PEOPLE) if (x !== y) list.push({ type: 'before', x, y });
    }
    return list;
  })(),
};

const ranking = {
  id: 'reasoning-ranking',
  generate(rand) {
    for (;;) {
      const s = rand.pick(RANK_SCENES);
      const order = rand.shuffle(PEOPLE);
      const { conditions, matching } = pickConditions(rankPuzzle, rand, order);
      const statements = pickStatements(rankPuzzle, rand, conditions, matching);
      if (!statements) continue;
      return buildProblem(rankPuzzle, {
        intro: s.intro,
        conditions,
        statements,
        matching,
        conditionText: (c) => (c.type === 'rank' ? s.rank(c.x, c.k) : s[c.type](c.x, c.y)),
        statementText: (st) => {
          if (st.type === 'rank') return `${st.x}は${st.k}位である`;
          if (st.type === 'top3') return `${st.x}は3位以内である`;
          return s.sBefore(st.x, st.y);
        },
        worldText: (order) => order.join(' → '),
        listHeader: '条件に合う順位（1位 → 5位）',
      });
    }
  },
  // 検算：問題を作る側とは別に書いた判定で、120通りの並び方を全部たどる
  solve({ conditions, statements }) {
    const ok = (item, order) => {
      const pos = Object.fromEntries(order.map((p, i) => [p, i + 1]));
      if (item.type === 'before') return pos[item.x] < pos[item.y];
      if (item.type === 'justAfter') return pos[item.y] - pos[item.x] === 1;
      if (item.type === 'rank') return pos[item.x] === item.k;
      if (item.type === 'between') return pos[item.x] - pos[item.y] === 2 || pos[item.y] - pos[item.x] === 2;
      if (item.type === 'top3') return pos[item.x] < 4;
      return false;
    };
    const matching = rankPuzzle.worlds.filter((o) => conditions.every((c) => ok(c, o)));
    const sure = statements.map((st, i) => (matching.every((o) => ok(st, o)) ? i : -1)).filter((i) => i >= 0);
    return label(answerText(sure));
  },
  validate: (params) => validatePuzzle(rankPuzzle, params),
};

// ==== B. 内訳 ====
// 3種類のものが合わせて total 個。どれも1個以上。内訳は [1つ目の個数, 2つ目の個数, 3つ目の個数]

const BREAKDOWN_SCENES = [
  {
    names: ['赤', '青', '白'],
    intro: (total) => `赤・青・白の3色の玉が、合わせて${total}個ある。どの色も1個以上ある。次のことがわかっている。`,
    allDiff: '3色とも個数がちがう',
  },
  {
    names: ['りんご', 'みかん', 'もも'],
    intro: (total) => `りんご・みかん・ももを、合わせて${total}個買った。どれも1個以上買った。次のことがわかっている。`,
    allDiff: '3種類とも個数がちがう',
  },
];
const BREAKDOWN_TOTALS = [8, 9, 10, 11, 12];

// 合計 total 個で、3つともが1個以上の内訳を全部並べる
function allBreakdowns(total) {
  const list = [];
  for (let a = 1; a <= total - 2; a++) for (let b = 1; a + b <= total - 1; b++) list.push([a, b, total - a - b]);
  return list;
}

// 合計ごとにパズルを作る（考えられる内訳の一覧と推論の候補が合計で変わるため）
function breakdownPuzzle(total) {
  const statements = [];
  for (let x = 0; x < 3; x++) {
    for (let k = 1; k <= total - 2; k++) statements.push({ type: 'exact', x, k });
    for (let k = 2; k <= total - 2; k++) statements.push({ type: 'atLeast', x, k });
    for (let y = 0; y < 3; y++) if (x !== y) statements.push({ type: 'more', x, y });
    statements.push({ type: 'most', x });
  }
  return {
    word: '内訳',
    worlds: allBreakdowns(total),
    holds(item, t) {
      switch (item.type) {
        case 'more': return t[item.x] > t[item.y];
        case 'atLeast': return t[item.x] >= item.k;
        case 'atMost': return t[item.x] <= item.k;
        case 'sum2': return t[item.x] + t[item.y] === item.m;
        case 'twice': return t[item.x] === 2 * t[item.y];
        case 'allDiff': return t[0] !== t[1] && t[1] !== t[2] && t[0] !== t[2];
        case 'exact': return t[item.x] === item.k;
        case 'most': return [0, 1, 2].every((j) => j === item.x || t[item.x] > t[j]);
        default: throw new Error(`知らない種類: ${item.type}`);
      }
    },
    // 本当の内訳 hidden で成り立つ条件を1つ作る（作れない組み合わせなら null）
    randomCondition(rand, hidden) {
      const [x, y] = rand.shuffle([0, 1, 2]);
      const type = rand.pick(['more', 'more', 'atLeast', 'atMost', 'sum2', 'sum2', 'twice', 'allDiff']);
      if (type === 'more') {
        if (hidden[x] === hidden[y]) return null;
        return hidden[x] > hidden[y] ? { type, x, y } : { type, x: y, y: x };
      }
      if (type === 'atLeast') {
        const k = hidden[x] - rand.int(0, 1);
        return k >= 2 ? { type, x, k } : null;
      }
      if (type === 'atMost') {
        const k = hidden[x] + rand.int(0, 1);
        return k <= total - 3 ? { type, x, k } : null;
      }
      // 「合わせると」は、問題文の最初の紹介と同じ順番で書く（「ももとりんご」ではなく「りんごともも」）
      if (type === 'sum2') return { type, x: Math.min(x, y), y: Math.max(x, y), m: hidden[x] + hidden[y] };
      if (type === 'twice') return hidden[x] === 2 * hidden[y] ? { type, x, y } : null;
      return hidden[0] !== hidden[1] && hidden[1] !== hidden[2] && hidden[0] !== hidden[2] ? { type: 'allDiff' } : null;
    },
    statements,
  };
}
const BREAKDOWN_PUZZLES = Object.fromEntries(BREAKDOWN_TOTALS.map((t) => [t, breakdownPuzzle(t)]));

const breakdown = {
  id: 'reasoning-breakdown',
  generate(rand) {
    for (;;) {
      const s = rand.pick(BREAKDOWN_SCENES);
      const total = rand.pick(BREAKDOWN_TOTALS);
      const puzzle = BREAKDOWN_PUZZLES[total];
      const hidden = rand.pick(puzzle.worlds);
      const { conditions, matching } = pickConditions(puzzle, rand, hidden);
      const statements = pickStatements(puzzle, rand, conditions, matching);
      if (!statements) continue;
      const n = (i) => s.names[i];
      const conditionText = (c) => {
        if (c.type === 'more') return `${n(c.x)}は${n(c.y)}より多い`;
        if (c.type === 'atLeast') return `${n(c.x)}は${c.k}個以上ある`;
        if (c.type === 'atMost') return `${n(c.x)}は${c.k}個以下である`;
        if (c.type === 'sum2') return `${n(c.x)}と${n(c.y)}を合わせると${c.m}個`;
        if (c.type === 'twice') return `${n(c.x)}の個数は${n(c.y)}のちょうど2倍`;
        return s.allDiff;
      };
      const result = buildProblem(puzzle, {
        intro: s.intro(total),
        conditions,
        statements,
        matching,
        conditionText,
        statementText: (st) => {
          if (st.type === 'exact') return `${n(st.x)}は${st.k}個である`;
          if (st.type === 'atLeast') return `${n(st.x)}は${st.k}個以上である`;
          if (st.type === 'more') return `${n(st.x)}は${n(st.y)}より多い`;
          return `${n(st.x)}が一番多い`;
        },
        worldText: (t) => t.map((count, i) => `${n(i)}${count}個`).join('・'),
        listHeader: '条件に合う内訳',
      });
      // 検算で使うため、合計の個数も問題の数字として残す
      return { ...result, params: { total, ...result.params } };
    }
  },
  // 検算：問題を作る側とは別に書いた判定で、合計 total 個の内訳を全部たどる
  solve({ total, conditions, statements }) {
    const ok = (item, [a, b, c]) => {
      const count = [a, b, c];
      const v = (i) => count[i];
      if (item.type === 'more') return v(item.x) - v(item.y) > 0;
      if (item.type === 'atLeast') return v(item.x) >= item.k;
      if (item.type === 'atMost') return !(v(item.x) > item.k);
      if (item.type === 'sum2') return v(item.x) + v(item.y) === item.m;
      if (item.type === 'twice') return v(item.x) === v(item.y) + v(item.y);
      if (item.type === 'allDiff') return new Set(count).size === 3;
      if (item.type === 'exact') return v(item.x) === item.k;
      if (item.type === 'most') return v(item.x) === Math.max(a, b, c) && count.filter((x) => x === v(item.x)).length === 1;
      return false;
    };
    const worlds = [];
    for (let a = 1; a < total; a++) for (let b = 1; b < total; b++) if (total - a - b >= 1) worlds.push([a, b, total - a - b]);
    const matching = worlds.filter((w) => conditions.every((c) => ok(c, w)));
    const sure = statements.map((st, i) => (matching.every((w) => ok(st, w)) ? i : -1)).filter((i) => i >= 0);
    return label(answerText(sure));
  },
  validate: (params) => validatePuzzle(BREAKDOWN_PUZZLES[params.total], params),
};

export default {
  id: 'reasoning',
  label: '推論',
  templates: [ranking, breakdown],
};
