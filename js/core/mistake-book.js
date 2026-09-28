// 復習リストの決まりの係。間違えた問題を「同じ問題は1回だけ・最大100問・古い順に出す」の決まりで出し入れする。
// quiz.js が「入れて」「消して」「◯問ちょうだい」と頼む。実際の保存は、main.js から渡された storage/mistakes.js の関数に任せる。
//
// 保存するのは作り終わった問題そのもの（問題文・選択肢・正解の位置・解説）なので、問題を作り直す必要はない。

const MAX_PROBLEMS = 100;

// 問題を見分ける印：テンプレートと問題の数字が同じなら同じ問題（場面の文章だけ違う問題も同じとみなす）
export const problemKey = (problem) => `${problem.templateId}:${JSON.stringify(problem.params)}`;

// 保存に必要な項目だけを取り出す（誤答の候補 wrongs などは、選択肢を作ったあとは要らない）
function toSaved(q) {
  const { category, categoryLabel, templateId, params, text, answer, unit, prefix, explanation, choices, answerIndex } = q;
  return { category, categoryLabel, templateId, params, text, answer, unit, prefix, explanation, choices, answerIndex };
}

export function createMistakeBook({ load, save, max = MAX_PROBLEMS }) {
  return {
    count: () => load().length,

    // 間違えた問題を入れる。すでに入っていれば何もしない。多すぎたら古いものから消す
    add(problem) {
      const list = load();
      if (list.some((p) => problemKey(p) === problemKey(problem))) return;
      save([...list, toSaved(problem)].slice(-max));
    },

    // 復習で正解した問題を消す
    remove(problem) {
      const key = problemKey(problem);
      save(load().filter((p) => problemKey(p) !== key));
    },

    // 復習で出す問題を、古い順に最大 n 問返す
    take: (n) => load().slice(0, n),
  };
}
