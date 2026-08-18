(function(){
  "use strict";
  const stages=[
    {step:"1단계",title:"계란",description:"단백질 6g을 추가하면<br>1단계 선행 효과가 높아져요",time:"식사 시작 직후 드세요",amount:"1인분 (약90g)",effect:"이후 식사의 혈당 상승을 완화해요",image:"assets/side-menu/rolled-omelet.png",alt:"계란말이"},
    {step:"2단계",title:"식이섬유",description:"시금치 나물을 먼저 섭취하면<br>이후 식사의 상대적 부담을 낮추는 데 도움이 돼요",time:"계란말이를 먹은 뒤 드세요",amount:"1인분 (약90g)",effect:"식사 부담을 완화하는데 도움을 줘요",image:"assets/side-menu/spinach.png",alt:"시금치 나물"},
    {step:"3단계",title:"탄수화물",description:"앞선 메뉴를 충분히 섭취한 뒤<br>밥을 천천히 드세요",time:"다른 메뉴를 먼저 먹은 뒤 드세요",amount:"1인분 (약200g)",effect:"마지막에 섭취해 상대적 부담을 낮춰요",image:"assets/side-menu/rice.png",alt:"공기밥"}
  ];
  const buttons=[...document.querySelectorAll("[data-stage]")];
  const step=document.querySelector("[data-detail-step]");
  const title=document.querySelector("[data-detail-title]");
  const description=document.querySelector("[data-detail-description]");
  const time=document.querySelector("[data-guide-time]");
  const amount=document.querySelector("[data-guide-amount]");
  const effect=document.querySelector("[data-guide-effect]");
  const image=document.querySelector("[data-detail-image]");

  function selectStage(index){
    const stage=stages[index];
    buttons.forEach((button,buttonIndex)=>button.classList.toggle("is-active",buttonIndex===index));
    step.textContent=stage.step;
    title.innerHTML=`${stage.title} <span>추천</span>`;
    description.innerHTML=stage.description;
    time.textContent=stage.time;
    amount.textContent=stage.amount;
    effect.textContent=stage.effect;
    image.src=stage.image;
    image.alt=stage.alt;
  }
  buttons.forEach((button)=>button.addEventListener("click",()=>selectStage(Number(button.dataset.stage))));
  selectStage(0);
})();
