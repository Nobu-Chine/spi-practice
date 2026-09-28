// 「推論」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解（「アとイ」などの文字）・よくあるミス・解説をセットで返す。
// 文字の答えは values.js の label() で作る。
//
// 順位の推論：5人の本当の順位を決め、それに合う条件を足していき、条件に合う並び方が2〜6通りになったら止める。
// 推論ア・イ・ウは、全部の並び方で成り立つか（必ず正しい）を調べて答えを決める。
// 条件1つだけで正誤が決まってしまう推論（条件の言い換え）は、考えなくても解けるので使わない。
// 検算（solve）は、問題を作る側とは別に書いた判定で、120通りの並び方を全部数え上げて確かめる。
import { label } from '../core/values.js';

const PEOPLE = ['A', 'B', 'C', 'D', 'E'];
const MARKS = ['ア', 'イ', 'ウ'];
const MIN_ORDERS = 2;
const MAX_ORDERS = 6;

// 場面ごとの言い方（「先に」＝順位が上）
const SCENES = [
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

// ---- 並び方の道具 ----

// 5人の並び方120通り（配列の0番目が1位）
function allOrders() {
  const result = [];
  (function walk(rest, picked) {
    if (rest.length === 0) return result.push(picked);
    rest.forEach((p, i) => walk([...rest.slice(0, i), ...rest.slice(i + 1)], [...picked, p]));
  })(PEOPLE, []);
  return result;
}
const ORDERS = allOrders();

// 順位（1〜5）を調べる
const rankIn = (order, person) => order.indexOf(person) + 1;

// 条件・推論が、ある並び方で成り立つか（問題を作る側の判定）
function holds(item, order) {
  const r = (p) => rankIn(order, p);
  switch (item.type) {
    case 'before': return r(item.x) < r(item.y);
    case 'justAfter': return r(item.y) === r(item.x) + 1;
    case 'rank': return r(item.x) === item.k;
    case 'between': return Math.abs(r(item.x) - r(item.y)) === 2;
    case 'top3': return r(item.x) <= 3;
    default: throw new Error(`知らない種類: ${item.type}`);
  }
}

const orderText = (order) => order.join(' → ');
const circled = (i) => '①②③④⑤⑥'[i];

// ア・イ・ウのうち「必ず正しい」ものの組を、選択肢の文字にする
function answerText(indexes) {
  if (indexes.length === 0) return 'どれも必ず正しいとはいえない';
  const names = indexes.map((i) => MARKS[i]);
  return names.length === 1 ? `${names[0]}だけ` : names.join('と');
}

// ---- 条件づくり ----

function randomCondition(rand, order) {
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
}

// 条件を足していき、条件に合う並び方が MIN〜MAX 通りになった組を返す
function pickConditions(rand, order) {
  for (let tries = 0; tries < 200; tries++) {
    const conditions = [];
    let matching = ORDERS;
    for (let step = 0; step < 60 && conditions.length < 4 && matching.length > MAX_ORDERS; step++) {
      const c = randomCondition(rand, order);
      if (!c) continue;
      const next = matching.filter((o) => holds(c, o));
      if (next.length === matching.length || next.length < MIN_ORDERS) continue; // 役に立たない・絞りすぎの条件は使わない
      conditions.push(c);
      matching = next;
    }
    if (matching.length >= MIN_ORDERS && matching.length <= MAX_ORDERS) return { conditions: dropRedundant(conditions), matching };
  }
  throw new Error('条件を作れなかった');
}

// ほかの条件から自動的にわかる条件（外しても並び方が変わらないもの）は、読む時間が増えるだけなので取り除く
function dropRedundant(conditions) {
  const count = (list) => ORDERS.filter((o) => list.every((c) => holds(c, o))).length;
  let kept = [...conditions];
  for (const c of conditions) {
    const without = kept.filter((k) => k !== c);
    if (without.length > 0 && count(without) === count(kept)) kept = without;
  }
  return kept;
}

// ---- 推論づくり ----

function allStatements() {
  const list = [];
  for (const x of PEOPLE) {
    for (let k = 1; k <= 5; k++) list.push({ type: 'rank', x, k });
    list.push({ type: 'top3', x });
    for (const y of PEOPLE) if (x !== y) list.push({ type: 'before', x, y });
  }
  return list;
}
const STATEMENTS = allStatements();

// 条件1つだけで正誤が決まる推論か（条件の言い換え・すぐ否定できるもの）
function decidedByOneCondition(statement, conditions) {
  return conditions.some((c) => {
    const withC = ORDERS.filter((o) => holds(c, o));
    const truth = withC.map((o) => holds(statement, o));
    return truth.every(Boolean) || truth.every((t) => !t);
  });
}

// 推論の分類：always（必ず正しい）・sometimes（ありうる）・never（ありえない）
function classify(statement, matching) {
  const count = matching.filter((o) => holds(statement, o)).length;
  if (count === matching.length) return 'always';
  return count === 0 ? 'never' : 'sometimes';
}

// 「必ず正しい」推論の数ごとの出やすさ（0個・3個はたまに）
const ALWAYS_COUNTS = [0, 1, 1, 1, 2, 2, 2, 3];

function pickStatements(rand, conditions, matching) {
  const usable = STATEMENTS.filter((s) => !decidedByOneCondition(s, conditions)).map((s) => ({ ...s, kind: classify(s, matching) }));
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

// ---- 誤答づくり ----

// 正解以外の7通りの組それぞれに、どんなミスでそれを選ぶかの説明をつける。
// 1つだけちがう組（1つ多く選んだ・1つ見落とした）を先に並べる
function buildWrongs(statements, correct, matching) {
  const results = [];
  for (let mask = 0; mask < 8; mask++) {
    const picked = [0, 1, 2].filter((i) => mask & (1 << i));
    if (answerText(picked) === answerText(correct)) continue;
    const extra = picked.filter((i) => !correct.includes(i));
    const missed = correct.filter((i) => !picked.includes(i));
    const reasons = [
      ...extra.map((i) => {
        if (statements[i].kind === 'never') return `${MARKS[i]}はどの並び方でも成り立たない`;
        const counter = matching.findIndex((o) => !holds(statements[i], o));
        return `${MARKS[i]}は成り立つ並び方もあるが、${circled(counter)}では成り立たない（必ずではない）`;
      }),
      ...missed.map((i) => `${MARKS[i]}はどの並び方でも成り立つのに、見落としてしまった`),
    ];
    // ひっかけ（ありうるを選ぶ）を一番先、次に見落とし、ちがいが多いものほど後
    const score = extra.length + missed.length + (extra.some((i) => statements[i].kind === 'sometimes') ? 0 : 0.5);
    results.push({ value: label(answerText(picked)), mistake: reasons.join('。'), score });
  }
  return results.sort((a, b) => a.score - b.score).map(({ value, mistake }) => ({ value, mistake }));
}

// ---- テンプレート ----

const ranking = {
  id: 'reasoning-ranking',
  generate(rand) {
    for (;;) {
      const s = rand.pick(SCENES);
      const order = rand.shuffle(PEOPLE);
      const { conditions, matching } = pickConditions(rand, order);
      const statements = pickStatements(rand, conditions, matching);
      if (!statements) continue;

      const conditionText = (c) => (c.type === 'rank' ? s.rank(c.x, c.k) : s[c.type](c.x, c.y));
      const statementText = (st) => {
        if (st.type === 'rank') return `${st.x}は${st.k}位である`;
        if (st.type === 'top3') return `${st.x}は3位以内である`;
        return s.sBefore(st.x, st.y);
      };
      const correct = statements.map((st, i) => (st.kind === 'always' ? i : -1)).filter((i) => i >= 0);
      const result = (st) => {
        if (st.kind === 'always') return 'どの並び方でも成り立つ → 必ず正しい';
        if (st.kind === 'never') return 'どの並び方でも成り立たない → 正しくない';
        const yes = matching.map((o, i) => (holds(st, o) ? circled(i) : null)).filter(Boolean).join('');
        const no = matching.map((o, i) => (holds(st, o) ? null : circled(i))).filter(Boolean).join('');
        return `${yes}では成り立つが${no}では成り立たない → 必ずとはいえない`;
      };

      return {
        params: {
          conditions,
          statements: statements.map(({ kind, ...rest }) => rest),
        },
        text: [
          s.intro,
          ...conditions.map((c) => `・${conditionText(c)}`),
          '次の推論ア、イ、ウのうち、必ず正しいものはどれか。',
          ...statements.map((st, i) => `${MARKS[i]}：${statementText(st)}`),
        ].join('\n'),
        answer: label(answerText(correct)),
        unit: '',
        wrongs: buildWrongs(statements, correct, matching),
        explanation: [
          // 並び方の書き出しは1つの行にまとめる（解説の番号と①②が2重にならないように、行の中で改行する）
          [`条件に合う順位（1位 → 5位）は、次の${matching.length}通り`, ...matching.map((o, i) => `${circled(i)} ${orderText(o)}`)].join('\n'),
          ...statements.map((st, i) => `${MARKS[i]}「${statementText(st)}」：${result(st)}`),
          `よって、必ず正しいのは「${answerText(correct)}」`,
          'ポイント：「必ず正しい」は、考えられる並び方すべてで成り立つもの。1つでも成り立たない並び方（反例）があれば選ばない',
        ],
      };
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
    const matching = ORDERS.filter((o) => conditions.every((c) => ok(c, o)));
    const sure = statements.map((st, i) => (matching.every((o) => ok(st, o)) ? i : -1)).filter((i) => i >= 0);
    return label(answerText(sure));
  },
  // check.js が使う独自チェック：並び方の数が2〜6通りか、条件1つだけで決まる推論がないか、同じ推論が2回出ていないか
  validate({ conditions, statements }) {
    const errors = [];
    const matching = ORDERS.filter((o) => conditions.every((c) => holds(c, o)));
    if (matching.length < MIN_ORDERS || matching.length > MAX_ORDERS) errors.push(`条件に合う並び方が${matching.length}通り`);
    statements.forEach((st, i) => {
      if (decidedByOneCondition(st, conditions)) errors.push(`${MARKS[i]}が条件1つだけで決まる（言い換え）`);
    });
    if (new Set(statements.map((st) => JSON.stringify(st))).size !== statements.length) errors.push('同じ推論が2回出ている');
    conditions.forEach((c, i) => {
      const others = conditions.filter((_, j) => j !== i);
      if (ORDERS.filter((o) => others.every((k) => holds(k, o))).length === matching.length) errors.push(`条件${i + 1}はほかの条件からわかる（なくても同じ）`);
    });
    return errors;
  },
};

export default {
  id: 'reasoning',
  label: '推論',
  templates: [ranking],
};
