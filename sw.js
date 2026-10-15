// PDF読み上げ：アプリ本体を端末に保存して、ネットがなくても開けるようにする Service Worker
// - 保存するのはアプリのファイル（下の FILES）だけ。PDF・文章・辞書は保存しない
// - ネットがあるときは GitHub Pages の最新版を使い、保存分も置き換える（3秒以内に返事がなければ保存分を使う）
// - 保存先は常に1つ（CACHE）。仕組みを変えたときは名前を変え、古い保存分は自動で削除する
const CACHE = 'pdf-yomiage-app-v1';
const FILES = [
  './', 'index.html', 'manifest.json', 'icon-180.png', 'icon-192.png', 'icon-512.png',
  'lib/pdf.min.js', 'lib/pdf.worker.min.js', 'lib/pdf.cmaps.js', 'lib/PDFJS-LICENSE.txt'
];
const TIMEOUT_MS = 3000;

// 初めて開いたとき：アプリのファイルをすべて保存する
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

// 古い保存分（このアプリの別の名前のもの）を削除する
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('pdf-yomiage-app-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 読み込み：最新版を優先し、ネットがない・遅いときは保存分を使う
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;  // 他のサイトへの通信には関わらない
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const fromNet = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());  // 最新版で保存分を置き換える（同じ場所に上書きなので増えない）
      return res;
    });
    fromNet.catch(() => {});  // ネットがないときの失敗は、下で保存分に切り替えるので無視する
    const timeout = new Promise(resolve => setTimeout(resolve, TIMEOUT_MS, null));
    try {
      const res = await Promise.race([fromNet, timeout]);
      if (res) return res;
    } catch {}
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    return fromNet;  // 保存分がなければ、ネットの返事を待つ
  })());
});
