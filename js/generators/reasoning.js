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

// ==== 共通の流れ（パズル puzzle = { worlds, holds, randomCondition, statements, word, maxConditions?, minMatches?, maxMatches? }） ====
// worlds：考えられるもの全部（並び方・内訳・部屋割り）　holds(条件か推論, ひとつ)：成り立つか　word：解説での呼び方（「並び方」など）
// maxConditions：条件をいくつまで使うか（書かなければ4個。考えられるものが多い型は多めにする）
// minMatches・maxMatches：条件に合うものが何通りならよいか（書かなければ2〜6通り）
// sameSubject(推論a, 推論b)：同じことを裏表で聞く推論か（書けば、そういう推論どうしを1問に一緒に出さない）

// 条件を足していき、条件に合うものが MIN〜MAX 通りになった組を返す
function pickConditions(puzzle, rand, hidden) {
  const maxConditions = puzzle.maxConditions ?? 4;
  for (let tries = 0; tries < 200; tries++) {
    const conditions = [];
    let matching = puzzle.worlds;
    for (let step = 0; step < 60 && conditions.length < maxConditions && matching.length > MAX_MATCHES; step++) {
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
  return decidedGiven(puzzle, statement, conditions.map((c) => puzzle.worlds.filter((w) => puzzle.holds(c, w))));
}

// 上と同じ判定。条件ごとに「その条件だけに合うもの」を先に数えておいたものを使う（推論の候補が多い型でも速くするため）
function decidedGiven(puzzle, statement, worldsPerCondition) {
  return worldsPerCondition.some((withC) => {
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
  const worldsPerCondition = conditions.map((c) => puzzle.worlds.filter((w) => puzzle.holds(c, w)));
  const usable = puzzle.statements
    .filter((s) => !decidedGiven(puzzle, s, worldsPerCondition))
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
  const picked = [...always.slice(0, want), ...others];
  // 同じことを裏表で聞く推論（「Cは正直者」と「Cはうそつき」など）が一緒に出ると、片方で両方が決まってしまうので選び直す。
  // この決まりはパズルに sameSubject があるときだけ使う
  if (puzzle.sameSubject && picked.some((a, i) => picked.some((b, j) => i < j && puzzle.sameSubject(a, b)))) return null;
  return rand.shuffle(picked);
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

// 条件・推論・誤答・解説をまとめて1問にする（どの型でも同じ形）。
// conditionLine：条件1つを問題文の1行にする書き方（書かなければ「・条件」）　hint：解説の最初に置く考え方（書かなければなし）
function buildProblem(puzzle, { intro, conditions, statements, matching, conditionText, statementText, worldText, listHeader, conditionLine, hint }) {
  const line = conditionLine ?? ((c) => `・${conditionText(c)}`);
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
      ...conditions.map(line),
      '次の推論ア、イ、ウのうち、必ず正しいものはどれか。',
      ...statements.map((st, i) => `${MARKS[i]}：${statementText(st)}`),
    ].join('\n'),
    answer: label(answerText(correct)),
    unit: '',
    wrongs: buildWrongs(puzzle, statements, correct, matching),
    explanation: [
      ...(hint ? [hint] : []),
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
  const [min, max] = [puzzle.minMatches ?? MIN_MATCHES, puzzle.maxMatches ?? MAX_MATCHES];
  if (count < min || count > max) errors.push(`条件に合う${puzzle.word}が${count}通り`);
  statements.forEach((st, i) => {
    if (decidedByOneCondition(puzzle, st, conditions)) errors.push(`${MARKS[i]}が条件1つだけで決まる（言い換え）`);
  });
  if (new Set(statements.map((st) => JSON.stringify(st))).size !== statements.length) errors.push('同じ推論が2回出ている');
  if (puzzle.sameSubject && statements.some((a, i) => statements.some((b, j) => i < j && puzzle.sameSubject(a, b)))) {
    errors.push('同じことを裏表で聞く推論が一緒に出ている');
  }
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

// ==== C. 位置（2階建てアパートの部屋割り） ====
// 部屋は6つ。番号 0〜2 が1階の左から（101・102・103号室）、3〜5 が2階の左から（201・202・203号室）。201は101の真上。
// 部屋割りは「部屋の番号順に、住んでいる人を並べたもの」

const TENANTS = ['A', 'B', 'C', 'D', 'E', 'F'];
const COLUMN_NAMES = ['左端', '真ん中', '右端'];
const roomNumber = (i) => (i < 3 ? 101 + i : 201 + i - 3);

function allAssignments() {
  const result = [];
  (function walk(rest, picked) {
    if (rest.length === 0) return result.push(picked);
    rest.forEach((p, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, p]));
  })(TENANTS, []);
  return result;
}

// 人の部屋の番号（0〜5）・階（1か2）・左右の位置（0〜2）
const roomOf = (w, p) => w.indexOf(p);
const floorOf = (w, p) => (roomOf(w, p) < 3 ? 1 : 2);
const columnOf = (w, p) => roomOf(w, p) % 3;

const apartmentPuzzle = {
  word: '部屋割り',
  worlds: allAssignments(),
  maxConditions: 5,
  holds(item, w) {
    switch (item.type) {
      case 'above': return floorOf(w, item.x) === 2 && floorOf(w, item.y) === 1 && columnOf(w, item.x) === columnOf(w, item.y);
      case 'sameFloor': return floorOf(w, item.x) === floorOf(w, item.y);
      case 'diffFloor': return floorOf(w, item.x) !== floorOf(w, item.y);
      case 'nextTo': return floorOf(w, item.x) === floorOf(w, item.y) && Math.abs(columnOf(w, item.x) - columnOf(w, item.y)) === 1;
      case 'floor': return floorOf(w, item.x) === item.f;
      case 'column': return columnOf(w, item.x) === item.c;
      case 'room': return roomOf(w, item.x) === item.r;
      default: throw new Error(`知らない種類: ${item.type}`);
    }
  },
  // 本当の部屋割り hidden で成り立つ条件を1つ作る（作れない組み合わせなら null）。
  // 入れ替えても意味が同じ条件（同じ階・違う階・隣どうし）は、読みやすいよう A→F の順で書く
  randomCondition(rand, hidden) {
    const pick = this.pickCondition(rand, hidden);
    if (pick && ['sameFloor', 'diffFloor', 'nextTo'].includes(pick.type) && pick.x > pick.y) return { ...pick, x: pick.y, y: pick.x };
    return pick;
  },
  pickCondition(rand, hidden) {
    const [x, y] = rand.shuffle(TENANTS);
    const type = rand.pick(['above', 'above', 'sameFloor', 'diffFloor', 'nextTo', 'nextTo', 'floor', 'column']);
    const room = roomOf(hidden, x);
    if (type === 'above') {
      // x の真上か真下の人と組にする（上にいる人を先に書く）
      const other = hidden[room < 3 ? room + 3 : room - 3];
      return room >= 3 ? { type, x, y: other } : { type, x: other, y: x };
    }
    if (type === 'sameFloor') return floorOf(hidden, x) === floorOf(hidden, y) ? { type, x, y } : null;
    if (type === 'diffFloor') return floorOf(hidden, x) !== floorOf(hidden, y) ? { type, x, y } : null;
    if (type === 'nextTo') {
      const neighbors = [room - 1, room + 1].filter((r) => r >= 0 && r <= 5 && Math.floor(r / 3) === Math.floor(room / 3));
      return { type, x, y: hidden[rand.pick(neighbors)] };
    }
    if (type === 'floor') return { type, x, f: floorOf(hidden, x) };
    return { type: 'column', x, c: columnOf(hidden, x) };
  },
  statements: (() => {
    const list = [];
    for (const x of TENANTS) {
      for (let r = 0; r < 6; r++) list.push({ type: 'room', x, r });
      for (const f of [1, 2]) list.push({ type: 'floor', x, f });
      for (let c = 0; c < 3; c++) list.push({ type: 'column', x, c });
      for (const y of TENANTS) {
        if (x === y) continue;
        list.push({ type: 'above', x, y });
        if (x < y) list.push({ type: 'sameFloor', x, y }, { type: 'nextTo', x, y });
      }
    }
    return list;
  })(),
};

const APARTMENT_INTRO = [
  'A〜Fの6人が、2階建てのアパートに1人1部屋ずつ住んでいる。',
  '1階は左から101・102・103号室、2階は左から201・202・203号室で、201号室は101号室の真上にある。次のことがわかっている。',
].join('\n');

const apartment = {
  id: 'reasoning-apartment',
  generate(rand) {
    for (;;) {
      const hidden = rand.shuffle(TENANTS);
      const { conditions, matching } = pickConditions(apartmentPuzzle, rand, hidden);
      const statements = pickStatements(apartmentPuzzle, rand, conditions, matching);
      if (!statements) continue;
      const conditionText = (c) => {
        if (c.type === 'above') return `${c.x}の部屋は${c.y}の部屋の真上にある`;
        if (c.type === 'sameFloor') return `${c.x}と${c.y}は同じ階に住んでいる`;
        if (c.type === 'diffFloor') return `${c.x}と${c.y}は違う階に住んでいる`;
        if (c.type === 'nextTo') return `${c.x}と${c.y}の部屋は隣どうしである`;
        if (c.type === 'floor') return `${c.x}は${c.f}階に住んでいる`;
        return `${c.x}の部屋は${COLUMN_NAMES[c.c]}にある`;
      };
      const statementText = (st) => {
        if (st.type === 'room') return `${st.x}は${roomNumber(st.r)}号室に住んでいる`;
        if (st.type === 'floor') return `${st.x}は${st.f}階に住んでいる`;
        if (st.type === 'column') return `${st.x}の部屋は${COLUMN_NAMES[st.c]}である`;
        if (st.type === 'above') return `${st.x}の部屋は${st.y}の部屋の真上である`;
        if (st.type === 'sameFloor') return `${st.x}と${st.y}は同じ階である`;
        return `${st.x}と${st.y}の部屋は隣どうしである`;
      };
      return buildProblem(apartmentPuzzle, {
        intro: APARTMENT_INTRO,
        conditions,
        statements,
        matching,
        conditionText,
        statementText,
        worldText: (w) => `2階 ${w[3]}・${w[4]}・${w[5]} ／ 1階 ${w[0]}・${w[1]}・${w[2]}`,
        listHeader: '条件に合う部屋割り（それぞれ左から）',
      });
    }
  },
  // 検算：問題を作る側とは別に書いた判定で、720通りの部屋割りを号室の数字で全部たどる
  solve({ conditions, statements }) {
    const ok = (item, w) => {
      const num = Object.fromEntries(w.map((p, i) => [p, roomNumber(i)])); // 例：{ A: 203, ... }
      const floor = (p) => Math.floor(num[p] / 100);
      const col = (p) => num[p] % 100; // 1〜3（左から）
      if (item.type === 'above') return num[item.x] - num[item.y] === 100;
      if (item.type === 'sameFloor') return floor(item.x) === floor(item.y);
      if (item.type === 'diffFloor') return floor(item.x) !== floor(item.y);
      if (item.type === 'nextTo') return floor(item.x) === floor(item.y) && Math.abs(num[item.x] - num[item.y]) === 1;
      if (item.type === 'floor') return floor(item.x) === item.f;
      if (item.type === 'column') return col(item.x) === item.c + 1;
      if (item.type === 'room') return num[item.x] === roomNumber(item.r);
      return false;
    };
    const matching = apartmentPuzzle.worlds.filter((w) => conditions.every((c) => ok(c, w)));
    const sure = statements.map((st, i) => (matching.every((w) => ok(st, w)) ? i : -1)).filter((i) => i >= 0);
    return label(answerText(sure));
  },
  validate: (params) => validatePuzzle(apartmentPuzzle, params),
};

// ==== D. 正誤（正直者とうそつき） ====
// 4人それぞれが正直者（true）かうそつき（false）。組み合わせは [Aが正直者か, Bが…, Cが…, Dが…] の16通り。
// 条件は「全員が1回ずつ話した発言」。正直者の発言は本当、うそつきの発言はうそになる組み合わせだけが残る。
// 絞りきれないときだけ「正直者は◯人」を足す。うそつき問題は答えが1通りに決まることが多いので、1〜4通りまで許す

const SPEAKERS = ['A', 'B', 'C', 'D'];
const honestWorlds = Array.from({ length: 16 }, (_, bits) => SPEAKERS.map((_, i) => Boolean(bits & (1 << i))));
const liarCountOf = (w) => w.filter((h) => !h).length;

// 発言の中身（claim）が、ある組み合わせで本当か
function claimTrue(claim, w) {
  if (claim.type === 'honest') return w[SPEAKERS.indexOf(claim.q)];
  if (claim.type === 'liar') return !w[SPEAKERS.indexOf(claim.q)];
  return liarCountOf(w) === claim.k; // liarCount：うそつきの人数
}

const honestyPuzzle = {
  word: '組み合わせ',
  worlds: honestWorlds,
  minMatches: 1,
  maxMatches: 4,
  holds(item, w) {
    switch (item.type) {
      // 発言：話した人が正直者なら中身は本当、うそつきなら中身はうそ
      case 'says': return w[SPEAKERS.indexOf(item.p)] === claimTrue(item.claim, w);
      case 'honestCount': return w.filter(Boolean).length === item.k;
      case 'isHonest': return w[SPEAKERS.indexOf(item.x)];
      case 'isLiar': return !w[SPEAKERS.indexOf(item.x)];
      case 'liarsAre': return liarCountOf(w) === item.k;
      default: throw new Error(`知らない種類: ${item.type}`);
    }
  },
  statements: [
    ...SPEAKERS.map((x) => ({ type: 'isHonest', x })),
    ...SPEAKERS.map((x) => ({ type: 'isLiar', x })),
    ...[1, 2, 3].map((k) => ({ type: 'liarsAre', k })),
  ],
  // 同じことを聞く推論か：同じ人が正直者かうそつきか／うそつきの人数
  sameSubject(a, b) {
    if (a.type === 'liarsAre' || b.type === 'liarsAre') return a.type === b.type;
    return a.x === b.x;
  },
};

// 本当の組み合わせ hidden で、話した人 p が言えること（正直者なら本当のこと、うそつきならうそ）を1つ選ぶ
function randomSpeech(rand, hidden, p) {
  const others = SPEAKERS.filter((q) => q !== p);
  const claims = [
    ...others.map((q) => ({ type: 'honest', q })),
    ...others.map((q) => ({ type: 'liar', q })),
    ...[0, 1, 2, 3].map((k) => ({ type: 'liarCount', k })),
  ];
  const sayable = claims.filter((claim) => claimTrue(claim, hidden) === hidden[SPEAKERS.indexOf(p)]);
  return { type: 'says', p, claim: rand.pick(sayable) };
}

// 全員の発言（と、必要なら「正直者は◯人」）を作る。どの条件も外すと結果が変わる（無駄がない）組だけを使う
function pickHonestyConditions(rand, hidden) {
  const count = (list) => honestWorlds.filter((w) => list.every((c) => honestyPuzzle.holds(c, w))).length;
  for (let tries = 0; tries < 500; tries++) {
    const conditions = SPEAKERS.map((p) => randomSpeech(rand, hidden, p));
    // 2人が同じことを言うと問題文が単調になるので、4人の発言は全部ちがう内容にする
    if (new Set(conditions.map((c) => JSON.stringify(c.claim))).size !== SPEAKERS.length) continue;
    if (count(conditions) > honestyPuzzle.maxMatches) conditions.push({ type: 'honestCount', k: hidden.filter(Boolean).length });
    const matches = count(conditions);
    if (matches < honestyPuzzle.minMatches || matches > honestyPuzzle.maxMatches) continue;
    const allNeeded = conditions.every((c) => count(conditions.filter((k) => k !== c)) !== matches);
    if (!allNeeded) continue;
    return { conditions, matching: honestWorlds.filter((w) => conditions.every((c) => honestyPuzzle.holds(c, w))) };
  }
  throw new Error('発言を作れなかった');
}

const HONESTY_INTRO = [
  'A、B、C、Dの4人は、それぞれ正直者かうそつきのどちらかである。',
  '正直者はいつも本当のことを言い、うそつきはいつもうそを言う。4人は次のように話した。',
].join('\n');

const claimText = (claim) => {
  if (claim.type === 'honest') return `${claim.q}は正直者だ`;
  if (claim.type === 'liar') return `${claim.q}はうそつきだ`;
  return claim.k === 0 ? 'この中にうそつきはいない' : `この中にうそつきは${claim.k}人いる`;
};

const honesty = {
  id: 'reasoning-honesty',
  generate(rand) {
    for (;;) {
      // 本当の組み合わせ：うそつきは1〜3人
      const liars = rand.int(1, 3);
      const hidden = rand.shuffle(SPEAKERS.map((_, i) => i >= liars));
      const { conditions, matching } = pickHonestyConditions(rand, hidden);
      const statements = pickStatements(honestyPuzzle, rand, conditions, matching);
      if (!statements) continue;
      const names = (w, want) => SPEAKERS.filter((_, i) => w[i] === want).join('・') || 'いない';
      return buildProblem(honestyPuzzle, {
        intro: HONESTY_INTRO,
        conditions,
        statements,
        matching,
        conditionText: (c) => (c.type === 'says' ? `${c.p}「${claimText(c.claim)}」` : `4人のうち、正直者は${c.k}人である`),
        conditionLine: (c) => (c.type === 'says' ? `${c.p}「${claimText(c.claim)}」` : `また、4人のうち正直者は${c.k}人であることがわかっている。`),
        statementText: (st) => {
          if (st.type === 'isHonest') return `${st.x}は正直者である`;
          if (st.type === 'isLiar') return `${st.x}はうそつきである`;
          return `うそつきは${st.k}人である`;
        },
        worldText: (w) => `正直者：${names(w, true)} ／ うそつき：${names(w, false)}`,
        listHeader: '全員の発言と食い違わない組み合わせ',
        hint: '考え方：だれか1人を正直者（またはうそつき）と仮に決め、その人の発言から順にほかの人を決めていく。全員の発言と食い違わない組み合わせだけを残す',
      });
    }
  },
  // 検算：問題を作る側とは別に書いた判定で、正直者・うそつきの16通りを全部たどる
  solve({ conditions, statements }) {
    const ok = (item, honest) => {
      const liarsCount = SPEAKERS.filter((p) => !honest[p]).length;
      const said = (claim) => (claim.type === 'honest' ? honest[claim.q] === true : claim.type === 'liar' ? honest[claim.q] === false : liarsCount === claim.k);
      if (item.type === 'says') return honest[item.p] ? said(item.claim) : !said(item.claim);
      if (item.type === 'honestCount') return 4 - liarsCount === item.k;
      if (item.type === 'isHonest') return honest[item.x] === true;
      if (item.type === 'isLiar') return honest[item.x] === false;
      if (item.type === 'liarsAre') return liarsCount === item.k;
      return false;
    };
    const all = [];
    for (let bits = 0; bits < 16; bits++) all.push(Object.fromEntries(SPEAKERS.map((p, i) => [p, (bits >> i) % 2 === 1])));
    const matching = all.filter((h) => conditions.every((c) => ok(c, h)));
    const sure = statements.map((st, i) => (matching.every((h) => ok(st, h)) ? i : -1)).filter((i) => i >= 0);
    return label(answerText(sure));
  },
  validate: (params) => validatePuzzle(honestyPuzzle, params),
};

export default {
  id: 'reasoning',
  label: '推論',
  templates: [ranking, breakdown, apartment, honesty],
};
