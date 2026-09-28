// 「確率」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解（分数）・よくあるミス・解説をセットで返す。
// 分数は values.js の fraction() で作り、選び方の数は math.js の計算道具を使う。
//
// 検算（solve）は公式を使わず、玉・さいころ・くじの出方を全部1つずつ数え上げて確率を出す。
// 作る道（公式）と確かめる道（数え上げ）がまったく別なので、式の書き間違いを確実に見つけられる。
import { combinations } from '../core/math.js';
import { fraction } from '../core/values.js';

// ---- 解説で使う書き方 ----

// 「6/15 ＝ 2/5」のように、約分できるときは約分した分数も書く
function fractionText(num, den) {
  const f = fraction(num, den);
  return f.num === num ? `${num}/${den}` : `${num}/${den} ＝ ${f.num}/${f.den}`;
}

// 「5個から2個を選ぶ ＝ (5 × 4) ÷ (2 × 1) ＝ 10通り」
function pairLine(label, k) {
  if (k === 2) return `${label} ＝ 1通り`;
  return `${label} ＝ (${k} × ${k - 1}) ÷ (2 × 1) ＝ ${combinations(k, 2)}通り`;
}

// ---- 検算用の数え上げ（公式を使わない） ----

// 0〜n−1 の番号から、ちがう番号を2つ順番に取り出す組を全部たどり、条件に合う割合を分数で返す
function countPairs(n, accept) {
  let hit = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      total++;
      if (accept(i, j)) hit++;
    }
  }
  return fraction(hit, total);
}

// ---- A. 袋から玉を2個同時に取り出す ----
const BALL_KINDS = ['bothRed', 'oneEach', 'atLeastRed'];

const balls = {
  id: 'probability-balls',
  generate(rand, { calculator }) {
    const kind = rand.pick(BALL_KINDS);
    const red = calculator ? rand.int(2, 8) : rand.int(2, 5);
    const white = calculator ? rand.int(2, 8) : rand.int(2, 5);
    const n = red + white;
    const all = combinations(n, 2);
    const intro = `赤玉${red}個と白玉${white}個が入った袋から、同時に2個の玉を取り出す。`;
    const allLine = pairLine(`全部の取り出し方（${n}個から2個）`, n);

    if (kind === 'bothRed') {
      const hit = combinations(red, 2);
      return {
        params: { kind, red, white },
        text: `${intro}2個とも赤玉である確率はいくらか。`,
        answer: fraction(hit, all),
        unit: '',
        wrongs: [
          { value: fraction(red * red, n * n), mistake: '1個目を袋に戻してから2個目を取り出す計算にしてしまった' },
          { value: fraction(red, n), mistake: '1個目が赤玉である確率だけを出してしまった' },
          { value: fraction(hit, n * (n - 1)), mistake: '全部の取り出し方は順番つきで、赤2個は順番なしで数えてしまった（数え方がそろっていない）' },
        ],
        explanation: [
          allLine,
          pairLine(`2個とも赤（赤${red}個から2個）`, red),
          `確率 ＝ ${fractionText(hit, all)}`,
          'ポイント：確率 ＝ あてはまる場合の数 ÷ 全部の場合の数。同時に取り出すときは、順番を考えない選び方で数える',
        ],
      };
    }

    if (kind === 'oneEach') {
      const hit = red * white;
      return {
        params: { kind, red, white },
        text: `${intro}赤玉と白玉が1個ずつである確率はいくらか。`,
        answer: fraction(hit, all),
        unit: '',
        wrongs: [
          { value: fraction(hit, n * (n - 1)), mistake: '「赤→白」の順番だけを数えて、「白→赤」を数え忘れてしまった' },
          { value: fraction(red * white, n * n), mistake: '1個目を袋に戻してから2個目を取り出す計算にしてしまった' },
          { value: fraction(1, 2), mistake: '「1個ずつ」か「そうでないか」の2通りと考えて、1/2にしてしまった' },
        ],
        explanation: [
          allLine,
          `赤と白が1個ずつ ＝ 赤${red}個から1個 × 白${white}個から1個 ＝ ${red} × ${white} ＝ ${hit}通り`,
          `確率 ＝ ${fractionText(hit, all)}`,
          'ポイント：確率 ＝ あてはまる場合の数 ÷ 全部の場合の数。同時に取り出すときは、順番を考えない選び方で数える',
        ],
      };
    }

    const none = combinations(white, 2);
    return {
      params: { kind, red, white },
      text: `${intro}少なくとも1個が赤玉である確率はいくらか。`,
      answer: fraction(all - none, all),
      unit: '',
      wrongs: [
        { value: fraction(none, all), mistake: '引く側の「2個とも白玉」の確率を答えてしまった' },
        { value: fraction(red * white, all), mistake: '赤玉がちょうど1個の場合だけを数え、2個とも赤の場合を忘れてしまった' },
        { value: fraction(red, n), mistake: '1個目が赤玉である確率だけを出してしまった' },
      ],
      explanation: [
        '「少なくとも1個が赤」は、1 から「2個とも白」の確率を引く',
        allLine,
        pairLine(`2個とも白（白${white}個から2個）`, white),
        `確率 ＝ 1 − ${none}/${all} ＝ ${fractionText(all - none, all)}`,
        'ポイント：「少なくとも」は、1 −（1回も起きない確率）で求めると速い',
      ],
    };
  },
  // 検算：番号 0〜red−1 を赤玉として、2個の取り出し方を順番つきで全部数える（順番つきでも割合は同じ）
  solve({ kind, red, white }) {
    const isRed = (i) => i < red;
    return countPairs(red + white, (i, j) => {
      if (kind === 'bothRed') return isRed(i) && isRed(j);
      if (kind === 'oneEach') return isRed(i) !== isRed(j);
      return isRed(i) || isRed(j);
    });
  },
};

