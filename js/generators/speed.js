// 「速度算」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説をセットで返す。
// 数字を選ぶときは math.js の計算道具を使う。
//
// どのテンプレートも「先に速さと時間を決めて、距離を計算する」逆算方式なので、答えは必ず割り切れる整数になる。
// 旅人算（出会い・追い越し）は本番で出やすいので、ほかの2倍出るようにしている（weight: 2）。
import { gcd, lcm, pickPreferring } from '../core/math.js';

// top ÷ bottom の「時間」の書き方。
// 「2分の3時間」は「2分（ミニッツ）」と読み違えやすいので使わず、
// 小数で割り切れるときは小数（1.5）、割り切れないときは「1/3」と書く
function hoursText(top, bottom) {
  const g = gcd(top, bottom);
  let rest = bottom / g;
  while (rest % 2 === 0) rest /= 2;
  while (rest % 5 === 0) rest /= 5;
  return rest === 1 ? String(top / bottom) : `${top / g}/${bottom / g}`;
}

// A. 距離と時速から、かかる時間（分）を求める
const MOVE_SCENES = [
  { from: '家', to: '駅', how: '', verb: '歩く', speeds: [3, 4, 5, 6] },
  { from: '家', to: '図書館', how: '自転車に乗り、', verb: '走る', speeds: [10, 12, 15, 18] },
  { from: 'A市', to: 'B市', how: '車に乗り、', verb: '走る', speeds: [30, 36, 40, 45, 48, 60] },
];
// 電卓なしで使う、60と約分しやすい分数
const NICE_MINUTES = [10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 48, 50, 54, 60, 72, 75, 80, 90];

const minutesFromDistance = {
  id: 'speed-minutes',
  generate(rand, { calculator }) {
    const s = rand.pick(MOVE_SCENES);
    // 距離（時速×分÷60）が整数kmになる組み合わせを選ぶ
    const pickPair = () => {
      for (;;) {
        const v = calculator ? rand.int(s.speeds[0], s.speeds.at(-1)) : rand.pick(s.speeds);
        const t = calculator ? rand.int(5, 120) : rand.pick(NICE_MINUTES);
        if ((v * t) % 60 === 0) return { v, t };
      }
    };
    // 代表的なミス（1時間を100分として計算する）も整数になる組み合わせを優先する
    const { v, t } = pickPreferring(pickPair, ({ v, t }) => ((v * t) / 60 * 100) % v === 0);
    const d = (v * t) / 60;

    return {
      params: { d, v },
      text: `${s.from}から${s.to}まで${d}kmある。${s.how}時速${v}kmで${s.verb}と、何分かかるか。`,
      answer: t,
      unit: '分',
      wrongs: [
        { value: (d * 100) / v, mistake: '1時間を100分として計算してしまった' },
        { value: d / v, mistake: `${d}÷${v}で出た「時間」の数字を、そのまま分にしてしまった` },
        { value: (v * 60) / d, mistake: '距離と速さを逆にして割ってしまった' },
        { value: d * v, mistake: '距離と速さを掛けてしまった' },
      ],
      explanation: [
        `時間 ＝ 距離 ÷ 速さ ＝ ${d} ÷ ${v} ＝ ${hoursText(d, v)}時間`,
        `1時間 ＝ 60分 なので、${hoursText(d, v)}時間 × 60 ＝ ${t}分`,
        'ポイント：時速で計算すると答えは「時間」で出る。分を聞かれたら × 60 する',
      ],
    };
  },
  solve({ d, v }) {
    return (d * 60) / v;
  },
};

// B. 行きと帰りの速さから、往復の平均の速さを求める
const NICE_SPEEDS = [3, 4, 5, 6, 8, 10, 12, 15, 20, 24, 30, 36, 40, 45, 48, 60];

// 平均の速さ（2×v1×v2÷(v1+v2)）が整数になり、速さの差が大きすぎない組を探す
function findSpeedPair(rand, calculator) {
  for (let tries = 0; tries < 1000; tries++) {
    const v1 = calculator ? rand.int(3, 90) : rand.pick(NICE_SPEEDS);
    const v2 = calculator ? rand.int(3, 90) : rand.pick(NICE_SPEEDS);
    const ok =
      v1 !== v2 &&
      (2 * v1 * v2) % (v1 + v2) === 0 &&
      Math.max(v1, v2) <= Math.min(v1, v2) * 4 &&
      lcm(v1, v2) <= 240;
    if (ok) return [v1, v2];
  }
  return findSpeedPair(rand, false); // 電卓ありで見つからないときは電卓なしの候補から
}

