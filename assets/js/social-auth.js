(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.FirstBiteApi) return;
    const pending = window.FirstBiteApi.getPendingSocialLogin();
    if (!pending) return;

    try {
      const completed = await window.FirstBiteApi.completeSocialLogin();
      if (!completed) return;
      if (completed.next && completed.next !== "index.html") {
        window.location.replace(completed.next);
      }
    } catch (error) {
      console.error("소셜 로그인 세션 복구 실패", error);
      window.FirstBiteApi.clearPendingSocialLogin();
      window.location.replace("login.html?oauth_error=session");
    }
  });
})();
