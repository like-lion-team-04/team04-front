(function () {
  "use strict";

  const LABELS = ["너무 졸렸어요", "꽤 졸렸어요", "졸렸어요", "살짝 졸렸어요", "안 졸렸어요"];
  const LEFTS = ["10.82%", "26.92%", "43.01%", "59.11%", "75.21%"];
  const STORAGE_KEY = "firstbite.latestFeedback.v3";
  const PENDING_KEY = "firstbite.pendingFeedback.v2";
  const SUBMISSION_KEY = "firstbite.feedbackSubmission.v1";
  const SUBMISSION_TTL_MS = 23 * 60 * 60 * 1000;

  function createIdempotencyKey() {
    if (window.FirstBiteApi && typeof window.FirstBiteApi.createIdempotencyKey === "function") {
      return window.FirstBiteApi.createIdempotencyKey();
    }
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      const value = character === "x" ? random : (random & 3 | 8);
      return value.toString(16);
    });
  }

  function readJson(storage, key) {
    try {
      return JSON.parse(storage.getItem(key) || "null");
    } catch (_error) {
      return null;
    }
  }

  function writeJson(storage, key, value) {
    if (value === null || value === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  }

  function readLatest() {
    return readJson(localStorage, STORAGE_KEY);
  }

  function saveLatest(value) {
    writeJson(localStorage, STORAGE_KEY, value);
  }

  function readPending() {
    const value = readJson(sessionStorage, PENDING_KEY);
    if (!value || !value.recordId) return null;
    if (value.expiresAt) {
      const expiresAt = new Date(value.expiresAt).getTime();
      if (Number.isFinite(expiresAt) && expiresAt < Date.now()) {
        sessionStorage.removeItem(PENDING_KEY);
        return null;
      }
    }
    return value;
  }

  function savePending(value) {
    if (value && value.recordId) {
      writeJson(sessionStorage, PENDING_KEY, {
        recordId: value.recordId,
        expiresAt: value.expiresAt || null
      });
    }
  }

  function clearPending(recordId) {
    const current = readPending();
    if (!recordId || !current || current.recordId === recordId) sessionStorage.removeItem(PENDING_KEY);
  }

  function readSubmissionAttempt() {
    const value = readJson(sessionStorage, SUBMISSION_KEY);
    if (!value || !value.requestKey || !value.recordId || !value.answeredAt) return null;
    const createdAt = Number(value.createdAt || 0);
    if (!createdAt || Date.now() - createdAt > SUBMISSION_TTL_MS) {
      sessionStorage.removeItem(SUBMISSION_KEY);
      return null;
    }
    return value;
  }

  function getSubmissionAttempt(recordId, score) {
    const existing = readSubmissionAttempt();
    if (existing && existing.recordId === recordId && Number(existing.score) === Number(score)) return existing;

    const created = {
      recordId,
      score: Number(score),
      answeredAt: new Date().toISOString(),
      requestKey: createIdempotencyKey(),
      createdAt: Date.now()
    };
    writeJson(sessionStorage, SUBMISSION_KEY, created);
    return created;
  }

  function clearSubmissionAttempt(recordId) {
    const current = readSubmissionAttempt();
    if (!recordId || !current || current.recordId === recordId) sessionStorage.removeItem(SUBMISSION_KEY);
  }

  function setupSelection(canvas, initialScore) {
    const overlay = canvas.querySelector("[data-selected-card]");
    const icon = canvas.querySelector("[data-selected-icon]");
    const label = canvas.querySelector("[data-selected-label]");
    const neutralLastCard = canvas.querySelector("[data-neutral-last-card]");
    let score = initialScore || null;

    function clear() {
      score = null;
      if (overlay) overlay.hidden = true;
      if (neutralLastCard) neutralLastCard.hidden = false;
    }

    function render(nextScore) {
      const numericScore = Number(nextScore);
      if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
        clear();
        return null;
      }
      score = numericScore;
      const index = score - 1;

      if (overlay) {
        overlay.hidden = false;
        overlay.style.setProperty("--selected-left", LEFTS[index]);
      }
      if (icon) icon.src = `assets/design/feedback/selected-${score}.png`;
      if (label) label.textContent = LABELS[index];
      if (neutralLastCard) neutralLastCard.hidden = score === 5;
      return score;
    }

    canvas.querySelectorAll("[data-feedback-score]").forEach((button) => {
      button.addEventListener("click", () => {
        render(button.dataset.feedbackScore);
        canvas.dispatchEvent(new CustomEvent("feedback-selection", { detail: { score } }));
      });
    });

    if (score) render(score);
    else clear();
    return { render, clear, getScore: () => score };
  }

  async function loadServerState() {
    if (!window.FirstBiteApi) {
      return { authenticated: false, pending: null, status: null };
    }

    const authenticated = await window.FirstBiteApi.restoreSession();
    if (!authenticated) return { authenticated: false, pending: null, status: null };

    let pending = null;
    try {
      pending = await window.FirstBiteApi.getPendingFeedback();
    } catch (_error) {
      // 상태 조회가 살아 있으면 pending API 단독 실패에도 화면을 복구할 수 있다.
    }

    if (pending && pending.pending && pending.recordId) {
      savePending(pending);
      return {
        authenticated: true,
        pending,
        status: {
          status: "PENDING",
          recordId: pending.recordId,
          question: pending.question,
          scale: pending.scale,
          sleepinessScore: null,
          answeredAt: null,
          expiresAt: pending.expiresAt
        }
      };
    }

    const status = await window.FirstBiteApi.getFeedbackStatus();
    if (status && status.status === "PENDING" && status.recordId) savePending(status);
    else clearPending();

    return { authenticated: true, pending, status };
  }

  async function loadPersonalization() {
    if (!window.FirstBiteApi) return null;
    const authenticated = await window.FirstBiteApi.restoreSession();
    if (!authenticated) return null;
    return window.FirstBiteApi.getPersonalization();
  }

  function confirmedLocalValue(score, answeredAt, extra = {}) {
    const numericScore = Number(score);
    const value = {
      score: Number.isInteger(numericScore) && numericScore >= 1 && numericScore <= 5 ? numericScore : null,
      label: Number.isInteger(numericScore) && numericScore >= 1 && numericScore <= 5 ? LABELS[numericScore - 1] : null,
      answeredAt: answeredAt || new Date().toISOString(),
      submitted: true,
      ...extra
    };
    saveLatest(value);
    return value;
  }

  async function resolvePendingRecord() {
    const cached = readPending();
    if (cached && cached.recordId) return cached.recordId;

    const pending = await window.FirstBiteApi.getPendingFeedback();
    if (pending && pending.pending && pending.recordId) {
      savePending(pending);
      return pending.recordId;
    }

    const status = await window.FirstBiteApi.getFeedbackStatus();
    if (status && status.status === "PENDING" && status.recordId) {
      savePending(status);
      return status.recordId;
    }
    if (status && status.status === "ANSWERED") {
      return { alreadyAnswered: true, status };
    }
    return null;
  }

  async function submit(score) {
    const numericScore = Number(score);
    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 5) {
      throw new Error("1~5 중 하나의 컨디션을 선택해 주세요.");
    }
    if (!window.FirstBiteApi) throw new Error("API를 사용할 수 없습니다.");

    const authenticated = await window.FirstBiteApi.restoreSession();
    if (!authenticated) {
      const error = new Error("로그인 후 피드백을 저장할 수 있습니다.");
      error.code = "AUTH_UNAUTHORIZED";
      throw error;
    }

    const resolved = await resolvePendingRecord();
    if (resolved && resolved.alreadyAnswered) {
      const status = resolved.status;
      clearPending(status.recordId);
      clearSubmissionAttempt(status.recordId);
      const local = confirmedLocalValue(status.sleepinessScore, status.answeredAt, { recordId: status.recordId });
      return { ...local, alreadyAnswered: true, server: status };
    }
    if (!resolved) {
      const error = new Error("현재 응답할 수 있는 코칭 피드백이 없습니다.");
      error.code = "FEEDBACK_NOT_AVAILABLE";
      throw error;
    }

    const recordId = resolved;
    const attempt = getSubmissionAttempt(recordId, numericScore);

    try {
      const response = await window.FirstBiteApi.submitFeedback(recordId, {
        sleepinessScore: numericScore,
        skipped: false,
        answeredAt: attempt.answeredAt
      }, attempt.requestKey);

      clearPending(recordId);
      clearSubmissionAttempt(recordId);
      const saved = confirmedLocalValue(response && response.sleepinessScore != null ? response.sleepinessScore : numericScore,
        attempt.answeredAt, {
          recordId,
          feedbackCount: response && response.feedbackCount,
          personalizationUpdated: Boolean(response && response.personalizationUpdated)
        });
      return { ...saved, server: response };
    } catch (error) {
      if (error && error.code === "FEEDBACK_ALREADY_EXISTS") {
        const status = await window.FirstBiteApi.getFeedbackStatus();
        if (status && status.status === "ANSWERED") {
          clearPending(status.recordId || recordId);
          clearSubmissionAttempt(recordId);
          const saved = confirmedLocalValue(status.sleepinessScore, status.answeredAt, {
            recordId: status.recordId || recordId
          });
          return { ...saved, alreadyAnswered: true, server: status };
        }
      }
      throw error;
    }
  }

  window.FirstBiteFeedback = Object.freeze({
    labels: LABELS,
    setupSelection,
    loadServerState,
    loadPersonalization,
    submit,
    readLatest,
    savePendingRecordId: (recordId) => savePending({ recordId })
  });
})();