const averageRoundTrip = {
  id: 'speed-round-trip',
  generate(rand, { calculator }) {
    // 代表的なミス（速さを単純に平均する）も整数になる組を優先する
    const [v1, v2] = pickPreferring(() => findSpeedPair(rand, calculator), ([a, b]) => (a + b) % 2 === 0);
    // 片道の距離は、行きも帰りも時間が整数になるよう両方の速さの公倍数にする
    const base = lcm(v1, v2);
    const d = base * rand.int(1, Math.max(1, Math.floor((Math.min(v1, v2) * 4) / base)));
    const t1 = d / v1;
    const t2 = d / v2;
    const avg = (2 * d) / (t1 + t2);

    return {
      params: { d, v1, v2 },
      text: `A地点とB地点の間（${d}km）を往復した。行きは時速${v1}km、帰りは時速${v2}kmで進んだ。往復の平均の速さは時速何kmか。`,
      answer: avg,
      prefix: '時速',
      unit: 'km',
      wrongs: [
        { value: (v1 + v2) / 2, mistake: '行きと帰りの速さを足して2で割ってしまった' },
        { value: avg / 2, mistake: '往復の距離ではなく、片道の距離を時間で割ってしまった' },
        { value: v1 + v2, mistake: '行きと帰りの速さを足してしまった' },
      ],
      explanation: [
        `行き：${d} ÷ ${v1} ＝ ${t1}時間、帰り：${d} ÷ ${v2} ＝ ${t2}時間`,
        `往復で ${2 * d}km を ${t1 + t2}時間 で進んだ`,
        `平均の速さ ＝ ${2 * d} ÷ ${t1 + t2} ＝ 時速${avg}km`,
        'ポイント：平均の速さ ＝ 全体の距離 ÷ 全体の時間。速さどうしを足して2で割らない',
      ],
    };
  },
  // 検算：距離を使わない公式 2×v1×v2÷(v1+v2)
  solve({ v1, v2 }) {
    return (2 * v1 * v2) / (v1 + v2);
  },
};

// C. 旅人算：2人が向かい合って進む「出会い」と、後から追いかける「追い越し」を半分ずつ出す
const PAIRS = [
  { first: '兄', second: '弟' },
  { first: 'Aさん', second: 'Bさん' },
];
// 電卓なしで使う、歩く速さ（分速m）と時間（分）
const WALK_SPEEDS = [50, 60, 70, 75, 80, 90, 100];
const MEET_MINUTES = [4, 5, 6, 8, 10, 12, 15, 20];
const CHASE_SPEEDS = [40, 50, 60, 70, 75, 80, 90, 100];
const CHASE_GAPS = [10, 15, 20, 25, 30, 40, 50, 60]; // 追いかける人のほうが1分あたり何m速いか
const HEAD_MINUTES = [2, 3, 4, 5, 6, 8, 9, 10, 12, 15, 18, 20]; // 先に出発した人が何分先に出たか

// 出会い：距離 ÷ (速さの和)
function meetProblem(rand, calculator, p) {
  const pickMeet = () => {
    for (;;) {
      const v1 = calculator ? rand.int(40, 120) : rand.pick(WALK_SPEEDS);
      const v2 = calculator ? rand.int(40, 120) : rand.pick(WALK_SPEEDS);
      const t = calculator ? rand.int(3, 30) : rand.pick(MEET_MINUTES);
      if (v1 !== v2) return { v1, v2, t };
    }
  };
  // 代表的なミス（速さの差で割る）も整数になる組み合わせを優先する
  const { v1, v2, t } = pickPreferring(pickMeet, ({ v1, v2, t }) => ((v1 + v2) * t) % Math.abs(v1 - v2) === 0);
  const sum = v1 + v2;
  const d = sum * t;

  return {
    params: { kind: 'meet', d, v1, v2 },
    text: `A地点とB地点は${d}m離れている。${p.first}はA地点から分速${v1}m、${p.second}はB地点から分速${v2}mで、同時に向かい合って歩き始めた。2人が出会うのは何分後か。`,
    answer: t,
    unit: '分',
    wrongs: [
      { value: d / Math.abs(v1 - v2), mistake: '向かい合って進むのに、速さの差で割ってしまった（差を使うのは追い越しのとき）' },
      { value: 2 * t, mistake: '2人の速さを平均して、その速さで割ってしまった' },
      { value: d / v1, mistake: `${p.first}の速さだけで割ってしまった（2人とも近づいている）` },
    ],
    explanation: [
      `2人は1分間に ${v1} ＋ ${v2} ＝ ${sum}m ずつ近づく`,
      `出会うまでの時間 ＝ ${d} ÷ ${sum} ＝ ${t}分`,
      'ポイント：向かい合って進むときは、2人の速さを足す（出会い算）',
    ],
  };
}

