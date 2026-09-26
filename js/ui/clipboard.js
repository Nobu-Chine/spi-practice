// 文字をクリップボードにコピーする。成功したら true を返す。
// ふつうは navigator.clipboard を使う。使えない・断られたときは、昔ながらの方法（見えない入力欄を選択してコピー）を試す。
// iPhone（Safari）は、ボタンを押した流れの中で呼ばれないとコピーを断るので、押された直後にこの関数を呼ぶこと。
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 下の予備の方法を試す
  }
  return copyWithSelection(text);
}

function copyWithSelection(text) {
  const area = document.createElement('textarea');
  area.value = text;
  // readonly にしてキーボードが出ないようにし、16px にして iPhone の自動ズームを防ぐ
  area.setAttribute('readonly', '');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', fontSize: '16px' });
  document.body.append(area);

  area.focus();
  area.select();
  area.setSelectionRange(0, text.length); // iPhone は select() だけでは全体を選べない
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}
