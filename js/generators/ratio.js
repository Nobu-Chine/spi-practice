// 「割合」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説をセットで返す。
// 数字を選ぶときは math.js の計算道具を使う。
//
// どのテンプレートも「先に答えを決めて、そこから問題の数字を作る（逆算）」ので、答えは必ず割り切れる整数になる。
// generate() が問題を作り、solve() は問題文に出した数字だけを使って解き直す（検算用）。
import { lcm, percentToFraction, pickMultiple, pickPreferring } from '../core/math.js';

// 電卓なしで使う、暗算しやすい%
const NICE_PERCENTS = [10, 20, 25, 30, 40, 50, 60, 75, 80];

function fraction({ top, bottom }) {
  return `${bottom}分の${top}`;
}

// 「元 × 分数 ＝ 値」から元を求める式の説明（値 ÷ 分子 × 分母）
function divideLine(label, value, { top, bottom }, result, unit) {
  if (top === 1) return `${label} ＝ ${value} × ${bottom} ＝ ${result}${unit}`;
  return `${label} ＝ ${value} ÷ ${top} × ${bottom} ＝ ${value / top} × ${bottom} ＝ ${result}${unit}`;
}

// A. 一部の人数と%から、全体を求める
const PART_SCENES = [
  { group: 'ある会社の社員', noun: '社員', part: '女性' },
  { group: 'ある学校の生徒', noun: '生徒', part: '電車で通学している人' },
  { group: 'あるイベントの参加者', noun: '参加者', part: '初めて参加した人' },
];

const wholeFromPart = {
  id: 'ratio-whole-from-part',
  generate(rand, { calculator }) {
    const p = calculator ? rand.int(3, 97) : rand.pick(NICE_PERCENTS);
    const frac = percentToFraction(p);
    const toPart = (w) => (w / frac.bottom) * frac.top;
    // 代表的なミス（一部の人数に%を掛ける）も整数になる全体を優先する
    const whole = pickPreferring(
      () => (calculator ? pickMultiple(rand, frac.bottom, 100, 2000) : pickMultiple(rand, lcm(frac.bottom, 10), 50, 600)),
      (w) => Number.isInteger((toPart(w) * p) / 100),
    );
    const n = toPart(whole);
    const s = rand.pick(PART_SCENES);

    return {
      params: { p, n },
      text: `${s.group}のうち、${p}%が${s.part}で、その人数は${n}人だった。${s.noun}は全部で何人か。`,
      answer: whole,
      unit: '人',
      wrongs: [
        { value: (n * p) / 100, mistake: `${n}人に${p}%を掛けてしまった（${n}人は全体ではなく一部）` },
        { value: whole - n, mistake: `全体ではなく「${s.part}以外」の人数を出してしまった` },
        { value: (n * 100) / (100 - p), mistake: `${100 - p}%（${s.part}以外の割合）で割ってしまった` },
        { value: (n * (100 + p)) / 100, mistake: `${n}人を${p}%増やしてしまった` },
      ],
      explanation: [
        `${p}% を分数にすると ${fraction(frac)}`,
        `全体 × ${fraction(frac)} ＝ ${n}人`,
        divideLine('全体', n, frac, whole, '人'),
        'ポイント：「全体 × 割合 ＝ 一部」の形に当てはめる',
      ],
    };
  },
  solve({ p, n }) {
    return (n * 100) / p;
  },
};

// B. 増えた（減った）後の数と%から、元の数を求める
const CHANGE_SCENES = [
  { subject: 'あるサークルの会員数', now: '今年', before: '去年', unit: '人' },
  { subject: 'ある店の来店客数', now: '今月', before: '先月', unit: '人' },
  { subject: 'ある図書館の貸出冊数', now: '今月', before: '先月', unit: '冊' },
];

