(function () {
  "use strict";

  const PAGE_SIZE = 4;
  const SUMMARY_PAGE_SIZE = 50;
  let page = 1;
  let totalPages = 1;
  let loadingMore = false;
  let weekOffset = 0;
  let allRecords = [];

  const mealTypeByHour = (value) => {
    const date = value ? new Date(value) : new Date();
    const hour = date.getHours();
    if (hour >= 5 && hour < 10) return { label: "아침", icon: "☀" };
    if (hour >= 10 && hour < 15) return { label: "점심", icon: "☀" };
    if (hour >= 15 && hour < 21) return { label: "저녁", icon: "☾" };
    return { label: "야식", icon: "☾" };
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function localIsoDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getWeekRange(offset) {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const day = now.getDay();
    const mondayDelta = day === 0 ? -6 : 1 - day;
    const from = new Date(now);
    from.setDate(now.getDate() + mondayDelta + (offset * 7));
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    return { from, to };
  }

  function weekLabel(range) {
    const f = range.from;
    const t = range.to;
    if (f.getMonth() === t.getMonth()) {
      return `${f.getMonth() + 1}월 ${f.getDate()}일 - ${t.getDate()}일`;
    }
    return `${f.getMonth() + 1}월 ${f.getDate()}일 - ${t.getMonth() + 1}월 ${t.getDate()}일`;
  }

  function dateTitle(value) {
    if (!value) return "날짜 없음";
    const date = new Date(value);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
  }

  function durationLabel(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const rest = value % 60;
    if (!minutes) return `${rest}초`;
    return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
  }

  function percent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    return `${Math.round(number * 100)}%`;
  }

  function feedbackLabel(score) {
    const labels = ["너무 졸렸어요", "꽤 졸렸어요", "졸렸어요", "별로 졸리지 않았어요", "안 졸렸어요"];
    const number = Number(score);
    return number >= 1 && number <= 5 ? labels[number - 1] : null;
  }

  function renderRecord(item) {
    const meal = mealTypeByHour(item.completedAt);
    const statusDone = item.completionReason === "COMPLETED";
    const menuItems = Array.isArray(item.menuItems) ? item.menuItems : [];
    const menu = menuItems.length
      ? menuItems.map((food) => food.name).filter(Boolean).join(" · ")
      : (item.mealName || "메뉴 정보 없음");
    const stageResults = Array.isArray(item.stageResults) ? item.stageResults : [];
    const totalSeconds = Number.isFinite(Number(item.totalSeconds))
      ? Number(item.totalSeconds)
      : stageResults.reduce((sum, stage) => sum + (Number(stage.actualSeconds) || 0), 0);
    const feedback = feedbackLabel(item.sleepinessScore);
    const menuCount = menuItems.length || (menu ? 1 : 0);
    const totalStages = Number(item.totalStages) || 0;
    const completedStages = Number(item.completedStages) || 0;
    const href = `coaching-record-detail.html?recordId=${encodeURIComponent(item.recordId)}`;

    return `
      <article class="record-card">
        <div class="record-meal-type">
          <span class="record-meal-icon" aria-hidden="true">${meal.icon}</span>
          <span>${meal.label}</span>
        </div>
        <div class="record-content">
          <div class="record-title-line">
            <h3>${escapeHtml(dateTitle(item.completedAt))} · ${meal.label}</h3>
            <span class="record-status-badge ${statusDone ? "" : "user-ended"}">${statusDone ? "완료" : "중도 종료"}</span>
          </div>
          <p class="record-menu">${escapeHtml(menu)}</p>
          <div class="record-chip-row">
            <span class="record-chip">${escapeHtml(`${completedStages}/${totalStages || completedStages}단계 완료`)}</span>
            <span class="record-chip">${escapeHtml(`실행 시간 ${durationLabel(totalSeconds)}`)}</span>
            <span class="record-chip">${escapeHtml(`${menuCount}개 메뉴`)}</span>
          </div>
          <p class="record-feedback">다음 날 피드백&nbsp; <strong>${escapeHtml(feedback || "미응답")}</strong></p>
        </div>
        <a class="record-detail-link" href="${href}">자세히 보기 <span aria-hidden="true">›</span></a>
      </article>`;
  }

  function renderRecords(items, append) {
    const list = document.querySelector("[data-history-list]");
    if (!append) list.innerHTML = "";
    if (!items.length && !append) {
      list.innerHTML = '<div class="record-empty">아직 완료한 코칭 기록이 없어요.<br>새로운 식사 코칭을 시작하면 이곳에 기록이 쌓여요.</div>';
      return;
    }
    if (items.length) list.insertAdjacentHTML("beforeend", items.map(renderRecord).join(""));
  }

  async function getAllRecordsInRange(range) {
    const from = localIsoDate(range.from);
    const to = localIsoDate(range.to);
    let requestedPage = 1;
    let pages = 1;
    const records = [];

    do {
      const result = await window.FirstBiteApi.getCoachingRecords({
        from,
        to,
        page: requestedPage,
        size: SUMMARY_PAGE_SIZE
      });
      const items = result && Array.isArray(result.items) ? result.items : [];
      records.push(...items);
      pages = result && result.meta && Number.isFinite(Number(result.meta.totalPages))
        ? Math.max(1, Number(result.meta.totalPages))
        : (items.length < SUMMARY_PAGE_SIZE ? requestedPage : requestedPage + 1);
      requestedPage += 1;
    } while (requestedPage <= pages);

    return records;
  }

  async function loadSummary() {
    const range = getWeekRange(weekOffset);
    const label = document.querySelector("[data-week-label]");
    const next = document.querySelector("[data-week-next]");
    label.textContent = weekLabel(range);
    next.disabled = weekOffset >= 0;

    const summaryPromise = window.FirstBiteApi.getCoachingHistorySummary({
      from: localIsoDate(range.from),
      to: localIsoDate(range.to),
      timezone: "Asia/Seoul"
    });
    const recordsPromise = getAllRecordsInRange(range);
    const [summaryResult, recordsResult] = await Promise.allSettled([summaryPromise, recordsPromise]);

    if (summaryResult.status !== "fulfilled") {
      document.querySelector('[data-summary="coachingCount"]').textContent = "-";
      document.querySelector('[data-summary="completedCount"]').textContent = "-";
      document.querySelector('[data-summary="feedbackCount"]').textContent = "-";
      document.querySelector("[data-summary-note]").textContent = "이번 주 코칭 요약을 불러오지 못했어요.";
      return;
    }

    const summary = summaryResult.value || {};
    document.querySelector('[data-summary="coachingCount"]').textContent = String(Number(summary.coachingCount) || 0);
    document.querySelector('[data-summary="completedCount"]').textContent = String(Number(summary.completedCoachingCount) || 0);

    let feedbackCount = null;
    if (recordsResult.status === "fulfilled") {
      feedbackCount = recordsResult.value.filter((record) => record.sleepinessScore != null).length;
      document.querySelector('[data-summary="feedbackCount"]').textContent = String(feedbackCount);
    } else {
      document.querySelector('[data-summary="feedbackCount"]').textContent = "-";
    }

    const noteParts = [
      `코칭 완료율 ${percent(summary.completionRate)}`,
      `단계 준수율 ${percent(summary.orderAdherenceRate)}`
    ];
    if (feedbackCount != null) noteParts.push(`피드백 ${feedbackCount}회`);
    document.querySelector("[data-summary-note]").textContent = noteParts.join(" · ");
  }

  async function loadRecords(options = {}) {
    if (loadingMore) return;
    loadingMore = true;
    const loadMore = document.querySelector("[data-load-more]");
    const status = document.querySelector("[data-history-status]");
    const requestedPage = options.page || 1;
    if (loadMore) loadMore.disabled = true;
    status.textContent = "";

    try {
      const result = await window.FirstBiteApi.getCoachingRecords({ page: requestedPage, size: PAGE_SIZE });
      const items = result && Array.isArray(result.items) ? result.items : [];
      renderRecords(items, requestedPage > 1);
      allRecords = requestedPage > 1 ? allRecords.concat(items) : items.slice();
      page = requestedPage;
      totalPages = result && result.meta && Number.isFinite(Number(result.meta.totalPages))
        ? Math.max(1, Number(result.meta.totalPages))
        : (items.length < PAGE_SIZE ? requestedPage : requestedPage + 1);

      if (loadMore) {
        loadMore.hidden = allRecords.length === 0 || page >= totalPages;
        loadMore.disabled = page >= totalPages;
      }
    } catch (error) {
      if (requestedPage === 1) {
        document.querySelector("[data-history-list]").innerHTML = `
          <div class="record-error">
            <div>코칭 기록을 불러오지 못했어요.<br>${escapeHtml(error.message || "잠시 후 다시 시도해 주세요.")}<br><button type="button" data-record-retry>다시 시도</button></div>
          </div>`;
      } else {
        status.textContent = error.message || "추가 기록을 불러오지 못했어요.";
      }
      if (loadMore) loadMore.disabled = false;
    } finally {
      loadingMore = false;
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace("login.html?next=coaching-history.html");
        return;
      }
    } catch (error) {
      document.querySelector("[data-history-list]").innerHTML = `<div class="record-error">${escapeHtml(error.message || "로그인 상태를 확인하지 못했어요.")}</div>`;
      return;
    }

    await Promise.all([loadSummary(), loadRecords({ page: 1 })]);

    document.querySelector("[data-week-prev]").addEventListener("click", () => {
      weekOffset -= 1;
      loadSummary();
    });
    document.querySelector("[data-week-next]").addEventListener("click", () => {
      if (weekOffset >= 0) return;
      weekOffset += 1;
      loadSummary();
    });
    document.querySelector("[data-load-more]").addEventListener("click", () => {
      if (page < totalPages) loadRecords({ page: page + 1 });
    });
    document.querySelector("[data-history-list]").addEventListener("click", (event) => {
      const retry = event.target.closest("[data-record-retry]");
      if (retry) loadRecords({ page: 1 });
    });
  });
})();
