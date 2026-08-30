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

// v1에서 cross-origin(카카오맵 등) 요청까지 전부 캐시하던 버그를 고치면서 버전을 올렸다 —
// 옛 v1 캐시에 잘못 저장된 응답이 남아있을 수 있어 activate 시점에 지운다.
const RUNTIME_CACHE = 'topten-portal-runtime-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // 우리 사이트(같은 origin) 요청만 다룬다. 카카오맵 SDK, 지오코딩 API, 지도 타일/클러스터
  // 이미지처럼 다른 도메인(cross-origin) 요청은 절대 손대지 않고 브라우저가 원래대로 처리하게
  // 그냥 흘려보낸다(respondWith를 아예 호출하지 않음).
  //
  // 처음엔 모든 GET 요청을 가로채서 캐시에 저장했는데, "홈 화면에 추가"해서 설치한 뒤로
  // 열면(=서비스워커가 처음부터 활성화된 채로 페이지가 뜨는 상황) 지도에 매장 마커가 아예
  // 하나도 안 뜨는 문제가 있었다. 원인으로 가장 유력한 게 이 부분이다 — 카카오 쪽 요청은
  // CORS 없이 오는 불투명(opaque) 응답이라 cache.put()이 실패하거나 응답이 원래와 다르게
  // 전달될 수 있다. 일반 탭에서는 서비스워커가 아직 그 페이지를 장악하기 전(첫 방문)이라
  // 문제가 안 드러났을 뿐, 설치된 앱은 처음부터 서비스워커가 모든 요청을 가로채서 바로
  // 증상이 나타난 것으로 보인다. 그래서 같은 origin 요청에만 관여하도록 범위를 좁혔다.
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

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
