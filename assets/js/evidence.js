(function () {
  "use strict";
  // 올바른 전역명은 window.FirstBiteApi (대문자 API 아님).
  const api = window.FirstBiteApi;
  if (!api) return;

  const list = document.querySelector("[data-evidence-list]");
  if (!list) return;

  api.getEvidence()
    .then((data) => {
      const sources = data && data.sources;
      // 서버가 출처 데이터를 주면 갱신, 없으면 HTML의 정적 안내를 그대로 유지한다.
      if (!Array.isArray(sources) || sources.length === 0) return;
      list.innerHTML = sources.map((source) => `<article class="evidence-row"><h3>${source.title || source.name || "데이터 출처"}</h3><p>${source.description || source.organization || ""}<br>${source.publishedYear || ""}</p>${source.url ? `<a class="source-link" href="${source.url}" target="_blank" rel="noopener">출처 보기</a>` : ""}</article>`).join("");
    })
    .catch((error) => {
      // 실패(비로그인 401·네트워크 등) 시에도 페이지의 정적 출처 안내를 유지해 백지화를 막는다.
      console.warn("데이터 출처를 서버에서 불러오지 못해 기본 안내를 표시합니다.", error && error.code ? error.code : error);
    });
})();
