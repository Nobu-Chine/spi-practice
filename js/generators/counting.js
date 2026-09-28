// 「場合の数」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説をセットで返す。
// 並べ方・選び方の数は math.js の計算道具を使う。
//
// 検算（solve）は公式を使わず、全部の並べ方・選び方を1つずつ実際に数え上げる。
// 作る道（公式）と確かめる道（数え上げ）がまったく別なので、式の書き間違いを確実に見つけられる。
import { permutations, combinations } from '../core/math.js';

// ---- 解説で使う書き方 ----

// 「6 × 5 × 4」のように、n から1ずつ減らして r個掛ける式
function productText(n, r) {
  return Array.from({ length: r }, (_, i) => n - i).join(' × ');
}

// 「6人から3人を選ぶ ＝ (6 × 5 × 4) ÷ (3 × 2 × 1) ＝ 20通り」。
// 選ぶ人数が半分より多いときは「選ばない人を選ぶ」と考えるほうが速いので、そちらで書く（5人から4人 ＝ 選ばない1人 ＝ 5通り）
function combinationLine(label, n, r) {
  if (r === n) return `${label} ＝ 全員を選ぶので 1通り`;
  const k = Math.min(r, n - r);
  const how = k === r ? '' : `選ばない${k}人を選ぶのと同じなので `;
  if (k === 1) return `${label} ＝ ${how}${n}通り`;
  return `${label} ＝ ${how}(${productText(n, k)}) ÷ (${productText(k, k)}) ＝ ${combinations(n, r)}通り`;
}

// ---- 検算用の数え上げ（公式を使わない） ----

// 0〜n−1 の番号から、ちがう番号を r個 順番に取り出す並びを全部たどって、条件に合うものを数える
function countSequences(n, r, accept = () => true) {
  let count = 0;
  const used = Array(n).fill(false);
  const picked = [];
  (function walk() {
    if (picked.length === r) {
      if (accept(picked)) count++;
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      picked.push(i);
      walk();
      picked.pop();
      used[i] = false;
    }
  })();
  return count;
}

// 番号が小さい順に並んだ並びだけを数えると、「選ぶだけ（順番なし）」の数になる
const isAscending = (seq) => seq.every((v, i) => i === 0 || seq[i - 1] < v);

// ---- A. 並べる？選ぶだけ？ ----
const ROLES = ['委員長', '副委員長', '書記', '会計'];

const orderOrChoose = {
  id: 'counting-order-or-choose',
  generate(rand, { calculator }) {
    const ordered = rand.next() < 0.5;
    // 電卓なしは 4〜8人から2〜3人（6人以上なら4人まで）。答えが暗算できる大きさ（最大 8×7×6×5 ＝ 1680）に収まる
    const n = calculator ? rand.int(5, 10) : rand.int(4, 8);
    const r = calculator ? rand.int(2, 4) : rand.int(2, n >= 6 ? 4 : 3);
    const perm = permutations(n, r);
    const comb = combinations(n, r);
    const reorder = permutations(r, r);

    if (ordered) {
      const roles = ROLES.slice(0, r);
      return {
        params: { ordered, n, r },
        text: `${n}人の中から、${roles.join('・')}を1人ずつ選ぶ（1人が2つの役を兼ねることはない）。選び方は何通りか。`,
        answer: perm,
        unit: '通り',
        wrongs: [
          { value: comb, mistake: '役があって順番を区別するのに、「選ぶだけ」の計算をしてしまった' },
          { value: n ** r, mistake: '同じ人が何度でも選ばれるとして計算してしまった' },
          { value: n * r, mistake: `人数（${n}人）と役の数（${r}つ）を掛けただけになってしまった` },
        ],
        explanation: [
          '役が決まっているので、選ぶ順番を区別する（並べ方と同じ）',
          roles.map((role, i) => `${role}は${n - i}通り`).join('、') + '（前で選ばれた人は除く）',
          `${productText(n, r)} ＝ ${perm}通り`,
          'ポイント：役・順番があるか（並べる）、ないか（選ぶだけ）を最初に確かめる',
        ],
      };
    }

    return {
      params: { ordered, n, r },
      text: `${n}人の中から、${r}人の代表を選ぶ。選び方は何通りか。`,
      answer: comb,
      unit: '通り',
      wrongs: [
        { value: perm, mistake: '代表には順番がないのに、並べ方の計算をしてしまった' },
        { value: n ** r, mistake: '同じ人が何度でも選ばれるとして計算してしまった' },
        { value: n * r, mistake: `人数（${n}人）と選ぶ人数（${r}人）を掛けただけになってしまった` },
      ],
      explanation: [
        '代表には順番がないので、選ぶだけ（並べ方ではない）',
        `まず並べ方で数えると ${productText(n, r)} ＝ ${perm}通り`,
        `同じ${r}人の組でも並べ替えが ${productText(r, r)} ＝ ${reorder}通りずつ重なっているので、${perm} ÷ ${reorder} ＝ ${comb}通り`,
        'ポイント：役・順番があるか（並べる）、ないか（選ぶだけ）を最初に確かめる',
      ],
    };
  },
  // 検算：r人の並びを全部たどる。選ぶだけのときは、番号が小さい順の並びだけ数える
  solve({ ordered, n, r }) {
    return countSequences(n, r, ordered ? undefined : isAscending);
  },
};

