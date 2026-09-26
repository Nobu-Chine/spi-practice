// 分野の登録簿。
// 分野を増やすときは、このフォルダに1ファイル作って、下の categories に1行足すだけ。
import ratio from './ratio.js';

export const categories = [
  ratio,
];

// 指定した分野のテンプレートを1つ選んで、問題を1問作る
export function generateProblem(categoryId, rand, settings) {
  const category = categories.find((c) => c.id === categoryId);
  const template = rand.pick(category.templates);
  return {
    category: category.id,
    categoryLabel: category.label,
    templateId: template.id,
    ...template.generate(rand, settings),
  };
}
