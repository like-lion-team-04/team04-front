(function () {
  "use strict";

  const resultList = document.querySelector("[data-direct-results]");
  const selectedList = document.querySelector("[data-direct-selected]");
  const search = document.querySelector("[data-direct-search]");
  const next = document.querySelector("[data-direct-next]");
  const reviewList = document.querySelector("[data-review-list]");
  const confirmButton = document.querySelector("[data-manual-confirm]");
  const resultLabel = document.querySelector(".direct-columns > section:first-child .column-label");

  if (!resultList || !selectedList || !search || !next || !reviewList || !confirmButton) return;

  let results = [];
  const selected = [];
  let category = "ALL";
  let searchTimer;
  let requestSerial = 0;
  let loading = false;

  const categoryMap = {
    ALL: null,
    RICE: "RICE",
    NOODLE: "NOODLE",
    FLOUR: "BUNSIK",
    BOWL_RICE: "RICE_BOWL",
    BREAD: "BREAD"
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
  }

  function mapFood(food) {
    return {
      foodId: food.foodId,
      name: food.name,
      carb: Number(food.carbohydrateG || 0),
      protein: Number(food.proteinG || 0),
      gi: Number(food.gi || 0),
      category: food.category,
      servingMultiplier: Number(food.defaultServing || 1)
    };
  }

  function checkIcon() {
    return '<i aria-hidden="true">✓</i>';
  }

  function emptyState(title, description) {
    return `<div class="empty-selection"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`;
  }

  function updateResultLabel(total) {
    if (!resultLabel) return;
    const categoryName = document.querySelector("[data-category].is-active")?.textContent?.trim() || "전체";
    resultLabel.textContent = `검색결과　·　${categoryName}${Number.isFinite(total) ? ` (${total})` : ""}`;
  }

  function renderResults(message) {
    if (message) {
      resultList.innerHTML = emptyState(message.title, message.description);
      return;
    }

    if (!results.length) {
      resultList.innerHTML = emptyState("검색 결과가 없어요.", "다른 메뉴명이나 카테고리로 찾아보세요.");
      return;
    }

    resultList.innerHTML = results.map((food) => `
      <button class="direct-food-option ${selected.some((item) => item.foodId === food.foodId) ? "is-selected" : ""}" type="button" data-food-id="${escapeHtml(food.foodId)}">
        <span><strong>${escapeHtml(food.name)}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span><em>GI ${food.gi}</em>${checkIcon()}
      </button>`).join("");
  }

  function renderSelected() {
    selectedList.innerHTML = selected.length ? selected.map((food) => `
      <button class="direct-food-option selected-food" type="button" data-remove-id="${escapeHtml(food.foodId)}">
        <span><strong>${escapeHtml(food.name)}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span><em>GI ${food.gi}</em>${checkIcon()}
      </button>`).join("") : emptyState("아직 선택한 메뉴가 없어요.", "왼쪽 목록에서 메뉴를 선택해주세요.");
    next.disabled = selected.length === 0 || loading;
  }

  async function ensureAuthenticated() {
    if (!window.FirstBiteApi) return false;
    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace("login.html?next=direct-select.html");
        return false;
      }
      return true;
    } catch (error) {
      renderResults({
        title: "로그인 상태를 확인하지 못했어요.",
        description: error.message || "잠시 후 다시 시도해 주세요."
      });
      return false;
    }
  }

  async function loadFoods() {
    const serial = ++requestSerial;
    loading = true;
    next.disabled = true;
    renderResults({ title: "메뉴를 불러오는 중이에요.", description: "잠시만 기다려주세요." });

    try {
      const response = await window.FirstBiteApi.searchFoods({
        query: search.value.trim(),
        category: categoryMap[category],
        page: 1,
        size: 50
      });
      if (serial !== requestSerial) return;
      results = (response.items || []).map(mapFood).filter((food) => isUuid(food.foodId));
      updateResultLabel(response.meta ? Number(response.meta.totalElements) : results.length);
      renderResults();
    } catch (error) {
      if (serial !== requestSerial) return;
      results = [];
      updateResultLabel();
      if (error && error.status === 401) {
        window.location.replace("login.html?next=direct-select.html");
        return;
      }
      renderResults({
        title: "메뉴를 불러오지 못했어요.",
        description: error.message || "서버 연결을 확인한 뒤 다시 검색해 주세요."
      });
    } finally {
      if (serial === requestSerial) {
        loading = false;
        renderSelected();
      }
    }
  }

  function toggleFood(id) {
    const index = selected.findIndex((food) => food.foodId === id);
    if (index >= 0) {
      selected.splice(index, 1);
    } else {
      const found = results.find((food) => food.foodId === id);
      if (!found || !isUuid(found.foodId)) return;
      selected.push({ ...found, servingMultiplier: 1 });
    }
    renderResults();
    renderSelected();
  }

  resultList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-food-id]");
    if (option) toggleFood(option.dataset.foodId);
  });

  selectedList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-remove-id]");
    if (option) toggleFood(option.dataset.removeId);
  });

  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(loadFoods, 250);
  });

  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    category = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item === button));
    loadFoods();
  }));

  function pencilIcon() {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
  }

  function renderReview() {
    document.querySelector("[data-selected-count]").textContent = selected.length;
    reviewList.innerHTML = selected.length ? selected.map((food, index) => `
      <article class="manual-review-row">
        <div><strong>${escapeHtml(food.name)}</strong><span>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</span></div>
        <em>GI ${food.gi}</em>
        <select data-review-serving="${index}" aria-label="${escapeHtml(food.name)} 인분 선택">${[0.5, 1, 1.5, 2].map((amount) => `<option value="${amount}" ${amount === food.servingMultiplier ? "selected" : ""}>${amount}인분</option>`).join("")}</select>
        <span class="food-divider"></span>
        <button class="icon-button" type="button" data-review-edit="${index}" aria-label="${escapeHtml(food.name)} 수정">${pencilIcon()}</button>
        <button class="icon-button" type="button" data-review-delete="${index}" aria-label="${escapeHtml(food.name)} 삭제">${trashIcon()}</button>
      </article>`).join("") : emptyState("선택한 메뉴가 없어요.", "메뉴를 다시 선택해주세요.");
    confirmButton.disabled = selected.length === 0;
  }

  next.addEventListener("click", () => {
    if (!selected.length) return;
    document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "review"));
    renderReview();
    window.scrollTo(0, 0);
  });

  reviewList.addEventListener("change", (event) => {
    if (!event.target.matches("[data-review-serving]")) return;
    selected[Number(event.target.dataset.reviewServing)].servingMultiplier = Number(event.target.value);
  });

  reviewList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-review-edit]");
    const remove = event.target.closest("[data-review-delete]");
    if (edit) {
      document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select"));
      renderResults();
      renderSelected();
      window.scrollTo(0, 0);
      return;
    }
    if (remove) {
      selected.splice(Number(remove.dataset.reviewDelete), 1);
      renderReview();
    }
  });

  document.querySelector("[data-review-add]").addEventListener("click", () => {
    document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select"));
    renderResults();
    renderSelected();
    window.scrollTo(0, 0);
  });

  confirmButton.addEventListener("click", async () => {
    if (!selected.length || selected.some((item) => !isUuid(item.foodId))) return;
    const loggedIn = await ensureAuthenticated();
    if (!loggedIn) return;

    sessionStorage.setItem("firstbiteMealSource", "MANUAL");
    sessionStorage.setItem("firstbiteMealItems", JSON.stringify(selected.map(({ foodId, servingMultiplier }) => ({ foodId, servingMultiplier }))));
    sessionStorage.removeItem("firstbiteRecognitionId");
    sessionStorage.removeItem("firstbite.currentAnalysis");
    window.location.href = "menu-confirmed.html";
  });

  async function init() {
    renderSelected();
    const loggedIn = await ensureAuthenticated();
    if (!loggedIn) return;

    // 화면에 특정 사용자 이름을 하드코딩하지 않고 현재 로그인 계정 정보를 사용한다.
    const nameTarget = document.querySelector("[data-direct-user-name]");
    if (nameTarget) {
      window.FirstBiteApi.getMe()
        .then((account) => {
          nameTarget.textContent = account && account.name ? account.name : "회원";
        })
        .catch(() => {
          nameTarget.textContent = "회원";
        });
    }

    await loadFoods();
  }

  init();
})();
