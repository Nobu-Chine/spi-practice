// 問題づくりで使う計算の道具。

// 最大公約数
export function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// 最小公倍数
export function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

// 百分率を約分した分数にする（60% → 5分の3 → { top: 3, bottom: 5 }）
export function percentToFraction(percent) {
  const g = gcd(percent, 100);
  return { top: percent / g, bottom: 100 / g };
}

// step の倍数のうち、min〜max に入るものを1つ選ぶ
export function pickMultiple(rand, step, min, max) {
  return step * rand.int(Math.ceil(min / step), Math.floor(max / step));
}

// 条件に合う値が出るまで何回か選び直す（見つからなければ最後の値を使う）。
// 「代表的なミスの答えも割り切れる数」を優先したいときに使う。
export function pickPreferring(pick, isGood, tries = 30) {
  let value;
  for (let i = 0; i < tries; i++) {
    value = pick();
    if (isGood(value)) return value;
  }
  return value;
}
