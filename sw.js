// TOP10 영업지원 포털 서비스워커
//
// 이 사이트는 주간 매출실적 파일이 올라올 때마다 topten_portal.html 전체가
// 통째로 새 내용으로 교체되는 방식이다. 그래서 절대로 이 파일(특히 HTML 자체)을
// 적극적으로 캐시하면 안 된다 — 캐시했다가는 홈 화면 아이콘을 눌렀을 때
// 몇 주 전 매출 데이터가 뜨는 심각한 버그가 생긴다.
//
// 이 서비스워커는 "설치 가능한 앱"이 되기 위한 최소 요건만 채운다:
// 항상 네트워크에서 최신 내용을 받아오고, 네트워크가 아예 안 될 때만
// (예: 지하철 등 오프라인) 최후 수단으로 마지막에 성공했던 응답을 보여준다.

const RUNTIME_CACHE = 'topten-portal-runtime-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 성공하면 오프라인 대비용으로만 살짝 저장해두고, 화면엔 항상 방금 받은 최신 응답을 준다.
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
