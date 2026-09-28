// 答えの値の係。答えは「整数」（120人など）・「分数」（確率の 3/10 など）・「文字」（推論の「アとイ」など）で、どれも同じように比べたり判定したりできるようにする。
// choices.js（4択づくり）・format.js（書き方）・tests/ のチェックから使われる。分数は fraction()、文字は label() で generators/ の各ファイルが作る。
//
// 分数は { num: 分子, den: 分母 } の形で、必ず約分した状態にしておく（6/10 ではなく 3/5）。
// 文字は { label: 'アとイ' } の形。文字には「正解に近い値」がないので、補充はせず、誤答は全部ミスの説明つきで生成器が用意する。
import { gcd } from './math.js';

// 約分した分数を作る
export function fraction(num, den) {
  const g = gcd(Math.abs(num), Math.abs(den)) || 1;
  return { num: num / g, den: den / g };
}

// 文字の答えを作る
export const label = (text) => ({ label: text });

export const isFraction = (value) => typeof value === 'object' && value !== null && 'num' in value && 'den' in value;
export const isLabel = (value) => typeof value === 'object' && value !== null && 'label' in value;

// 値の種類：'number'（整数）・'fraction'（分数）・'label'（文字）
export function valueKind(value) {
  if (isFraction(value)) return 'fraction';
  if (isLabel(value)) return 'label';
  return 'number';
}

// 値を比べるための文字（同じ値なら同じ文字になる）
export function valueKey(value) {
  if (isFraction(value)) return `${value.num}/${value.den}`;
  if (isLabel(value)) return `label:${value.label}`;
  return String(value);
}

export const sameValue = (a, b) => valueKey(a) === valueKey(b);

// 選択肢として使える値：正の整数、0より大きく1より小さい分数（確率）、空でない文字
export function isUsableValue(value) {
  if (isFraction(value)) {
    return Number.isInteger(value.num) && Number.isInteger(value.den) && value.num > 0 && value.num < value.den;
  }
  if (isLabel(value)) return typeof value.label === 'string' && value.label.trim() !== '';
  return Number.isInteger(value) && value > 0;
}

// 補充した選択肢が正解に十分近いか（tests/ のチェックもこの決まりで確かめる）
// 整数：正解の±10%（小さい答えは±2）まで。分数：同じ分母で分子を2ずらした分まで。文字：近い値がないので補充は使えない（常に false）
export function isNearAnswer(value, answer) {
  if (isLabel(answer)) return false;
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
  if (isLabel(answer)) return null; // 文字には近い値がないので作らない（使えない値として捨てられる）
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
