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

export default {
  id: 'ratio',
  label: '割合',
  templates: [wholeFromPart, originalFromChange],
};
