// 「集合」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説（人数の表つき）をセットで返す。
// 数字を選ぶときは math.js の計算道具を使う。
//
// 先に「Aだけ・両方・Bだけ・どちらでもない」の4つの人数を決めてから、問題に出す数字を計算する逆算方式。
// A・B はどれも1人以上。C（少なくとも何人）は、どちらでもない人が0人のときを考えるので、そこだけ0人になる。
// 解説には4つの人数と合計の表を入れる（解説の1行を { type: 'table', ... } にすると画面側が表として表示する）。
import { pickPreferring } from '../core/math.js';

const SCENES = [
  {
    intro: (n) => `${n}人にアンケートをとった。`,
    a: { short: '犬', has: '犬が好きな人' },
    b: { short: '猫', has: '猫が好きな人' },
    both: '両方とも好きな人',
    neither: 'どちらも好きでない人',
  },
  {
    intro: (n) => `ある会社の社員${n}人に、持っている資格を聞いた。`,
    a: { short: '英検', has: '英検を持っている人' },
    b: { short: '簿記', has: '簿記を持っている人' },
    both: '両方持っている人',
    neither: 'どちらも持っていない人',
  },
  {
    intro: (n) => `ある学校の生徒${n}人に、通学で使う乗り物を聞いた。`,
    a: { short: 'バス', has: 'バスを使う人' },
    b: { short: '電車', has: '電車を使う人' },
    both: '両方使う人',
    neither: 'どちらも使わない人',
  },
];

// 電卓なしで使う、キリのいい合計人数（20分の1刻みが整数になるよう、どれも20の倍数）
const NICE_TOTALS = [40, 60, 80, 100, 120, 140, 160, 200];

// 合計を4つの人数（Aだけ・両方・Bだけ・どちらでもない）に分ける。どれも1人以上
function splitTotal(rand, calculator) {
  const total = calculator ? rand.int(100, 1000) : rand.pick(NICE_TOTALS);
  // 電卓なしは合計の20分の1刻み（100人なら5人刻み）にして、暗算しやすくする
  const unit = calculator ? 1 : total / 20;
  const slots = total / unit;
  const cuts = new Set();
  while (cuts.size < 3) cuts.add(rand.int(1, slots - 1));
  const [c1, c2, c3] = [...cuts].sort((x, y) => x - y);
  const [onlyA, both, onlyB, neither] = [c1, c2 - c1, c3 - c2, slots - c3].map((k) => k * unit);
  return { total, onlyA, both, onlyB, neither };
}

function regionTable(s, r, answerIndex) {
  return {
    type: 'table',
    // ​（見えない区切り）の位置でだけ折り返す。スマホ幅で「どちらでもな／い」と切れるのを防ぐ
    headers: [`${s.a.short}だけ`, '両方', `${s.b.short}だけ`, 'どちらでも​ない', '合計'],
    cells: [r.onlyA, r.both, r.onlyB, r.neither, r.total].map((v) => `${v}人`),
    highlight: answerIndex,
  };
}

// 問題の数字から4つの人数を出し直して、どれも1人以上かを確かめる（check.js 用）
function validateRegions(r) {
  const bad = Object.entries(r).filter(([, v]) => !(Number.isInteger(v) && v >= 1));
  return bad.length ? [`人数が1人未満の部分がある: ${bad.map(([k, v]) => `${k}=${v}`).join(', ')}`] : [];
}

// A. 両方の人数から、どちらでもない人数を求める
const neitherFromBoth = {
  id: 'sets-neither',
  generate(rand, { calculator }) {
    // 代表的なミス（合計からAとBを引くだけ）も正の数になる分け方を優先する
    const r = pickPreferring(() => splitTotal(rand, calculator), (r) => r.neither > r.both);
    const a = r.onlyA + r.both;
    const b = r.onlyB + r.both;
    const s = rand.pick(SCENES);

    return {
      params: { total: r.total, a, b, both: r.both },
      text: `${s.intro(r.total)}${s.a.has}は${a}人、${s.b.has}は${b}人、${s.both}は${r.both}人だった。${s.neither}は何人か。`,
      answer: r.neither,
      unit: '人',
      wrongs: [
        { value: r.total - a - b, mistake: `合計から${a}人と${b}人を引いただけで、両方の人を2回引いてしまった` },
        {
          value: r.neither + r.both,
          mistake: `${s.a.short}だけ＋${s.b.short}だけを足して合計から引き、両方の人（${r.both}人）を数に入れ忘れてしまった`,
        },
        { value: a + b - r.both, mistake: `${s.neither}ではなく、少なくとも一方にあてはまる人数を出してしまった` },
      ],
      explanation: [
        `表に整理する（${s.a.short}だけ ＝ ${a} − ${r.both} ＝ ${r.onlyA}人、${s.b.short}だけ ＝ ${b} − ${r.both} ＝ ${r.onlyB}人）`,
        regionTable(s, r, 3),
        `どちらでもない ＝ ${r.total} − (${a} ＋ ${b} − ${r.both}) ＝ ${r.total} − ${a + b - r.both} ＝ ${r.neither}人`,
        `ポイント：${a} ＋ ${b} では両方の人（${r.both}人）を2回数えているので、1回分引く`,
      ],
    };
  },
  solve({ total, a, b, both }) {
    return total - a - b + both;
  },
  validate({ total, a, b, both }) {
    return validateRegions({ onlyA: a - both, both, onlyB: b - both, neither: total - a - b + both });
  },
};

