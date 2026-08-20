// 런타임 환경 설정. api.js보다 먼저 로드되어야 한다.
// - 로컬 개발: 프론트 :3000, 백엔드 :8080 (다른 origin)
// - 배포: 프론트/백엔드를 같은 오리진(nginx)에서 서빙 → 상대경로 "/api/v1"
(function () {
  "use strict";
  if (!window.FIRSTBITE_API_BASE) {
    var host = location.hostname;
    var isLocalDev = host === "localhost" || host === "127.0.0.1";
    window.FIRSTBITE_API_BASE = isLocalDev
      ? "http://localhost:8080/api/v1"  // 로컬 개발
      : "/api/v1";                       // 배포(같은 오리진)
  }
})();