// ---- B. 少なくとも1人 ----
const atLeastOne = {
  id: 'counting-at-least-one',
  generate(rand, { calculator }) {
    const r = calculator ? rand.int(2, 5) : rand.int(2, 4);
    const men = calculator ? rand.int(r, 8) : rand.int(r, 6); // 男子だけでも r人選べるようにする（「女子0人」の場合がある）
    const women = calculator ? rand.int(2, 7) : rand.int(2, 5);
    const n = men + women;
    const all = combinations(n, r);
    const none = combinations(men, r);
    const answer = all - none;

    return {
      params: { men, women, r },
      text: `男子${men}人、女子${women}人の中から${r}人を選ぶ。女子が少なくとも1人入る選び方は何通りか。`,
      answer,
      unit: '通り',
      wrongs: [
        {
          value: women * combinations(n - 1, r - 1),
          mistake: '先に女子を1人決めてから残りを選び、同じ組み合わせを何回も数えてしまった',
        },
        { value: all, mistake: '「女子が1人もいない選び方」を引き忘れてしまった' },
        { value: none, mistake: '引く側の「女子が1人もいない（男子だけの）選び方」を答えてしまった' },
      ],
      explanation: [
        '「少なくとも1人」は、全部の選び方から「女子が1人もいない選び方」を引く',
        combinationLine(`全部（${n}人から${r}人）`, n, r),
        combinationLine(`女子が1人もいない（男子${men}人から${r}人）`, men, r),
        `${all} − ${none} ＝ ${answer}通り`,
        'ポイント：女子1人・2人…と分けて数えるより、「全部 − 1人もいない場合」のほうが速くて確実',
      ],
    };
  },
  // 検算：番号 0〜women−1 を女子として、女子を1人以上含む組を数え上げる
  solve({ men, women, r }) {
    return countSequences(men + women, r, (seq) => isAscending(seq) && seq.some((i) => i < women));
  },
};

// ---- C. 並び方に条件がつく（隣り合う・隣り合わない・3人が隣り合う・両端） ----
const KINDS = ['pair', 'apart', 'trio', 'ends'];

