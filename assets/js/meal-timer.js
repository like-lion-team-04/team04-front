(function(){
  "use strict";
  const stages=[
    {chip:"1단계 · 단백질",title:"단백질부터 시작해요",guide:"처음 5분은 계란말이를 천천히 드세요.",seconds:300},
    {chip:"2단계 · 식이섬유",title:"이제 채소를 드세요",guide:"다음 5분은 양배추 샐러드와 시금치 나물을 천천히 드세요.",seconds:300},
    {chip:"3단계 · 탄수화물",title:"나머지 메뉴를 드세요",guide:"이제 제육볶음, 된장찌개, 밥을 편하게 드세요.",seconds:null}
  ];
  const timerScreen=document.querySelector("[data-timer-screen]");
  const completeScreen=document.querySelector("[data-complete-screen]");
  const chip=document.querySelector("[data-stage-chip]");
  const title=document.querySelector("[data-stage-title]");
  const guide=document.querySelector("[data-stage-guide]");
  const timeLabel=document.querySelector("[data-time-label]");
  const time=document.querySelector("[data-time]");
  const ring=document.querySelector("[data-timer-ring]");
  const pauseButton=document.querySelector("[data-pause]");
  const nextButton=document.querySelector("[data-next]");
  const stageRows=[...document.querySelectorAll("[data-stage-list] li")];
  const progressCount=document.querySelector("[data-progress-count]");
  const progressBar=document.querySelector("[data-progress-bar]");
  const menuCard=document.querySelector(".today-menu-card:not(.complete-menu-copy)");
  const completeMenuCard=document.querySelector(".complete-menu-copy");
  let stageIndex=0,remaining=stages[0].seconds,stageElapsed=0,totalElapsed=0,paused=false,intervalId=null;

  function formatTime(seconds){const minutes=Math.floor(seconds/60);const rest=seconds%60;return `${String(minutes).padStart(2,"0")}:${String(rest).padStart(2,"0")}`;}
  function updateClock(){
    const stage=stages[stageIndex];
    if(stage.seconds===null){timeLabel.textContent="진행 시간";time.textContent=formatTime(stageElapsed);ring.style.setProperty("--timer-progress",`${Math.min(stageElapsed/300,1)*360}deg`);}
    else{timeLabel.textContent="남은 시간";time.textContent=formatTime(remaining);ring.style.setProperty("--timer-progress",`${(1-remaining/stage.seconds)*360}deg`);}
  }
  function updateStages(){
    stageRows.forEach((row,index)=>{row.classList.toggle("is-current",index===stageIndex);row.classList.toggle("is-done",index<stageIndex);row.querySelector(":scope > b").textContent=index<stageIndex?"✓":String(index+1);row.querySelector("small").textContent=index<stageIndex?"식사 완료":index===stageIndex?"현재 진행 중":"대기";});
    progressCount.textContent=`${stageIndex+1} / 3`;progressBar.style.width=`${((stageIndex+1)/3)*100}%`;
  }
  function showStage(index){stageIndex=index;stageElapsed=0;remaining=stages[index].seconds;paused=false;pauseButton.textContent="일시정지";chip.textContent=stages[index].chip;title.textContent=stages[index].title;guide.textContent=stages[index].guide;nextButton.textContent="다음 단계";updateClock();updateStages();}
  function tick(){if(paused)return;totalElapsed+=1;stageElapsed+=1;if(stages[stageIndex].seconds!==null){remaining=Math.max(remaining-1,0);if(remaining===0){showStage(stageIndex+1);}}updateClock();}
  function saveRecord(){const record={completedAt:new Date().toISOString(),totalSeconds:totalElapsed,completedStages:3,orderCompliance:100};let records=[];try{records=JSON.parse(localStorage.getItem("firstbiteMealRecords")||"[]");}catch(error){records=[];}records.unshift(record);localStorage.setItem("firstbiteMealRecords",JSON.stringify(records.slice(0,30)));}
  function finishMeal(){if(intervalId!==null){clearInterval(intervalId);intervalId=null;}saveRecord();timerScreen.hidden=true;completeScreen.hidden=false;document.querySelector("[data-total-time]").textContent=formatTime(totalElapsed);window.scrollTo({top:0,behavior:"smooth"});}
  function startTimer(){if(intervalId!==null)clearInterval(intervalId);intervalId=setInterval(tick,1000);}

  pauseButton.addEventListener("click",()=>{paused=!paused;pauseButton.textContent=paused?"계속하기":"일시정지";});
  nextButton.addEventListener("click",()=>{if(stageIndex<2)showStage(stageIndex+1);else finishMeal();});
  document.querySelector("[data-finish]").addEventListener("click",finishMeal);
  document.querySelector("[data-restart]").addEventListener("click",()=>{totalElapsed=0;completeScreen.hidden=true;timerScreen.hidden=false;showStage(0);startTimer();window.scrollTo({top:0,behavior:"smooth"});});
  completeMenuCard.innerHTML=menuCard.innerHTML;
  showStage(0);startTimer();
})();
