(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    const profileLinks = [...document.querySelectorAll(".profile-button, .mobile-profile-hit")];
    if (!profileLinks.length || !window.FirstBiteApi) return;

    const applyState = (loggedIn) => {
      profileLinks.forEach((profileLink) => {
        profileLink.href = loggedIn ? "account.html" : "login.html";
        profileLink.setAttribute("aria-label", loggedIn ? "계정 및 사용자 데이터" : "로그인");
      });
    };

    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      applyState(loggedIn);
    } catch (_error) {
      applyState(false);
    }

    window.addEventListener("firstbite:auth-state", (event) => {
      applyState(Boolean(event.detail && event.detail.authenticated));
    });
  });
})();
