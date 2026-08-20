(function () {
  "use strict";

  const ARTWORK = {
    default: "assets/design/home-default.svg?v=20260820-12",
    deferred: "assets/design/home-deferred.svg?v=20260820-12",
    selected: "assets/design/home-selected.svg?v=20260820-12",
    saved: "assets/design/home-saved.svg?v=20260820-12"
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const canvas = document.querySelector(".home-design");
    const artwork = canvas && canvas.querySelector("[data-design-artwork]");
    if (!canvas || !artwork || !window.FirstBiteFeedback) return;

    const saveButton = canvas.querySelector("[data-feedback-save]");
    const statusText = canvas.querySelector("[data-feedback-status]");
    const savedAnswer = canvas.querySelector("[data-saved-answer]");
    const selection = window.FirstBiteFeedback.setupSelection(canvas);
    let selectedScore = null;

    function render(state, options = {}) {
      canvas.dataset.state = state;
      artwork.src = ARTWORK[state] || ARTWORK.default;
      savedAnswer.hidden = true;

      if (state === "default") {
        selectedScore = null;
        selection.clear();
        saveButton.disabled = true;
        saveButton.classList.remove("is-active");
        statusText.textContent = "어제 오후 컨디션을 선택해 주세요.";
        return;
      }

      if (state === "selected") {
        artwork.src = ARTWORK.default;
        selection.render(selectedScore);
        saveButton.disabled = false;
        saveButton.classList.add("is-active");
        statusText.textContent = `${window.FirstBiteFeedback.labels[selectedScore - 1]}를 선택했습니다.`;
        return;
      }

      saveButton.disabled = true;
      saveButton.classList.remove("is-active");

      if (state === "saved") {
        const score = Number(options.score || selectedScore || 0);
        if (score >= 1 && score <= 5 && score !== 5) {
          savedAnswer.hidden = false;
          savedAnswer.textContent = `어제 오후 컨디션이 '${window.FirstBiteFeedback.labels[score - 1]}'로 저장되었습니다`;
        }
        statusText.textContent = "어제의 컨디션을 저장했어요.";
      } else if (state === "deferred") {
        statusText.textContent = options.message || "현재 응답할 피드백이 없습니다.";
      }
    }

    function savedToday(latest) {
      if (!latest || latest.submitted !== true || !latest.answeredAt) return false;
      const answered = new Date(latest.answeredAt);
      const today = new Date();
      return answered.getFullYear() === today.getFullYear()
        && answered.getMonth() === today.getMonth()
        && answered.getDate() === today.getDate();
    }

    canvas.addEventListener("feedback-selection", (event) => {
      selectedScore = event.detail.score;
      render("selected");
    });

    canvas.querySelector("[data-feedback-defer]").addEventListener("click", () => {
      // '다음에 답하기'는 서버에 저장하지 않는다. 다음 방문 시 다시 PENDING으로 조회될 수 있다.
      render("deferred", { message: "피드백을 다음 방문에 다시 보여드릴게요." });
    });

    saveButton.addEventListener("click", async () => {
      if (!selectedScore) return;
      saveButton.disabled = true;
      try {
        const result = await window.FirstBiteFeedback.submit(selectedScore);
        selectedScore = Number(result.score || selectedScore || 0) || null;
        render("saved", { score: selectedScore });
      } catch (error) {
        saveButton.disabled = false;
        if (error && error.code === "AUTH_UNAUTHORIZED") {
          window.location.href = "login.html?next=index.html";
          return;
        }
        window.alert(error.message || "피드백을 저장하지 못했습니다.");
      }
    });

    // 서버 결과를 확인하기 전에는 선택이 없는 기본 상태로 둔다.
    render("default");

    try {
      const server = await window.FirstBiteFeedback.loadServerState();
      if (!server.authenticated) {
        render("deferred", { message: "로그인하면 어제 코칭에 대한 피드백을 남길 수 있어요." });
        return;
      }

      const status = server.status;
      if (status && status.status === "PENDING") {
        render("default");
        return;
      }
      if (status && status.status === "ANSWERED") {
        selectedScore = status.sleepinessScore == null ? null : Number(status.sleepinessScore);
        render("saved", { score: selectedScore });
        return;
      }
      if (status && status.status === "EXPIRED") {
        render("deferred", { message: "어제 피드백의 응답 기간이 지났어요." });
        return;
      }
      render("deferred", { message: "어제 완료한 코칭 기록이 없어 피드백이 없습니다." });
    } catch (_error) {
      // 서버 연결이 일시적으로 실패해도, 과거 서버 저장이 확인된 로컬 캐시만 제한적으로 사용한다.
      const latest = window.FirstBiteFeedback.readLatest();
      if (savedToday(latest)) {
        selectedScore = latest.score == null ? null : Number(latest.score);
        render("saved", { score: selectedScore });
      } else {
        render("deferred", { message: "피드백 정보를 불러오지 못했습니다." });
      }
    }
  });
})();
