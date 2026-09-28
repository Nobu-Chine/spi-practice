// 「損益算」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説をセットで返す。
// 数字を選ぶときは math.js の計算道具を使う。
//
// どのテンプレートも「先に原価を決めて、定価・売値・利益を計算する」逆算方式。
// 赤字（利益が0以下）になる組み合わせは使わない。A・B は (100+a)(100−b) > 10000 のときだけ採用し、
// C（売れ残り）は全体の利益が0より大きくなるまで選び直す。
import { gcd, lcm, pickMultiple, pickPreferring } from '../core/math.js';

// 電卓なしで使う、暗算しやすい%
const NICE_MARKUPS = [10, 20, 25, 30, 40, 50];
const NICE_DISCOUNTS = [5, 10, 20, 25, 30];

// n / 10000 を約分したときの分母
function bottomOf(n, den) {
  return den / gcd(n, den);
}

// 利益の割合（原価を10000としたとき）。0より大きければ黒字
const gainOf = (a, b) => (100 + a) * (100 - b) - 10000;

// 利益が出る「a%増し・b%引き」の組を選び、定価・売値が整数になる原価を決める。
// 電卓なしのときは markups / discounts から選び、acceptPair で組み合わせをさらに絞れる
function pickDeal(rand, calculator, preferWrong, { markups = NICE_MARKUPS, discounts = NICE_DISCOUNTS, acceptPair = () => true } = {}) {
  let a;
  let b;
  do {
    a = calculator ? rand.int(10, 60) : rand.pick(markups);
    b = calculator ? rand.int(5, 40) : rand.pick(discounts);
  } while (gainOf(a, b) <= 0 || (!calculator && !acceptPair(a, b)));

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
  return gainOf(a, b) > 0 ? [] : [`赤字になる組み合わせ: ${a}%増し・${b}%引き`];
}

// 損益算Bの電卓なし用：「1 ÷ 利益の割合」が整数になる組み合わせだけ使う。
// 割り算の代わりに整数を掛ければ済む（0.04→×25、0.05→×20、0.125→×8、0.2→×5）
const COST_MARKUPS = [...NICE_MARKUPS, 60, 75];
const COST_DISCOUNTS = [...NICE_DISCOUNTS, 40];
const isEasyGain = (a, b) => gainOf(a, b) > 0 && Number.isInteger(10000 / gainOf(a, b));

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
    // 代表的なミス（利益が原価の(a−b)%だと考える）も整数になる原価を優先する。
    // 電卓なしでは、利益の割合が割りやすい組み合わせだけ使う
    const { a, b, cost, list, sell, profit } = pickDeal(
      rand,
      calculator,
      (c, a, b) => ((c * gainOf(a, b)) / 10000) * 100 / (a - b),
      { markups: COST_MARKUPS, discounts: COST_DISCOUNTS, acceptPair: isEasyGain },
    );
    const gain = gainOf(a, b); // 利益の割合（原価を10000としたとき）

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
  validate(params, { calculator }) {
    const errors = validateNoLoss(params);
    if (!calculator && !isEasyGain(params.a, params.b)) {
      errors.push(`電卓なしなのに割りにくい利益の割合: ${gainOf(params.a, params.b) / 10000}`);
    }
    return errors;
  },
};

// C. 売れ残り：まとめて仕入れ、一部は定価で売れ、残りは値引きして売る（または捨てる）。全体の利益を求める
// 電卓なしで使う、暗算しやすい数字
const LEFTOVER_COSTS = [100, 200, 300, 400, 500, 600]; // 1個の原価（円）
const LEFTOVER_COUNTS = [50, 100, 120, 150, 200]; // 仕入れた個数
const SOLD_PERCENTS = [60, 70, 75, 80, 90]; // 定価で売れた割合
const LEFTOVER_DISCOUNTS = [10, 20, 30, 40, 50]; // 残りを定価の何%引きで売るか（50は「半額」と書く）

// 1個の原価・%から、定価と値引き後の売値（捨てるときは0円）を出す
function leftoverPrices({ cost, a, b, discard }) {
  const list = (cost * (100 + a)) / 100;
  return { list, sale: discard ? 0 : (list * (100 - b)) / 100 };
}