// 追い越し：先に進んだ距離 ÷ (速さの差)
function chaseProblem(rand, calculator, p) {
  const pickChase = () => {
    for (;;) {
      const v2 = calculator ? rand.int(40, 100) : rand.pick(CHASE_SPEEDS);
      const gap = calculator ? rand.int(5, 60) : rand.pick(CHASE_GAPS);
      const h = calculator ? rand.int(2, 20) : rand.pick(HEAD_MINUTES);
      const t = (v2 * h) / gap;
      if (Number.isInteger(t) && t >= 2 && t <= (calculator ? 60 : 30)) return { v1: v2 + gap, v2, h, t };
    }
  };
  // 代表的なミス（速さの和で割る）も整数になる組み合わせを優先する。
  // ほかのミスまで条件に入れると、数字の組み合わせが数通りに偏るので入れない
  const { v1, v2, h, t } = pickPreferring(pickChase, ({ v1, v2, h }) => (v2 * h) % (v1 + v2) === 0);
  const ahead = v2 * h;
  const diff = v1 - v2;

  return {
    params: { kind: 'chase', v1, v2, h },
    text: `${p.second}が家を出て、分速${v2}mで駅に向かった。その${h}分後に${p.first}が家を出て、同じ道を分速${v1}mで追いかけた。${p.first}が${p.second}に追いつくのは、${p.first}が家を出てから何分後か。`,
    answer: t,
    unit: '分',
    wrongs: [
      { value: ahead / (v1 + v2), mistake: '同じ向きに追いかけるのに、速さの和で割ってしまった（和を使うのは出会いのとき）' },
      { value: t + h, mistake: `${p.first}ではなく、${p.second}が家を出てからの時間を答えてしまった` },
      { value: ahead / v1, mistake: `差を縮める速さ（${diff}m）ではなく、${p.first}の速さで割ってしまった` },
    ],
    explanation: [
      `${p.first}が家を出るまでに、${p.second}は ${v2} × ${h} ＝ ${ahead}m 先に進んでいる`,
      `${p.first}は1分間に ${v1} − ${v2} ＝ ${diff}m ずつ差を縮める`,
      `追いつくまでの時間 ＝ ${ahead} ÷ ${diff} ＝ ${t}分`,
      'ポイント：同じ向きに追いかけるときは速さを引く（追い越し算）。先に進んだ距離を先に出す',
    ],
  };
}

const travelers = {
  id: 'speed-travelers',
  weight: 2,
  generate(rand, { calculator }) {
    const p = rand.pick(PAIRS);
    return rand.next() < 0.5 ? meetProblem(rand, calculator, p) : chaseProblem(rand, calculator, p);
  },
  // 検算：出会いは 距離 ÷ 速さの和、追い越しは 先に進んだ距離 ÷ 速さの差
  solve(params) {
    if (params.kind === 'meet') return params.d / (params.v1 + params.v2);
    return (params.v2 * params.h) / (params.v1 - params.v2);
  },
  // check.js が使う独自チェック：追いかける人のほうが速いか、出会いの2人の速さが違うか
  validate(params) {
    if (params.kind === 'chase' && params.v1 <= params.v2) return ['追いかける人のほうが遅い（追いつけない）'];
    if (params.kind === 'meet' && params.v1 === params.v2) return ['出会いの2人の速さが同じ'];
    return [];
  },
};

export default {
  id: 'speed',
  label: '速度算',
  templates: [minutesFromDistance, averageRoundTrip, travelers],
};
