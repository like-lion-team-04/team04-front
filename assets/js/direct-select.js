(function () {
  "use strict";
  const results = [
    { foodId: "manual-1", name: "제육볶음 + 공기밥", carb: 72, protein: 22, gi: 58, category: "RICE" },
    { foodId: "manual-2", name: "순두부찌개 + 공기밥", carb: 65, protein: 18, gi: 52, category: "RICE" },
    { foodId: "manual-3", name: "김치찌개 + 공기밥", carb: 70, protein: 15, gi: 56, category: "RICE" },
    { foodId: "manual-4", name: "비빔밥", carb: 75, protein: 14, gi: 61, category: "BOWL_RICE" },
    { foodId: "manual-5", name: "떡볶이", carb: 82, protein: 8, gi: 56, category: "FLOUR" },
    { foodId: "manual-6", name: "잔치국수", carb: 74, protein: 12, gi: 57, category: "NOODLE" },
    { foodId: "manual-7", name: "샌드위치", carb: 48, protein: 15, gi: 49, category: "BREAD" }
  ];
  const selected = [];
  let category = "ALL";
  const resultList = document.querySelector("[data-direct-results]");
  const selectedList = document.querySelector("[data-direct-selected]");
  const search = document.querySelector("[data-direct-search]");
  const next = document.querySelector("[data-direct-next]");
  const reviewList = document.querySelector("[data-review-list]");

  function checkIcon() { return '<i aria-hidden="true">✓</i>'; }
  function filteredResults() {
    const query = search.value.trim().toLowerCase();
    return results.filter((food) => (category === "ALL" || food.category === category) && food.name.toLowerCase().includes(query));
  }
  function renderResults() {
    resultList.innerHTML = filteredResults().map((food) => `
      <button class="direct-food-option ${selected.some((item) => item.foodId === food.foodId) ? "is-selected" : ""}" type="button" data-food-id="${food.foodId}">
        <span><strong>${food.name}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span><em>GI ${food.gi}</em>${checkIcon()}
      </button>`).join("");
  }
  function renderSelected() {
    selectedList.innerHTML = selected.length ? selected.map((food) => `
      <button class="direct-food-option selected-food" type="button" data-remove-id="${food.foodId}">
        <span><strong>${food.name}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span><em>GI ${food.gi}</em>${checkIcon()}
      </button>`).join("") : '<div class="empty-selection"><strong>아직 선택한 메뉴가 없어요.</strong><span>왼쪽 목록에서 메뉴를 선택해주세요.</span></div>';
    next.disabled = selected.length === 0;
  }
  function toggleFood(id) {
    const index = selected.findIndex((food) => food.foodId === id);
    if (index >= 0) selected.splice(index, 1);
    else selected.push({ ...results.find((food) => food.foodId === id), servingMultiplier: 1 });
    renderResults(); renderSelected();
  }
  resultList.addEventListener("click", (event) => { const option = event.target.closest("[data-food-id]"); if (option) toggleFood(option.dataset.foodId); });
  selectedList.addEventListener("click", (event) => { const option = event.target.closest("[data-remove-id]"); if (option) toggleFood(option.dataset.removeId); });
  search.addEventListener("input", renderResults);
  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    category = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item === button));
    renderResults();
  }));

  function pencilIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>'; }
  function trashIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>'; }
  function renderReview() {
    document.querySelector("[data-selected-count]").textContent = selected.length;
    reviewList.innerHTML = selected.map((food, index) => `
      <article class="manual-review-row">
        <div><strong>${food.name}</strong><span>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</span></div>
        <em>GI ${food.gi}</em>
        <select data-review-serving="${index}" aria-label="${food.name} 인분 선택">${[0.5,1,1.5,2].map((amount)=>`<option value="${amount}" ${amount===food.servingMultiplier?"selected":""}>${amount}인분</option>`).join("")}</select>
        <span class="food-divider"></span>
        <button class="icon-button" type="button" data-review-edit="${index}" aria-label="${food.name} 수정">${pencilIcon()}</button>
        <button class="icon-button" type="button" data-review-delete="${index}" aria-label="${food.name} 삭제">${trashIcon()}</button>
      </article>`).join("");
    document.querySelector("[data-manual-confirm]").disabled = selected.length === 0;
  }
  next.addEventListener("click", () => {
    document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "review"));
    renderReview(); window.scrollTo(0, 0);
  });
  reviewList.addEventListener("change", (event) => { if (event.target.matches("[data-review-serving]")) selected[Number(event.target.dataset.reviewServing)].servingMultiplier = Number(event.target.value); });
  reviewList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-review-edit]");
    const remove = event.target.closest("[data-review-delete]");
    if (edit) {
      document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select"));
      renderResults(); renderSelected(); window.scrollTo(0,0); return;
    }
    if (remove) { selected.splice(Number(remove.dataset.reviewDelete),1); renderReview(); }
  });
  document.querySelector("[data-review-add]").addEventListener("click", () => {
    document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select"));
    renderResults(); renderSelected(); window.scrollTo(0,0);
  });
  document.querySelector("[data-manual-confirm]").addEventListener("click", () => {
    sessionStorage.setItem("firstbiteMealSource", "MANUAL");
    sessionStorage.setItem("firstbiteMealItems", JSON.stringify(selected.map(({foodId,servingMultiplier})=>({foodId,servingMultiplier}))));
    window.location.href = "menu-confirmed.html";
  });
  renderResults(); renderSelected();
})();