function pickLeftover(rand, calculator) {
  for (;;) {
    const cost = calculator ? rand.int(10, 200) * 10 : rand.pick(LEFTOVER_COSTS);
    const count = calculator ? rand.int(50, 500) : rand.pick(LEFTOVER_COUNTS);
    const soldPercent = calculator ? rand.int(50, 95) : rand.pick(SOLD_PERCENTS);
    const sold = (count * soldPercent) / 100;
    const a = calculator ? rand.int(10, 60) : rand.pick(NICE_MARKUPS);
    const b = calculator ? rand.int(5, 60) : rand.pick(LEFTOVER_DISCOUNTS);
    const discard = rand.next() < 0.5;
    const { list, sale } = leftoverPrices({ cost, a, b, discard });
    const profit = sold * list + (count - sold) * sale - cost * count;
    // 電卓なしは、定価・売値を10円単位、売れた個数・残りの個数を10個単位にして、掛け算を暗算できる大きさにする
    const easy = calculator || [list, sale, sold, count - sold].every((v) => v % 10 === 0);
    // 個数・定価・売値が整数で、全体で黒字になる組み合わせだけ使う
    if (easy && Number.isInteger(sold) && sold < count && Number.isInteger(list) && Number.isInteger(sale) && profit > 0) {
      return { cost, count, sold, a, b, discard, list, sale, profit };
    }
  }
}

const leftover = {
  id: 'profit-leftover',
  generate(rand, { calculator }) {
    const { cost, count, sold, a, b, discard, list, sale, profit } = pickLeftover(rand, calculator);
    const rest = count - sold;
    const revenue = sold * list + rest * sale;
    const totalCost = cost * count;
    const saleText = b === 50 ? '定価の半額' : `定価の${b}%引き`;
    const restText = discard ? '残りは売れ残ったので捨てた' : `残りは${saleText}で売った`;

    const wrongs = [
      { value: (list - cost) * count, mistake: '売れ残りがなく、全部が定価で売れたとして計算してしまった' },
      discard
        ? { value: (list - cost) * sold, mistake: `捨てた${rest}個の仕入れ値を引き忘れてしまった` }
        : {
            value: sold * list + rest * ((cost * (100 - b)) / 100) - totalCost,
            mistake: `値引き後の売値を、定価ではなく原価から計算してしまった`,
          },
      { value: revenue, mistake: '利益ではなく、売上の合計を答えてしまった' },
      { value: revenue - cost * sold, mistake: `仕入れ値を、売れた${sold}個の分しか引いていない` },
    ];

    const explanation = [
      `定価 ＝ ${cost} × ${rateText(100 + a, 100)} ＝ ${list}円`,
      ...(discard ? [] : [`${saleText} ＝ ${list} × ${rateText(100 - b, 100)} ＝ ${sale}円`]),
      discard
        ? `売上 ＝ ${list} × ${sold}個 ＝ ${revenue}円（捨てた${rest}個は売上0円）`
        : `売上 ＝ ${list} × ${sold}個 ＋ ${sale} × ${rest}個 ＝ ${list * sold} ＋ ${sale * rest} ＝ ${revenue}円`,
      `仕入れ値の合計 ＝ ${cost} × ${count}個 ＝ ${totalCost}円`,
      `利益 ＝ ${revenue} − ${totalCost} ＝ ${profit}円`,
      `ポイント：仕入れ値は、売れ残った${rest}個も含めた${count}個ぶんかかっている`,
    ];

    return {
      params: { cost, count, sold, a, b, discard },
      text: `ある商品を1個${cost}円で${count}個仕入れ、原価の${a}%の利益を見込んで定価をつけた。${sold}個は定価で売れたが、${restText}。全体の利益は何円か。`,
      answer: profit,
      unit: '円',
      wrongs,
      explanation,
    };
  },
  // 検算：1個あたりの利益（損）を足し合わせる。定価で売れた分 ＋ 残りの分
  solve(params) {
    const { list, sale } = leftoverPrices(params);
    return (list - params.cost) * params.sold + (sale - params.cost) * (params.count - params.sold);
  },
  // check.js が使う独自チェック：全体で黒字か、売れ残りがちゃんとあるか
  validate(params) {
    const errors = [];
    if (this.solve(params) <= 0) errors.push('全体の利益が0円以下（赤字）');
    if (!(params.sold > 0 && params.sold < params.count)) errors.push(`売れた個数がおかしい: ${params.sold}/${params.count}`);
    return errors;
  },
};

export default {
  id: 'profit',
  label: '損益算',
  templates: [profitFromDeal, costFromProfit, leftover],
};