const originalFromChange = {
  id: 'ratio-original-from-change',
  generate(rand, { calculator }) {
    const up = rand.next() < 0.5;
    const p = calculator
      ? rand.int(2, up ? 80 : 60)
      : rand.pick(up ? [10, 20, 25, 30, 40, 50] : [10, 20, 25, 30, 40]);
    const rate = up ? 100 + p : 100 - p;
    const frac = percentToFraction(rate);
    const toCurr = (v) => (v / frac.bottom) * frac.top;
    // 代表的なミス（今の数から直接%を足し引きする）も整数になる元の数を優先する
    const prev = pickPreferring(
      () => (calculator ? pickMultiple(rand, frac.bottom, 100, 3000) : pickMultiple(rand, lcm(frac.bottom, 10), 50, 600)),
      (v) => Number.isInteger((toCurr(v) * (up ? 100 - p : 100 + p)) / 100),
    );
    const curr = toCurr(prev);
    const s = rand.pick(CHANGE_SCENES);
    const u = s.unit;

    const wrongs = up
      ? [
          { value: (curr * (100 - p)) / 100, mistake: `${s.now}の${curr}${u}から${p}%を引いてしまった（${p}%は${s.before}が基準）` },
          { value: curr - prev, mistake: '増えた分だけを答えてしまった' },
          { value: curr - p, mistake: `${p}%を${p}${u}として引いてしまった` },
        ]
      : [
          { value: (curr * (100 + p)) / 100, mistake: `${s.now}の${curr}${u}に${p}%を足してしまった（${p}%は${s.before}が基準）` },
          { value: prev - curr, mistake: '減った分だけを答えてしまった' },
          { value: curr + p, mistake: `${p}%を${p}${u}として足してしまった` },
        ];

    return {
      params: { p, curr, up },
      text: `${s.subject}は${s.now}${curr}${u}で、${s.before}より${p}%${up ? '増えた' : '減った'}。${s.before}は何${u}だったか。`,
      answer: prev,
      unit: u,
      wrongs,
      explanation: [
        `${s.before}を100%とすると、${s.now}は 100% ${up ? '＋' : '−'} ${p}% ＝ ${rate}% ＝ ${fraction(frac)}`,
        `${s.before} × ${fraction(frac)} ＝ ${curr}${u}`,
        divideLine(s.before, curr, frac, prev, u),
        `ポイント：${p}%は${s.before}を基準にした割合。${s.now}の数から直接${p}%を${up ? '引かない' : '足さない'}`,
      ],
    };
  },
  solve({ p, curr, up }) {
    return (curr * 100) / (up ? 100 + p : 100 - p);
  },
};

// C. 割合の割合：「全体のp%がX、Xのうちq%がY」のとき、Y は全体の何%か（または何人か）。%で聞く形と人数で聞く形を半分ずつ出す
const NESTED_SCENES = [
  { group: 'ある会社の社員', noun: '社員', outer: '男性', inner: '営業部の所属', target: '営業部の男性' },
  { group: 'ある学校の生徒', noun: '生徒', outer: '部活動に入っている人', inner: '運動部員', target: '運動部員' },
  { group: 'ある店の客', noun: '客', outer: '会員', inner: 'クーポンを使った人', target: 'クーポンを使った会員' },
];
// 電卓なしで使う%。2つを掛けた答えが整数の%になる組み合わせだけ使う
const OUTER_PERCENTS = [20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90];
const INNER_PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 80];
const NESTED_TOTALS = [100, 200, 300, 400, 500, 600, 800, 1000];

// 小数で表す（40 → 0.4）。整数どうしで1回だけ割るので誤差が出ない
const decimal = (percent) => String(percent / 100);

function pickNested(rand, calculator, asCount) {
  for (;;) {
    const p = calculator ? rand.int(10, 90) : rand.pick(OUTER_PERCENTS);
    const q = calculator ? rand.int(5, 95) : rand.pick(INNER_PERCENTS);
    const answerPercent = (p * q) / 100;
    if (!asCount) {
      // %で聞く形：答えが整数の%になり、代表的なミス（%どうしの引き算）も正になる組み合わせ
      if (Number.isInteger(answerPercent) && p > q) return { p, q };
      continue;
    }
    // 人数で聞く形：途中の人数（Xの人数）も答えも整数になる全体の人数。
    // p と q が同じだと「全体に q% を掛ける」ミスと「Xの人数で止める」ミスが同じ数になるので、違う値にする
    const total = calculator ? rand.int(10, 200) * 10 : rand.pick(NESTED_TOTALS);
    const outerCount = (total * p) / 100;
    const count = (outerCount * q) / 100;
    if (p !== q && Number.isInteger(outerCount) && Number.isInteger(count) && count > 0) {
      return { p, q, total, outerCount, count };
    }
  }
}

