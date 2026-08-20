/*
 * 백엔드 연결 시 사용할 계약만 정리한 파일입니다.
 * 화면 구현과 실제 연동 코드가 같은 경로를 사용하도록 계약을 모아 둡니다.
 */
export const firstBiteApi = Object.freeze({
  login: { method: "POST", path: "/api/v1/auth/login" },
  logout: { method: "POST", path: "/api/v1/auth/logout" },
  refresh: { method: "POST", path: "/api/v1/auth/refresh" },
  createPhoneVerification: { method: "POST", path: "/api/v1/auth/phone-verifications" },
  confirmPhoneVerification: { method: "POST", path: "/api/v1/auth/phone-verifications/confirm" },
  signup: { method: "POST", path: "/api/v1/auth/signup" },
  getMyAccount: { method: "GET", path: "/api/v1/accounts/me" },
  createRecognition: { method: "POST", path: "/api/v1/recognitions", contentType: "multipart/form-data" },
  getRecognition: { method: "GET", path: "/api/v1/recognitions/{recognitionId}" },
  searchFoods: { method: "GET", path: "/api/v1/foods" },
  createMeal: { method: "POST", path: "/api/v1/meals" },
  replaceMealItems: { method: "PUT", path: "/api/v1/meals/{mealId}/items" },
  createAnalysis: { method: "POST", path: "/api/v1/meals/{mealId}/analysis" },
  getAnalysis: { method: "GET", path: "/api/v1/meals/{mealId}/analysis" },
  getCoachingPlan: { method: "GET", path: "/api/v1/meals/{mealId}/coaching-plan" },
  getSideMenuRecommendations: { method: "GET", path: "/api/v1/meals/{mealId}/side-menu-recommendations" },
  searchSideMenus: { method: "GET", path: "/api/v1/side-menus" },
  addSideMenu: { method: "POST", path: "/api/v1/meals/{mealId}/side-menus" },
  removeSideMenu: { method: "DELETE", path: "/api/v1/meals/{mealId}/side-menus/{sideMenuId}" },
  getActiveCoachingSession: { method: "GET", path: "/api/v1/coaching-sessions/active" },
  startCoachingSession: { method: "POST", path: "/api/v1/coaching-sessions" },
  updateCoachingStage: { method: "PATCH", path: "/api/v1/coaching-sessions/{sessionId}" },
  updateCoachingTimer: { method: "PATCH", path: "/api/v1/coaching-sessions/{sessionId}/timer" },
  completeCoachingSession: { method: "POST", path: "/api/v1/coaching-sessions/{sessionId}/complete" },
  getCoachingRecords: { method: "GET", path: "/api/v1/coaching-records" },
  getCoachingRecord: { method: "GET", path: "/api/v1/coaching-records/{recordId}" },
  getCoachingHistorySummary: { method: "GET", path: "/api/v1/coaching-records/summary" },
  reuseCoachingRecord: { method: "POST", path: "/api/v1/coaching-records/{recordId}/reuse" },
  submitFeedback: { method: "POST", path: "/api/v1/coaching-records/{recordId}/feedback" },
  getPersonalization: { method: "GET", path: "/api/v1/personalization" }
});

export const recognitionStatuses = Object.freeze({
  processing: "PROCESSING",
  completed: "COMPLETED",
  failed: "FAILED"
});

export function toMealDraft(items, recognitionId) {
  return {
    source: "IMAGE",
    recognitionId,
    items: items.map(({ foodId, servingMultiplier }) => ({ foodId, servingMultiplier }))
  };
}
