// Minimal service worker for AlreaDough.
// Why it exists: Android Chrome only offers its one-tap install prompt to sites that have a service
// worker with a real fetch handler. Its only jobs are to qualify for that and to show a calm page
// when the phone is offline. It never caches pages, API calls, or chat replies, so a new deploy is
// always seen on the next load.
const OFFLINE_PAGE = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AlreaDough</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efea;color:#2b2523;font:16px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;text-align:center;padding:24px}h1{font:500 26px Georgia,serif;margin:0 0 8px}p{margin:0;color:#7a6a64}</style></head><body><div><h1>AlreaDough</h1><p>现在没有网络，连上网络后再打开就好。<br>You're offline. Open it again once you're connected.</p></div></body></html>`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(request).catch(() => new Response(OFFLINE_PAGE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } })),
  );
});
