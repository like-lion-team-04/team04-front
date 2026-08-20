(function () {
  "use strict";

  const LOCAL_BACKEND_ORIGIN = "http://localhost:8080";
  const OAUTH_NEXT_KEY = "firstbite.oauth.next";
  const OAUTH_PROVIDER_KEY = "firstbite.oauth.provider";
  const OAUTH_STARTED_AT_KEY = "firstbite.oauth.startedAt";
  const OAUTH_MAX_AGE_MS = 10 * 60 * 1000;

  function resolveBackendOrigin() {
    const configured = typeof window.FIRSTBITE_BACKEND_ORIGIN === "string"
      ? window.FIRSTBITE_BACKEND_ORIGIN.trim().replace(/\/$/, "")
      : "";
    if (configured) return configured;

    const host = window.location.hostname;
    const port = window.location.port;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";
    if (isLocalHost && port && port !== "8080") return LOCAL_BACKEND_ORIGIN;
    return "";
  }

  const BACKEND_ORIGIN = resolveBackendOrigin();
  const API_ROOT = `${BACKEND_ORIGIN}/api/v1`;
  let accessToken = null;
  let refreshPromise = null;

  class ApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "ApiError";
      this.status = options.status || 0;
      this.code = options.code || "COMMON_REQUEST_FAILED";
      this.details = Array.isArray(options.details) ? options.details : [];
    }
  }

  function emitAuthState(authenticated) {
    window.dispatchEvent(new CustomEvent("firstbite:auth-state", {
      detail: { authenticated }
    }));
  }

  function clearAccessToken() {
    accessToken = null;
    emitAuthState(false);
  }

  async function readPayload(response) {
    if (response.status === 204) return null;

    const text = await response.text();
    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new ApiError("서버 응답을 확인할 수 없습니다.", {
        status: response.status,
        code: "COMMON_INVALID_RESPONSE"
      });
    }
  }

  function toApiError(response, payload) {
    const error = payload && payload.error ? payload.error : {};
    return new ApiError(error.message || "요청을 처리하지 못했습니다.", {
      status: response.status,
      code: error.code,
      details: error.details
    });
  }

  function queryString(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
    });
    const result = query.toString();
    return result ? `?${result}` : "";
  }

  function idempotencyKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.random() * 16 | 0;
      const value = character === "x" ? random : (random & 3 | 8);
      return value.toString(16);
    });
  }

  async function send(path, options = {}) {
    const method = options.method || "GET";
    const headers = new Headers(options.headers || {});
    const body = options.body;

    if (options.auth !== false && accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    let requestBody;
    if (body instanceof FormData) {
      requestBody = body;
    } else if (body !== undefined) {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(`${API_ROOT}${path}`, {
        method,
        headers,
        body: requestBody,
        credentials: "include"
      });
    } catch (_error) {
      throw new ApiError("서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.", {
        code: "COMMON_NETWORK_ERROR"
      });
    }

    const payload = await readPayload(response);

    // 보호 API에서 Access Token이 만료된 경우 HttpOnly Refresh Token으로 한 번만 복구한다.
    if (response.status === 401 && options.auth !== false && options.retry !== false) {
      clearAccessToken();
      const restored = await restoreSession();
      if (restored) {
        return send(path, { ...options, retry: false });
      }
    }

    if (!response.ok || (payload && payload.success === false)) {
      throw toApiError(response, payload);
    }

    if (payload && payload.success === true) {
      if (options.includeMeta) return { data: payload.data, meta: payload.meta || null };
      return payload.data;
    }
    return payload;
  }

  async function refresh() {
    if (refreshPromise) return refreshPromise;

    refreshPromise = send("/auth/refresh", {
      method: "POST",
      auth: false,
      retry: false
    })
      .then((data) => {
        if (!data || !data.accessToken) {
          throw new ApiError("로그인 상태를 복구하지 못했습니다.", {
            code: "AUTH_REFRESH_INVALID_RESPONSE"
          });
        }
        accessToken = data.accessToken;
        emitAuthState(true);
        return data;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async function restoreSession() {
    if (accessToken) return true;

    try {
      await refresh();
      return true;
    } catch (error) {
      // Refresh Token이 없거나 만료/재사용된 경우는 정상적인 비로그인 상태로 취급한다.
      if (error instanceof ApiError && [401, 409].includes(error.status)) return false;
      throw error;
    }
  }


  function safeNextPage(value) {
    return value && /^[a-z0-9-]+\.html(?:[?#].*)?$/i.test(value) ? value : "index.html";
  }

  function oauthLoginUrl(provider) {
    const normalized = String(provider || "").toLowerCase();
    if (!new Set(["kakao", "google"]).has(normalized)) {
      throw new ApiError("지원하지 않는 소셜 로그인입니다.", { code: "AUTH_OAUTH_PROVIDER_UNSUPPORTED" });
    }
    return `${BACKEND_ORIGIN}/oauth2/authorization/${normalized}`;
  }

  function beginSocialLogin(provider, next = "index.html") {
    const normalized = String(provider || "").toLowerCase();
    const target = safeNextPage(next);
    const url = oauthLoginUrl(normalized);
    sessionStorage.setItem(OAUTH_NEXT_KEY, target);
    sessionStorage.setItem(OAUTH_PROVIDER_KEY, normalized);
    sessionStorage.setItem(OAUTH_STARTED_AT_KEY, String(Date.now()));
    window.location.assign(url);
  }

  function clearPendingSocialLogin() {
    sessionStorage.removeItem(OAUTH_NEXT_KEY);
    sessionStorage.removeItem(OAUTH_PROVIDER_KEY);
    sessionStorage.removeItem(OAUTH_STARTED_AT_KEY);
  }

  function getPendingSocialLogin() {
    const provider = sessionStorage.getItem(OAUTH_PROVIDER_KEY);
    if (!provider) return null;
    const startedAt = Number(sessionStorage.getItem(OAUTH_STARTED_AT_KEY));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > OAUTH_MAX_AGE_MS) {
      clearPendingSocialLogin();
      return null;
    }
    return {
      provider,
      next: safeNextPage(sessionStorage.getItem(OAUTH_NEXT_KEY))
    };
  }

  async function completeSocialLogin() {
    const pending = getPendingSocialLogin();
    if (!pending) return null;
    const restored = await restoreSession();
    if (!restored) {
      throw new ApiError("소셜 로그인 세션을 확인하지 못했습니다.", {
        status: 401,
        code: "AUTH_OAUTH_SESSION_MISSING"
      });
    }
    clearPendingSocialLogin();
    return pending;
  }

  async function login(email, password) {
    const data = await send("/auth/login", {
      method: "POST",
      auth: false,
      retry: false,
      body: { email, password }
    });
    if (!data || !data.accessToken) {
      throw new ApiError("로그인 응답에 인증 정보가 없습니다.", {
        code: "AUTH_LOGIN_INVALID_RESPONSE"
      });
    }
    accessToken = data.accessToken;
    emitAuthState(true);
    return data;
  }

  async function logout() {
    try {
      if (!accessToken) {
        const restored = await restoreSession();
        if (!restored) {
          clearAccessToken();
          return false;
        }
      }
      await send("/auth/logout", { method: "POST", retry: false });
      return true;
    } finally {
      clearAccessToken();
    }
  }

  window.FirstBiteApi = Object.freeze({
    ApiError,
    request: send,
    restoreSession,
    login,
    logout,
    getBackendOrigin: () => BACKEND_ORIGIN,
    getOAuthLoginUrl: oauthLoginUrl,
    beginSocialLogin,
    getPendingSocialLogin,
    completeSocialLogin,
    clearPendingSocialLogin,
    createIdempotencyKey: idempotencyKey,
    getMe: () => send("/accounts/me"),
    getFeedbackStatus: (date) => send(`/feedbacks/status${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    getPendingFeedback: (date) => send(`/feedbacks/pending${date ? `?date=${encodeURIComponent(date)}` : ""}`),
    submitFeedback: (recordId, feedback, requestKey) => send(`/coaching-records/${recordId}/feedback`, {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: feedback
    }),
    getPersonalization: () => send("/personalization"),
    createRecognition: (image, imageType = "FOOD_PHOTO", requestKey = idempotencyKey()) => {
      const allowedTypes = new Set(["MENU_BOARD", "DELIVERY_SCREEN", "FOOD_PHOTO"]);
      const normalizedType = allowedTypes.has(imageType) ? imageType : "FOOD_PHOTO";
      const form = new FormData();
      form.append("image", image);
      return send(`/recognitions${queryString({ imageType: normalizedType })}`, {
        method: "POST",
        headers: { "Idempotency-Key": requestKey },
        body: form
      });
    },
    getRecognition: (recognitionId) => send(`/recognitions/${recognitionId}`),
    searchFoods: async (params = {}) => {
      const response = await send(`/foods${queryString(params)}`, { includeMeta: true });
      return { ...(response.data || {}), meta: response.meta || null };
    },
    createMeal: (meal, requestKey = idempotencyKey()) => send("/meals", {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: meal
    }),
    replaceMealItems: (mealId, items) => send(`/meals/${mealId}/items`, {
      method: "PUT",
      body: { items }
    }),
    createAnalysis: (mealId, usePersonalization = true, requestKey = idempotencyKey()) => send(`/meals/${mealId}/analysis`, {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: { usePersonalization }
    }),
    getAnalysis: (mealId) => send(`/meals/${mealId}/analysis`),
    getCoachingPlan: (mealId) => send(`/meals/${mealId}/coaching-plan`),
    getSideMenuRecommendations: (mealId, limit = 3) => {
      const normalizedLimit = Math.min(3, Math.max(1, Number(limit) || 3));
      return send(`/meals/${mealId}/side-menu-recommendations${queryString({ limit: normalizedLimit })}`);
    },
    searchSideMenus: (params = {}) => send(`/side-menus${queryString(params)}`),
    addSideMenu: (mealId, sideMenuId, servingMultiplier = 1, requestKey = idempotencyKey()) => send(`/meals/${mealId}/side-menus`, {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: { sideMenuId, servingMultiplier }
    }),
    removeSideMenu: (mealId, sideMenuId) => send(`/meals/${mealId}/side-menus/${sideMenuId}`, { method: "DELETE" }),
    getActiveCoachingSession: () => send("/coaching-sessions/active"),
    startCoachingSession: (mealId, planVersion, requestKey = idempotencyKey()) => send("/coaching-sessions", {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: { mealId, planVersion }
    }),
    updateCoachingStage: (sessionId, action, expectedStage, occurredAt = new Date().toISOString()) => send(`/coaching-sessions/${sessionId}`, {
      method: "PATCH",
      body: { action, expectedStage, occurredAt }
    }),
    updateCoachingTimer: (sessionId, action, expectedStage, occurredAt = new Date().toISOString()) => send(`/coaching-sessions/${sessionId}/timer`, {
      method: "PATCH",
      body: { action, expectedStage, occurredAt }
    }),
    completeCoachingSession: (sessionId, reason = "COMPLETED", requestKey = idempotencyKey(), endedAt = new Date().toISOString()) => send(`/coaching-sessions/${sessionId}/complete`, {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: { reason, endedAt }
    }),
    getCoachingRecords: async (params = {}) => {
      const response = await send(`/coaching-records${queryString(params)}`, { includeMeta: true });
      return { ...(response.data || {}), meta: response.meta || null };
    },
    getCoachingRecord: (recordId) => send(`/coaching-records/${recordId}`),
    getCoachingHistorySummary: (params) => send(`/coaching-records/summary${queryString(params)}`),
    reuseCoachingRecord: (recordId, includeSideMenus = true, requestKey = idempotencyKey()) => send(`/coaching-records/${recordId}/reuse`, {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: { includeSideMenus }
    }),
    getEvidence: () => send("/evidence"),
    createPhoneVerification: (phoneNumber) => send("/auth/phone-verifications", {
      method: "POST",
      auth: false,
      retry: false,
      body: { phoneNumber }
    }),
    confirmPhoneVerification: (requestId) => send("/auth/phone-verifications/confirm", {
      method: "POST",
      auth: false,
      retry: false,
      body: { requestId }
    }),
    signup: (signupData) => send("/auth/signup", {
      method: "POST",
      auth: false,
      retry: false,
      body: signupData
    })
  });
})();
