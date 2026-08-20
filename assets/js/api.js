(function () {
  "use strict";

  const API_ROOT = "/api/v1";
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

  // 음식 이미지 로컬 폴백 매핑. 백엔드가 imageUrl을 채워주면 그 값을 우선 쓰고,
  // 없을 때만 음식명으로 assets/foods/의 대표 이미지를 찾는다. 매칭 없으면 중립 placeholder.
  const FOOD_IMAGE_ROOT = "assets/foods/";
  const NEUTRAL_FOOD_IMAGE = "assets/recognition/food-photo.jpg";
  const FOOD_IMAGE_EXACT = {
    "김밥": "gimbap.jpg",
    "떡볶이": "tteokbokki.webp",
    "백미밥": "white_rice.jpg",
    "제육볶음": "spicy_pork.jpg",
    "된장찌개": "soybean_paste_stew.jpg",
    "라면": "ramyeon.webp",
    "잔치국수": "banquet_noodles.jpg",
    "고기만두": "meat_dumplings.jpg",
    "햄샌드위치": "ham_sandwich.jpg",
    "식빵": "white_bread.jpg",
    "구운계란": "boiled_egg.jpg",
    "연두부": "soft_tofu.jpg",
    "닭가슴살": "chicken_breast.jpg",
    "방울토마토": "cherry_tomato.jpg",
    "무나물": "radish_namul.jpg",
    "오이": "cucumber.jpg",
    "양배추": "cabbage.jpg",
    "아몬드": "almonds.jpg",
    "사과": "apple.jpg",
    "파프리카": "paprika.jpg",
    "삶은 브로콜리": "boiled_broccoli.jpg",
    "참치 통조림": "canned_tuna.jpg",
    "무가당 그릭요거트": "plain_greek_yogurt.jpg",
    "풋콩": "edamame.jpg",
    "우유": "milk.jpg"
  };
  // 키워드 부분매칭. 다른 음식명에 부분포함되어 오매핑되는 키워드(예: "계란"→계란볶음밥,
  // "제육"→제육덮밥)는 제외하고, 단일 음식에만 대응되는 키워드만 남긴다.
  const FOOD_IMAGE_KEYWORD = [
    ["된장", "soybean_paste_stew.jpg"],
    ["라면", "ramyeon.webp"], ["만두", "meat_dumplings.jpg"],
    ["샌드위치", "ham_sandwich.jpg"], ["식빵", "white_bread.jpg"],
    ["브로콜리", "boiled_broccoli.jpg"], ["그릭", "plain_greek_yogurt.jpg"],
    ["방울토마토", "cherry_tomato.jpg"], ["양배추", "cabbage.jpg"],
    ["닭가슴살", "chicken_breast.jpg"], ["아몬드", "almonds.jpg"],
    ["파프리카", "paprika.jpg"], ["연두부", "soft_tofu.jpg"]
  ];

  function foodImageByName(name) {
    const value = String(name || "").trim();
    if (value && FOOD_IMAGE_EXACT[value]) return FOOD_IMAGE_ROOT + FOOD_IMAGE_EXACT[value];
    for (const [keyword, file] of FOOD_IMAGE_KEYWORD) {
      if (value.includes(keyword)) return FOOD_IMAGE_ROOT + file;
    }
    return NEUTRAL_FOOD_IMAGE;
  }

  function foodImageForItem(item) {
    return item && item.imageUrl ? item.imageUrl : foodImageByName(item && item.name);
  }

  window.FirstBiteFoodImage = Object.freeze({
    byName: foodImageByName,
    forItem: foodImageForItem,
    neutral: NEUTRAL_FOOD_IMAGE
  });

  window.FirstBiteApi = Object.freeze({
    ApiError,
    request: send,
    restoreSession,
    login,
    logout,
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
