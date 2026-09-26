// 画面の表示とボタン操作だけを担当する。
// 計算・採点はしない。進行役から受け取ったデータを表示し、押されたボタンを知らせるだけ。
const $ = (id) => document.getElementById(id);

const formatValue = (value, unit) => `${value.toLocaleString('ja-JP')}${unit}`;
const formatPercent = (correct, total) => (total ? `${Math.round((correct / total) * 100)}%` : '—');
function formatTime(ms) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}分${s % 60}秒` : `${s}秒`;
}

function el(tag, props = {}, text) {
  const node = Object.assign(document.createElement(tag), props);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createView({ categoryLabels, onStart, onChoose, onNext, onQuit, onHome, onClearHistory }) {
  const screens = { home: $('screen-home'), question: $('screen-question'), result: $('screen-result') };
  let lastMode = null;

  function showScreen(name) {
    for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
    window.scrollTo(0, 0);
  }

  $('mode-list').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-mode]');
    if (button) onStart(button.dataset.mode);
  });
  $('choice-list').addEventListener('click', (e) => {
    const button = e.target.closest('button[data-index]');
    if (button && !button.disabled) onChoose(Number(button.dataset.index));
  });
  $('next-button').addEventListener('click', () => onNext());
  $('quit-button').addEventListener('click', () => {
    if (confirm('この回をやめますか？（この回の成績は記録されません）')) onQuit();
  });
  $('retry-button').addEventListener('click', () => onStart(lastMode));
  $('home-button').addEventListener('click', () => onHome());
  $('clear-history').addEventListener('click', () => {
    if (confirm('成績の記録をすべて消しますか？')) onClearHistory();
  });

  function showHome({ modes, summary, settings }) {
    $('home-lead').textContent =
      `1回${settings.questionsPerSession}問・1問${settings.secondsPerQuestion}秒・${settings.calculator ? '電卓あり' : '電卓なし'}`;

    $('mode-list').replaceChildren(
      ...modes.map((m) => {
        const button = el('button', { type: 'button' }, m.label);
        button.dataset.mode = m.id;
        return button;
      }),
    );

    const box = $('history-summary');
    if (summary.sessions === 0) {
      box.replaceChildren(el('p', { className: 'muted' }, 'まだ記録がありません。1回解くとここに成績が出ます。'));
      $('clear-history').hidden = true;
    } else {
      const table = el('table');
      table.append(el('tr'));
      table.rows[0].append(el('th', {}, '分野'), el('th', { className: 'num' }, '正答率（直近）'));
      for (const c of summary.perCategory) {
        const row = table.insertRow();
        const name = row.insertCell();
        name.textContent = categoryLabels[c.id];
        if (c.id === summary.weakestId) name.append(el('span', { className: 'badge' }, '苦手'));
        const rate = row.insertCell();
        rate.className = 'num';
        rate.textContent = c.total ? `${formatPercent(c.correct, c.total)}（${c.total}問）` : 'まだ解いていない';
      }
      box.replaceChildren(el('p', { className: 'muted' }, `これまで ${summary.sessions} 回練習`), table);
      $('clear-history').hidden = false;
    }
    showScreen('home');
  }

  function showQuestion(q) {
    $('q-progress').textContent = `${q.number} / ${q.total}問`;
    $('q-category').textContent = q.categoryLabel;
    $('q-text').textContent = q.text;
    $('choice-list').replaceChildren(
      ...q.choices.map((value, i) => {
        const button = el('button', { type: 'button' }, formatValue(value, q.unit));
        button.dataset.index = i;
        return button;
      }),
    );
    $('feedback').hidden = true;
    showScreen('question');
  }

  function showTime(left, total) {
    $('timer-text').textContent = `${left}秒`;
    $('timer-fill').style.width = `${(left / total) * 100}%`;
    $('timer').classList.toggle('is-low', left <= 10);
  }

  function showFeedback(fb) {
    if (!fb) return;
    const buttons = [...$('choice-list').children];
    for (const b of buttons) b.disabled = true;
    buttons[fb.answerIndex].classList.add('is-correct');
    if (fb.chosenIndex !== null && !fb.correct) buttons[fb.chosenIndex].classList.add('is-wrong');

    const verdict = $('fb-verdict');
    verdict.textContent = fb.correct ? '○ 正解' : fb.timedOut ? '× 時間切れ' : '× 不正解';
    verdict.className = `verdict ${fb.correct ? 'ok' : 'ng'}`;
    $('fb-answer').textContent = `正解：${formatValue(fb.answer, fb.unit)}`;
    $('fb-mistake').hidden = !fb.mistake;
    $('fb-mistake').textContent = fb.mistake ? `よくあるミス：${fb.mistake}` : '';
    $('fb-steps').replaceChildren(...fb.explanation.map((line) => el('li', {}, line)));
    $('next-button').textContent = fb.isLast ? '結果を見る' : '次の問題へ';

    $('feedback').hidden = false;
    $('feedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showResult(result) {
    lastMode = result.mode;
    $('r-rate').textContent = formatPercent(result.correct, result.total);
    $('r-detail').textContent =
      `${result.total}問中 ${result.correct}問正解` + (result.timedOut ? `（時間切れ ${result.timedOut}問）` : '');
    $('r-time').textContent =
      `解答にかかった時間 ${formatTime(result.timeMs)}（1問平均 ${formatTime(result.timeMs / result.total)}）`;

    const table = el('table');
    table.append(el('tr'));
    table.rows[0].append(el('th', {}, '分野'), el('th', { className: 'num' }, '正答'), el('th', { className: 'num' }, '平均時間'));
    for (const [id, c] of Object.entries(result.byCategory)) {
      const row = table.insertRow();
      row.insertCell().textContent = categoryLabels[id];
      Object.assign(row.insertCell(), { className: 'num', textContent: `${c.correct}/${c.total}（${formatPercent(c.correct, c.total)}）` });
      Object.assign(row.insertCell(), { className: 'num', textContent: formatTime(c.timeMs / c.total) });
    }
    $('r-categories').replaceChildren(table);
    showScreen('result');
  }

  return { showHome, showQuestion, showTime, showFeedback, showResult };
}
