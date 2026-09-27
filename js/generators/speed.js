// 「速度算」の問題を作る係。index.js（登録簿）から呼ばれ、問題文・正解・よくあるミス・解説をセットで返す。
// 数字を選ぶときは math.js の計算道具を使う。
//
// どちらも「先に速さと時間を決めて、距離を計算する」逆算方式なので、答えは必ず割り切れる整数になる。
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

export default {
  id: 'speed',
  label: '速度算',
  templates: [minutesFromDistance, averageRoundTrip],
};
