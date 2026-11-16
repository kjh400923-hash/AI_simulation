(() => {
  const $ = selector => document.querySelector(selector);
  const setup = $('#setup');
  const story = $('#story');
  const characterGrid = $('#characterGrid');
  const startButton = $('#startGame');
  const activeTurn = $('#activeTurn');
  const log = $('#storyLog');
  const timerText = document.createElement('span');
  let selectedCharacter = null;
  let selecting = false;

  function renderCharacters() {
    characterGrid.innerHTML='';
    GameData.characters.forEach(character=>{
      const button=document.createElement('button');
      button.type='button';button.className='character-card';button.dataset.id=character.id;
      button.innerHTML=`<strong>${escapeHtml(character.name)}</strong><small>${escapeHtml(character.profile)}</small><span class="tag">${escapeHtml(character.tag)}</span>`;
      button.addEventListener('click',()=>{
        selectedCharacter=character.id;
        characterGrid.querySelectorAll('.character-card').forEach(card=>card.classList.toggle('selected',card.dataset.id===selectedCharacter));
        startButton.disabled=false;startButton.textContent='이 캐릭터로 시작하기';
      });
      characterGrid.append(button);
    });
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function appendEntry({meta,title,text,choiceText,impact}) {
    const article=document.createElement('article');article.className='log-entry';
    article.innerHTML=`${meta?`<div class="log-meta">${escapeHtml(meta)}</div>`:''}${title?`<h2>${escapeHtml(title)}</h2>`:''}${text?`<p>${escapeHtml(text)}</p>`:''}${choiceText?`<p class="choice-line">선택: ${escapeHtml(choiceText)}</p>`:''}${impact?.length?`<p class="impact">${impact.map(escapeHtml).join(' · ')}</p>`:''}`;
    log.append(article);scrollDown();
  }
  function scrollDown() { requestAnimationFrame(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})); }
  function updateStats() {
    const state=Game.getState();if(!state)return;
    const names=GameData.statNames;
    $('#playerLabel').textContent=`${state.characterName} · ${state.turn}/${GameData.events.length}개월`;
    $('#gradeLabel').textContent=state.turn<12?'1학년':state.turn<24?'2학년':state.turn<36?'3학년':'졸업';
    $('#statList').innerHTML=Object.entries(names).map(([key,label])=>{
      const value=state.stats[key];
      return `<div class="stat-row ${key==='stress'?'stress':''}"><div class="stat-name"><span>${label}</span><span>${value}</span></div><div class="meter"><i style="width:${value}%"></i></div></div>`;
    }).join('');
  }
  function renderTurn() {
    const event=Game.getEvent();
    if(!event){renderEnding();return;}
    selecting=false;
    const turnNumber=Game.getState().turn+1;
    $('#storyTitle').textContent=`${turnNumber}번째 달 · ${event.title}`;
    $('#storySubtitle').textContent=`${event.month} · ${event.kind==='important'?'중요한 선택':event.kind==='sudden'?'돌발 상황':'학교생활'}`;
    appendEntry({meta:`${turnNumber}개월째 · ${event.month}${event.shared?' · 공동 이벤트 주제':''}`,title:event.title,text:event.scene});
    if(event.shared){appendEntry({meta:'프로토타입 안내',text:'공동 이벤트 장면입니다. 지금은 1인 체험판이라 본인의 선택과 이야기를 확인합니다. 조원 집계와 온라인 동기화는 서버 연결 단계에서 적용합니다.'});}
    if(Game.getState().fatigueTurns>0){appendEntry({meta:'컨디션 알림',text:`과로 상태가 남아 있습니다. 회복을 우선하고, 무리한 선택은 피하는 편이 좋습니다. (회복 상태 ${Game.getState().fatigueTurns}턴 남음)`});}
    $('#storySubtitle').textContent=`${event.month} · ${event.kind==='important'?'중요한 선택':event.kind==='sudden'?'돌발 상황':'학교생활'} — 제한 시간 ${Game.getTimerSeconds(event)}초`;
    activeTurn.innerHTML='';
    const header=document.createElement('div');header.className='turn-header';
    const h=document.createElement('h2');h.textContent=`${turnNumber}번째 선택`;
    timerText.className='timer';timerText.textContent=`${Game.getTimerSeconds(event)}초`;
    header.append(h,timerText);activeTurn.append(header);
    const prompt=document.createElement('p');prompt.className='prompt';prompt.textContent=event.prompt;activeTurn.append(prompt);
    const choicesWrap=document.createElement('div');choicesWrap.className='choices';activeTurn.append(choicesWrap);
    const choices=Game.getChoices();
    choices.forEach((item,index)=>{
      const button=document.createElement('button');button.type='button';button.className=`choice-button ${item.unlocked?'':'locked'}`;button.disabled=!item.unlocked;
      button.innerHTML=`<span class="choice-number">${index+1}</span><span class="choice-copy"><strong>${escapeHtml(item.text)}${item.unlocked?'':` <span class="locked-label">🔒 ${escapeHtml(item.lockReason||'조건 미충족')}</span>`}</strong><small>${escapeHtml(item.detail||'')}</small></span>`;
      button.addEventListener('click',()=>makeChoice(item,false));choicesWrap.append(button);
    });
    const state=Game.getState();
    if(state.fatigueTurns>0){const note=document.createElement('p');note.className='prompt';note.textContent='과로 상태에서는 회복과 부담 조절을 고려해 선택하세요.';activeTurn.append(note);}
    Game.startTimer(seconds=>{
      timerText.textContent=`${seconds}초`;
      timerText.classList.toggle('urgent',seconds<=10);
    },()=>makeChoice(Game.getChoices().find(c=>c.unlocked)||Game.getChoices()[0],true));
    updateStats();scrollDown();
  }
  function makeChoice(item,timedOut) {
    if(selecting||!item)return;
    selecting=true;Game.stopTimer();
    const event=Game.getState().history.length<GameData.events.length?GameData.events[Game.getState().history.length]:null;
    const result=Game.choose(item,timedOut);
    if(!result){selecting=false;return;}
    const record=Game.getState().history.at(-1);
    appendEntry({meta:`${record.month} · 나의 선택`,choiceText:record.choice,text:record.result,impact:record.effects});
    updateStats();
    activeTurn.innerHTML='';
    if(result.ended){renderEnding();return;}
    const next=document.createElement('button');next.type='button';next.className='primary-button next-button';next.textContent='다음 달로';next.addEventListener('click',renderTurn,{once:true});activeTurn.append(next);scrollDown();
  }
  function renderEnding() {
    Game.stopTimer();
    const ending=Game.getEnding();
    $('#storyTitle').textContent='졸업식 · 3년의 이야기';
    $('#storySubtitle').textContent=`${ending.name}의 마지막 장면`;
    appendEntry({meta:'36개월의 끝',title:'졸업식 날',text:'교복을 입는 마지막 날. 세 해 동안의 선택이 한 사람의 모든 것을 결정하지는 않지만, 그때 배운 것들은 다음 교실까지 함께 간다.'});
    activeTurn.innerHTML=`<div class="ending-card"><h2>나의 성장</h2><p>${escapeHtml(ending.text)}</p><h2>지호의 이야기</h2><p>${escapeHtml(ending.schoolNote)}</p><p class="reflection"><strong>돌아보기</strong><br>가장 고민됐던 선택은 무엇이었나요? 그때 나와 타인의 필요를 어떻게 함께 생각했나요?</p><p class="reflection">이 결과는 1인 프로토타입의 개인 경로입니다. 조별 집계 결과는 서버 연동 후 구현합니다.</p></div>`;
    $('#resetGame').hidden=false;updateStats();scrollDown();
  }
  function begin() {
    if(!selectedCharacter)return;
    const state=Game.start(selectedCharacter,$('#playerName').value||'');
    setup.hidden=true;story.hidden=false;$('#resetGame').hidden=false;
    $('#playerLabel').textContent=`${state.characterName} · 입학 전`;
    $('#storyTitle').textContent=`${state.characterName}의 중학교 생활`;
    $('#storySubtitle').textContent='입학식이 시작되기 전, 낯선 교실의 문 앞에 섰다.';
    appendEntry({meta:'프롤로그',title:'새로운 시작',text:`${state.characterName}은(는) 새 교복의 소매를 만지작거리며 교실 문 앞에 섰다. 어떤 선택을 하게 될지 아직 알 수 없다. 이 이야기는 정답을 찾기보다, 선택과 그 영향을 살펴보는 여정이다.`});
    updateStats();renderTurn();
  }
  function reset() {
    Game.stopTimer();selecting=false;selectedCharacter=null;log.innerHTML='';activeTurn.innerHTML='';story.hidden=true;setup.hidden=false;$('#resetGame').hidden=true;
    startButton.disabled=true;startButton.textContent='캐릭터를 선택하세요';$('#playerName').value='';renderCharacters();window.scrollTo({top:0,behavior:'smooth'});
  }
  startButton.addEventListener('click',begin);
  $('#resetGame').addEventListener('click',reset);
  $('#toggleStats').addEventListener('click',()=>$('#statsPanel').classList.toggle('hidden'));
  renderCharacters();
})();
