(function () {
  "use strict";

  const link = document.querySelector("[data-analysis-link]");
  const status = document.querySelector("[data-analysis-status]");
  if (!link || !status || !window.FirstBiteApi) return;

  const allowedServing = new Set([0.5, 1, 1.5, 2]);

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function readItems() {
    try {
      const items = JSON.parse(sessionStorage.getItem("firstbiteMealItems") || "[]");
      return Array.isArray(items) ? items : [];
    } catch (_error) {
      return [];
    }
  }

  function validateItems(items) {
    return items.length >= 1
      && items.length <= 20
      && items.every((item) => isUuid(item.foodId) && allowedServing.has(Number(item.servingMultiplier)))
      && new Set(items.map((item) => item.foodId)).size === items.length;
  }

  function currentSource() {
    return sessionStorage.getItem("firstbiteMealSource") || "MANUAL";
  }

  function currentRecognitionId(source) {
    const recognitionId = sessionStorage.getItem("firstbiteRecognitionId") || "";
    if (source !== "IMAGE") return null;
    if (!isUuid(recognitionId)) throw new Error("사진 인식 정보가 없습니다. 사진을 다시 인식해 주세요.");
    return recognitionId;
  }

  function canReuseDraft(mealId, source, recognitionId) {
    if (!isUuid(mealId)) return false;
    const storedSource = sessionStorage.getItem("firstbite.currentMealSource");
    const storedRecognitionId = sessionStorage.getItem("firstbite.currentRecognitionId") || null;
    if (storedSource !== source) return false;
    if (source === "IMAGE" && storedRecognitionId !== recognitionId) return false;
    return true;
  }

  function rememberMeal(meal, source, recognitionId) {
    if (!meal || !isUuid(meal.mealId)) throw new Error("식사 저장 결과를 확인할 수 없습니다.");
    sessionStorage.setItem("firstbite.currentMealId", meal.mealId);
    sessionStorage.setItem("firstbiteMealId", meal.mealId);
    sessionStorage.setItem("firstbite.currentMealSource", source);
    if (recognitionId) sessionStorage.setItem("firstbite.currentRecognitionId", recognitionId);
    else sessionStorage.removeItem("firstbite.currentRecognitionId");
    sessionStorage.setItem("firstbite.currentMeal", JSON.stringify(meal));
    sessionStorage.removeItem("firstbite.currentAnalysis");
    return meal.mealId;
  }

  async function createDraft(source, recognitionId, items) {
    const meal = await window.FirstBiteApi.createMeal({ source, recognitionId, items });
    return rememberMeal(meal, source, recognitionId);
  }

  async function syncMealDraft() {
    const items = readItems();
    if (!validateItems(items)) {
      throw new Error("선택한 메뉴 정보가 올바르지 않습니다. 메뉴를 다시 선택해 주세요.");
    }

    const source = currentSource();
    const recognitionId = currentRecognitionId(source);
    const existingMealId = sessionStorage.getItem("firstbite.currentMealId") || sessionStorage.getItem("firstbiteMealId") || "";

    if (canReuseDraft(existingMealId, source, recognitionId)) {
      try {
        const updated = await window.FirstBiteApi.replaceMealItems(existingMealId, items);
        return rememberMeal(updated, source, recognitionId);
      } catch (error) {
        // 이미 분석된 식사/삭제된 식사/다른 로그인 계정의 오래된 브라우저 상태라면 새 초안을 만든다.
        if (!["MEAL_ALREADY_CONFIRMED", "MEAL_NOT_FOUND", "MEAL_FORBIDDEN"].includes(error.code)) throw error;
      }
    }

    return createDraft(source, recognitionId, items);
  }

  async function prepareResult() {
    link.addEventListener("click", (event) => {
      if (link.getAttribute("aria-disabled") === "true") event.preventDefault();
    });

    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace("login.html?next=menu-confirmed.html");
        return;
      }

      status.textContent = "선택한 메뉴를 저장하고 있습니다.";
      const mealId = await syncMealDraft();

      // 3단계(부담 분석)는 기존 흐름을 유지한다. 2단계에서는 여기까지 식사 초안/보정 API가 확실히 완료된다.
      status.textContent = "식후 부담을 분석하고 있습니다.";
      const analysis = await window.FirstBiteApi.createAnalysis(mealId, true);
      sessionStorage.setItem("firstbite.currentAnalysis", JSON.stringify(analysis));
      link.setAttribute("aria-disabled", "false");
      status.textContent = "메뉴 저장과 분석이 완료되었습니다.";
    } catch (error) {
      status.classList.remove("sr-only");
      status.textContent = error.message || "메뉴를 저장하지 못했습니다.";
      link.textContent = "메뉴 다시 입력";
      link.href = "menu-input.html";
      link.setAttribute("aria-disabled", "false");
    }
  }

  prepareResult();
})();
