/* TOP10 영업지원 포털 서비스워커 (v3, 2026-10-22)
 *
 * 목적: 홈 화면/PC 앱으로 설치해서 써도, 깃허브에 새 topten_portal.html을 올리면
 *       앱을 열 때 항상 최신 화면이 나오게 한다.
 *
 * 동작
 *  - 같은 사이트(github.io/topten-portal) 파일만 다룬다. 카카오맵 등 외부 요청은 손대지 않는다
 *    (외부 요청까지 가로채면 지도 마커가 안 뜨는 문제가 있었음 — v2에서 해결한 내용 유지).
 *  - 페이지(HTML)는 브라우저 저장본을 건너뛰고 매번 서버에서 새로 받는다(cache:'no-store').
 *    → v2까지는 브라우저가 몇 분간 예전 파일을 재사용해서, 올린 직후 PC에 옛 화면이 뜨는 일이 있었다.
 *  - 아이콘/manifest 같은 나머지 파일도 서버 우선으로 받는다.
 *  - 인터넷이 끊겼을 때만 마지막으로 받아둔 화면을 보여준다.
 */
const RUNTIME_CACHE = 'topten-portal-runtime-v3';

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== RUNTIME_CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function isPage(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1 || /\.html?$/i.test(new URL(request.url).pathname);
}

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // 외부(카카오맵 등)는 브라우저에 맡김

  const fresh = isPage(request)
    ? fetch(request, { cache: 'no-store' })   // 페이지: 브라우저 저장본 건너뛰고 항상 서버에서 새로
    : fetch(request);                                                       // 그 외: 서버 우선

  event.respondWith(
    fresh.then(function (response) {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      // 오프라인일 때만 마지막 저장본
      return caches.match(request).then(function (cached) {
        return cached || caches.match(url.pathname) || Response.error();
      });
    })
  );
});
