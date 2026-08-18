(function () {
  "use strict";

  const BASE_URL = (window.FIRSTBITE_API_BASE || "/api/v1").replace(/\/$/, "");
  let accessToken = null;
  let refreshing = null;

  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  function idempotencyKey() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function parseResponse(response) {
    if (response.status === 204) return null;
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await response.json() : null;
    if (!response.ok || (body && body.success === false)) {
      const error = body && body.error;
      throw new ApiError((error && error.message) || `요청을 처리하지 못했습니다. (${response.status})`, response.status, error && error.code, error && error.details);
    }
    return body && Object.prototype.hasOwnProperty.call(body, "data") ? body.data : body;
  }

  async function raw(path, options) {
    const settings = { credentials: "include", ...options };
    settings.headers = { Accept: "application/json", ...(options && options.headers) };
    if (accessToken && !(options && options.public)) settings.headers.Authorization = `Bearer ${accessToken}`;
    delete settings.public;
    if (settings.body && !(settings.body instanceof FormData) && typeof settings.body !== "string") {
      settings.headers["Content-Type"] = "application/json";
      settings.body = JSON.stringify(settings.body);
    }
    const response = await fetch(`${BASE_URL}${path}`, settings);
    return { response, data: await parseResponse(response) };
  }

  async function refresh() {
    if (!refreshing) {
      refreshing = raw("/auth/refresh", { method: "POST", body: {}, public: true })
        .then(({ data }) => {
          accessToken = data && data.accessToken;
          return data;
        })
        .finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(path, options) {
    try {
      return (await raw(path, options)).data;
    } catch (error) {
      if (error.status === 401 && !(options && options.public) && path !== "/auth/refresh") {
        await refresh();
        return (await raw(path, options)).data;
      }
      throw error;
    }
  }

  window.FirstBiteAPI = {
    ApiError,
    getAccessToken: () => accessToken,
    setAccessToken: (token) => { accessToken = token || null; },
    ensureSession: async () => accessToken || (await refresh()).accessToken,
    login: async (email, password) => {
      const data = await request("/auth/login", { method: "POST", body: { email, password }, public: true });
      accessToken = data.accessToken;
      return data;
    },
    signup: (body) => request("/auth/signup", { method: "POST", body, public: true }),
    createPhoneVerification: (phoneNumber) => request("/auth/phone-verifications", { method: "POST", body: { phoneNumber }, public: true }),
    confirmPhoneVerification: (verification) => request("/auth/phone-verifications/confirm", {
      method: "POST",
      body: typeof verification === "string" ? { requestId: verification } : verification,
      public: true
    }),
    refresh,
    logout: async () => { await request("/auth/logout", { method: "POST" }); accessToken = null; },
    getMe: () => request("/accounts/me", { method: "GET" }),
    createRecognition: (image, imageType) => {
      const body = new FormData();
      body.append("image", image);
      if (imageType) body.append("imageType", imageType);
      return request("/recognitions", { method: "POST", body, headers: { "Idempotency-Key": idempotencyKey() } });
    },
    getRecognition: (recognitionId) => request(`/recognitions/${encodeURIComponent(recognitionId)}`, { method: "GET" }),
    getFoods: ({ query = "", category = "", page = 1, size = 20 } = {}) => {
      const params = new URLSearchParams({ page: String(page), size: String(size) });
      if (query) params.set("query", query);
      if (category && category !== "ALL") params.set("category", category);
      return request(`/foods?${params}`, { method: "GET", public: true });
    },
    createMeal: (body) => request("/meals", { method: "POST", body, headers: { "Idempotency-Key": idempotencyKey() } }),
    updateMealItems: (mealId, items) => request(`/meals/${encodeURIComponent(mealId)}/items`, { method: "PUT", body: { items } }),
    getAnalysis: (mealId) => request(`/meals/${encodeURIComponent(mealId)}/analysis`, { method: "GET" }),
    getSideMenuRecommendations: (mealId, limit = 3) => request(`/meals/${encodeURIComponent(mealId)}/side-menu-recommendations?limit=${limit}`, { method: "GET" }),
    getCoachingPlan: (mealId) => request(`/meals/${encodeURIComponent(mealId)}/coaching-plan`, { method: "GET" }),
    getEvidence: ({ analysisId = "", type = "" } = {}) => {
      const params = new URLSearchParams();
      if (analysisId) params.set("analysisId", analysisId);
      if (type) params.set("type", type);
      return request(`/evidence${params.size ? `?${params}` : ""}`, { method: "GET", public: true });
    }
  };
})();