// ---- B. さいころを2個投げる ----
const DICE_KINDS = ['sum', 'sum', 'diff', 'atLeast']; // 和の問題をやや多めに出す

// 2個のさいころの目の組のうち、条件に合うものを「(1,5)(2,4)…」の形で書き出す
function diceList(accept) {
  const list = [];
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (accept(a, b)) list.push(`(${a},${b})`);
  return list;
}

const dice = {
  id: 'probability-dice',
  generate(rand) {
    const kind = rand.pick(DICE_KINDS);

    if (kind === 'sum') {
      const s = rand.int(3, 11);
      const list = diceList((a, b) => a + b === s);
      const unordered = Math.ceil(list.length / 2); // (1,5)と(5,1)を同じとした数
      return {
        params: { kind, s },
        text: `大小2個のさいころを同時に投げる。出た目の和が${s}になる確率はいくらか。`,
        answer: fraction(list.length, 36),
        unit: '',
        wrongs: [
          { value: fraction(unordered, 36), mistake: '(1,5)と(5,1)のような入れかえを、同じ1通りと数えてしまった' },
          { value: fraction(1, 11), mistake: '目の和は2〜12の11通りなので、1/11と考えてしまった（どの和も同じ出やすさではない）' },
          { value: fraction(unordered, 21), mistake: '目の組み合わせを、順番を考えない21通りで数えてしまった' },
        ],
        explanation: [
          '2個のさいころの目の出方は 6 × 6 ＝ 36通り（大小を区別する）',
          `和が${s}になるのは ${list.join('')} の${list.length}通り`,
          `確率 ＝ ${fractionText(list.length, 36)}`,
          'ポイント：2個のさいころは区別して数える。(1,5)と(5,1)は別の出方',
        ],
      };
    }

    if (kind === 'diff') {
      const d = rand.int(1, 5);
      const list = diceList((a, b) => Math.abs(a - b) === d);
      return {
        params: { kind, d },
        text: `大小2個のさいころを同時に投げる。出た目の差が${d}になる確率はいくらか。`,
        answer: fraction(list.length, 36),
        unit: '',
        wrongs: [
          { value: fraction(list.length / 2, 36), mistake: '(1,2)と(2,1)のような入れかえを、同じ1通りと数えてしまった' },
          { value: fraction(1, 6), mistake: '目の差は0〜5の6通りなので、1/6と考えてしまった（どの差も同じ出やすさではない）' },
          { value: fraction(list.length / 2, 21), mistake: '目の組み合わせを、順番を考えない21通りで数えてしまった' },
        ],
        explanation: [
          '2個のさいころの目の出方は 6 × 6 ＝ 36通り（大小を区別する）',
          `差が${d}になるのは ${list.join('')} の${list.length}通り`,
          `確率 ＝ ${fractionText(list.length, 36)}`,
          'ポイント：2個のさいころは区別して数える。(1,2)と(2,1)は別の出方',
        ],
      };
    }

    // 少なくとも1個は k以上の目（k ＝ 6 のときは「6の目」）。k を変えると答えも変わる（11/36・5/9・3/4・8/9）
    const k = rand.int(3, 6);
    const face = k === 6 ? '6の目' : `${k}以上の目`;
    const good = 7 - k; // 1個のさいころで k以上が出る目の数
    const bad = k - 1; // 1個のさいころで k以上が出ない目の数
    const none = bad * bad;
    return {
      params: { kind, k },
      text: `大小2個のさいころを同時に投げる。少なくとも1個は${face}が出る確率はいくらか。`,
      answer: fraction(36 - none, 36),
      unit: '',
      wrongs: [
        {
          value: fraction(2 * good, 6),
          mistake: `1個ずつの確率 ${valueText(fraction(good, 6))} を、そのまま2回足してしまった（2個とも${face}の場合を2回数えている）`,
        },
        { value: fraction(none, 36), mistake: `引く側の「1個も${face}が出ない」確率を答えてしまった` },
        { value: fraction(good * good, 36), mistake: `2個とも${face}が出る場合だけを数えてしまった` },
        { value: fraction(good, 6), mistake: 'さいころ1個だけで考えてしまった（2個あることを使っていない）' },
      ],
      explanation: [
        `「少なくとも1個は${face}」は、1 から「1個も${face}が出ない」確率を引く`,
        `1個も${face}が出ない出方 ＝ ${bad} × ${bad} ＝ ${none}通り（36通り中）`,
        `確率 ＝ 1 − ${none}/36 ＝ ${fractionText(36 - none, 36)}`,
        'ポイント：「少なくとも」は、1 −（1回も起きない確率）で求めると速い',
      ],
    };
  },
  // 検算：大小のさいころの目 36通りを全部たどって数える
  solve(params) {
    let hit = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        if (params.kind === 'sum' && a + b === params.s) hit++;
        if (params.kind === 'diff' && Math.abs(a - b) === params.d) hit++;
        if (params.kind === 'atLeast' && (a >= params.k || b >= params.k)) hit++;
      }
    }
    return fraction(hit, 36);
  },
};

