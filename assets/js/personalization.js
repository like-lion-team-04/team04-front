(function () {
  "use strict";

  const ARTWORK = {
    selected: "assets/design/personalization-default.svg?v=20260820-12",
    saved: "assets/design/personalization-saved.svg?v=20260820-12"
  };

  const DIRECTION_TITLES = {
    GENTLER: "조금 더 완만한 방향으로 안내 중이에요",
    STANDARD: "현재 일반 기준으로 안내 중이에요",
    STRONGER: "조금 더 적극적인 방향으로 안내 중이에요"
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const canvas = document.querySelector(".personalization-design");
    const artwork = canvas && canvas.querySelector("[data-design-artwork]");
    if (!canvas || !artwork || !window.FirstBiteFeedback) return;

    const selection = window.FirstBiteFeedback.setupSelection(canvas);
    const saveButton = canvas.querySelector("[data-feedback-save]");
    const savedAnswer = canvas.querySelector("[data-saved-answer]");
    const statusText = canvas.querySelector("[data-feedback-status]");
    const unavailableNote = canvas.querySelector("[data-feedback-unavailable]");
    const personalizationLive = canvas.querySelector("[data-personalization-live]");
    const progressRing = canvas.querySelector("[data-personalization-ring]");
    const progressCount = canvas.querySelector("[data-personalization-count]");
    const progressTitle = canvas.querySelector("[data-personalization-progress-title]");
    const progressDescription = canvas.querySelector("[data-personalization-progress-description]");
    const directionTitle = canvas.querySelector("[data-personalization-direction-title]");
    const directionDescription = canvas.querySelector("[data-personalization-direction-description]");
    const coefficientText = canvas.querySelector("[data-personalization-coefficient]");
    let selectedScore = null;

    function hideUnavailable() {
      if (unavailableNote) unavailableNote.hidden = true;
    }

    function showUnavailable(message) {
      selection.clear();
      canvas.dataset.state = "unavailable";
      artwork.src = ARTWORK.selected;
      saveButton.disabled = true;
      saveButton.classList.remove("is-active");
      savedAnswer.hidden = true;
      if (unavailableNote) {
        unavailableNote.hidden = false;
        unavailableNote.textContent = message;
      }
      statusText.textContent = message;
    }

    function renderPending() {
      hideUnavailable();
      canvas.dataset.state = "selected";
      artwork.src = ARTWORK.selected;
      savedAnswer.hidden = true;
      selection.clear();
      selectedScore = null;
      saveButton.disabled = true;
      saveButton.classList.remove("is-active");
      statusText.textContent = "어제 오후 컨디션을 선택해 주세요.";
    }

    function renderSelected() {
      hideUnavailable();
      canvas.dataset.state = "selected";
      artwork.src = ARTWORK.selected;
      selection.render(selectedScore);
      saveButton.disabled = false;
      saveButton.classList.add("is-active");
      savedAnswer.hidden = true;
      statusText.textContent = `${window.FirstBiteFeedback.labels[selectedScore - 1]}를 선택했습니다.`;
    }

    function renderSaved(score) {
      hideUnavailable();
      canvas.dataset.state = "saved";
      artwork.src = ARTWORK.saved;
      selection.clear();
      saveButton.disabled = true;
      saveButton.classList.remove("is-active");
      savedAnswer.hidden = true;
      const numericScore = Number(score || 0);
      if (numericScore >= 1 && numericScore <= 5 && numericScore !== 5) {
        savedAnswer.hidden = false;
        savedAnswer.textContent = `어제 오후 컨디션이 '${window.FirstBiteFeedback.labels[numericScore - 1]}'로 저장되었습니다`;
      }
      statusText.textContent = "어제의 컨디션을 저장했어요.";
    }

    function renderPersonalization(profile) {
      if (!personalizationLive) return;
      personalizationLive.hidden = false;

      if (!profile) {
        progressRing && progressRing.style.setProperty("--personalization-progress", "0deg");
        if (progressCount) progressCount.textContent = "- / 3";
        if (progressTitle) progressTitle.textContent = "개인화 정보를 불러오지 못했어요";
        if (progressDescription) progressDescription.textContent = "잠시 후 다시 확인해 주세요.";
        if (directionTitle) directionTitle.textContent = "현재 상태를 확인할 수 없어요";
        if (directionDescription) directionDescription.textContent = "서버 연결 상태를 확인해 주세요.";
        if (coefficientText) coefficientText.hidden = true;
        return;
      }

      const feedbackCount = Math.max(0, Number(profile.feedbackCount) || 0);
      const progressCountValue = Math.min(3, feedbackCount);
      const progress = Math.min(1, feedbackCount / 3);
      const enabled = Boolean(profile.enabled);
      const direction = String(profile.direction || "STANDARD").toUpperCase();
      const remaining = Math.max(0, 3 - feedbackCount);

      if (progressRing) progressRing.style.setProperty("--personalization-progress", `${progress * 360}deg`);
      if (progressCount) progressCount.textContent = `${progressCountValue} / 3`;
      if (progressTitle) {
        progressTitle.textContent = enabled
          ? "맞춤 안내가 활성화됐어요!"
          : `개인화까지 ${remaining}회 남았어요!`;
      }
      if (progressDescription) {
        progressDescription.textContent = enabled
          ? `지금까지 ${feedbackCount}회의 피드백이 맞춤 안내에 반영됐어요.`
          : `피드백 ${feedbackCount}회가 쌓였어요. 3회부터 맞춤 안내가 시작돼요.`;
      }
      if (directionTitle) {
        directionTitle.textContent = enabled
          ? (DIRECTION_TITLES[direction] || DIRECTION_TITLES.STANDARD)
          : "피드백을 모으고 있어요";
      }
      if (directionDescription) directionDescription.textContent = profile.message || "피드백을 바탕으로 안내 기준을 조정해요.";
      if (coefficientText) {
        if (enabled && profile.coefficient != null) {
          coefficientText.hidden = false;
          coefficientText.textContent = `개인화 계수 ${Number(profile.coefficient).toFixed(2)}`;
        } else {
          coefficientText.hidden = true;
        }
      }
    }

    async function refreshPersonalization() {
      try {
        const profile = await window.FirstBiteFeedback.loadPersonalization();
        renderPersonalization(profile);
      } catch (_error) {
        renderPersonalization(null);
      }
    }

    canvas.addEventListener("feedback-selection", (event) => {
      selectedScore = event.detail.score;
      if (selectedScore) renderSelected();
    });

    canvas.querySelector("[data-feedback-defer]").addEventListener("click", () => {
      // '다음에 답하기'는 서버에 저장하지 않으므로 홈으로 돌아가도 다음 방문에 다시 노출될 수 있다.
      window.location.href = "index.html";
    });

    saveButton.addEventListener("click", async () => {
      if (!selectedScore) return;
      saveButton.disabled = true;
      try {
        const result = await window.FirstBiteFeedback.submit(selectedScore);
        selectedScore = result.score == null ? null : Number(result.score);
        renderSaved(selectedScore);
        await refreshPersonalization();
      } catch (error) {
        saveButton.disabled = false;
        if (error && error.code === "AUTH_UNAUTHORIZED") {
          window.location.href = "login.html?next=personalization.html";
          return;
        }
        window.alert(error.message || "피드백을 저장하지 못했습니다.");
      }
    });

    renderPending();

    try {
      const server = await window.FirstBiteFeedback.loadServerState();
      if (!server.authenticated) {
        window.location.replace("login.html?next=personalization.html");
        return;
      }

      const status = server.status;
      if (status && status.status === "ANSWERED") {
        selectedScore = status.sleepinessScore == null ? null : Number(status.sleepinessScore);
        renderSaved(selectedScore);
      } else if (status && status.status === "PENDING") {
        renderPending();
      } else if (status && status.status === "EXPIRED") {
        showUnavailable("어제 컨디션 피드백의 응답 기간이 지났어요.");
      } else {
        showUnavailable("어제 완료한 코칭 기록이 없어 지금은 남길 피드백이 없어요.");
      }
    } catch (_error) {
      showUnavailable("피드백 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.");
    }

    await refreshPersonalization();
  });
})();
