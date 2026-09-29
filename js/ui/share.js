// 共有の係。サイトのURLを友だちに送れるようにする。main.js から呼ばれ、コピーは clipboard.js に任せる。
//
// ホーム画面から開くとアドレスバーが無く共有できないため、サイト内の共有ボタンから使う。
// スマホは共有メニュー（LINEなど）を開き、使えないブラウザではURLをコピーする。
// 結果は 'shared'（共有メニューを開いた）・'copied'（コピーした）・'failed'（どちらもできなかった）で返す。
import { copyText } from './clipboard.js';

const SITE_URL = 'https://spi-practice-app.vercel.app/';
const SITE_TITLE = 'SPI非言語 練習';

export async function shareSite() {
  if (navigator.share) {
    try {
      await navigator.share({ title: SITE_TITLE, url: SITE_URL });
    } catch {
      // 共有メニューを閉じただけのときもここに来るので、何もしない
    }
    return 'shared';
  }
  return (await copyText(SITE_URL)) ? 'copied' : 'failed';
}