const adjacent = {
  id: 'counting-adjacent',
  generate(rand, { calculator }) {
    const kind = rand.pick(KINDS);
    // 3人が隣り合う形は5人以上から。電卓なしは答えが 720通り 以下になる人数にする
    const n = kind === 'trio' ? (calculator ? rand.int(5, 8) : rand.int(5, 7)) : calculator ? rand.int(4, 7) : rand.int(4, 6);
    const total = permutations(n, n);
    const block = permutations(n - 1, n - 1); // AとBをひとまとめにしたときの並べ方
    const side = block * 2;
    const others = n - 2;
    const middle = permutations(others, others); // A・B（・C）以外の並べ方など

    if (kind === 'trio') {
      const answer = middle * 6;
      return {
        params: { kind, n },
        text: `A、B、Cを含む${n}人が1列に並ぶ。A、B、Cの3人が隣り合う並び方は何通りか。`,
        answer,
        unit: '通り',
        wrongs: [
          { value: middle, mistake: 'まとめた3人の中の並び方（3 × 2 × 1 ＝ 6通り）を掛け忘れてしまった' },
          { value: middle * 3, mistake: 'まとめた3人の中の並び方を、3通りと数えてしまった' },
          { value: total, mistake: '「隣り合う」という条件を使わず、全員の並べ方を出してしまった' },
        ],
        explanation: [
          `A、B、Cをひとまとめにすると、まとまり1つと残り${n - 3}人の、合わせて${n - 2}つの並べ方 ＝ ${productText(others, others)} ＝ ${middle}通り`,
          'まとめた中の A、B、C の並び方 ＝ 3 × 2 × 1 ＝ 6通り',
          `${middle} × 6 ＝ ${answer}通り`,
          'ポイント：隣り合う → ひとまとめにして並べ、まとまりの中の並び方を掛ける',
        ],
      };
    }

    if (kind === 'ends') {
      const answer = middle * 2;
      return {
        params: { kind, n },
        text: `AとBを含む${n}人が1列に並ぶ。AとBが両端に並ぶ並び方は何通りか。`,
        answer,
        unit: '通り',
        wrongs: [
          { value: middle, mistake: '両端のAとBを入れ替えた並び（A…B と B…A）の2通りを掛け忘れてしまった' },
          { value: block * 2, mistake: `片方の端だけを決めて、残り${n - 1}人を全部並べてしまった` },
          { value: total, mistake: '「両端」という条件を使わず、全員の並べ方を出してしまった' },
        ],
        explanation: [
          '両端の並び方は「A…B」と「B…A」の2通り',
          `間の${others}人の並べ方 ＝ ${productText(others, others)} ＝ ${middle}通り`,
          `2 × ${middle} ＝ ${answer}通り`,
          'ポイント：場所が決まっている人を先に置いてから、残りの人を並べる',
        ],
      };
    }

    if (kind === 'pair') {
      return {
        params: { kind, n },
        text: `AとBを含む${n}人が1列に並ぶ。AとBが隣り合う並び方は何通りか。`,
        answer: side,
        unit: '通り',
        wrongs: [
          { value: block, mistake: 'まとめたAとBの中の並び方（AB・BA の2通り）を掛け忘れてしまった' },
          { value: total, mistake: '「隣り合う」という条件を使わず、全員の並べ方を出してしまった' },
          {
            value: middle * 2,
            mistake: `AとBのまとまりを並べる人数に入れず、残り${others}人の並べ方に2を掛けただけになってしまった`,
          },
        ],
        explanation: [
          `AとBをひとまとめにすると、まとまり1つと残り${n - 2}人の、合わせて${n - 1}つの並べ方 ＝ ${productText(n - 1, n - 1)} ＝ ${block}通り`,
          'まとめた中の AとB の並び方が AB・BA の2通り',
          `${block} × 2 ＝ ${side}通り`,
          'ポイント：隣り合う → ひとまとめにして並べ、まとまりの中の並び方を掛ける',
        ],
      };
    }

    const answer = total - side;
    return {
      params: { kind, n },
      text: `AとBを含む${n}人が1列に並ぶ。AとBが隣り合わない並び方は何通りか。`,
      answer,
      unit: '通り',
      wrongs: [
        { value: side, mistake: '「隣り合わない」ではなく、隣り合う並び方を答えてしまった' },
        { value: total - block, mistake: '引く「隣り合う並び方」で、AB・BA の2通りを掛け忘れてしまった' },
        { value: total, mistake: '「隣り合わない」という条件を使わず、全員の並べ方を出してしまった' },
      ],
      explanation: [
        `全員の並べ方 ＝ ${productText(n, n)} ＝ ${total}通り`,
        `隣り合う並べ方 ＝ ${productText(n - 1, n - 1)} × 2 ＝ ${side}通り（AとBをまとめて並べ、AB・BA の2通りを掛ける）`,
        `${total} − ${side} ＝ ${answer}通り`,
        'ポイント：隣り合わない → 全部から「隣り合う」を引く',
      ],
    };
  },
  // 検算：番号0をA、1をB、2をCとして全員の並びを全部たどり、条件に合う並びを数える
  solve({ kind, n }) {
    return countSequences(n, n, (seq) => {
      const [a, b, c] = [0, 1, 2].map((person) => seq.indexOf(person));
      if (kind === 'pair') return Math.abs(a - b) === 1;
      if (kind === 'apart') return Math.abs(a - b) > 1;
      if (kind === 'trio') return Math.max(a, b, c) - Math.min(a, b, c) === 2;
      return Math.min(a, b) === 0 && Math.max(a, b) === n - 1; // ends：AとBが先頭と最後
    });
  },
};

export default {
  id: 'counting',
  label: '場合の数',
  templates: [orderOrChoose, atLeastOne, adjacent],
};
