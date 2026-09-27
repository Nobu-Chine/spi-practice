// 画面の表示とボタン操作の係。計算や採点は quiz.js に任せ、受け取った結果を表示するだけ。
// ボタンが押されたことは main.js に知らせる。数字の書き方は format.js を使う。
import { formatValue } from '../core/format.js';

const $ = (id) => document.getElementById(id);

const COPY_MESSAGE_MS = 2000;
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

// 解説の行を並べる。番号は文字の行だけに振り、表には振らない（1 → 表 → 2 → 3）
function explanationItems(lines) {
  let number = 0;
  return lines.map((line) => {
    const item = explanationItem(line);
    if (typeof line === 'string') item.value = ++number;
    return item;
  });
}

// 解説の1行。文字ならそのまま、{ type: 'table' } なら表にする（highlight のマスは答えとして色をつける）
function explanationItem(line) {
  if (typeof line === 'string') return el('li', {}, line);
  const table = el('table', { className: 'mini-table' });
  const head = table.createTHead().insertRow();
  const body = table.createTBody().insertRow();
  line.headers.forEach((header, i) => {
    head.append(el('th', {}, header));
    const cell = body.insertCell();
    cell.textContent = line.cells[i];
    if (i === line.highlight) cell.className = 'is-answer';
  });
  const item = el('li', { className: 'has-table' });
  item.append(table);
  return item;
}

export function createView({ categoryLabels, onStart, onChoose, onNext, onQuit, onHome, onClearHistory, onCopy }) {
  const screens = { home: $('screen-home'), question: $('screen-question'), result: $('screen-result') };
  let lastMode = null;
  let copyMessageTimer = null;

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
  $('copy-button').addEventListener('click', () => onCopy());
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
        const button = el('button', { type: 'button' }, formatValue(value, q.unit, q.prefix));
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
    $('fb-answer').textContent = `正解：${formatValue(fb.answer, fb.unit, fb.prefix)}`;
    $('fb-mistake').hidden = !fb.mistake;
    $('fb-mistake').textContent = fb.mistake ? `よくあるミス：${fb.mistake}` : '';
    $('fb-steps').replaceChildren(...explanationItems(fb.explanation));
    $('next-button').textContent = fb.isLast ? '結果を見る' : '次の問題へ';
    clearCopyMessage();

    $('feedback').hidden = false;
    $('feedback').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // コピーの結果を短く表示して、少したったら消す
  function showCopyResult(ok) {
    const message = $('copy-message');
    message.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
    message.className = `copy-message ${ok ? 'ok' : 'ng'}`;
    clearTimeout(copyMessageTimer);
    copyMessageTimer = setTimeout(clearCopyMessage, COPY_MESSAGE_MS);
  }

  function clearCopyMessage() {
    clearTimeout(copyMessageTimer);
    $('copy-message').textContent = '';
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
    // 分野の並びはトップ画面と同じ登録順にそろえる
    for (const id of Object.keys(categoryLabels).filter((id) => result.byCategory[id])) {
      const c = result.byCategory[id];
      const row = table.insertRow();
      row.insertCell().textContent = categoryLabels[id];
      Object.assign(row.insertCell(), { className: 'num', textContent: `${c.correct}/${c.total}（${formatPercent(c.correct, c.total)}）` });
      Object.assign(row.insertCell(), { className: 'num', textContent: formatTime(c.timeMs / c.total) });
    }
    $('r-categories').replaceChildren(table);
    showScreen('result');
  }

  return { showHome, showQuestion, showTime, showFeedback, showCopyResult, showResult };
}
