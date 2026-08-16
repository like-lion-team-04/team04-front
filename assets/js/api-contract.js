/*
 * 백엔드 연결 시 사용할 계약만 정리한 파일입니다.
 * 현재 화면에서는 import하거나 네트워크 요청을 보내지 않습니다.
 */
export const firstBiteApi = Object.freeze({
  createRecognition: { method: "POST", path: "/api/v1/recognitions", contentType: "multipart/form-data" },
  getRecognition: { method: "GET", path: "/api/v1/recognitions/{recognitionId}" },
  searchFoods: { method: "GET", path: "/api/v1/foods" },
  createMeal: { method: "POST", path: "/api/v1/meals" },
  replaceMealItems: { method: "PUT", path: "/api/v1/meals/{mealId}/items" }
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