const percentOfPercent = {
  id: 'ratio-nested',
  generate(rand, { calculator }) {
    const s = rand.pick(NESTED_SCENES);
    const asCount = rand.next() < 0.5;

    if (!asCount) {
      const { p, q } = pickNested(rand, calculator, false);
      const answer = (p * q) / 100;
      return {
        params: { kind: 'percent', p, q },
        text: `${s.group}のうち${p}%が${s.outer}で、${s.outer}のうち${q}%が${s.inner}である。${s.target}は${s.noun}全体の何%か。`,
        answer,
        unit: '%',
        wrongs: [
          { value: q, mistake: `${s.outer}の中での割合（${q}%）を、そのまま全体の割合として答えてしまった` },
          { value: p - q, mistake: `${p}% − ${q}% と、%どうしを引き算してしまった` },
          { value: p + q < 100 ? p + q : null, mistake: `${p}% ＋ ${q}% と、%どうしを足し算してしまった` },
        ],
        explanation: [
          `${s.outer}は全体の ${p}% ＝ ${decimal(p)}`,
          `${s.target}は${s.outer}の ${q}% なので、全体から見ると ${decimal(p)} × ${decimal(q)} ＝ ${decimal(answer)}`,
          `${decimal(answer)} ＝ ${answer}%`,
          'ポイント：「〜のうち◯%」は、その前の割合に掛ける。%どうしを足したり引いたりしない',
        ],
      };
    }

    // 代表的なミス（全体に内側の%をそのまま掛ける）も整数になる組み合わせを優先する
    const { p, q, total, outerCount, count } = pickPreferring(
      () => pickNested(rand, calculator, true),
      ({ q, total }) => Number.isInteger((total * q) / 100),
    );
    return {
      params: { kind: 'count', p, q, total },
      text: `${s.group}${total}人のうち${p}%が${s.outer}で、${s.outer}のうち${q}%が${s.inner}である。${s.target}は何人か。`,
      answer: count,
      unit: '人',
      wrongs: [
        { value: (total * q) / 100, mistake: `${s.noun}全体の${total}人に、${q}%をそのまま掛けてしまった` },
        { value: outerCount, mistake: `${s.outer}の人数を出したところで止めてしまった` },
        { value: p > q ? (total * (p - q)) / 100 : null, mistake: `${p}% − ${q}% と、%どうしを引き算してから掛けてしまった` },
      ],
      explanation: [
        `${s.outer}の人数 ＝ ${total} × ${decimal(p)} ＝ ${outerCount}人`,
        `${s.target} ＝ ${outerCount} × ${decimal(q)} ＝ ${count}人`,
        'ポイント：「〜のうち◯%」は、その前に出した人数に掛ける。全体の人数に直接掛けない',
      ],
    };
  },
  // 検算：%の形は p × q ÷ 100、人数の形は 全体 × p × q ÷ 10000 で一気に出す
  solve({ kind, p, q, total }) {
    return kind === 'percent' ? (p * q) / 100 : (total * p * q) / 10000;
  },
  // check.js が使う独自チェック：答えが外側の割合（人数）より小さいか
  validate({ kind, p, q, total }) {
    const inner = kind === 'percent' ? (p * q) / 100 : (total * p * q) / 10000;
    const outer = kind === 'percent' ? p : (total * p) / 100;
    return inner < outer ? [] : [`内側の割合が外側以上になっている: ${inner} / ${outer}`];
  },
};

export default {
  id: 'ratio',
  label: '割合',
  templates: [wholeFromPart, originalFromChange, percentOfPercent],
};