// B. どちらでもない人数から、両方の人数を求める
const bothFromNeither = {
  id: 'sets-both',
  generate(rand, { calculator }) {
    // 代表的なミス（どちらでもない人を忘れる）も正の数になる分け方を優先する
    const r = pickPreferring(() => splitTotal(rand, calculator), (r) => r.both > r.neither);
    const a = r.onlyA + r.both;
    const b = r.onlyB + r.both;
    const some = r.total - r.neither; // 少なくとも一方にあてはまる人
    const s = rand.pick(SCENES);

    return {
      params: { total: r.total, a, b, neither: r.neither },
      text: `${s.intro(r.total)}${s.a.has}は${a}人、${s.b.has}は${b}人、${s.neither}は${r.neither}人だった。${s.both}は何人か。`,
      answer: r.both,
      unit: '人',
      wrongs: [
        { value: a + b - r.total, mistake: `${s.neither}（${r.neither}人）を計算に入れ忘れてしまった` },
        { value: some, mistake: `${s.both}ではなく、少なくとも一方にあてはまる人数を出してしまった` },
        { value: a + b - r.neither, mistake: `${a} ＋ ${b} から、${s.neither}の${r.neither}人を引いてしまった` },
      ],
      explanation: [
        `少なくとも一方にあてはまる人 ＝ ${r.total} − ${r.neither} ＝ ${some}人。表に整理すると`,
        regionTable(s, r, 1),
        `両方 ＝ ${a} ＋ ${b} − ${some} ＝ ${a + b} − ${some} ＝ ${r.both}人`,
        `ポイント：${a} ＋ ${b} は両方の人を2回数えている。${some}人より多い分が両方の人数`,
      ],
    };
  },
  solve({ total, a, b, neither }) {
    return a + b + neither - total;
  },
  validate({ total, a, b, neither }) {
    const both = a + b + neither - total;
    return validateRegions({ onlyA: a - both, both, onlyB: b - both, neither });
  },
};

// C. 両方にあてはまる人は「少なくとも何人」か（最小の人数）
// 両方の人が一番少なくなるのは、どちらでもない人が0人のとき。そのとき 両方 ＝ A ＋ B − 合計
function pickAtLeast(rand, calculator) {
  const total = calculator ? rand.int(100, 1000) : rand.pick(NICE_TOTALS);
  const unit = calculator ? 1 : total / 20; // 電卓なしは合計の20分の1刻み（100人なら5人刻み）
  const slots = total / unit;
  // 本番の問題らしく、A も B も合計の50〜95%にする（片方だけ極端に少ない問題にしない）
  const low = Math.ceil(slots * 0.5);
  const high = Math.floor(slots * 0.95);
  for (;;) {
    // A も B も合計より少なく、2つを足すと合計を超える（超えた分が「少なくとも」の人数）
    const a = rand.int(low, high) * unit;
    const b = rand.int(low, high) * unit;
    const both = a + b - total;
    if (a !== b && both >= unit && a - both >= unit && b - both >= unit) return { total, a, b, both };
  }
}

const bothAtLeast = {
  id: 'sets-at-least',
  generate(rand, { calculator }) {
    const { total, a, b, both } = pickAtLeast(rand, calculator);
    const s = rand.pick(SCENES);
    const r = { onlyA: a - both, both, onlyB: b - both, neither: 0, total };

    return {
      params: { total, a, b },
      text: `${s.intro(total)}${s.a.has}は${a}人、${s.b.has}は${b}人だった。${s.both}は少なくとも何人いるか。`,
      answer: both,
      unit: '人',
      wrongs: [
        { value: Math.min(a, b), mistake: '「少なくとも（一番少ない場合）」ではなく、「多くとも（一番多い場合）」の人数を出してしまった' },
        { value: Math.abs(a - b), mistake: `${a}人と${b}人の差を答えてしまった` },
        { value: total - Math.max(a, b), mistake: `合計から多いほうの${Math.max(a, b)}人を引いてしまった` },
      ],
      explanation: [
        `両方の人が一番少なくなるのは、${s.neither}が0人のとき。表にすると`,
        regionTable(s, r, 1),
        `両方 ＝ ${a} ＋ ${b} − ${total} ＝ ${a + b} − ${total} ＝ ${both}人`,
        `ポイント：${a} ＋ ${b} ＝ ${a + b}人は合計の${total}人より${both}人多い。この多い分は、必ず両方に数えられている`,
      ],
    };
  },
  // 検算：A ＋ B − 合計
  solve({ total, a, b }) {
    return a + b - total;
  },
  // check.js が使う独自チェック：A・B が合計より少なく、Aだけ・両方・Bだけ がどれも1人以上か
  validate({ total, a, b }) {
    const both = a + b - total;
    const errors = validateRegions({ onlyA: a - both, both, onlyB: b - both });
    if (a >= total || b >= total) errors.push(`AかBが合計以上: A=${a} B=${b} 合計=${total}`);
    return errors;
  },
};

export default {
  id: 'sets',
  label: '集合',
  templates: [neitherFromBoth, bothFromNeither, bothAtLeast],
};
