// 計算の道具箱。約数・倍数・%を分数に直す計算・並べ方や選び方の数など、問題づくり（generators/ の各ファイル）が使う。

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

// n人から r人を選んで1列に並べる数（順番を区別する）：n × (n−1) × … を r個掛ける
export function permutations(n, r) {
  let result = 1;
  for (let i = 0; i < r; i++) result *= n - i;
  return result;
}

// n人から r人を選ぶだけの数（順番を区別しない）：並べる数 ÷ r人の並べ替えの数
export function combinations(n, r) {
  if (r < 0 || r > n) return 0;
  return permutations(n, r) / permutations(r, r);
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
