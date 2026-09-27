// サイコロ（乱数）の係。問題の数字や選択肢の並びをランダムに決めるときに、generators/・choices.js・quiz.js が使う。
//
// seed（乱数の種）を渡すと毎回同じ並びになるので、おかしな問題が出たときに同じ問題を再現できる。
export function createRandom(seed = Date.now()) {
  let state = seed >>> 0;

  // 0以上1未満の数を返す（mulberry32 という定番の計算方法）
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    seed,
    next,
    // min以上max以下の整数
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    shuffle(list) {
      const copy = [...list];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
