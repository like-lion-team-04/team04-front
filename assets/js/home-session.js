// 홈 진입 시 세션 부트스트랩.
// 소셜 로그인 성공 후 백엔드가 refresh 쿠키를 심고 이 페이지로 리다이렉트한다.
// 여기서 /auth/refresh 를 호출해 Access Token(메모리)을 확보하고 로그인 상태를 반영한다.
(function () {
  "use strict";
  const api = window.FirstBiteAPI;
  if (!api) return;

  api.ensureSession()
    .then(() => {
      // 로그인 상태: 프로필 버튼을 계정 페이지로 연결한다.
      const profile = document.querySelector(".profile-button");
      if (profile) {
        profile.setAttribute("href", "account.html");
        profile.setAttribute("aria-label", "내 계정");
      }
      document.body.dataset.authenticated = "true";
    })
    .catch(() => {
      // 비로그인 상태: 게스트로 유지한다.
      document.body.dataset.authenticated = "false";
    });
})();
