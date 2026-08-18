(function () {
  "use strict";
  const api = window.FirstBiteAPI;
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
  let selectedFile = null;
  let recognitionId = null;
  let recognizedFoods = [];
  let lowConfidenceFoods = [];
  let currentTab = "recognized";
  let editIndex = null;
  let selectedCandidate = null;
  let candidates = [];
  let searchTimer = null;
  const escapeHtml = (value) => String(value || "").replace(/[&<>'\"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '\"':"&quot;" }[character]));

  function setView(name) { views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === name)); document.body.classList.toggle("is-processing", name === "processing"); window.scrollTo(0, 0); }
  function setProgress(percent) { document.querySelector("[data-progress-ring]").style.setProperty("--progress", percent * 3.6 + "deg"); document.querySelector("[data-progress]").textContent = percent + "%"; }
  function useFile(file) {
    uploadError.textContent = ""; selectedFile = null;
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { uploadError.textContent = "JPG, PNG, WEBP 형식의 사진을 선택해 주세요."; startButton.disabled = true; return; }
    if (file.size > 10 * 1024 * 1024) { uploadError.textContent = "10MB 이하의 사진을 선택해 주세요."; startButton.disabled = true; return; }
    selectedFile = file;
    const reader = new FileReader(); reader.addEventListener("load", () => { preview.src = reader.result; preview.hidden = false; addPhoto.hidden = true; startButton.disabled = false; }); reader.readAsDataURL(file);
  }
  fileInput.addEventListener("change", () => useFile(fileInput.files[0]));
  ["dragenter","dragover"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.add("is-dragging"); }));
  ["dragleave","drop"].forEach((name) => dropZone.addEventListener(name, (event) => { event.preventDefault(); dropZone.classList.remove("is-dragging"); }));
  dropZone.addEventListener("drop", (event) => useFile(event.dataTransfer.files[0]));

  function mapRecognitionItem(item) {
    const best = item.candidates && item.candidates[0];
    return {
      foodId: best && best.foodId,
      temporaryItemId: item.temporaryItemId,
      name: (best && best.name) || item.recognizedName,
      image: preview.src,
      carbohydrateG: best && best.carbohydrateG,
      proteinG: best && best.proteinG,
      gi: best && best.gi,
      servingMultiplier: item.estimatedServing || 1,
      candidates: item.candidates || [],
      needsConfirmation: item.needsConfirmation
    };
  }
  async function waitForRecognition(id) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      setProgress(Math.min(95, 8 + Math.round(attempt * 1.1)));
      const data = await api.getRecognition(id);
      if (data.status === "FAILED") throw new Error(data.failureReason || "사진을 인식하지 못했습니다.");
      if (data.status === "COMPLETED") return data;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("인식 시간이 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.");
  }
  startButton.addEventListener("click", async () => {
    if (!selectedFile) return;
    setProgress(0); setView("processing");
    try {
      const created = await api.createRecognition(selectedFile, "FOOD_PHOTO"); recognitionId = created.recognitionId;
      const result = await waitForRecognition(recognitionId); setProgress(100);
      recognizedFoods = (result.items || []).map(mapRecognitionItem);
      lowConfidenceFoods = recognizedFoods.filter((food) => food.needsConfirmation);
      renderFoods(); setView("result");
    } catch (error) { uploadError.textContent = error.message || "사진 인식에 실패했습니다."; setView("upload"); }
  });

  function activeFoods() { return currentTab === "recognized" ? recognizedFoods : lowConfidenceFoods; }
  function pencilIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4.2-1 10.6-10.6a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.7 6.9 2.8 2.8"/></svg>'; }
  function trashIcon() { return '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>'; }
  function foodMeta(food) { return `탄수화물 ${food.carbohydrateG == null ? "-" : food.carbohydrateG}g　·　단백질 ${food.proteinG == null ? "-" : food.proteinG}g`; }
  function renderFoods() {
    const foods = activeFoods();
    document.querySelector('[data-result-tab="recognized"]').textContent = `인식한 메뉴 (${recognizedFoods.length})`;
    document.querySelector('[data-result-tab="low"]').textContent = `낮은 신뢰도 메뉴(${lowConfidenceFoods.length})`;
    foodList.innerHTML = foods.map((food,index) => `<article class="food-row"><img src="${escapeHtml(food.image)}" alt="${escapeHtml(food.name)}"><div class="food-copy"><strong>${escapeHtml(food.name)}</strong><span>${escapeHtml(foodMeta(food))}</span></div><span class="food-gi">GI ${food.gi == null ? "-" : escapeHtml(food.gi)}</span><select class="serving-select" data-serving-index="${index}" aria-label="인분 선택">${[0.5,1,1.5,2].map((amount)=>`<option value="${amount}" ${amount===food.servingMultiplier?"selected":""}>${amount}인분</option>`).join("")}</select><span class="food-divider"></span><button class="icon-button" type="button" data-edit-food="${index}" aria-label="수정">${pencilIcon()}</button><button class="icon-button" type="button" data-delete-food="${index}" aria-label="삭제">${trashIcon()}</button></article>`).join("") || '<div class="empty-selection"><strong>인식된 메뉴가 없어요.</strong></div>';
    document.querySelector("[data-add-food]").hidden = currentTab === "low";
  }
  document.querySelectorAll("[data-result-tab]").forEach((tab) => tab.addEventListener("click", () => { currentTab = tab.dataset.resultTab; document.querySelectorAll("[data-result-tab]").forEach((item) => { const active=item===tab; item.classList.toggle("is-active",active); item.setAttribute("aria-selected",String(active)); }); renderFoods(); }));
  foodList.addEventListener("change", (event) => { if (event.target.matches("[data-serving-index]")) activeFoods()[Number(event.target.dataset.servingIndex)].servingMultiplier = Number(event.target.value); });
  foodList.addEventListener("click", (event) => { const edit=event.target.closest("[data-edit-food]"); const remove=event.target.closest("[data-delete-food]"); if(edit) openPicker(Number(edit.dataset.editFood)); if(remove){ const target=activeFoods()[Number(remove.dataset.deleteFood)]; recognizedFoods=recognizedFoods.filter((food)=>food!==target); lowConfidenceFoods=lowConfidenceFoods.filter((food)=>food!==target); renderFoods(); } });

  async function loadCandidates() {
    pickerList.innerHTML = '<div class="empty-selection"><strong>메뉴를 불러오는 중이에요.</strong></div>';
    try { const data = await api.getFoods({ query: foodSearch.value.trim(), size: 50 }); candidates = Array.isArray(data) ? data : (data.items || []); renderCandidates(); }
    catch (error) { pickerList.innerHTML = `<div class="empty-selection"><strong>${escapeHtml(error.message || "메뉴를 불러오지 못했어요.")}</strong></div>`; }
  }
  function renderCandidates() { pickerList.innerHTML = candidates.map((food)=>`<button class="picker-option ${selectedCandidate&&selectedCandidate.foodId===food.foodId?"is-selected":""}" type="button" data-candidate="${escapeHtml(food.foodId)}"><span><strong>${escapeHtml(food.name)}</strong><small>${escapeHtml(food.category || "기타")}</small></span><span>GI ${food.gi == null ? "-" : escapeHtml(food.gi)}</span><i>✓</i></button>`).join("") || '<div class="empty-selection"><strong>검색 결과가 없어요.</strong></div>'; }
  function openPicker(index) { editIndex=Number.isInteger(index)?index:null; selectedCandidate=null; pickerComplete.disabled=true; modal.hidden=false; document.body.style.overflow="hidden"; foodSearch.value=editIndex===null?"":activeFoods()[editIndex].name; loadCandidates(); foodSearch.focus(); }
  function closePicker(){ modal.hidden=true; document.body.style.overflow=""; }
  document.querySelector("[data-add-food]").addEventListener("click",()=>openPicker(null));
  document.querySelectorAll("[data-close-modal]").forEach((button)=>button.addEventListener("click",closePicker));
  foodSearch.addEventListener("input",()=>{clearTimeout(searchTimer);searchTimer=setTimeout(loadCandidates,300);});
  pickerList.addEventListener("click",(event)=>{const option=event.target.closest("[data-candidate]");if(!option)return;selectedCandidate=candidates.find((food)=>food.foodId===option.dataset.candidate);pickerComplete.disabled=false;renderCandidates();});
  pickerComplete.addEventListener("click",()=>{if(!selectedCandidate)return;const current=editIndex===null?null:activeFoods()[editIndex];const item={...selectedCandidate,image:preview.src,servingMultiplier:current?current.servingMultiplier:1};if(current){const index=recognizedFoods.indexOf(current);if(index>=0)recognizedFoods.splice(index,1,item);lowConfidenceFoods=lowConfidenceFoods.filter((food)=>food!==current);}else recognizedFoods.push(item);renderFoods();closePicker();});
  document.querySelector("[data-confirm-result]").addEventListener("click",async(event)=>{const button=event.currentTarget;const items=recognizedFoods.filter((food)=>food.foodId).map(({foodId,servingMultiplier})=>({foodId,servingMultiplier}));if(!items.length){window.alert("확정할 메뉴를 선택해 주세요.");return;}button.disabled=true;try{const meal=await api.createMeal({source:"IMAGE",recognitionId,items});sessionStorage.setItem("firstbiteMealId",meal.mealId);window.location.href="menu-confirmed.html";}catch(error){window.alert(error.message||"메뉴를 저장하지 못했습니다.");button.disabled=false;}});
})();