// ---- C. くじ引き（引いたくじは戻さない） ----
const LOTTERY_KINDS = ['second', 'both', 'atLeastOne'];

const lottery = {
  id: 'probability-lottery',
  generate(rand, { calculator }) {
    const kind = rand.pick(LOTTERY_KINDS);
    // 2人とも当たる形は当たりが2本以上、少なくとも1人の形ははずれが2本以上いる
    const n = calculator ? rand.int(5, 20) : rand.int(5, 10);
    // 当たりが1本だと「2人とも当たる」ことがなく、「1人ずつの確率を足す」ミスがたまたま正解になるので、
    // 「2人とも当たる」「少なくとも1人」の形は当たりを2本以上にする
    const lowest = kind === 'second' ? 1 : 2;
    const highest = Math.min(calculator ? 6 : 4, kind === 'atLeastOne' ? n - 2 : n - 1);
    const a = rand.int(lowest, highest);
    const miss = n - a;
    const all = n * (n - 1);
    const intro = `${n}本のくじの中に当たりくじが${a}本ある。AとBがこの順に1本ずつ引く（引いたくじは戻さない）。`;
    const allLine = `2人の引き方は全部で ${n} × ${n - 1} ＝ ${all}通り（A・Bの順番つきで数える）`;

    if (kind === 'second') {
      const aHit = a * (a - 1);
      const aMiss = miss * a;
      return {
        params: { kind, n, a },
        text: `${intro}Bが当たりを引く確率はいくらか。`,
        answer: fraction(aHit + aMiss, all),
        unit: '',
        wrongs: [
          { value: fraction(a - 1, n - 1), mistake: 'Aが当たりを引いたと決めつけて計算してしまった' },
          { value: fraction(a, n - 1), mistake: 'Aが1本引いた分、全体の本数だけを1本減らしてしまった' },
          { value: fraction(aHit, all), mistake: '2人とも当たる確率を出してしまった' },
        ],
        explanation: [
          allLine,
          `Aが当たり → Bも当たり：${a} × ${a - 1} ＝ ${aHit}通り`,
          `Aがはずれ → Bが当たり：${miss} × ${a} ＝ ${aMiss}通り`,
          `確率 ＝ (${aHit} ＋ ${aMiss})/${all} ＝ ${fractionText(aHit + aMiss, all)}`,
          `ポイント：くじは引く順番に関係なく、当たる確率は同じ（Bも最初のAと同じ ${valueText(fraction(a, n))}）`,
        ],
      };
    }

    if (kind === 'both') {
      const hit = a * (a - 1);
      return {
        params: { kind, n, a },
        text: `${intro}2人とも当たりを引く確率はいくらか。`,
        answer: fraction(hit, all),
        unit: '',
        wrongs: [
          { value: fraction(a * a, n * n), mistake: '引いたくじを戻す計算にしてしまった（2本目は当たりも全体も1本減る）' },
          { value: fraction(a, n), mistake: 'Aが当たる確率だけを出してしまった' },
          { value: fraction(a - 1, n - 1), mistake: 'Aが当たったあとに、Bが当たる確率だけを出してしまった' },
        ],
        explanation: [
          allLine,
          `2人とも当たり：${a} × ${a - 1} ＝ ${hit}通り`,
          `確率 ＝ ${fractionText(hit, all)}`,
          'ポイント：1本目を引いたあとは、当たりくじも全体の本数も1本ずつ減る',
        ],
      };
    }

    const bothMiss = miss * (miss - 1);
    return {
      params: { kind, n, a },
      text: `${intro}少なくとも1人が当たりを引く確率はいくらか。`,
      answer: fraction(all - bothMiss, all),
      unit: '',
      wrongs: [
        { value: fraction(bothMiss, all), mistake: '引く側の「2人ともはずれ」の確率を答えてしまった' },
        { value: fraction(2 * a, n), mistake: '1人ずつの当たる確率を、そのまま2回足してしまった' },
        { value: fraction(a, n), mistake: 'Aが当たる確率だけを出してしまった' },
        { value: fraction(a * (a - 1), all), mistake: '「少なくとも1人」ではなく、2人とも当たる確率を出してしまった' },
      ],
      explanation: [
        '「少なくとも1人が当たり」は、1 から「2人ともはずれ」の確率を引く',
        allLine,
        `2人ともはずれ：${miss} × ${miss - 1} ＝ ${bothMiss}通り`,
        `確率 ＝ 1 − ${bothMiss}/${all} ＝ ${fractionText(all - bothMiss, all)}`,
        'ポイント：「少なくとも」は、1 −（1回も起きない確率）で求めると速い',
      ],
    };
  },
  // 検算：番号 0〜a−1 を当たりくじとして、A・Bの引き方を順番つきで全部数える
  solve({ kind, n, a }) {
    const win = (i) => i < a;
    return countPairs(n, (i, j) => {
      if (kind === 'second') return win(j);
      if (kind === 'both') return win(i) && win(j);
      return win(i) || win(j);
    });
  },
  // check.js が使う独自チェック：当たりもはずれも、問いに必要な本数があるか
  validate({ kind, n, a }) {
    if (kind !== 'second' && a < 2) return ['2人とも当たる・少なくとも1人の形なのに当たりが1本しかない'];
    if (kind === 'atLeastOne' && n - a < 2) return ['少なくとも1人の形なのにはずれが1本以下'];
    if (a >= n) return ['当たりくじが全体と同じかそれ以上'];
    return [];
  },
};

// 分数を「2/5」と書く（解説の中で使う）
function valueText(f) {
  return `${f.num}/${f.den}`;
}

export default {
  id: 'probability',
  label: '確率',
  templates: [balls, dice, lottery],
};
