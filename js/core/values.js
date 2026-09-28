// 答えの値の係。答えは「整数」（120人など）か「分数」（確率の 3/10 など）で、どちらも同じように比べたり判定したりできるようにする。
// choices.js（4択づくり）・format.js（書き方）・tests/check.js（チェック）から使われる。分数は generators/ の各ファイルが fraction() で作る。
//
// 分数は { num: 分子, den: 分母 } の形で、必ず約分した状態にしておく（6/10 ではなく 3/5）。
import { gcd } from './math.js';

// 約分した分数を作る
export function fraction(num, den) {
  const g = gcd(Math.abs(num), Math.abs(den)) || 1;
  return { num: num / g, den: den / g };
}

export const isFraction = (value) => typeof value === 'object' && value !== null && 'num' in value && 'den' in value;

// 値を比べるための文字（同じ値なら同じ文字になる）
export function valueKey(value) {
  return isFraction(value) ? `${value.num}/${value.den}` : String(value);
}

export const sameValue = (a, b) => valueKey(a) === valueKey(b);

// 選択肢として使える値：正の整数、または 0より大きく1より小さい分数（確率）
export function isUsableValue(value) {
  if (isFraction(value)) {
    return Number.isInteger(value.num) && Number.isInteger(value.den) && value.num > 0 && value.num < value.den;
  }
  return Number.isInteger(value) && value > 0;
}

// 補充した選択肢が正解に十分近いか（tests/check.js もこの決まりで確かめる）
// 整数：正解の±10%（小さい答えは±2）まで。分数：同じ分母で分子を2ずらした分まで
export function isNearAnswer(value, answer) {
  if (isFraction(answer)) {
    if (!isFraction(value)) return false;
    return Math.abs(value.num / value.den - answer.num / answer.den) <= 2 / answer.den + 1e-9;
  }
  return Math.abs(value - answer) <= Math.max(answer * 0.1, 2);
}

// 補充の候補を1つ作る：正解から step × offset だけずらした値
// 整数は「正解の約5%以下のキリのいい数」ずつずらす。
// 分数は offset が ±1・±2 なら同じ分母のまま分子をずらす（3/10 → 4/10, 5/10）。
// それで足りないとき（1/2 など分母が小さく 0/2・2/2 になってしまう）は、分母を細かくして近い分数を作る（1/2 → 3/8 など）
export function shiftedValue(answer, offset) {
  if (!isFraction(answer)) return answer + fillerStep(answer) * offset;
  if (Math.abs(offset) <= 2) return fraction(answer.num + offset, answer.den);
  const m = Math.abs(offset) - 1; // 分母を m倍に細かくする（2倍、3倍、…）
  return fraction(answer.num * m + (offset % 2 === 0 ? 1 : -1), answer.den * m);
}

// 整数の補充用のずらし幅：正解の約5%以下で最大の「1・2・5 × 10のn乗」（100なら5、1020なら50）。
// 1倍・2倍ずらしても正解の±10%以内に収まる
function fillerStep(answer) {
  let step = 1;
  for (let unit = 1; unit <= answer; unit *= 10) {
    for (const m of [1, 2, 5]) {
      if (unit * m <= answer * 0.05) step = unit * m;
    }
  }
  return step;
}
