(function () {
  "use strict";

  const REUSE_ATTEMPT_PREFIX = "firstbite.historyReuseAttempt.";
  let loadedRecord = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function koreanDate(value, withYear) {
    if (!value) return "날짜 없음";
    const date = value instanceof Date ? value : new Date(value);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const prefix = withYear ? `${date.getFullYear()}. ` : "";
    return `${prefix}${date.getMonth() + 1}. ${date.getDate()} (${weekdays[date.getDay()]})`;
  }

  function koreanTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${koreanDate(date, true)} ${hh}:${mm}`;
  }

  function durationLabel(seconds) {
    if (seconds == null) return "-";
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    if (!minutes) return `${rest}초`;
    return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
  }

  function mealMeta(type) {
    const map = {
      BREAKFAST: { label: "아침", icon: "☀" },
      LUNCH: { label: "점심", icon: "☀" },
      DINNER: { label: "저녁", icon: "☾" },
      SNACK: { label: "야식", icon: "☾" }
    };
    return map[type] || { label: "식사", icon: "☀" };
  }

  function localFallbackImage(name) {
    const value = String(name || "");
    if (value.includes("계란") || value.includes("달걀")) return "assets/recognition/rolled-omelet.png";
    if (value.includes("된장")) return "assets/recognition/doenjang-stew.png";
    if (value.includes("밥")) return "assets/recognition/rice.png";
    if (value.includes("김치")) return "assets/recognition/kimchi.png";
    if (value.includes("제육")) return "assets/recognition/spicy-pork.png";
    return "assets/recognition/food-photo.jpg";
  }

  function imageMarkup(item) {
    const src = item.imageUrl || localFallbackImage(item.name);
    const fallback = localFallbackImage(item.name);
    return `<img src="${escapeHtml(src)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}'">`;
  }

  function servingText(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return "1인분";
    return `${Number.isInteger(number) ? number : number.toFixed(1)}인분`;
  }

  function feedbackTime(feedback) {
    if (!feedback || !feedback.answeredAt) return "";
    const date = new Date(feedback.answeredAt);
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return `${koreanDate(date, true)} ${hh}:${mm}`;
  }

  function feedbackText(feedback) {
    if (!feedback) return "미응답";
    if (feedback.status === "SKIPPED") return "건너뜀";
    if (feedback.sleepinessLabel) return feedback.sleepinessLabel;
    return "미응답";
  }

  function isCorrupted(data) {
    return !data
      || !isUuid(data.recordId)
      || !data.completedAt
      || !data.summary
      || !Array.isArray(data.items)
      || !Array.isArray(data.recommendedOrder)
      || !Array.isArray(data.stages);
  }

  function renderDetail(data) {
    if (isCorrupted(data)) {
      throw Object.assign(new Error("기록 일부가 손상되어 상세 내용을 표시할 수 없어요."), { code: "HISTORY_CORRUPTED" });
    }

    loadedRecord = data;
    const meal = mealMeta(data.mealType);
    const statusDone = data.completionReason === "COMPLETED";
    document.querySelector("[data-detail-date]").textContent = `${koreanDate(data.completedAt, false)} · ${meal.label}`;
    const status = document.querySelector("[data-detail-status]");
    status.textContent = statusDone ? "완료" : "중도 종료";
    status.classList.toggle("user-ended", !statusDone);
    document.querySelector("[data-detail-meal-icon]").textContent = meal.icon;
    document.querySelector("[data-detail-meal-type]").textContent = meal.label;
    document.querySelector("[data-detail-completed-at]").textContent = koreanTime(data.completedAt);
    document.querySelector("[data-detail-duration]").textContent = durationLabel(data.summary.totalSeconds);

    const feedback = data.feedback || {};
    const label = feedbackText(feedback);
    document.querySelector("[data-detail-feedback]").textContent = label;

    const items = document.querySelector("[data-detail-items]");
    items.innerHTML = data.items.length
      ? data.items.map((item) => `<article class="food-item">${imageMarkup(item)}<div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(servingText(item.servingMultiplier))}</small></div></article>`).join("")
      : '<div class="food-placeholder">메뉴 없음</div>';

    const orderContainer = document.querySelector("[data-detail-order]");
    orderContainer.innerHTML = data.recommendedOrder.length
      ? data.recommendedOrder.map((item, index) => {
        const arrow = index < data.recommendedOrder.length - 1 ? '<span class="order-arrow" aria-hidden="true">→</span>' : "";
        return `<div class="order-step"><span class="order-number">${escapeHtml(item.order || index + 1)}</span><strong>${escapeHtml(item.name)}</strong></div>${arrow}`;
      }).join("")
      : '<div class="order-empty">저장된 추천 순서 정보가 없어요.</div>';

    const stages = document.querySelector("[data-detail-stages]");
    stages.innerHTML = data.stages.length
      ? data.stages.map((stage) => {
        const done = stage.result === "COMPLETED";
        const resultLabel = done ? "완료" : stage.result === "SKIPPED" ? "건너뜀" : "미진행";
        const actual = stage.actualSeconds == null ? "" : `<span class="stage-time">실행 ${escapeHtml(durationLabel(stage.actualSeconds))}</span>`;
        const recommended = stage.recommendedSeconds == null ? "" : `<span class="stage-time stage-time-muted">권장 ${escapeHtml(durationLabel(stage.recommendedSeconds))}</span>`;
        return `<li class="stage-row"><span class="stage-check" aria-hidden="true">${done ? "✓" : stage.result === "SKIPPED" ? "–" : "·"}</span><strong>${escapeHtml(`${stage.stage}단계 ${resultLabel}`)}</strong><div class="stage-meta"><span>${escapeHtml(stage.title || "식사 단계")}</span>${actual}${recommended}</div></li>`;
      }).join("")
      : '<li class="stage-row"><strong>저장된 실행 단계가 없어요.</strong></li>';

    document.querySelector("[data-detail-feedback-label]").textContent = label;
    document.querySelector("[data-detail-feedback-time]").textContent = feedbackTime(feedback);
    const feedbackCard = document.querySelector("[data-detail-feedback-card]");
    feedbackCard.classList.toggle("is-pending", feedback.status === "PENDING");
    const feedbackLink = document.querySelector("[data-detail-feedback-link]");
    if (feedbackLink) feedbackLink.firstChild.textContent = feedback.status === "PENDING" ? "피드백 남기기 " : "개인화 보기 ";

    const personalization = document.querySelector("[data-detail-personalization]");
    if (personalization) {
      personalization.textContent = data.personalizationApplied ? "개인화 적용됨" : "기본 기준 적용";
    }
  }

  function stateContent(type, error) {
    if (type === "not-found") return ["코칭 기록을 찾을 수 없어요.", "삭제되었거나 더 이상 존재하지 않는 기록이에요."];
    if (type === "forbidden") return ["이 기록을 볼 권한이 없어요.", "본인의 코칭 기록만 확인할 수 있어요."];
    if (type === "corrupted") return ["기록 일부를 확인할 수 없어요.", "저장된 코칭 기록이 올바르지 않아 상세 내용을 표시하지 못했어요."];
    return ["코칭 기록 조회에 실패했어요.", error && error.message ? error.message : "잠시 후 다시 시도해 주세요."];
  }

  function showError(type, error) {
    document.querySelector("[data-detail-loading]").hidden = true;
    document.querySelector("[data-detail-content]").hidden = true;
    const box = document.querySelector("[data-detail-error]");
    const [title, message] = stateContent(type, error);
    document.querySelector("[data-error-title]").textContent = title;
    document.querySelector("[data-error-message]").textContent = message;
    box.hidden = false;
    document.querySelector("[data-detail-retry]").hidden = type === "not-found" || type === "forbidden";
  }

  function reuseAttempt(recordId) {
    const storageKey = `${REUSE_ATTEMPT_PREFIX}${recordId}`;
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null");
      if (saved && saved.requestKey && saved.includeSideMenus === true) {
        return { storageKey, requestKey: saved.requestKey };
      }
    } catch (_error) {
      sessionStorage.removeItem(storageKey);
    }
    const requestKey = window.FirstBiteApi.createIdempotencyKey();
    sessionStorage.setItem(storageKey, JSON.stringify({ requestKey, includeSideMenus: true }));
    return { storageKey, requestKey };
  }

  function rememberReusedMeal(result) {
    if (!result || !isUuid(result.newMealId)) {
      throw Object.assign(new Error("다시 사용할 식사 정보를 확인할 수 없어요."), { code: "HISTORY_REUSE_INVALID_RESPONSE" });
    }

    const mealItems = loadedRecord && Array.isArray(loadedRecord.items)
      ? loadedRecord.items
        .filter((item) => isUuid(item.foodId))
        .map((item) => ({ foodId: item.foodId, servingMultiplier: Number(item.servingMultiplier) || 1 }))
      : [];

    sessionStorage.setItem("firstbite.currentMealId", result.newMealId);
    sessionStorage.setItem("firstbiteMealId", result.newMealId);
    sessionStorage.setItem("firstbite.currentMealSource", "REUSE");
    sessionStorage.setItem("firstbiteMealSource", "REUSE");
    sessionStorage.setItem("firstbite.currentMeal", JSON.stringify({
      mealId: result.newMealId,
      status: result.status || "DRAFT",
      source: result.source || "REUSE",
      copiedItemCount: result.copiedItemCount
    }));
    sessionStorage.setItem("firstbiteMealItems", JSON.stringify(mealItems));
    sessionStorage.removeItem("firstbiteRecognitionId");
    sessionStorage.removeItem("firstbite.currentRecognitionId");
    sessionStorage.removeItem("firstbite.currentAnalysis");
    sessionStorage.removeItem("firstbite.coachingPlan");
    sessionStorage.removeItem("firstbite.activeCoachingSession");
    sessionStorage.removeItem("firstbite.lastCoachingCompletion");
  }

  async function reuseRecord(recordId) {
    const button = document.querySelector("[data-reuse-record]");
    const status = document.querySelector("[data-reuse-status]");
    if (!button || button.disabled) return;

    const attempt = reuseAttempt(recordId);
    button.disabled = true;
    button.textContent = "새 식사를 준비하고 있어요";
    status.textContent = "과거 메뉴를 현재 기준으로 다시 준비하고 있어요.";
    status.classList.remove("is-error");

    try {
      const result = await window.FirstBiteApi.reuseCoachingRecord(recordId, true, attempt.requestKey);
      rememberReusedMeal(result);
      sessionStorage.removeItem(attempt.storageKey);
      status.textContent = "새 식사 초안을 만들었어요. 현재 기준으로 다시 분석할게요.";
      window.location.assign("burden-result.html");
    } catch (error) {
      if (error && error.code === "REUSE_FOOD_UNAVAILABLE") {
        sessionStorage.removeItem(attempt.storageKey);
        status.textContent = "현재 사용할 수 없는 메뉴가 포함되어 있어 다시 코칭받을 수 없어요.";
      } else if (error && (error.code === "COACHING_RECORD_NOT_FOUND" || error.code === "MEAL_NOT_FOUND")) {
        sessionStorage.removeItem(attempt.storageKey);
        status.textContent = "원본 코칭 기록의 식사 정보를 찾을 수 없어요.";
      } else if (error && error.code === "IDEMPOTENCY_KEY_CONFLICT") {
        sessionStorage.removeItem(attempt.storageKey);
        status.textContent = "요청 상태가 바뀌었어요. 한 번 더 눌러 새로 시도해 주세요.";
      } else if (error && error.code === "COMMON_NETWORK_ERROR") {
        status.textContent = "서버 연결이 끊겼어요. 다시 누르면 같은 요청으로 안전하게 재시도해요.";
      } else {
        status.textContent = error && error.message ? error.message : "메뉴를 다시 준비하지 못했어요.";
      }
      status.classList.add("is-error");
      button.disabled = false;
      button.textContent = "이 메뉴로 다시 코칭받기";
    }
  }

  async function loadDetail(recordId) {
    document.querySelector("[data-detail-error]").hidden = true;
    document.querySelector("[data-detail-content]").hidden = true;
    const loading = document.querySelector("[data-detail-loading]");
    loading.hidden = false;
    try {
      const data = await window.FirstBiteApi.getCoachingRecord(recordId);
      renderDetail(data);
      loading.hidden = true;
      document.querySelector("[data-detail-content]").hidden = false;
    } catch (error) {
      if (error && error.code === "COACHING_RECORD_NOT_FOUND") showError("not-found", error);
      else if (error && (error.code === "HISTORY_FORBIDDEN" || error.status === 403)) showError("forbidden", error);
      else if (error && error.code === "HISTORY_CORRUPTED") showError("corrupted", error);
      else showError("failed", error);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const recordId = params.get("recordId");
    if (!isUuid(recordId)) {
      showError("not-found", null);
      return;
    }

    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace(`login.html?next=${encodeURIComponent(`coaching-record-detail.html?recordId=${recordId}`)}`);
        return;
      }
    } catch (error) {
      showError("failed", error);
      return;
    }

    await loadDetail(recordId);
    document.querySelector("[data-detail-retry]").addEventListener("click", () => loadDetail(recordId));
    document.querySelector("[data-reuse-record]").addEventListener("click", () => reuseRecord(recordId));
  });
})();
