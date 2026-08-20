(function () {
  "use strict";

  const START_ATTEMPT_PREFIX = "firstbite.coachingStartAttempt:";

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value, digits = 1) {
    return number(value).toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  function currentMealId() {
    return sessionStorage.getItem("firstbite.currentMealId") || sessionStorage.getItem("firstbiteMealId");
  }

  function setCurrentMealId(mealId) {
    if (!mealId) return;
    sessionStorage.setItem("firstbite.currentMealId", mealId);
    sessionStorage.setItem("firstbiteMealId", mealId);
  }

  function nutrientLabel(value) {
    return {
      PROTEIN: "단백질",
      FIBER: "식이섬유",
      CARBOHYDRATE: "탄수화물",
      AVAILABLE_CARBOHYDRATE: "탄수화물"
    }[value] || value || "";
  }

  function renderStages(stages) {
    const grid = document.querySelector("[data-stage-grid]");
    if (!grid) return;

    if (!Array.isArray(stages) || !stages.length) {
      grid.innerHTML = `<p class="loading-message">현재 메뉴로는 식사 순서를 구성할 수 없습니다.</p>`;
      return;
    }

    grid.innerHTML = stages.map((stage) => {
      const foods = Array.isArray(stage.items) ? stage.items : [];
      const summary = stage.summary || {};
      const timeText = stage.recommendedSeconds == null
        ? "마지막 단계는 편하게 마무리하세요."
        : `${Math.round(number(stage.recommendedSeconds) / 60)}분 정도 천천히 드셔보세요.`;
      const nutrient = nutrientLabel(summary.nutrientName);
      const summaryText = nutrient
        ? `${nutrient} ${formatNumber(summary.nutrientAmountG, 1)}g`
        : "";

      return `
        <article class="stage-card">
          <span class="stage-number">${escapeHtml(stage.stage)}</span>
          <h3>${escapeHtml(stage.title || `${stage.stage}단계`)}</h3>
          <p>${escapeHtml(stage.guide || timeText)}</p>
          ${summaryText ? `<p class="stage-summary">${escapeHtml(summaryText)}</p>` : ""}
          <div class="stage-foods">
            ${foods.length
              ? foods.map((item) => `
                <span class="stage-food">
                  ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="">` : ""}
                  ${escapeHtml(item.name)}
                  <small>${formatNumber(item.servingMultiplier || 1, 1)}인분</small>
                </span>`).join("")
              : `<span class="stage-food">이 단계에 해당하는 메뉴가 없습니다.</span>`}
          </div>
        </article>`;
    }).join("");
  }

  async function ensurePlan(mealId) {
    try {
      return await window.FirstBiteApi.getCoachingPlan(mealId);
    } catch (error) {
      if (error && error.code === "ANALYSIS_REQUIRED") {
        const created = await window.FirstBiteApi.createAnalysis(mealId, true);
        sessionStorage.setItem("firstbite.currentAnalysis", JSON.stringify(created));
        return window.FirstBiteApi.getCoachingPlan(mealId);
      }
      throw error;
    }
  }

  function startAttemptKey(mealId, version) {
    return `${START_ATTEMPT_PREFIX}${mealId}:${version}`;
  }

  function readStartAttempt(mealId, version) {
    const key = startAttemptKey(mealId, version);
    let requestKey = sessionStorage.getItem(key);
    if (!requestKey) {
      requestKey = window.FirstBiteApi.createIdempotencyKey();
      sessionStorage.setItem(key, requestKey);
    }
    return { storageKey: key, requestKey };
  }

  async function resumeActiveSession(activeSession) {
    if (!activeSession || !activeSession.sessionId || !activeSession.mealId) {
      throw new Error("진행 중인 코칭 정보를 확인할 수 없습니다.");
    }

    const activePlan = await ensurePlan(activeSession.mealId);
    sessionStorage.removeItem(startAttemptKey(activeSession.mealId, activePlan.version));
    setCurrentMealId(activeSession.mealId);
    sessionStorage.setItem("firstbite.coachingPlan", JSON.stringify(activePlan));
    sessionStorage.removeItem("firstbite.lastCoachingCompletion");
    sessionStorage.setItem("firstbite.activeCoachingSession", JSON.stringify(activeSession));
    window.location.href = "meal-timer.html";
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const startButton = document.querySelector("[data-start-coaching]");
    const status = document.querySelector("[data-coaching-status]");
    let mealId = currentMealId();
    let plan = null;

    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace(`login.html?next=${encodeURIComponent("coaching-plan.html")}`);
        return;
      }
      if (!mealId) {
        throw new Error("먼저 메뉴를 입력하고 결과를 확인해 주세요.");
      }

      plan = await ensurePlan(mealId);
      if (!plan || !Number.isInteger(Number(plan.version)) || !Array.isArray(plan.stages) || !plan.stages.length) {
        throw new Error("현재 메뉴로는 식사 순서를 구성할 수 없습니다.");
      }

      setCurrentMealId(mealId);
      sessionStorage.setItem("firstbite.coachingPlan", JSON.stringify(plan));
      renderStages(plan.stages);
      startButton.disabled = false;
      status.textContent = "";
    } catch (error) {
      renderStages([]);
      startButton.disabled = true;
      status.textContent = error && error.message ? error.message : "식사 순서를 불러오지 못했습니다.";
    }

    startButton.addEventListener("click", async () => {
      if (!plan || !mealId) return;

      startButton.disabled = true;
      status.textContent = "식사 코칭을 시작하고 있어요.";

      try {
        const active = await window.FirstBiteApi.getActiveCoachingSession();
        if (active && active.active && active.session) {
          status.textContent = active.session.mealId === mealId
            ? "진행 중인 식사를 이어서 시작할게요."
            : "이미 진행 중인 식사가 있어 해당 타이머로 이동할게요.";
          await resumeActiveSession(active.session);
          return;
        }

        const attempt = readStartAttempt(mealId, plan.version);
        const started = await window.FirstBiteApi.startCoachingSession(
          mealId,
          Number(plan.version),
          attempt.requestKey
        );
        sessionStorage.removeItem(attempt.storageKey);

        const session = { ...started, mealId };
        sessionStorage.removeItem("firstbite.lastCoachingCompletion");
        sessionStorage.setItem("firstbite.activeCoachingSession", JSON.stringify(session));
        window.location.href = "meal-timer.html";
      } catch (error) {
        if (error && error.code === "COACHING_ALREADY_ACTIVE") {
          try {
            const active = await window.FirstBiteApi.getActiveCoachingSession();
            if (active && active.active && active.session) {
              await resumeActiveSession(active.session);
              return;
            }
          } catch (_recoveryError) {
            // 아래 공통 오류 메시지를 사용한다.
          }
        }

        if (error && error.code === "COACHING_PLAN_CHANGED") {
          try {
            sessionStorage.removeItem(startAttemptKey(mealId, plan.version));
            plan = await ensurePlan(mealId);
            sessionStorage.setItem("firstbite.coachingPlan", JSON.stringify(plan));
            renderStages(plan.stages);
            status.textContent = "추천 순서가 변경되어 최신 계획으로 다시 불러왔어요. 확인 후 다시 시작해 주세요.";
          } catch (refreshError) {
            status.textContent = refreshError && refreshError.message
              ? refreshError.message
              : "최신 코칭 계획을 불러오지 못했습니다.";
          }
        } else {
          status.textContent = error && error.message ? error.message : "식사 코칭을 시작하지 못했습니다.";
        }

        if (error && error.code === "IDEMPOTENCY_KEY_CONFLICT") {
          sessionStorage.removeItem(startAttemptKey(mealId, plan.version));
        }
        startButton.disabled = false;
      }
    });
  });
})();
