(function () {
  "use strict";

  const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");
  const PREVIEW_KEY = "firstbite.sideMenuPreview";

  if (!MOBILE_QUERY.matches || !document.querySelector("[data-mobile-side-view]")) return;

  const body = document.body;
  const directView = document.querySelector('[data-mobile-side-view="direct"]');
  const searchView = document.querySelector('[data-mobile-side-view="search"]');
  const previewView = document.querySelector('[data-mobile-side-view="preview"]');
  const bottomNav = document.querySelector(".mobile-side-bottom-nav");
  const mealId = sessionStorage.getItem("firstbite.currentMealId") || sessionStorage.getItem("firstbiteMealId");
  const params = new URLSearchParams(window.location.search);
  const requestedMode = params.get("mode") || "direct";
  const previewSideMenuId = params.get("sideMenuId") || "";

  let selectedSideMenu = null;
  let searchTimer = null;
  let currentCategory = "";
  let currentCategoryLabel = "전체";

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value, digits = 1) {
    if (value === null || value === undefined || value === "") return "—";
    return number(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
  }

  function formatGram(value) {
    return value === null || value === undefined ? "—" : `${formatNumber(value, 1)}g`;
  }

  function formatMg(value) {
    return value === null || value === undefined ? "—" : `${formatNumber(value, 0)}mg`;
  }

  function formatKcal(value) {
    return value === null || value === undefined ? "—" : `약 ${formatNumber(value, 0)} kcal`;
  }

  function percent(value) {
    if (value === null || value === undefined) return "—";
    const numeric = number(value);
    const pct = numeric <= 1 ? numeric * 100 : numeric;
    return `약 ${Math.round(pct)}% 완화`;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    }[char]));
  }

  function localImageForName(name, index = 0) {
    const text = String(name || "");
    if (/계란|달걀/.test(text)) return "assets/side-menu/rolled-omelet.png";
    if (/제육|돼지|불고기/.test(text)) return "assets/side-menu/spicy-pork.png";
    if (/된장/.test(text)) return "assets/side-menu/doenjang-stew.png";
    if (/시금치|채소|김치|샐러드|양배추/.test(text)) return "assets/side-menu/cabbage-salad.png";
    if (/밥|쌀/.test(text)) return "assets/side-menu/rice.png";
    const fallbacks = [
      "assets/side-menu/cabbage-salad.png",
      "assets/side-menu/rolled-omelet.png",
      "assets/side-menu/spinach.png"
    ];
    return fallbacks[index % fallbacks.length];
  }

  function imageFor(item, index = 0) {
    return item && item.imageUrl ? item.imageUrl : localImageForName(item && item.name, index);
  }

  function showView(name) {
    directView.hidden = name !== "direct";
    searchView.hidden = name !== "search";
    previewView.hidden = name !== "preview";
    body.classList.toggle("side-mobile-direct", name === "direct");
    body.classList.toggle("side-mobile-search", name === "search");
    body.classList.toggle("side-mobile-preview", name === "preview");
    if (bottomNav) bottomNav.hidden = name !== "direct";
    window.scrollTo(0, 0);
  }

  async function requireSession() {
    const authenticated = await window.FirstBiteApi.restoreSession();
    if (!authenticated) {
      const next = `side-menu.html${window.location.search || ""}`;
      window.location.replace(`login.html?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }

  async function getPlan() {
    try {
      return await window.FirstBiteApi.getCoachingPlan(mealId);
    } catch (error) {
      if (error && error.code === "ANALYSIS_REQUIRED") {
        await window.FirstBiteApi.createAnalysis(mealId, true);
        return window.FirstBiteApi.getCoachingPlan(mealId);
      }
      throw error;
    }
  }

  function renderCurrentOrder(plan) {
    const list = document.querySelector("[data-mobile-side-current-order]");
    const interval = document.querySelector("[data-mobile-side-current-interval]");
    if (!list) return;

    const items = Array.isArray(plan && plan.recommendedOrder) ? plan.recommendedOrder : [];
    if (!items.length) {
      list.innerHTML = '<li class="is-empty">현재 식사 순서를 확인할 수 없어요.</li>';
    } else {
      list.innerHTML = items.map((item, index) => `
        <li>
          <b>${escapeHtml(item.order || index + 1)}</b>
          <img src="${escapeHtml(imageFor(item, index))}" alt="">
          <span><strong>${escapeHtml(item.name || "메뉴")}</strong><small>${formatNumber(item.servingMultiplier || 1, 1)}인분</small></span>
        </li>`).join("");
    }

    const stages = Array.isArray(plan && plan.stages) ? plan.stages : [];
    const seconds = stages.map((stage) => stage.recommendedSeconds).filter((value) => value != null && number(value) > 0);
    if (interval) {
      interval.textContent = seconds.length
        ? `섭취 간 간격: 약 ${Math.max(1, Math.round(number(seconds[0]) / 60))}~10분`
        : "섭취 간 간격: 자유롭게 진행";
    }
  }

  async function loadDirectView() {
    const status = document.querySelector("[data-mobile-side-status]");
    if (!mealId) {
      if (status) status.textContent = "식사 정보가 없어 메뉴 입력 화면으로 이동합니다.";
      window.setTimeout(() => window.location.replace("menu-input.html"), 600);
      return;
    }
    try {
      const plan = await getPlan();
      renderCurrentOrder(plan);
      if (status) status.textContent = "";
    } catch (error) {
      const list = document.querySelector("[data-mobile-side-current-order]");
      if (list) list.innerHTML = '<li class="is-empty">현재 식사 순서를 불러오지 못했어요.</li>';
      if (status) status.textContent = error && error.message ? error.message : "현재 식사 순서를 불러오지 못했어요.";
    }
  }

  function renderSearchItems(response) {
    const list = document.querySelector("[data-mobile-side-search-list]");
    if (!list) return;
    const items = Array.isArray(response && response.items) ? response.items : [];
    if (!items.length) {
      list.innerHTML = '<p class="mobile-side-search-empty">조건에 맞는 사이드 메뉴가 없어요.</p>';
      return;
    }

    list.innerHTML = items.map((item) => {
      const selected = selectedSideMenu && String(selectedSideMenu.sideMenuId) === String(item.sideMenuId);
      return `
        <button type="button" class="mobile-side-search-item${selected ? " is-selected" : ""}" data-mobile-side-item="${escapeHtml(item.sideMenuId)}">
          <span><strong>${escapeHtml(item.name || "사이드 메뉴")}</strong><small>탄수화물 ${formatNumber(item.carbohydrateG, 1)}g　·　단백질 ${formatNumber(item.proteinG, 1)}g</small></span>
          <em>${item.gi == null ? "GI —" : `GI ${formatNumber(item.gi, 0)}`}</em>
          <i>✓</i>
        </button>`;
    }).join("");

    list.querySelectorAll("[data-mobile-side-item]").forEach((button) => {
      button.addEventListener("click", () => {
        const item = items.find((candidate) => String(candidate.sideMenuId) === button.dataset.mobileSideItem);
        selectedSideMenu = item || null;
        renderSearchItems(response);
        updateSelectButton();
      });
    });
  }

  async function runSearch() {
    const input = document.querySelector("[data-mobile-side-query]");
    const status = document.querySelector("[data-mobile-side-search-status]");
    const list = document.querySelector("[data-mobile-side-search-list]");
    const summary = document.querySelector("[data-mobile-side-category-label]");
    if (summary) summary.textContent = currentCategoryLabel;
    if (list) list.innerHTML = '<p class="mobile-side-search-empty">사이드 메뉴를 불러오고 있어요.</p>';
    if (status) status.textContent = "";

    try {
      const response = await window.FirstBiteApi.searchSideMenus({
        query: input ? input.value.trim() : "",
        category: currentCategory,
        activeOnly: true,
        page: 0,
        size: 20
      });
      renderSearchItems(response || { items: [] });
    } catch (error) {
      if (list) list.innerHTML = '<p class="mobile-side-search-empty">사이드 메뉴를 불러오지 못했어요.</p>';
      if (status) status.textContent = error && error.message ? error.message : "사이드 메뉴를 불러오지 못했어요.";
    }
  }

  function queueSearch() {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(runSearch, 220);
  }

  function updateSelectButton() {
    const button = document.querySelector("[data-mobile-side-select-complete]");
    if (button) button.disabled = !selectedSideMenu;
  }

  function persistAddedSideMenu(item) {
    if (!mealId || !item || !item.sideMenuId) return;
    const key = `firstbite.addedSideMenus.${mealId}`;
    let items = [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "[]");
      items = Array.isArray(saved) ? saved : [];
    } catch (_error) {
      items = [];
    }
    const filtered = items.filter((saved) => String(saved.sideMenuId) !== String(item.sideMenuId));
    filtered.push({
      sideMenuId: item.sideMenuId,
      name: item.name || "사이드 메뉴",
      reason: item.reason || item.description || "추가됨",
      nutrientFocus: item.nutrientFocus || ""
    });
    sessionStorage.setItem(key, JSON.stringify(filtered));
  }

  async function addSelectedSideMenu(item, button, statusNode) {
    if (!mealId || !item || !item.sideMenuId) return;
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "추가 중...";
    if (statusNode) statusNode.textContent = "";
    try {
      await window.FirstBiteApi.addSideMenu(mealId, item.sideMenuId, 1);
      persistAddedSideMenu(item);
      window.location.replace("burden-result.html");
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      if (statusNode) statusNode.textContent = error && error.message ? error.message : "사이드 메뉴를 추가하지 못했어요.";
    }
  }

  function renderPreview(item) {
    const nutrition = item && item.nutrition ? item.nutrition : {};
    const effects = item && item.expectedEffects ? item.expectedEffects : {};
    const reasons = Array.isArray(item && item.reasons) ? item.reasons : [];

    const image = document.querySelector("[data-mobile-preview-image]");
    if (image) {
      image.src = imageFor(item, 0);
      image.alt = item && item.name ? item.name : "사이드 메뉴";
    }
    const set = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };
    set("[data-mobile-preview-name]", item && item.name ? item.name : "사이드 메뉴");
    set("[data-mobile-preview-description]", item && (item.description || item.reason) ? (item.description || item.reason) : "추천 정보를 확인해주세요.");
    set("[data-mobile-preview-serving]", nutrition.servingDescription || "1인분 기준");
    set("[data-mobile-preview-protein]", formatGram(nutrition.proteinG));
    set("[data-mobile-preview-fat]", formatGram(nutrition.fatG));
    set("[data-mobile-preview-sodium]", formatMg(nutrition.sodiumMg));
    set("[data-mobile-preview-carb]", formatGram(nutrition.carbohydrateG));
    set("[data-mobile-preview-fiber]", formatGram(nutrition.fiberG));
    set("[data-mobile-preview-calorie]", formatKcal(nutrition.calorieKcal));
    set("[data-mobile-preview-relief]", percent(effects.reliefRateDelta != null ? effects.reliefRateDelta : item.expectedReliefDelta));
    set("[data-mobile-preview-fiber-delta]", effects.fiberDeltaG == null ? "—" : `+${formatNumber(effects.fiberDeltaG, 1)}g`);
    set("[data-mobile-preview-protein-delta]", effects.proteinDeltaG == null ? "—" : `+${formatNumber(effects.proteinDeltaG, 1)}g`);
    set("[data-mobile-preview-estimated]", effects.estimated === false ? "현재 메뉴 기준 계산값 입니다." : "현재 메뉴 기준 예측치 입니다.");

    const reasonsNode = document.querySelector("[data-mobile-preview-reasons]");
    if (reasonsNode) {
      const normalized = reasons.length ? reasons : (item && item.reason ? [{ title: item.reason, description: "" }] : []);
      reasonsNode.innerHTML = normalized.length ? normalized.map((reason) => `
        <article><i>✓</i><div><strong>${escapeHtml(reason.title || "추천 이유")}</strong>${reason.description ? `<p>${escapeHtml(reason.description)}</p>` : ""}</div></article>`).join("")
        : '<p class="mobile-side-reason-empty">추천 이유 정보가 제공되지 않았어요.</p>';
    }

    const addButton = document.querySelector("[data-mobile-preview-add]");
    if (addButton) addButton.disabled = !(item && item.sideMenuId);
  }

  async function loadPreview() {
    let item = null;
    try {
      const saved = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || "null");
      if (saved && (!previewSideMenuId || String(saved.sideMenuId) === String(previewSideMenuId))) item = saved;
    } catch (_error) {
      item = null;
    }

    if (!item && mealId) {
      try {
        const response = await window.FirstBiteApi.getSideMenuRecommendations(mealId, 3);
        const items = Array.isArray(response && response.items) ? response.items : [];
        item = items.find((candidate) => String(candidate.sideMenuId) === String(previewSideMenuId)) || null;
      } catch (_error) {
        item = null;
      }
    }

    const status = document.querySelector("[data-mobile-preview-status]");
    if (!item) {
      if (status) status.textContent = "사이드 메뉴 상세 정보를 불러오지 못했어요.";
      renderPreview(null);
      return;
    }
    sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(item));
    renderPreview(item);
    if (status) status.textContent = "";
  }

  document.querySelector("[data-mobile-side-search-open]")?.addEventListener("click", () => {
    selectedSideMenu = null;
    updateSelectButton();
    showView("search");
    runSearch();
  });

  document.querySelector("[data-mobile-side-search-back]")?.addEventListener("click", () => {
    selectedSideMenu = null;
    updateSelectButton();
    showView("direct");
  });

  document.querySelector("[data-mobile-side-preview-back]")?.addEventListener("click", () => {
    window.location.href = "burden-result.html";
  });

  document.querySelector("[data-mobile-side-query]")?.addEventListener("input", queueSearch);

  document.querySelectorAll("[data-mobile-side-category]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-mobile-side-category]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
      currentCategory = button.dataset.mobileSideCategory || "";
      currentCategoryLabel = button.textContent.trim() || "전체";
      selectedSideMenu = null;
      updateSelectButton();
      runSearch();
    });
  });

  document.querySelector("[data-mobile-side-select-complete]")?.addEventListener("click", (event) => {
    if (!selectedSideMenu) return;
    addSelectedSideMenu(selectedSideMenu, event.currentTarget, document.querySelector("[data-mobile-side-search-status]"));
  });

  document.querySelector("[data-mobile-preview-add]")?.addEventListener("click", (event) => {
    let item = null;
    try { item = JSON.parse(sessionStorage.getItem(PREVIEW_KEY) || "null"); } catch (_error) { item = null; }
    if (!item) return;
    addSelectedSideMenu(item, event.currentTarget, document.querySelector("[data-mobile-preview-status]"));
  });

  (async function init() {
    try {
      if (!(await requireSession())) return;
      if (!mealId) {
        window.location.replace("menu-input.html");
        return;
      }
      if (requestedMode === "preview") {
        showView("preview");
        await loadPreview();
      } else {
        showView("direct");
        await loadDirectView();
      }
    } catch (error) {
      const status = document.querySelector("[data-mobile-side-status]");
      if (status) status.textContent = error && error.message ? error.message : "화면을 불러오지 못했어요.";
    }
  })();
})();
