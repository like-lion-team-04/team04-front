(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", async () => {
    if (!window.FirstBiteApi) return;

    const profileButton = document.querySelector(".profile-button");

    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace("login.html?next=account.html");
        return;
      }

      const account = await window.FirstBiteApi.getMe();
      document.querySelectorAll('[data-account-field="name"]').forEach((element) => {
        element.textContent = account.name || "회원";
      });
      document.querySelectorAll('[data-account-field="email"]').forEach((element) => {
        element.textContent = account.email || "";
      });

      const feedbackCount = document.querySelector('[data-account-field="feedbackCount"]');
      if (feedbackCount) {
        feedbackCount.textContent = String(account.personalization && Number.isFinite(account.personalization.feedbackCount)
          ? account.personalization.feedbackCount
          : 0);
      }

      const coachingCount = document.querySelector('[data-account-field="coachingCount"]');
      if (coachingCount) {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        const summary = await window.FirstBiteApi.getCoachingHistorySummary({
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          timezone: "Asia/Seoul"
        }).catch(() => null);
        coachingCount.textContent = String(summary && Number.isFinite(summary.coachingCount) ? summary.coachingCount : 0);
      }

      const avatar = document.querySelector(".account-avatar");
      if (avatar) avatar.alt = `${account.name || "회원"} 프로필`;
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        window.location.replace("login.html?next=account.html");
        return;
      }
      console.error("계정 정보를 불러오지 못했습니다.", error);
    }

    if (profileButton) {
      profileButton.setAttribute("aria-label", "로그아웃");
      profileButton.addEventListener("click", async (event) => {
        event.preventDefault();
        if (!window.confirm("로그아웃하시겠어요?")) return;
        try {
          await window.FirstBiteApi.logout();
        } finally {
          window.location.replace("login.html");
        }
      });
    }
  });
})();
