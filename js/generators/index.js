// 問題づくりの受付（分野の登録簿）。quiz.js から「この分野の問題を1問」と頼まれると、担当の分野ファイルに作らせる。
// 分野を増やすときは、このフォルダに1ファイル作って、下の categories に1行足すだけ。
import ratio from './ratio.js';
import profit from './profit.js';
import speed from './speed.js';
import sets from './sets.js';
import counting from './counting.js';
import probability from './probability.js';

export const categories = [
  ratio,
  profit,
  speed,
  sets,
  counting,
  probability,
];

// 指定した分野のテンプレートを1つ選んで、問題を1問作る。
// テンプレートに weight（出やすさ）があればそれに従う。ないものは1（例：weight: 2 は2倍出やすい）
export function generateProblem(categoryId, rand, settings) {
  const category = categories.find((c) => c.id === categoryId);
  const template = rand.weightedPick(category.templates, (t) => t.weight ?? 1);
  return {
    category: category.id,
    categoryLabel: category.label,
    templateId: template.id,
    ...template.generate(rand, settings),
  };
}
