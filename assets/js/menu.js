(() => {
  const picker = document.querySelector("[data-photo-picker]");
  const input = document.querySelector("[data-photo-input]");
  const preview = document.querySelector("[data-photo-preview]");

  if (picker && input && preview) {
    picker.addEventListener("click", (event) => {
      if (event.target !== input) input.click();
    });
    picker.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        input.click();
      }
    });
    input.addEventListener("change", () => {
      const [file] = input.files;
      if (!file) return;
      preview.src = URL.createObjectURL(file);
      preview.alt = `선택한 사진: ${file.name}`;
      picker.classList.add("has-preview");
    });
  }

  const menuRoot = document.querySelector("[data-menu-select]");
  if (!menuRoot) return;

  const foods = [
    { foodId: "food-doenjang-rice", name: "된장찌개 + 공기밥", category: "SOUP", categoryLabel: "탕류", carbs: 68, protein: 12, gi: 55 },
    { foodId: "food-jeyuk-rice", name: "제육볶음 + 공기밥", category: "RICE", categoryLabel: "밥류", carbs: 72, protein: 22, gi: 58 },
    { foodId: "food-sundubu-rice", name: "순두부찌개 + 공기밥", category: "SOUP", categoryLabel: "탕류", carbs: 65, protein: 18, gi: 52 },
    { foodId: "food-kimchi-rice", name: "김치찌개 + 공기밥", category: "SOUP", categoryLabel: "탕류", carbs: 70, protein: 15, gi: 56 },
    { foodId: "food-bibimbap", name: "비빔밥", category: "RICE", categoryLabel: "밥류", carbs: 75, protein: 14, gi: 61 },
    { foodId: "food-tteokbokki", name: "떡볶이", category: "FLOUR", categoryLabel: "분식류", carbs: 82, protein: 8, gi: 56 },
  ];

  const state = { query: "", category: "ALL", selected: new Set() };
  const results = menuRoot.querySelector("[data-food-results]");
  const selectedList = menuRoot.querySelector("[data-selected-list]");
  const search = menuRoot.querySelector("[data-food-search]");
  const tabs = [...menuRoot.querySelectorAll("[data-category]")];

  const card = (food, selected = false) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `food-card${selected ? " is-selected" : ""}`;
    button.dataset.foodId = food.foodId;
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `
      <span class="food-copy">
        <span class="food-name">${food.name}</span>
        <span class="food-meta">탄수화물 ${food.carbs}g · 단백질 ${food.protein}g</span>
      </span>
      <span class="food-gi">GI ${food.gi}</span>
      <span class="food-check" aria-hidden="true"></span>`;
    button.addEventListener("click", () => {
      if (state.selected.has(food.foodId)) state.selected.delete(food.foodId);
      else state.selected.add(food.foodId);
      render();
    });
    return button;
  };

  const render = () => {
    const query = state.query.trim().toLowerCase();
    const visible = foods.filter((food) => {
      const matchesQuery = !query || food.name.toLowerCase().includes(query);
      const matchesCategory = state.category === "ALL" || food.category === state.category;
      return matchesQuery && matchesCategory && !state.selected.has(food.foodId);
    });
    results.replaceChildren();
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "no-results";
      empty.textContent = "조건에 맞는 메뉴가 없어요.";
      results.append(empty);
    } else visible.forEach((food) => results.append(card(food)));

    selectedList.replaceChildren();
    const chosen = foods.filter((food) => state.selected.has(food.foodId));
    if (!chosen.length) {
      const empty = document.createElement("div");
      empty.className = "selected-empty";
      empty.innerHTML = "<p>아직 선택한 메뉴가 없어요</p><span>왼쪽 목록에서 메뉴를 선택해주세요.</span>";
      selectedList.append(empty);
    } else chosen.forEach((food) => selectedList.append(card(food, true)));
  };

  search.addEventListener("input", () => {
    state.query = search.value;
    render();
  });
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    state.category = tab.dataset.category;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    render();
  }));
  render();
})();
