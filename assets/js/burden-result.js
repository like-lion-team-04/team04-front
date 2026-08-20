(function () {
  "use strict";

  const fallbackImages = ["spicy-pork.png", "doenjang-stew.png", "rice.png", "rolled-omelet.png", "kimchi.png"];
  const mealId = sessionStorage.getItem("firstbite.currentMealId") || sessionStorage.getItem("firstbiteMealId");
  const addedSideMenusKey = mealId ? `firstbite.addedSideMenus.${mealId}` : "firstbite.addedSideMenus";

  let addedSideMenus = new Map();

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function percent(value) {
    const numeric = number(value);
    return Math.round(numeric * (numeric <= 1 ? 100 : 1));
  }

  function formatNumber(value, digits = 2) {
    const numeric = number(value);
    return numeric.toLocaleString("ko-KR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function image(item, index) {
    return item && item.imageUrl
      ? item.imageUrl
      : `assets/recognition/${fallbackImages[index % fallbackImages.length]}`;
  }

  function readAddedSideMenus() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(addedSideMenusKey) || "[]");
      if (!Array.isArray(saved)) return new Map();
      return new Map(saved.filter((item) => item && item.sideMenuId).map((item) => [item.sideMenuId, item]));
    } catch (_error) {
      return new Map();
    }
  }

  function saveAddedSideMenus() {
    sessionStorage.setItem(addedSideMenusKey, JSON.stringify(Array.from(addedSideMenus.values())));
  }

  function contributionLevel(value) {
    const gl = number(value);
    if (gl <= 10) return "낮음";
    if (gl <= 20) return "보통";
    return "높음";
  }

  function renderAnalysis(analysis) {
    const reliefText = `약 ${percent(analysis.reliefRate)}% 완화`;
    document.querySelector("[data-relief-rate]").textContent = reliefText;

    const levels = { LOW: "낮음", MEDIUM: "보통", HIGH: "높음" };
    document.querySelector(".original-card strong").textContent = levels[analysis.baselineLevel] || "—";
    document.querySelector(".applied-card strong").textContent = levels[analysis.recommendedLevel] || "—";
    document.querySelectorAll(".chart-label .strong").forEach((node) => {
      node.textContent = reliefText;
    });

    const contributions = Array.isArray(analysis.itemContributions) ? analysis.itemContributions : [];
    const totalServings = contributions.reduce((sum, item) => sum + number(item.servingMultiplier), 0);
    const conditions = analysis.comparisonConditions || {};

    const itemCount = document.querySelector("[data-condition-items]");
    const servings = document.querySelector("[data-condition-servings]");
    const personalization = document.querySelector("[data-condition-personalization]");
    if (itemCount) itemCount.textContent = `${contributions.length}개`;
    if (servings) servings.textContent = `${formatNumber(totalServings, 1)}인분`;
    if (personalization) {
      personalization.textContent = conditions.personalizationApplied
        ? `반영됨 (${formatNumber(conditions.personalCoefficient, 2)}×)`
        : "미반영";
    }

    const qualityText = { MEASURED: "실측 중심", MIXED: "실측·추정 혼합", ESTIMATED: "추정 중심" };
    const personalApplied = document.querySelector("[data-personal-applied]");
    const personalCoefficient = document.querySelector("[data-personal-coefficient]");
    const dataQuality = document.querySelector("[data-data-quality]");
    if (personalApplied) personalApplied.textContent = conditions.personalizationApplied ? "반영됨" : "미반영";
    if (personalCoefficient) personalCoefficient.textContent = `${formatNumber(conditions.personalCoefficient || 1, 2)}×`;
    if (dataQuality) dataQuality.textContent = qualityText[analysis.dataQuality] || analysis.dataQuality || "—";

    renderChart(analysis);
    renderSources(analysis.sources || [], analysis.disclaimer);
    return contributions;
  }

  function renderSources(sources, disclaimer) {
    const target = document.querySelector("[data-source-summary]");
    if (!target) return;

    const titles = sources.map((source) => source && source.title).filter(Boolean);
    const sourceText = titles.length ? titles.join("<br>") : "분석 근거 정보가 없습니다.";
    const disclaimerText = disclaimer
      ? `<br><br>${escapeHtml(disclaimer)}`
      : "";

    target.innerHTML = `${titles.length ? sourceText.split("<br>").map(escapeHtml).join("<br>") : escapeHtml(sourceText)}${disclaimerText}`;
  }

  function normalizeChartPoints(points, curve) {
    if (Array.isArray(points) && points.length) {
      return points.map((point, index) => ({
        minute: number(point.minute != null ? point.minute : index * 30),
        value: number(point.value)
      }));
    }
    if (Array.isArray(curve) && curve.length) {
      return curve.map((value, index) => ({ minute: index * 30, value: number(value) }));
    }
    return [];
  }

  function pointCoordinates(points, maxValue) {
    const left = 36;
    const right = 724;
    const top = 28;
    const bottom = 277;
    const minMinute = Math.min(...points.map((point) => point.minute));
    const maxMinute = Math.max(...points.map((point) => point.minute));
    const minuteSpan = Math.max(1, maxMinute - minMinute);
    const valueSpan = Math.max(0.01, maxValue);

    return points.map((point) => ({
      x: left + ((point.minute - minMinute) / minuteSpan) * (right - left),
      y: bottom - (point.value / valueSpan) * (bottom - top)
    }));
  }

  function smoothPath(points) {
    if (!points.length) return "";
    if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

    let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let index = 0; index < points.length - 1; index += 1) {
      const current = points[index];
      const next = points[index + 1];
      const previous = points[index - 1] || current;
      const afterNext = points[index + 2] || next;
      const control1X = current.x + (next.x - previous.x) / 6;
      const control1Y = current.y + (next.y - previous.y) / 6;
      const control2X = next.x - (afterNext.x - current.x) / 6;
      const control2Y = next.y - (afterNext.y - current.y) / 6;
      path += ` C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }
    return path;
  }

  function areaPath(points) {
    if (!points.length) return "";
    const bottom = 277;
    return `${smoothPath(points)} L ${points[points.length - 1].x.toFixed(1)} ${bottom} L ${points[0].x.toFixed(1)} ${bottom} Z`;
  }

  function renderChart(analysis) {
    const baseline = normalizeChartPoints(analysis.baselineChart, analysis.baseline && analysis.baseline.curve);
    const recommended = normalizeChartPoints(analysis.recommendedChart, analysis.recommended && analysis.recommended.curve);
    const allValues = baseline.concat(recommended).map((point) => point.value);
    if (!allValues.length) return;

    const maxValue = Math.max(...allValues, 1);
    const baselineCoordinates = pointCoordinates(baseline, maxValue);
    const recommendedCoordinates = pointCoordinates(recommended, maxValue);

    const baselineArea = document.querySelector("[data-baseline-area]");
    const recommendedArea = document.querySelector("[data-recommended-area]");
    const baselineLine = document.querySelector("[data-baseline-line]");
    const recommendedLine = document.querySelector("[data-recommended-line]");

    if (baselineArea) baselineArea.setAttribute("d", areaPath(baselineCoordinates));
    if (recommendedArea) recommendedArea.setAttribute("d", areaPath(recommendedCoordinates));
    if (baselineLine) baselineLine.setAttribute("d", smoothPath(baselineCoordinates));
    if (recommendedLine) recommendedLine.setAttribute("d", smoothPath(recommendedCoordinates));
  }

  function renderPlan(plan, contributions) {
    const contributionByMealItem = new Map(
      (contributions || []).map((item) => [String(item.mealItemId || ""), item])
    );

    const order = Array.isArray(plan.recommendedOrder) ? plan.recommendedOrder : [];
    const orderTarget = document.querySelector("[data-recommended-order]");
    if (orderTarget) {
      orderTarget.innerHTML = order.length
        ? order.map((item, index) => {
          const contribution = contributionByMealItem.get(String(item.mealItemId || ""));
          const level = contributionLevel(contribution && contribution.recommendedGl);
          return `
            <li>
              <b>${escapeHtml(item.order)}</b>
              <img src="${escapeHtml(image(item, index))}" alt="">
              <span><strong>${escapeHtml(item.name)}</strong><small>${formatNumber(item.servingMultiplier || 1, 1)}인분</small></span>
              <em>GL 기여(상대)<strong>${escapeHtml(level)}</strong></em>
            </li>`;
        }).join("")
        : `<li class="data-empty"><span><strong>추천 순서를 구성할 수 없습니다.</strong></span></li>`;
    }

    const stages = Array.isArray(plan.stages) ? plan.stages : [];
    const stageTarget = document.querySelector("[data-stage-cards]");
    if (stageTarget) {
      stageTarget.innerHTML = stages.length
        ? stages.map((stage) => {
          const names = (stage.items || []).map((item) => item.name).filter(Boolean).join(" · ");
          const minutes = stage.recommendedSeconds == null ? "자유롭게 마무리" : `${Math.round(number(stage.recommendedSeconds) / 60)}분 권장`;
          return `
            <article>
              <b>${escapeHtml(stage.stage)}단계</b>
              <strong>${escapeHtml(names || stage.title || "추천 단계")}</strong>
              <p>${escapeHtml(stage.guide || minutes)}</p>
            </article>`;
        }).join("")
        : `<article><b>안내</b><strong>추천 순서를 구성할 수 없습니다.</strong><p>메뉴 구성을 다시 확인해 주세요.</p></article>`;
    }

    const interval = document.querySelector("[data-order-interval]");
    if (interval) {
      const seconds = stages.map((stage) => stage.recommendedSeconds).filter((value) => value != null);
      if (seconds.length) {
        const minutes = Math.round(number(seconds[0]) / 60);
        interval.textContent = `섭취 간격: 약 ${minutes}분`;
      } else {
        interval.textContent = "섭취 간격: 자유롭게 진행";
      }
    }

    sessionStorage.setItem("firstbite.coachingPlan", JSON.stringify(plan));
  }

  function sideMenuDetail(item) {
    const nutrition = item.nutrition || {};
    const expected = item.expectedEffects || {};
    if (item.nutrientFocus === "PROTEIN") {
      const amount = nutrition.proteinG != null ? nutrition.proteinG : expected.proteinDeltaG;
      return amount != null ? `단백질 ${formatNumber(amount, 1)}g` : (item.reason || "단백질 보완");
    }
    if (item.nutrientFocus === "FIBER") {
      const amount = nutrition.fiberG != null ? nutrition.fiberG : expected.fiberDeltaG;
      return amount != null ? `식이섬유 ${formatNumber(amount, 1)}g` : (item.reason || "식이섬유 보완");
    }
    return item.reason || item.description || "추천 사이드 메뉴";
  }

  function renderSideMenus(recommendations, errorMessage = "") {
    const list = document.querySelector("[data-side-recommendations]");
    if (!list) return;

    const recommendedItems = Array.isArray(recommendations && recommendations.items) ? recommendations.items : [];
    const addedItems = Array.from(addedSideMenus.values());
    const addedIds = new Set(addedItems.map((item) => String(item.sideMenuId)));
    const availableItems = recommendedItems.filter((item) => !addedIds.has(String(item.sideMenuId)));

    const rows = [];
    addedItems.forEach((item) => {
      rows.push(`
        <li class="is-added">
          <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(sideMenuDetail(item))} · 추가됨</small></span>
          <button type="button" data-remove-side-menu="${escapeHtml(item.sideMenuId)}">−　제거</button>
        </li>`);
    });

    availableItems.slice(0, Math.max(0, 3 - rows.length)).forEach((item) => {
      rows.push(`
        <li>
          <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(sideMenuDetail(item))}</small></span>
          <button type="button" data-add-side-menu="${escapeHtml(item.sideMenuId)}">＋　추가</button>
        </li>`);
    });

    if (!rows.length) {
      rows.push(`
        <li class="data-empty">
          <span><strong>${escapeHtml(errorMessage || "현재 식사는 추가 사이드가 필요하지 않아요.")}</strong>
          <small>지금 메뉴만으로 코칭 순서를 진행할 수 있어요.</small></span>
        </li>`);
    }

    list.innerHTML = rows.join("");
  }

  async function ensureAnalysisDetail() {
    try {
      return await window.FirstBiteApi.getAnalysis(mealId);
    } catch (error) {
      if (error && error.code === "ANALYSIS_NOT_FOUND") {
        const created = await window.FirstBiteApi.createAnalysis(mealId, true);
        sessionStorage.setItem("firstbite.currentAnalysis", JSON.stringify(created));
        return window.FirstBiteApi.getAnalysis(mealId);
      }
      throw error;
    }
  }

  async function loadSideRecommendations() {
    try {
      const response = await window.FirstBiteApi.getSideMenuRecommendations(mealId, 3);
      renderSideMenus(response);
      return response;
    } catch (error) {
      if (error && error.code === "SIDE_MENU_NOT_NEEDED") {
        renderSideMenus({ items: [] }, error.message);
        return { items: [] };
      }
      renderSideMenus({ items: [] }, error && error.message ? error.message : "사이드 메뉴 추천을 불러오지 못했습니다.");
      return { items: [] };
    }
  }

  async function refreshCore() {
    if (!mealId) {
      window.location.replace("menu-input.html");
      return false;
    }

    const loggedIn = await window.FirstBiteApi.restoreSession();
    if (!loggedIn) {
      window.location.replace(`login.html?next=${encodeURIComponent("burden-result.html")}`);
      return false;
    }

    const analysis = await ensureAnalysisDetail();
    const contributions = renderAnalysis(analysis);

    let plan;
    try {
      plan = await window.FirstBiteApi.getCoachingPlan(mealId);
    } catch (error) {
      if (error && error.code === "ANALYSIS_REQUIRED") {
        await ensureAnalysisDetail();
        plan = await window.FirstBiteApi.getCoachingPlan(mealId);
      } else {
        throw error;
      }
    }
    renderPlan(plan, contributions);
    await loadSideRecommendations();
    return true;
  }

  async function refreshAfterSideMenuChange() {
    const analysis = await window.FirstBiteApi.getAnalysis(mealId);
    const contributions = renderAnalysis(analysis);
    const plan = await window.FirstBiteApi.getCoachingPlan(mealId);
    renderPlan(plan, contributions);
    await loadSideRecommendations();
  }

  const sideList = document.querySelector("[data-side-recommendations]");
  if (sideList) {
    sideList.addEventListener("click", async (event) => {
      const addButton = event.target.closest("[data-add-side-menu]");
      const removeButton = event.target.closest("[data-remove-side-menu]");
      if (!addButton && !removeButton) return;

      const button = addButton || removeButton;
      button.disabled = true;
      const originalText = button.textContent;

      try {
        if (addButton) {
          const sideMenuId = addButton.dataset.addSideMenu;
          const currentRecommendation = Array.from(document.querySelectorAll("[data-add-side-menu]"))
            .find((node) => node.dataset.addSideMenu === sideMenuId);
          const row = currentRecommendation && currentRecommendation.closest("li");
          const name = row && row.querySelector("strong") ? row.querySelector("strong").textContent : "사이드 메뉴";
          const detail = row && row.querySelector("small") ? row.querySelector("small").textContent : "";

          await window.FirstBiteApi.addSideMenu(mealId, sideMenuId, 1);
          addedSideMenus.set(sideMenuId, {
            sideMenuId,
            name,
            reason: detail
          });
          saveAddedSideMenus();
        } else {
          const sideMenuId = removeButton.dataset.removeSideMenu;
          await window.FirstBiteApi.removeSideMenu(mealId, sideMenuId);
          addedSideMenus.delete(sideMenuId);
          saveAddedSideMenus();
        }

        await refreshAfterSideMenuChange();
      } catch (error) {
        button.disabled = false;
        button.textContent = error && error.message ? error.message : "다시 시도";
        window.setTimeout(() => {
          button.textContent = originalText;
        }, 2200);
      }
    });
  }

  addedSideMenus = readAddedSideMenus();

  refreshCore().catch((error) => {
    const message = error && error.message ? error.message : "분석 결과를 불러오지 못했습니다.";
    const heading = document.querySelector(".burden-heading p");
    if (heading) heading.textContent = message;
    renderSideMenus({ items: [] }, "사이드 메뉴를 확인할 수 없습니다.");
  });
})();
