(function () {
  "use strict";

  const app = document.querySelector("[data-recognition-app]");
  if (!app) return;

  const views = [...document.querySelectorAll("[data-view]")];
  const fileInput = document.querySelector("#food-photo");
  const dropZone = document.querySelector("[data-drop-zone]");
  const preview = document.querySelector("[data-upload-preview]");
  const addPhoto = document.querySelector("[data-add-photo]");
  const uploadError = document.querySelector("[data-upload-error]");
  const startButton = document.querySelector("[data-start-recognition]");
  const foodList = document.querySelector("[data-food-list]");
  const modal = document.querySelector("[data-food-modal]");
  const pickerList = document.querySelector("[data-picker-list]");
  const pickerComplete = document.querySelector("[data-picker-complete]");
  const foodSearch = document.querySelector("[data-food-search]");
  const pickerSummary = document.querySelector(".picker-summary");
  const confirmResult = document.querySelector("[data-confirm-result]");
  const recognizedTab = document.querySelector('[data-result-tab="recognized"]');
  const lowTab = document.querySelector('[data-result-tab="low"]');
  const mobilePhotoFlow = document.querySelector("[data-mobile-photo-flow]");
  const mobilePhotoArtwork = document.querySelector("[data-mobile-photo-artwork]");
  const mobilePhotoBack = document.querySelector("[data-mobile-photo-back]");
  const mobilePhotoGuideConfirm = document.querySelector("[data-mobile-photo-guide-confirm]");
  const mobilePhotoAdd = document.querySelector("[data-mobile-photo-add]");
  const mobilePhotoGallery = document.querySelector("[data-mobile-photo-gallery]");
  const mobilePhotoCamera = document.querySelector("[data-mobile-photo-camera]");
  const mobilePhotoSourceConfirm = document.querySelector("[data-mobile-photo-source-confirm]");
  const mobilePhotoConfirm = document.querySelector("[data-mobile-photo-confirm]");
  const cameraInput = document.querySelector("#food-photo-camera");
  const mobileProcessingBack = document.querySelector("[data-mobile-processing-back]");

  const assets = "assets/recognition/";
  const fallbackImages = ["spicy-pork.png", "doenjang-stew.png", "rice.png", "rolled-omelet.png", "kimchi.png"];
  const categoryNames = { ALL: "전체", RICE: "밥류", NOODLE: "면류", BUNSIK: "분식류", RICE_BOWL: "덮밥류", BREAD: "빵류" };

  let recognizedFoods = [];
  let candidates = [];
  let currentTab = "recognized";
  let editClientId = null;
  let selectedCandidate = null;
  let selectedFile = null;
  let pickerCategory = "ALL";
  let candidateSearchTimer;
  let candidateRequestSerial = 0;
  let manualSequence = 0;

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

  function nextManualId() {
    manualSequence += 1;
    return `manual-${Date.now()}-${manualSequence}`;
  }

  function imageFor(index) {
    return assets + fallbackImages[index % fallbackImages.length];
  }

  function mapCandidate(candidate, fallbackName, index = 0) {
    return {
      foodId: candidate.foodId || null,
      name: candidate.name || fallbackName || "확인이 필요한 메뉴",
      carb: Number(candidate.carbohydrateG || 0),
      protein: Number(candidate.proteinG || 0),
      gi: Number(candidate.gi || 0),
      image: imageFor(index),
      servingMultiplier: 1
    };
  }

  function applyRecognition(result) {
    const items = Array.isArray(result.items) ? result.items : [];
    recognizedFoods = items.map((item, index) => {
      const candidate = Array.isArray(item.candidates) ? item.candidates[0] : null;
      const mapped = candidate
        ? mapCandidate(candidate, item.recognizedName, index)
        : {
            foodId: null,
            name: item.recognizedName || "확인이 필요한 메뉴",
            carb: 0,
            protein: 0,
            gi: 0,
            image: imageFor(index),
            servingMultiplier: 1
          };

      return {
        ...mapped,
        clientId: item.temporaryItemId || `recognized-${index + 1}`,
        servingMultiplier: [0.5, 1, 1.5, 2].includes(Number(item.estimatedServing)) ? Number(item.estimatedServing) : 1,
        needsConfirmation: Boolean(item.needsConfirmation || item.confidenceLevel === "LOW" || !candidate),
        recognizedName: item.recognizedName || mapped.name
      };
    });

    if (!recognizedFoods.length) {
      throw new Error("인식된 메뉴가 없습니다. 다른 사진을 사용하거나 메뉴를 직접 선택해 주세요.");
    }

    sessionStorage.setItem("firstbiteRecognitionWarnings", JSON.stringify(result.warnings || []));
  }

  function setProgress(progress) {
    document.querySelector("[data-progress-ring]").style.setProperty("--progress", progress * 3.6 + "deg");
    document.querySelector("[data-progress]").textContent = progress + "%";
  }

  async function waitForRecognition(recognitionId) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const result = await window.FirstBiteApi.getRecognition(recognitionId);
      setProgress(Math.min(95, 25 + attempt * 2));
      if (result.status === "COMPLETED") return result;
      if (result.status === "FAILED") throw new Error(result.error?.message || "사진 인식에 실패했습니다.");
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
    }
    throw new Error("사진 인식 시간이 초과되었습니다. 다시 시도해 주세요.");
  }

  function setView(name) {
    views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
    document.body.classList.toggle("is-processing", name === "processing");
    document.body.dataset.recognitionView = name;
    window.scrollTo(0, 0);
  }

  async function ensureAuthenticated() {
    if (!window.FirstBiteApi) return false;
    try {
      const loggedIn = await window.FirstBiteApi.restoreSession();
      if (!loggedIn) {
        window.location.replace("login.html?next=photo-recognition.html");
        return false;
      }
      return true;
    } catch (error) {
      uploadError.textContent = error.message || "로그인 상태를 확인하지 못했습니다.";
      return false;
    }
  }

  const mobilePhotoArtworkByStep = {
    guide: "assets/design/mobile/photo-guide.svg",
    upload: "assets/design/mobile/photo-upload.svg",
    source: "assets/design/mobile/photo-source.svg"
  };

  function setMobilePhotoStep(step) {
    if (!mobilePhotoFlow || !mobilePhotoArtwork || !mobilePhotoArtworkByStep[step]) return;
    mobilePhotoFlow.dataset.step = step;
    mobilePhotoArtwork.src = mobilePhotoArtworkByStep[step];
    mobilePhotoArtwork.alt = step === "guide"
      ? "사진 입력 안내"
      : step === "source"
        ? "사진 올리기 방식 선택"
        : "사진 추가";
    window.scrollTo(0, 0);
  }

  function syncMobilePhotoConfirm() {
    if (mobilePhotoConfirm) mobilePhotoConfirm.disabled = !selectedFile;
  }

  function useFile(file) {
    uploadError.textContent = "";
    selectedFile = null;
    syncMobilePhotoConfirm();
    if (!file) return;
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const allowedExtension = /\.(jpe?g|png|webp)$/i.test(file.name || "");
    if (!allowedTypes.has(String(file.type || "").toLowerCase()) && !allowedExtension) {
      uploadError.textContent = "JPG, PNG, WEBP 형식의 사진을 선택해 주세요.";
      startButton.disabled = true;
      syncMobilePhotoConfirm();
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      uploadError.textContent = "10MB 이하의 사진을 선택해 주세요.";
      startButton.disabled = true;
      syncMobilePhotoConfirm();
      return;
    }

    selectedFile = file;
    // 유효한 사진을 선택한 즉시 버튼을 활성화한다.
    // 미리보기 디코딩이 늦거나 실패해도 파일 선택 자체가 유효하면 인식 요청은 가능하다.
    startButton.disabled = false;
    syncMobilePhotoConfirm();
    setMobilePhotoStep("upload");

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      preview.src = reader.result;
      preview.hidden = false;
      addPhoto.hidden = true;
    });
    reader.addEventListener("error", () => {
      preview.hidden = true;
      addPhoto.hidden = false;
      uploadError.textContent = "사진 미리보기를 불러오지 못했지만 인식은 진행할 수 있어요.";
    });
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", () => useFile(fileInput.files[0]));
  if (cameraInput) cameraInput.addEventListener("change", () => useFile(cameraInput.files[0]));

  if (mobilePhotoGuideConfirm) mobilePhotoGuideConfirm.addEventListener("click", () => setMobilePhotoStep("upload"));
  if (mobilePhotoAdd) mobilePhotoAdd.addEventListener("click", () => setMobilePhotoStep("source"));
  if (mobilePhotoGallery) mobilePhotoGallery.addEventListener("click", () => fileInput.click());
  if (mobilePhotoCamera) mobilePhotoCamera.addEventListener("click", () => cameraInput && cameraInput.click());
  if (mobilePhotoSourceConfirm) mobilePhotoSourceConfirm.addEventListener("click", () => setMobilePhotoStep("upload"));
  if (mobilePhotoConfirm) mobilePhotoConfirm.addEventListener("click", () => {
    if (!selectedFile) return;
    startButton.click();
  });
  if (mobilePhotoBack) mobilePhotoBack.addEventListener("click", () => {
    const step = mobilePhotoFlow ? mobilePhotoFlow.dataset.step : "guide";
    if (step === "source") {
      setMobilePhotoStep("upload");
      return;
    }
    if (step === "upload") {
      setMobilePhotoStep("guide");
      return;
    }
    window.location.href = "menu-input.html";
  });
  if (mobileProcessingBack) mobileProcessingBack.addEventListener("click", () => {
    setView("upload");
    setMobilePhotoStep("upload");
  });

  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  }));
  dropZone.addEventListener("drop", (event) => useFile(event.dataTransfer.files[0]));

  startButton.addEventListener("click", async () => {
    if (!selectedFile) {
      uploadError.textContent = "사진을 먼저 선택해 주세요.";
      return;
    }
    const loggedIn = await ensureAuthenticated();
    if (!loggedIn) return;

    startButton.disabled = true;
    setView("processing");
    setProgress(10);

    try {
      const accepted = await window.FirstBiteApi.createRecognition(selectedFile, "FOOD_PHOTO");
      if (!accepted || !accepted.recognitionId) throw new Error("사진 인식 요청 정보를 받지 못했습니다.");
      sessionStorage.setItem("firstbiteRecognitionId", accepted.recognitionId);
      setProgress(25);

      const result = await waitForRecognition(accepted.recognitionId);
      applyRecognition(result);
      setProgress(100);
      currentTab = "recognized";
      updateTabs();
      renderFoods();
      setView("result");
    } catch (error) {
      uploadError.textContent = error.message || "사진 인식에 실패했습니다.";
      setView("upload");
    } finally {
      startButton.disabled = !selectedFile;
      syncMobilePhotoConfirm();
    }
  });

  function activeFoods() {
    return currentTab === "recognized" ? recognizedFoods : recognizedFoods.filter((food) => food.needsConfirmation);
  }

  function findFood(clientId) {
    return recognizedFoods.find((food) => food.clientId === clientId);
  }

  function pencilIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
  }

  function updateTabs() {
    const lowCount = recognizedFoods.filter((food) => food.needsConfirmation).length;
    recognizedTab.textContent = `인식한 메뉴 (${recognizedFoods.length})`;
    lowTab.textContent = `낮은 신뢰도 메뉴(${lowCount})`;
    document.body.dataset.resultTab = currentTab;
  }

  function updateConfirmState() {
    const invalid = !recognizedFoods.length
      || recognizedFoods.length > 20
      || recognizedFoods.some((food) => !isUuid(food.foodId) || food.needsConfirmation);
    confirmResult.disabled = invalid;
  }

  function renderFoods() {
    const foods = activeFoods();
    if (!foods.length) {
      foodList.innerHTML = `<div class="empty-selection"><strong>${currentTab === "low" ? "확인이 필요한 메뉴가 없어요." : "인식된 메뉴가 없어요."}</strong><span>${currentTab === "low" ? "모든 메뉴가 확인되었습니다." : "항목을 직접 추가해주세요."}</span></div>`;
    } else {
      foodList.innerHTML = foods.map((food) => `
        <article class="food-row ${food.needsConfirmation ? "needs-confirmation" : ""}" data-food-row="${escapeHtml(food.clientId)}">
          <img src="${escapeHtml(food.image)}" alt="${escapeHtml(food.name)}" >
          <div class="food-copy"><strong>${escapeHtml(food.name)}</strong><span>${food.foodId ? `탄수화물 ${food.carb}g　·　단백질 ${food.protein}g` : "메뉴 확인이 필요해요"}</span></div>
          <span class="food-gi">${food.foodId ? `GI ${food.gi}` : "확인 필요"}</span>
          <select class="serving-select" data-serving-food="${escapeHtml(food.clientId)}" aria-label="${escapeHtml(food.name)} 인분 선택">
            ${[0.5, 1, 1.5, 2].map((amount) => `<option value="${amount}" ${amount === food.servingMultiplier ? "selected" : ""}>${amount}인분</option>`).join("")}
          </select>
          <span class="food-divider" aria-hidden="true"></span>
          <button class="icon-button" type="button" data-edit-food="${escapeHtml(food.clientId)}" aria-label="${escapeHtml(food.name)} 수정">${pencilIcon()}</button>
          <button class="icon-button" type="button" data-delete-food="${escapeHtml(food.clientId)}" aria-label="${escapeHtml(food.name)} 삭제">${trashIcon()}</button>
        </article>`).join("");
    }

    document.querySelector("[data-add-food]").hidden = currentTab === "low";
    updateTabs();
    updateConfirmState();
  }

  document.querySelectorAll("[data-result-tab]").forEach((tab) => tab.addEventListener("click", () => {
    currentTab = tab.dataset.resultTab;
    document.querySelectorAll("[data-result-tab]").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    renderFoods();
  }));

  foodList.addEventListener("change", (event) => {
    if (!event.target.matches("[data-serving-food]")) return;
    const food = findFood(event.target.dataset.servingFood);
    if (food) food.servingMultiplier = Number(event.target.value);
  });

  foodList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-food]");
    const remove = event.target.closest("[data-delete-food]");
    const row = event.target.closest("[data-food-row]");
    if (edit) {
      openPicker(edit.dataset.editFood);
      return;
    }
    if (remove) {
      recognizedFoods = recognizedFoods.filter((food) => food.clientId !== remove.dataset.deleteFood);
      renderFoods();
      return;
    }
    if (row && window.matchMedia("(max-width: 767px)").matches) {
      const food = findFood(row.dataset.foodRow);
      if (food && food.needsConfirmation) openPicker(food.clientId);
    }
  });

  function renderCandidates(message) {
    if (message) {
      pickerList.innerHTML = `<div class="empty-selection"><strong>${escapeHtml(message.title)}</strong><span>${escapeHtml(message.description)}</span></div>`;
      return;
    }

    if (!candidates.length) {
      pickerList.innerHTML = '<div class="empty-selection"><strong>검색 결과가 없어요.</strong><span>다른 메뉴명이나 카테고리로 검색해 주세요.</span></div>';
      return;
    }

    pickerList.innerHTML = candidates.map((food) => `
      <button class="picker-option ${selectedCandidate && selectedCandidate.foodId === food.foodId ? "is-selected" : ""}" type="button" data-candidate="${escapeHtml(food.foodId)}">
        <span><strong>${escapeHtml(food.name)}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span>
        <span>GI ${food.gi}</span><i aria-hidden="true">✓</i>
      </button>`).join("");
  }

  async function loadCandidates() {
    const serial = ++candidateRequestSerial;
    selectedCandidate = null;
    pickerComplete.disabled = true;
    if (pickerSummary) pickerSummary.textContent = "검색 중...";
    renderCandidates({ title: "메뉴를 찾고 있어요.", description: "잠시만 기다려주세요." });

    try {
      const response = await window.FirstBiteApi.searchFoods({
        query: foodSearch.value.trim(),
        category: pickerCategory === "ALL" ? null : pickerCategory,
        page: 1,
        size: 20
      });
      if (serial !== candidateRequestSerial) return;
      candidates = (response.items || []).map((food, index) => mapCandidate(food, food.name, index)).filter((food) => isUuid(food.foodId));
      const total = response.meta ? Number(response.meta.totalElements) : candidates.length;
      if (pickerSummary) {
        pickerSummary.textContent = document.body.classList.contains("is-low-confidence-picker")
          ? `검색결과　· ${categoryNames[pickerCategory] || "전체"}`
          : `검색결과　 ${categoryNames[pickerCategory] || "전체"} · ${total}개`;
      }
      renderCandidates();
    } catch (error) {
      if (serial !== candidateRequestSerial) return;
      candidates = [];
      if (error && error.status === 401) {
        closePicker();
        window.location.replace("login.html?next=photo-recognition.html");
        return;
      }
      if (pickerSummary) pickerSummary.textContent = "검색 실패";
      renderCandidates({ title: "메뉴를 불러오지 못했어요.", description: error.message || "잠시 후 다시 시도해 주세요." });
    }
  }

  function openPicker(clientId) {
    editClientId = clientId || null;
    const editingFood = editClientId ? findFood(editClientId) : null;
    selectedCandidate = null;
    pickerComplete.disabled = true;
    pickerCategory = "ALL";
    document.querySelectorAll("[data-picker-category]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.pickerCategory === "ALL");
    });
    foodSearch.value = editingFood ? (editingFood.recognizedName || editingFood.name) : "";
    modal.hidden = false;
    document.body.classList.add("is-food-picker-open");
    document.body.classList.toggle("is-low-confidence-picker", Boolean(editingFood && editingFood.needsConfirmation));
    document.body.style.overflow = "hidden";
    loadCandidates();
    foodSearch.focus();
  }

  function closePicker() {
    modal.hidden = true;
    document.body.classList.remove("is-food-picker-open", "is-low-confidence-picker");
    document.body.style.overflow = "";
  }

  document.querySelector("[data-add-food]").addEventListener("click", () => openPicker(null));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closePicker));

  foodSearch.addEventListener("input", () => {
    window.clearTimeout(candidateSearchTimer);
    candidateSearchTimer = window.setTimeout(loadCandidates, 250);
  });

  document.querySelectorAll("[data-picker-category]").forEach((button) => button.addEventListener("click", () => {
    pickerCategory = button.dataset.pickerCategory;
    document.querySelectorAll("[data-picker-category]").forEach((item) => item.classList.toggle("is-active", item === button));
    loadCandidates();
  }));

  pickerList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-candidate]");
    if (!option) return;
    selectedCandidate = candidates.find((food) => food.foodId === option.dataset.candidate) || null;
    pickerComplete.disabled = !selectedCandidate;
    renderCandidates();
  });

  pickerComplete.addEventListener("click", () => {
    if (!selectedCandidate || !isUuid(selectedCandidate.foodId)) return;
    const existing = editClientId ? findFood(editClientId) : null;
    const item = {
      ...selectedCandidate,
      clientId: existing ? existing.clientId : nextManualId(),
      image: existing ? existing.image : imageFor(recognizedFoods.length),
      servingMultiplier: existing ? existing.servingMultiplier : 1,
      needsConfirmation: false,
      recognizedName: existing ? existing.recognizedName : selectedCandidate.name
    };

    if (existing) {
      const index = recognizedFoods.findIndex((food) => food.clientId === existing.clientId);
      if (index >= 0) recognizedFoods.splice(index, 1, item);
    } else {
      recognizedFoods.push(item);
    }

    renderFoods();
    closePicker();
  });

  document.querySelectorAll("[data-coming-soon]").forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));

  confirmResult.addEventListener("click", async () => {
    const unresolved = recognizedFoods.some((food) => !isUuid(food.foodId) || food.needsConfirmation);
    const duplicate = new Set(recognizedFoods.map((food) => food.foodId)).size !== recognizedFoods.length;
    if (!recognizedFoods.length || unresolved || duplicate) {
      if (duplicate) window.alert("같은 메뉴가 중복되어 있어요. 중복 항목을 삭제하거나 다른 메뉴로 수정해 주세요.");
      return;
    }

    const loggedIn = await ensureAuthenticated();
    if (!loggedIn) return;

    sessionStorage.setItem("firstbiteMealSource", "IMAGE");
    sessionStorage.setItem("firstbiteMealItems", JSON.stringify(recognizedFoods.map(({ foodId, servingMultiplier }) => ({ foodId, servingMultiplier }))));
    sessionStorage.setItem("firstbiteRecognitionId", sessionStorage.getItem("firstbiteRecognitionId") || "");
    sessionStorage.removeItem("firstbite.currentAnalysis");
    window.location.href = "menu-confirmed.html";
  });

  async function init() {
    document.body.dataset.recognitionView = "upload";
    updateTabs();
    renderFoods();
    await ensureAuthenticated();
  }

  init();

  syncMobilePhotoConfirm();
})();
