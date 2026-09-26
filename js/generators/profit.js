// 損益算の問題を作る。
// どちらのテンプレートも「先に原価を決めて、定価・売値・利益を計算する」逆算方式。
// 赤字（利益が0以下）になる%の組み合わせは使わない：(100+a)(100−b) > 10000 のときだけ採用する。
import { gcd, lcm, pickMultiple, pickPreferring } from '../core/math.js';

// 電卓なしで使う、暗算しやすい%
const NICE_MARKUPS = [10, 20, 25, 30, 40, 50];
const NICE_DISCOUNTS = [5, 10, 20, 25, 30];

// n / 10000 を約分したときの分母
function bottomOf(n, den) {
  return den / gcd(n, den);
}

// 利益が出る「a%増し・b%引き」の組を選び、定価・売値が整数になる原価を決める
function pickDeal(rand, calculator, preferWrong) {
  let a;
  let b;
  do {
    a = calculator ? rand.int(10, 60) : rand.pick(NICE_MARKUPS);
    b = calculator ? rand.int(5, 40) : rand.pick(NICE_DISCOUNTS);
  } while ((100 + a) * (100 - b) <= 10000);

  // 定価（原価×(100+a)/100）と売値（原価×(100+a)(100−b)/10000）が割り切れる原価の刻み
  const step = lcm(bottomOf(100 + a, 100), bottomOf((100 + a) * (100 - b), 10000));
  const cost = pickPreferring(
    () => (calculator ? pickMultiple(rand, step, 1000, 20000) : pickMultiple(rand, lcm(step, 100), 400, 6000)),
    (c) => Number.isInteger(preferWrong(c, a, b)),
  );
  const list = (cost * (100 + a)) / 100;
  const sell = (list * (100 - b)) / 100;
  return { a, b, cost, list, sell, profit: sell - cost };
}

// check.js が使う独自チェック：赤字の組み合わせが混じっていないか
function validateNoLoss({ a, b }) {
  return (100 + a) * (100 - b) > 10000 ? [] : [`赤字になる組み合わせ: ${a}%増し・${b}%引き`];
}

// 小数で表す（125 → 1.25）。整数どうしで1回だけ割るので、0.1+0.2 のような誤差が出ない
const rateText = (numerator, den) => String(numerator / den);

// A. 原価・利益率・値引き率から、利益を求める
const profitFromDeal = {
  id: 'profit-amount',
  generate(rand, { calculator }) {
    // 代表的なミス（%をそのまま引き算する）も整数になる原価を優先する
    const { a, b, cost, list, sell, profit } = pickDeal(rand, calculator, (c, a, b) => (c * (a - b)) / 100);

    return {
      params: { cost, a, b },
      text: `原価${cost}円の商品に、原価の${a}%の利益を見込んで定価をつけた。売れなかったので、定価の${b}%引きで売った。利益は何円か。`,
      answer: profit,
      unit: '円',
      wrongs: [
        { value: (cost * (a - b)) / 100, mistake: `${a}%−${b}%＝${a - b}%として、原価の${a - b}%を利益にしてしまった` },
        { value: list - cost, mistake: '値引き前の定価で売ったときの利益を出してしまった' },
        { value: list - sell, mistake: '利益ではなく値引きした金額を出してしまった' },
        { value: sell, mistake: '利益ではなく売値を答えてしまった' },
      ],
      explanation: [
        `定価 ＝ ${cost} × ${rateText(100 + a, 100)} ＝ ${list}円`,
        `売値 ＝ ${list} × ${rateText(100 - b, 100)} ＝ ${sell}円`,
        `利益 ＝ 売値 − 原価 ＝ ${sell} − ${cost} ＝ ${profit}円`,
        `ポイント：「${a}%増しから${b}%引き」は${a - b}%増しにはならない。掛け算を2回する`,
      ],
    };
  },
  // 検算：原価 × {(100+a)(100−b) − 10000} / 10000 で一気に出す
  solve({ cost, a, b }) {
    return (cost * ((100 + a) * (100 - b) - 10000)) / 10000;
  },
  validate: validateNoLoss,
};

// B. 利益率・値引き率・利益から、原価を求める
const costFromProfit = {
  id: 'profit-cost',
  generate(rand, { calculator }) {
    // 代表的なミス（利益が原価の(a−b)%だと考える）も整数になる原価を優先する
    const { a, b, cost, list, sell, profit } = pickDeal(rand, calculator, (c, a, b) => {
      const p = (c * ((100 + a) * (100 - b) - 10000)) / 10000;
      return (p * 100) / (a - b);
    });
    const gain = (100 + a) * (100 - b) - 10000; // 利益の割合（原価を10000としたとき）

    return {
      params: { a, b, profit },
      text: `ある商品に、原価の${a}%増しの定価をつけた。これを定価の${b}%引きで売ったところ、利益は${profit}円だった。原価は何円か。`,
      answer: cost,
      unit: '円',
      wrongs: [
        { value: (profit * 100) / (a - b), mistake: `${a}%−${b}%＝${a - b}%として、利益が原価の${a - b}%だと考えてしまった` },
        { value: (profit * 100) / a, mistake: `値引きを忘れて、利益が原価の${a}%だと考えてしまった` },
        { value: sell, mistake: '原価ではなく売値を出してしまった' },
        { value: list, mistake: '原価ではなく定価を出してしまった' },
      ],
      explanation: [
        `原価を1とすると、定価は ${rateText(100 + a, 100)}、売値は ${rateText(100 + a, 100)} × ${rateText(100 - b, 100)} ＝ ${rateText((100 + a) * (100 - b), 10000)}`,
        `利益は ${rateText((100 + a) * (100 - b), 10000)} − 1 ＝ ${rateText(gain, 10000)}（原価の${rateText(gain, 100)}%）`,
        `原価 × ${rateText(gain, 10000)} ＝ ${profit}円 なので、原価 ＝ ${profit} ÷ ${rateText(gain, 10000)} ＝ ${cost}円`,
        `ポイント：原価を1と置いて、定価・売値・利益を順に小数で表す`,
      ],
    };
  },
  // 検算：利益 ÷ 利益の割合
  solve({ a, b, profit }) {
    return (profit * 10000) / ((100 + a) * (100 - b) - 10000);
  },
  validate: validateNoLoss,
};

export default {
  id: 'profit',
  label: '損益算',
  templates: [profitFromDeal, costFromProfit],
};
