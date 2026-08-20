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
        // 전체 코칭 기록 수를 표시한다(30일 요약이 아니라 누적). 기간 제한으로 0으로 보이던 문제 방지.
        const records = await window.FirstBiteApi.getCoachingRecords({ page: 1, size: 1 }).catch(() => null);
        const total = records && records.meta && Number.isFinite(Number(records.meta.totalElements))
          ? Number(records.meta.totalElements)
          : 0;
        coachingCount.textContent = String(total);
      }

      const avatar = document.querySelector(".account-avatar");
      if (avatar) avatar.alt = `${account.name || "회원"} 프로필`;
    } catch (error) {
      if (error.status === 401 || error.status === 404) {
        window.location.replace("login.html?next=account.html");
        return;
      }
      console.error("계정 정보를 불러오지 못했습니다.", error);
      // 조용히 빈 화면으로 두지 않고 사용자에게 표시한다.
      document.querySelectorAll('[data-account-field="name"]').forEach((element) => {
        element.textContent = "정보를 불러오지 못했어요";
      });
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
