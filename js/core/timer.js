// 制限時間を数える係。quiz.js に頼まれて1問ごとに時間を数え、残り秒数と時間切れを quiz.js に知らせる。
//
// 「何回数えたか」ではなく「終了予定時刻との差」で残り秒数を出すので、
// スマホで画面を切り替えてタイマーが止まりがちになっても、時間がずれない。
export function createTimer({ seconds, onTick, onTimeUp, now = Date.now }) {
  let intervalId = null;
  let endAt = 0;

  function tick() {
    const left = Math.max(0, Math.ceil((endAt - now()) / 1000));
    onTick(left, seconds);
    if (left === 0) {
      stop();
      onTimeUp();
    }
  }

  function start() {
    stop();
    endAt = now() + seconds * 1000;
    tick();
    intervalId = setInterval(tick, 250);
  }

  function stop() {
    if (intervalId !== null) clearInterval(intervalId);
    intervalId = null;
  }

  return { start, stop };
}
