(function () {
  "use strict";

  const ACTIVE_SESSION_KEY = "firstbite.activeCoachingSession";
  const PLAN_KEY = "firstbite.coachingPlan";
  const LAST_COMPLETION_KEY = "firstbite.lastCoachingCompletion";
  const COMPLETE_ATTEMPT_PREFIX = "firstbite.coachingCompleteAttempt:";

  let session = null;
  let plan = null;
  let stageIndex = 0;
  let remaining = 0;
  let paused = false;
  let timerId = null;
  let localDeadlineMs = null;
  let busy = false;
  let completionShown = false;

  function readJson(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || "null");
    } catch (_error) {
      return null;
    }
  }

  function writeJson(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  function setCurrentMealId(mealId) {
    if (!mealId) return;
    sessionStorage.setItem("firstbite.currentMealId", mealId);
    sessionStorage.setItem("firstbiteMealId", mealId);
  }

  function stages() {
    return plan && Array.isArray(plan.stages) ? plan.stages : [];
  }

  function current() {
    return stages()[stageIndex] || null;
  }

  function isLastStage() {
    return stageIndex >= stages().length - 1;
  }

  function hasCountdown(stage = current()) {
    return Boolean(stage && stage.recommendedSeconds != null && Number(stage.recommendedSeconds) >= 0);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>\"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    }[char]));
  }

  function stageDurationText(stage) {
    if (!stage || stage.recommendedSeconds == null) return "제한 없음";
    const seconds = Math.max(0, Number(stage.recommendedSeconds) || 0);
    if (seconds < 60) return `${Math.round(seconds)}초`;
    return `${Math.max(1, Math.round(seconds / 60))}분`;
  }

  function renderMobileProgress() {
    const items = stages();
    const list = document.querySelector("[data-mobile-progress-stages]");
    const count = document.querySelector("[data-mobile-progress-count]");
    const bar = document.querySelector("[data-mobile-progress-bar]");
    if (!list || !items.length) return;

    const currentPosition = Math.min(items.length, stageIndex + 1);
    if (count) count.textContent = `${currentPosition} / ${items.length}`;
    if (bar) bar.style.width = `${(currentPosition / items.length) * 100}%`;

    list.innerHTML = items.map((item, index) => {
      const state = index < stageIndex ? "is-done" : (index === stageIndex ? "is-current" : "");
      const status = index < stageIndex ? "식사 완료" : (index === stageIndex ? "현재 진행 중" : "대기");
      return `<li class="${state}">
        <span class="mobile-stage-number">${escapeHtml(item.stage || index + 1)}</span>
        <span class="mobile-stage-copy"><strong>${escapeHtml(item.title || `${index + 1}단계`)}</strong><small>${status}</small></span>
        <span class="mobile-stage-time">${escapeHtml(stageDurationText(item))}</span>
      </li>`;
    }).join("");
  }

  function flattenPlanItems() {
    const seen = new Set();
    const result = [];
    stages().forEach((stage) => {
      (Array.isArray(stage.items) ? stage.items : []).forEach((item) => {
        const key = item.foodId || item.id || item.name;
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push({ ...item, role: stage.title || `${stage.stage}단계` });
      });
    });
    return result;
  }

  function mobileStageShortLabel(stage, index = 0) {
    const stageNo = stage && stage.stage != null ? stage.stage : index + 1;
    const raw = String(stage && stage.title ? stage.title : `${stageNo}단계`)
      .replace(/부터\s*시작해요[.!]?/g, "")
      .replace(/먼저\s*드세요[.!]?/g, "")
      .trim();
    return `${stageNo}단계 · ${raw || `${stageNo}단계`}`;
  }

  function renderMobileCompletion(result) {
    if (!plan) plan = readJson(PLAN_KEY);
    const items = stages();
    const stageList = document.querySelector("[data-mobile-completion-stages]");
    const count = document.querySelector("[data-mobile-complete-count]");
    const progressBar = document.querySelector("[data-mobile-complete-progress-bar]");
    const summary = result && result.summary ? result.summary : {};
    const completed = Number.isFinite(Number(summary.completedStages)) ? Number(summary.completedStages) : items.length;
    const total = Number.isFinite(Number(summary.totalStages)) ? Number(summary.totalStages) : items.length;

    if (count) count.textContent = total ? `${completed} / ${total}` : "-";
    if (progressBar) progressBar.style.width = total ? `${Math.max(0, Math.min(100, completed / total * 100))}%` : "0%";
    if (stageList) {
      stageList.innerHTML = items.length ? items.map((item, index) => {
        const done = index < completed;
        return `<li class="${done ? "is-done" : ""}">
          <span class="mobile-stage-number">${done ? "✓" : escapeHtml(item.stage || index + 1)}</span>
          <span class="mobile-stage-copy"><strong>${escapeHtml(item.title || `${index + 1}단계`)}</strong><small>${done ? "식사 완료" : "대기"}</small></span>
          <span class="mobile-stage-time">${escapeHtml(stageDurationText(item))}</span>
        </li>`;
      }).join("") : `<li><span class="mobile-stage-copy"><strong>완료된 식사</strong><small>단계 정보를 확인할 수 없어요.</small></span></li>`;
    }

    const firstStage = items[0] || null;
    const badge = document.querySelector("[data-mobile-complete-stage-badge]");
    const title = document.querySelector("[data-mobile-complete-title]");
    const guide = document.querySelector("[data-mobile-complete-guide]");
    if (badge) badge.textContent = mobileStageShortLabel(firstStage, 0);
    if (title) title.textContent = firstStage && firstStage.title ? firstStage.title : "식사를 완료했어요";
    if (guide) guide.textContent = firstStage && firstStage.guide
      ? firstStage.guide
      : "오늘도 추천 순서에 맞춰 식사를 마무리했어요.";

    const mobileTotalTime = document.querySelector("[data-mobile-total-time]");
    const mobileCompleted = document.querySelector("[data-mobile-completed-stages]");
    const mobileAdherence = document.querySelector("[data-mobile-adherence-rate]");
    if (mobileTotalTime) mobileTotalTime.textContent = Number.isFinite(Number(summary.totalSeconds)) ? format(summary.totalSeconds) : "-";
    if (mobileCompleted) mobileCompleted.textContent = total ? `${completed}/${total}` : "-";
    if (mobileAdherence) mobileAdherence.textContent = Number.isFinite(Number(summary.adherenceRate)) ? `${summary.adherenceRate}%` : "-";
  }

  function format(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function setStatus(message, isError = false) {
    const status = document.querySelector("[data-timer-status]");
    if (!status) return;
    status.textContent = message || "";
    status.classList.toggle("is-info", Boolean(message) && !isError);
  }

  function setControlsDisabled(disabled) {
    const pauseButton = document.querySelector("[data-pause]");
    const nextButton = document.querySelector("[data-next]");
    const endButton = document.querySelector("[data-end]");
    if (pauseButton) pauseButton.disabled = disabled;
    if (endButton) endButton.disabled = disabled;
    if (nextButton) {
      const pausedStageCannotAdvance = paused && !isLastStage();
      nextButton.disabled = disabled || pausedStageCannotAdvance;
    }
  }

  function renderRemaining(value) {
    const stage = current();
    const time = document.querySelector("[data-timer-time]");
    const ring = document.querySelector("[data-timer-ring]");
    if (!time || !ring || !stage) return;

    if (!hasCountdown(stage)) {
      remaining = 0;
      time.textContent = "--:--";
      ring.style.setProperty("--timer-progress", "100%");
      return;
    }

    remaining = Math.max(0, Math.floor(Number(value) || 0));
    const total = Math.max(1, Number(stage.recommendedSeconds) || 1);
    const progress = Math.max(0, Math.min(100, remaining / total * 100));
    time.textContent = format(remaining);
    ring.style.setProperty("--timer-progress", `${progress}%`);
  }

  function renderStage() {
    const stage = current();
    if (!stage) throw new Error("현재 코칭 단계를 확인할 수 없습니다.");

    document.querySelector("[data-stage-badge]").textContent = `${stage.stage}단계`;
    document.querySelector("[data-stage-title]").textContent = stage.title || `${stage.stage}단계`;
    document.querySelector("[data-stage-guide]").textContent = stage.guide
      || (hasCountdown(stage)
        ? "천천히 드신 뒤 다음 단계로 이동하세요."
        : "시간 제한 없이 편하게 식사를 마무리하세요.");

    document.querySelector("[data-timer-stages]").innerHTML = stages().map((item, index) => `
      <li class="${index === stageIndex ? "is-current" : ""}">
        <strong>${item.stage}단계　${item.title || ""}</strong>
        <span>${item.recommendedSeconds != null ? `${Math.round(Number(item.recommendedSeconds) / 60)}분` : "제한 없음"}</span>
      </li>`).join("");

    const nextButton = document.querySelector("[data-next]");
    nextButton.textContent = isLastStage() ? "식사 완료" : "다음 단계";

    const pauseButton = document.querySelector("[data-pause]");
    pauseButton.textContent = paused ? "다시 시작" : "일시정지";
    renderMobileProgress();
    setControlsDisabled(busy);
  }

  function findStageIndex(stageNumber) {
    const index = stages().findIndex((item) => Number(item.stage) === Number(stageNumber));
    if (index < 0) throw new Error("서버의 현재 단계와 코칭 계획이 일치하지 않습니다.");
    return index;
  }

  function syncFromServerSession(serverSession) {
    if (!serverSession || !serverSession.sessionId) {
      throw new Error("진행 중인 코칭 세션 정보를 확인할 수 없습니다.");
    }
    if (!stages().length) {
      throw new Error("코칭 계획을 불러오지 못했습니다.");
    }

    session = { ...(session || {}), ...serverSession };
    stageIndex = findStageIndex(session.currentStage);
    paused = session.status === "PAUSED";
    writeJson(ACTIVE_SESSION_KEY, session);
    setCurrentMealId(session.mealId);

    renderStage();

    if (hasCountdown()) {
      remaining = Math.max(0, Math.floor(Number(session.remainingSeconds) || 0));
      localDeadlineMs = paused ? null : Date.now() + remaining * 1000;
      renderRemaining(remaining);
    } else {
      remaining = 0;
      localDeadlineMs = null;
      renderRemaining(0);
    }
  }

  async function loadPlan(mealId) {
    const latestPlan = await window.FirstBiteApi.getCoachingPlan(mealId);
    if (!latestPlan || !Array.isArray(latestPlan.stages) || !latestPlan.stages.length) {
      throw new Error("코칭 계획을 불러오지 못했습니다.");
    }
    plan = latestPlan;
    writeJson(PLAN_KEY, plan);
    return plan;
  }

  async function fetchAndSyncActive(message) {
    const active = await window.FirstBiteApi.getActiveCoachingSession();
    if (!active || !active.active || !active.session) return null;

    if (!plan || !session || active.session.mealId !== session.mealId) {
      await loadPlan(active.session.mealId);
    }
    syncFromServerSession(active.session);
    if (message) setStatus(message, false);
    return active.session;
  }

  function completeAttemptKey(sessionId) {
    return `${COMPLETE_ATTEMPT_PREFIX}${sessionId}`;
  }

  function readOrCreateCompleteAttempt(sessionId, reason) {
    const storageKey = completeAttemptKey(sessionId);
    const stored = readJson(storageKey);
    if (stored && stored.reason === reason && stored.requestKey && stored.endedAt) {
      return { storageKey, ...stored };
    }

    const attempt = {
      reason,
      requestKey: window.FirstBiteApi.createIdempotencyKey(),
      endedAt: new Date().toISOString()
    };
    writeJson(storageKey, attempt);
    return { storageKey, ...attempt };
  }

  function renderCompletion(result) {
    completionShown = true;
    clearInterval(timerId);
    timerId = null;
    sessionStorage.removeItem(ACTIVE_SESSION_KEY);
    writeJson(LAST_COMPLETION_KEY, result);

    if (result && result.recordId && window.FirstBiteFeedback) {
      window.FirstBiteFeedback.savePendingRecordId(result.recordId);
    }

    if (result && result.recordId) {
      localStorage.setItem("firstbite.latestCoachingRecord", JSON.stringify({
        recordId: result.recordId,
        completedAt: new Date().toISOString(),
        totalSeconds: result.summary && result.summary.totalSeconds,
        completedStages: result.summary && result.summary.completedStages,
        totalStages: result.summary && result.summary.totalStages,
        adherenceRate: result.summary && result.summary.adherenceRate
      }));
    }

    document.querySelector("[data-timer-view]").hidden = true;
    document.querySelector("[data-completion-view]").hidden = false;

    const summary = result && result.summary ? result.summary : {};
    document.querySelector("[data-completed-stages]").textContent = Number.isFinite(Number(summary.totalStages))
      ? `${Number(summary.completedStages) || 0}/${Number(summary.totalStages) || 0}`
      : "-";
    document.querySelector("[data-total-time]").textContent = Number.isFinite(Number(summary.totalSeconds))
      ? format(summary.totalSeconds)
      : "-";

    const skipped = document.querySelector("[data-skipped-stages]");
    if (skipped) skipped.textContent = Number.isFinite(Number(summary.skippedStages)) ? String(summary.skippedStages) : "-";
    const adherence = document.querySelector("[data-adherence-rate]");
    if (adherence) adherence.textContent = Number.isFinite(Number(summary.adherenceRate)) ? `${summary.adherenceRate}%` : "-";

    renderMobileCompletion(result);
    setStatus("");
  }

  async function retryPendingCompletion(storedSession) {
    if (!storedSession || !storedSession.sessionId) return false;
    const attempt = readJson(completeAttemptKey(storedSession.sessionId));
    if (!attempt || !attempt.requestKey || !attempt.endedAt || !attempt.reason) return false;

    try {
      const result = await window.FirstBiteApi.completeCoachingSession(
        storedSession.sessionId,
        attempt.reason,
        attempt.requestKey,
        attempt.endedAt
      );
      sessionStorage.removeItem(completeAttemptKey(storedSession.sessionId));
      renderCompletion(result);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async function complete(reason) {
    if (busy || !session || !session.sessionId) return;
    busy = true;
    setControlsDisabled(true);
    setStatus("식사 기록을 저장하고 있어요.", false);
    clearInterval(timerId);
    timerId = null;

    const attempt = readOrCreateCompleteAttempt(session.sessionId, reason);
    try {
      const result = await window.FirstBiteApi.completeCoachingSession(
        session.sessionId,
        reason,
        attempt.requestKey,
        attempt.endedAt
      );
      sessionStorage.removeItem(attempt.storageKey);
      renderCompletion(result);
    } catch (error) {
      if (error && [
        "IDEMPOTENCY_KEY_CONFLICT",
        "COACHING_COMPLETION_INVALID",
        "COACHING_SESSION_NOT_FOUND",
        "COACHING_SESSION_FORBIDDEN"
      ].includes(error.code)) {
        sessionStorage.removeItem(attempt.storageKey);
      }
      setStatus(error && error.message ? error.message : "식사 완료 기록을 저장하지 못했습니다.", true);
      busy = false;
      setControlsDisabled(false);
      if (!completionShown) timerId = window.setInterval(tick, 250);
    }
  }

  async function changeStage(action) {
    if (busy || completionShown) return;
    if (!session || !current()) return;

    if (isLastStage()) {
      if (action !== "AUTO_ADVANCE") await complete("COMPLETED");
      return;
    }

    if (paused) {
      setStatus("다음 단계로 이동하려면 타이머를 먼저 다시 시작해 주세요.", true);
      return;
    }

    busy = true;
    setControlsDisabled(true);
    setStatus(action === "AUTO_ADVANCE" ? "다음 단계로 자동 전환하고 있어요." : "다음 단계를 저장하고 있어요.", false);

    const expectedStage = current().stage;
    try {
      await window.FirstBiteApi.updateCoachingStage(session.sessionId, action, expectedStage);
      const synced = await fetchAndSyncActive("");
      if (!synced) throw new Error("진행 중인 코칭 세션을 찾을 수 없습니다.");
      setStatus("");
    } catch (error) {
      if (error && error.code === "COACHING_STAGE_CONFLICT") {
        try {
          const synced = await fetchAndSyncActive("다른 화면에서 변경된 진행 상태를 현재 화면에 반영했어요.");
          if (synced) return;
        } catch (_recoveryError) {
          // 아래 공통 오류를 표시한다.
        }
      }
      setStatus(error && error.message ? error.message : "단계를 변경하지 못했습니다.", true);
    } finally {
      busy = false;
      if (!completionShown) setControlsDisabled(false);
    }
  }

  async function togglePause() {
    if (busy || completionShown || !session || !current()) return;
    busy = true;
    setControlsDisabled(true);

    const action = paused ? "RESUME" : "PAUSE";
    setStatus(paused ? "타이머를 다시 시작하고 있어요." : "타이머를 잠시 멈추고 있어요.", false);

    try {
      const result = await window.FirstBiteApi.updateCoachingTimer(session.sessionId, action, current().stage);
      syncFromServerSession({ ...session, ...result });
      setStatus("");
    } catch (error) {
      if (error && ["COACHING_STAGE_CONFLICT", "COACHING_TIMER_STATE_CONFLICT"].includes(error.code)) {
        try {
          const synced = await fetchAndSyncActive("서버의 최신 타이머 상태로 맞췄어요.");
          if (synced) return;
        } catch (_recoveryError) {
          // 아래 공통 오류를 표시한다.
        }
      }
      setStatus(error && error.message ? error.message : "타이머 상태를 변경하지 못했습니다.", true);
    } finally {
      busy = false;
      if (!completionShown) setControlsDisabled(false);
    }
  }

  function tick() {
    if (completionShown || busy || paused || !session || !current() || !hasCountdown()) return;

    const nextRemaining = Math.max(0, Math.ceil(((localDeadlineMs || Date.now()) - Date.now()) / 1000));
    if (nextRemaining !== remaining) renderRemaining(nextRemaining);

    if (nextRemaining === 0 && !isLastStage()) {
      changeStage("AUTO_ADVANCE");
    }
  }

  async function initialize() {
    const loggedIn = await window.FirstBiteApi.restoreSession();
    if (!loggedIn) {
      window.location.replace("login.html?next=meal-timer.html");
      return;
    }

    const storedSession = readJson(ACTIVE_SESSION_KEY);
    const active = await window.FirstBiteApi.getActiveCoachingSession();

    if (!active || !active.active || !active.session) {
      if (await retryPendingCompletion(storedSession)) return;

      const lastCompletion = readJson(LAST_COMPLETION_KEY);
      if (lastCompletion && lastCompletion.recordId) {
        plan = readJson(PLAN_KEY);
        renderCompletion(lastCompletion);
        return;
      }

      sessionStorage.removeItem(ACTIVE_SESSION_KEY);
      window.location.replace("coaching-plan.html");
      return;
    }

    session = active.session;
    await loadPlan(session.mealId);
    syncFromServerSession(session);
    sessionStorage.removeItem(LAST_COMPLETION_KEY);

    if (hasCountdown() && remaining === 0 && !paused && !isLastStage()) {
      window.setTimeout(() => changeStage("AUTO_ADVANCE"), 0);
    }

    timerId = window.setInterval(tick, 250);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    document.querySelector("[data-next]").addEventListener("click", () => changeStage("NEXT"));
    document.querySelector("[data-pause]").addEventListener("click", togglePause);
    document.querySelector("[data-end]").addEventListener("click", () => {
      if (window.confirm("식사를 종료하시겠어요?")) complete("USER_ENDED");
    });

    try {
      await initialize();
    } catch (error) {
      setStatus(error && error.message ? error.message : "타이머를 시작하지 못했습니다.", true);
      setControlsDisabled(true);
    }

    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || busy || completionShown || !session) return;
      try {
        await fetchAndSyncActive("");
      } catch (_error) {
        // 다음 사용자 동작이나 새로고침에서 다시 동기화한다.
      }
    });
  });
})();
