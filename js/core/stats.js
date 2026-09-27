// 成績を集計する係。1回分の正答率（quiz.js から頼まれる）と、これまでの苦手分野（main.js から頼まれる）を計算する。
// 保存は history.js、表示は view.js の係なので、ここでは計算だけをする。

// 1回分の解答記録をまとめる
export function summarizeSession(records) {
  const byCategory = {};
  for (const r of records) {
    const c = (byCategory[r.category] ??= { correct: 0, total: 0, timeMs: 0 });
    c.total++;
    if (r.correct) c.correct++;
    c.timeMs += r.timeMs;
  }
  return {
    total: records.length,
    correct: records.filter((r) => r.correct).length,
    timedOut: records.filter((r) => r.timedOut).length,
    timeMs: records.reduce((sum, r) => sum + r.timeMs, 0),
    byCategory,
  };
}

// 履歴から分野ごとの直近の成績と苦手分野を出す。
// 苦手分野 = 直近 recent 問の正答率がいちばん低い分野（minAnswers 問以上解いた分野が2つ以上あるときだけ）
export function analyzeHistory(history, categoryIds, { recent = 30, minAnswers = 10 } = {}) {
  const newestFirst = [...history].reverse();
  const perCategory = categoryIds.map((id) => {
    let correct = 0;
    let total = 0;
    for (const session of newestFirst) {
      if (total >= recent) break;
      const c = session.byCategory?.[id];
      if (!c) continue;
      correct += c.correct;
      total += c.total;
    }
    return { id, correct, total, rate: total ? correct / total : null };
  });

  const eligible = perCategory.filter((c) => c.total >= minAnswers);
  const weakest =
    eligible.length >= 2 ? eligible.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  return { sessions: history.length, perCategory, weakestId: weakest?.id ?? null };
}
