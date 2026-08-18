(function () {
  "use strict";
  const api = window.FirstBiteAPI;
  let results = [];
  const selected = [];
  let category = "ALL";
  let searchTimer = null;
  const resultList = document.querySelector("[data-direct-results]");
  const selectedList = document.querySelector("[data-direct-selected]");
  const search = document.querySelector("[data-direct-search]");
  const next = document.querySelector("[data-direct-next]");
  const reviewList = document.querySelector("[data-review-list]");
  const escapeHtml = (value) => String(value || "").replace(/[&<>'\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" }[character]));
  const nutrients = (food) => food.carbohydrateG == null && food.proteinG == null ? `${food.category || "기타"}　·　기본 ${food.defaultServing || 1}인분` : `탄수화물 ${food.carbohydrateG || 0}g　·　단백질 ${food.proteinG || 0}g`;
  const giText = (food) => food.gi == null ? "GI -" : `GI ${food.gi}`;
  function checkIcon() { return '<i aria-hidden="true">✓</i>'; }
  function renderResults(message) {
    if (message) { resultList.innerHTML = `<div class="empty-selection"><strong>${escapeHtml(message)}</strong></div>`; return; }
    resultList.innerHTML = results.map((food) => `<button class="direct-food-option ${selected.some((item) => item.foodId === food.foodId) ? "is-selected" : ""}" type="button" data-food-id="${escapeHtml(food.foodId)}"><span><strong>${escapeHtml(food.name)}</strong><small>${escapeHtml(nutrients(food))}</small></span><em>${escapeHtml(giText(food))}</em>${checkIcon()}</button>`).join("") || '<div class="empty-selection"><strong>검색 결과가 없어요.</strong></div>';
  }
  async function loadFoods() {
    renderResults("메뉴를 불러오는 중이에요.");
    try {
      const apiCategory = category === "BOWL_RICE" ? "RICE" : category;
      const data = await api.getFoods({ query: search.value.trim(), category: apiCategory, size: 50 });
      results = Array.isArray(data) ? data : (data.items || []);
      renderResults();
    } catch (error) { renderResults(error.message || "메뉴를 불러오지 못했어요."); }
  }
  function renderSelected() {
    selectedList.innerHTML = selected.length ? selected.map((food) => `<button class="direct-food-option selected-food" type="button" data-remove-id="${escapeHtml(food.foodId)}"><span><strong>${escapeHtml(food.name)}</strong><small>${escapeHtml(nutrients(food))}</small></span><em>${escapeHtml(giText(food))}</em>${checkIcon()}</button>`).join("") : '<div class="empty-selection"><strong>아직 선택한 메뉴가 없어요.</strong><span>왼쪽 목록에서 메뉴를 선택해주세요.</span></div>';
    next.disabled = selected.length === 0;
  }
  function toggleFood(id) {
    const index = selected.findIndex((food) => food.foodId === id);
    if (index >= 0) selected.splice(index, 1);
    else { const food = results.find((item) => item.foodId === id); if (food) selected.push({ ...food, servingMultiplier: 1 }); }
    renderResults(); renderSelected();
  }
  resultList.addEventListener("click", (event) => { const option = event.target.closest("[data-food-id]"); if (option) toggleFood(option.dataset.foodId); });
  selectedList.addEventListener("click", (event) => { const option = event.target.closest("[data-remove-id]"); if (option) toggleFood(option.dataset.removeId); });
  search.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadFoods, 300); });
  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => { category = button.dataset.category; document.querySelectorAll("[data-category]").forEach((item) => item.classList.toggle("is-active", item === button)); loadFoods(); }));
  function pencilIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>'; }
  function trashIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>'; }
  function renderReview() {
    document.querySelector("[data-selected-count]").textContent = selected.length;
    reviewList.innerHTML = selected.map((food, index) => `<article class="manual-review-row"><div><strong>${escapeHtml(food.name)}</strong><span>${escapeHtml(nutrients(food))}</span></div><em>${escapeHtml(giText(food))}</em><select data-review-serving="${index}" aria-label="${escapeHtml(food.name)} 인분 선택">${[0.5,1,1.5,2].map((amount)=>`<option value="${amount}" ${amount===food.servingMultiplier?"selected":""}>${amount}인분</option>`).join("")}</select><span class="food-divider"></span><button class="icon-button" type="button" data-review-edit="${index}" aria-label="수정">${pencilIcon()}</button><button class="icon-button" type="button" data-review-delete="${index}" aria-label="삭제">${trashIcon()}</button></article>`).join("");
    document.querySelector("[data-manual-confirm]").disabled = selected.length === 0;
  }
  next.addEventListener("click", () => { document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "review")); renderReview(); window.scrollTo(0, 0); });
  reviewList.addEventListener("change", (event) => { if (event.target.matches("[data-review-serving]")) selected[Number(event.target.dataset.reviewServing)].servingMultiplier = Number(event.target.value); });
  reviewList.addEventListener("click", (event) => { const edit = event.target.closest("[data-review-edit]"); const remove = event.target.closest("[data-review-delete]"); if (edit) { document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select")); loadFoods(); renderSelected(); window.scrollTo(0,0); return; } if (remove) { selected.splice(Number(remove.dataset.reviewDelete),1); renderReview(); } });
  document.querySelector("[data-review-add]").addEventListener("click", () => { document.querySelectorAll("[data-direct-stage]").forEach((stage) => stage.classList.toggle("is-active", stage.dataset.directStage === "select")); loadFoods(); renderSelected(); window.scrollTo(0,0); });
  document.querySelector("[data-manual-confirm]").addEventListener("click", async (event) => {
    const button = event.currentTarget; button.disabled = true;
    try { const meal = await api.createMeal({ source: "MANUAL", items: selected.map(({ foodId, servingMultiplier }) => ({ foodId, servingMultiplier })) }); sessionStorage.setItem("firstbiteMealId", meal.mealId); window.location.href = "menu-confirmed.html"; }
    catch (error) { window.alert(error.message || "메뉴를 저장하지 못했습니다."); button.disabled = false; }
  });
  loadFoods(); renderSelected();
})();
