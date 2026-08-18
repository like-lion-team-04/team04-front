(function(){
  "use strict";
  const search=document.querySelector("[data-side-search]");
  const items=[...document.querySelectorAll("[data-side-item]")];
  const categories=[...document.querySelectorAll(".side-categories button")];
  const previewEmpty=document.querySelector("[data-preview-empty]");
  const previewContent=document.querySelector("[data-preview-content]");
  const recommendation=document.querySelector("[data-recommendation]");
  const order=document.querySelector("[data-current-order]");
  let selected=null;

  function filterItems(){
    const query=search.value.trim().toLowerCase();
    items.forEach((item)=>{item.hidden=!item.dataset.sideItem.toLowerCase().includes(query);});
  }
  function selectItem(item){
    selected=item;
    items.forEach((candidate)=>candidate.classList.toggle("is-selected",candidate===item));
    previewEmpty.hidden=true;
    previewContent.hidden=false;
    recommendation.hidden=false;
  }
  search.addEventListener("input",filterItems);
  items.forEach((item)=>item.addEventListener("click",()=>selectItem(item)));
  categories.forEach((button)=>button.addEventListener("click",()=>{
    categories.forEach((candidate)=>candidate.classList.toggle("is-active",candidate===button));
  }));
  document.querySelector("[data-add-side-menu]").addEventListener("click",()=>{
    if(!selected)return;
    if(!order.querySelector('[data-added-side-menu]')){
      const row=document.createElement("li");
      row.dataset.addedSideMenu="";
      row.innerHTML='<b>2</b><img src="assets/side-menu/cabbage-salad.png" alt=""><span><strong>양배추 샐러드</strong><small>1인분</small></span><em>GL 기여 (상대)<strong>낮음</strong></em>';
      order.children[0].after(row);
      [...order.children].forEach((item,index)=>{item.querySelector(":scope > b").textContent=String(index+1);});
    }
    document.querySelector("[data-page-title]").textContent="추천 사이드 메뉴";
    previewContent.hidden=true;
    previewEmpty.hidden=false;
    previewEmpty.innerHTML="<p>아직 메뉴를 선택하지 않았어요.<br>원하는 메뉴를 선택해주세요.</p>";
    recommendation.hidden=true;
    items.forEach((item)=>item.classList.remove("is-selected"));
    selected=null;
    window.scrollTo({top:0,behavior:"smooth"});
  });
})();
