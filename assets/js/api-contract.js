/*
 * API 명세 연결 지점입니다. 현재는 화면 구현 단계이므로 fetch 요청을 실행하지 않습니다.
 * 백엔드 연결 시 이 객체를 사용하는 서비스 모듈만 추가하면 화면 코드는 유지할 수 있습니다.
 */
window.FirstBiteApiContract = Object.freeze({
  baseUrl: "/api/v1",
  account: { me: "/accounts/me" },
  foods: { search: "/foods" },
  recognitions: {
    create: "/recognitions",
    detail: (recognitionId) => `/recognitions/${recognitionId}`,
  },
  meals: { create: "/meals" },
  imageTypes: Object.freeze({
    menuBoard: "MENU_BOARD",
    deliveryScreen: "DELIVERY_SCREEN",
    foodPhoto: "FOOD_PHOTO",
  }),
  mealSources: Object.freeze({ image: "IMAGE", manual: "MANUAL" }),
});
