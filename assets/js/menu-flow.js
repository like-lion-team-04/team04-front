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

  const assets = "assets/recognition/";
  const recognizedFoods = [
    { foodId: "food-pork", name: "제육볶음", image: assets + "spicy-pork.png", carb: 72, protein: 22, gi: 58, servingMultiplier: 1 },
    { foodId: "food-stew", name: "된장찌개", image: assets + "doenjang-stew.png", carb: 72, protein: 22, gi: 58, servingMultiplier: 1 },
    { foodId: "food-rice", name: "공기밥", image: assets + "rice.png", carb: 72, protein: 22, gi: 58, servingMultiplier: 1 },
    { foodId: "food-egg", name: "계란말이", image: assets + "rolled-omelet.png", carb: 72, protein: 22, gi: 58, servingMultiplier: 1 },
    { foodId: "food-kimchi", name: "김치", image: assets + "kimchi.png", carb: 72, protein: 22, gi: 58, servingMultiplier: 1 }
  ];
  const lowConfidenceFoods = recognizedFoods.slice(0, 2).map((food) => ({ ...food }));
  const candidates = [
    { foodId: "candidate-1", name: "김치제육볶음", carb: 72, protein: 22, gi: 58 },
    { foodId: "candidate-2", name: "콩나물 제육볶음", carb: 65, protein: 18, gi: 52 },
    { foodId: "candidate-3", name: "대파 제육볶음", carb: 70, protein: 15, gi: 56 },
    { foodId: "candidate-4", name: "고추장 제육볶음", carb: 75, protein: 14, gi: 61 },
    { foodId: "candidate-5", name: "제육두루치기", carb: 82, protein: 8, gi: 56 }
  ];

  let currentTab = "recognized";
  let editIndex = null;
  let selectedCandidate = null;

  function setView(name) {
    views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === name));
    document.body.classList.toggle("is-processing", name === "processing");
    window.scrollTo(0, 0);
  }

  function useFile(file) {
    uploadError.textContent = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      uploadError.textContent = "JPG, PNG, WEBP 형식의 사진을 선택해 주세요.";
      startButton.disabled = true;
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      uploadError.textContent = "10MB 이하의 사진을 선택해 주세요.";
      startButton.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      preview.src = reader.result;
      preview.hidden = false;
      addPhoto.hidden = true;
      startButton.disabled = false;
    });
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener("change", () => useFile(fileInput.files[0]));
  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  }));
  dropZone.addEventListener("drop", (event) => useFile(event.dataTransfer.files[0]));

  startButton.addEventListener("click", () => {
    setView("processing");
    const ring = document.querySelector("[data-progress-ring]");
    const value = document.querySelector("[data-progress]");
    let progress = 0;
    const timer = window.setInterval(() => {
      progress = Math.min(100, progress + 4);
      ring.style.setProperty("--progress", progress * 3.6 + "deg");
      value.textContent = progress + "%";
      if (progress === 100) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          renderFoods();
          setView("result");
        }, 250);
      }
    }, 55);
  });

  function activeFoods() {
    return currentTab === "recognized" ? recognizedFoods : lowConfidenceFoods;
  }

  function pencilIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>';
  }

  function renderFoods() {
    foodList.innerHTML = activeFoods().map((food, index) => `
      <article class="food-row">
        <img src="${food.image}" alt="${food.name}" >
        <div class="food-copy"><strong>${food.name}</strong><span>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</span></div>
        <span class="food-gi">GI ${food.gi}</span>
        <select class="serving-select" data-serving-index="${index}" aria-label="${food.name} 인분 선택">
          ${[0.5, 1, 1.5, 2].map((amount) => `<option value="${amount}" ${amount === food.servingMultiplier ? "selected" : ""}>${amount}인분</option>`).join("")}
        </select>
        <span class="food-divider" aria-hidden="true"></span>
        <button class="icon-button" type="button" data-edit-food="${index}" aria-label="${food.name} 수정">${pencilIcon()}</button>
        <button class="icon-button" type="button" data-delete-food="${index}" aria-label="${food.name} 삭제">${trashIcon()}</button>
      </article>`).join("");
    document.querySelector("[data-add-food]").hidden = currentTab === "low";
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
    if (!event.target.matches("[data-serving-index]")) return;
    activeFoods()[Number(event.target.dataset.servingIndex)].servingMultiplier = Number(event.target.value);
  });
  foodList.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit-food]");
    const remove = event.target.closest("[data-delete-food]");
    if (edit) openPicker(Number(edit.dataset.editFood));
    if (remove) {
      activeFoods().splice(Number(remove.dataset.deleteFood), 1);
      renderFoods();
    }
  });

  function renderCandidates() {
    const query = foodSearch.value.trim().toLowerCase();
    const filtered = candidates.filter((food) => food.name.toLowerCase().includes(query) || "제육볶음".includes(query));
    pickerList.innerHTML = filtered.map((food) => `
      <button class="picker-option ${selectedCandidate && selectedCandidate.foodId === food.foodId ? "is-selected" : ""}" type="button" data-candidate="${food.foodId}">
        <span><strong>${food.name}</strong><small>탄수화물 ${food.carb}g　·　단백질 ${food.protein}g</small></span>
        <span>GI ${food.gi}</span><i aria-hidden="true">✓</i>
      </button>`).join("");
  }

  function openPicker(index) {
    editIndex = Number.isInteger(index) ? index : null;
    selectedCandidate = null;
    pickerComplete.disabled = true;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    renderCandidates();
    foodSearch.focus();
  }

  function closePicker() {
    modal.hidden = true;
    document.body.style.overflow = "";
  }

  document.querySelector("[data-add-food]").addEventListener("click", () => openPicker(null));
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closePicker));
  foodSearch.addEventListener("input", renderCandidates);
  pickerList.addEventListener("click", (event) => {
    const option = event.target.closest("[data-candidate]");
    if (!option) return;
    selectedCandidate = candidates.find((food) => food.foodId === option.dataset.candidate);
    pickerComplete.disabled = false;
    renderCandidates();
  });
  pickerComplete.addEventListener("click", () => {
    if (!selectedCandidate) return;
    const item = {
      ...selectedCandidate,
      image: assets + "spicy-pork.png",
      servingMultiplier: editIndex === null ? 1 : activeFoods()[editIndex].servingMultiplier
    };
    if (editIndex === null) activeFoods().push(item);
    else activeFoods().splice(editIndex, 1, item);
    renderFoods();
    closePicker();
  });

  document.querySelectorAll("[data-coming-soon]").forEach((link) => link.addEventListener("click", (event) => event.preventDefault()));
  document.querySelector("[data-confirm-result]").addEventListener("click", () => {
    sessionStorage.setItem("firstbiteMealSource", "IMAGE");
    sessionStorage.setItem("firstbiteMealItems", JSON.stringify(recognizedFoods.map(({ foodId, servingMultiplier }) => ({ foodId, servingMultiplier }))));
    window.location.href = "menu-confirmed.html";
  });
})();
