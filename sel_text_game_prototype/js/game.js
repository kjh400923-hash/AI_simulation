window.Game = (() => {
  const TIMER_SECONDS = {normal:35, important:55, sudden:25};
  const clamp = n => Math.max(0, Math.min(100, n));
  const randomInt = ([min,max]) => Math.floor(Math.random()*(max-min+1))+min;
  const shuffle = items => [...items].sort(() => Math.random()-.5);
  let state = null;
  let timerId = null;
  let onRender = () => {};

  function start(characterId, customName) {
    const character = GameData.characters.find(c=>c.id===characterId);
    if (!character) throw new Error('캐릭터를 찾을 수 없습니다.');
    state = {
      characterId,
      characterName: customName.trim() || character.name,
      turn:0,
      stats:Object.fromEntries(Object.entries(character.ranges).map(([key,range])=>[key,randomInt(range)])),
      flags:{},
      fatigueTurns:0,
      history:[],
      ended:false
    };
    return getState();
  }

  function getState() { return state ? JSON.parse(JSON.stringify(state)) : null; }
  function getEvent() { return state && state.turn<GameData.events.length ? GameData.events[state.turn] : null; }
  function getTimerSeconds(event=getEvent()) { return TIMER_SECONDS[event?.kind||'normal'] || 35; }
  function requirementMet(condition) {
    if (!condition) return true;
    if (condition.stat && state.stats[condition.stat] < condition.min) return false;
    if (condition.stat && condition.max != null && state.stats[condition.stat] > condition.max) return false;
    return true;
  }
  function getChoices() {
    const event=getEvent();
    if (!event) return [];
    return shuffle(event.choices.map((item,index)=>{
      const statReady=requirementMet(item.condition);
      const strenuous=state.fatigueTurns>0 && ((item.effects?.stress||0)>0 || (item.effects?.academic||0)>1);
      return {...item,sourceIndex:index,unlocked:statReady&&!strenuous,lockReason:!statReady?`${GameData.statNames[item.condition.stat]} ${item.condition.min} 이상 필요`:strenuous?'과로 상태에서는 잠시 제한되는 선택':''};
    }));
  }
  function choose(choiceItem, timedOut=false) {
    if (!state || state.ended) return null;
    if (timerId) { clearInterval(timerId); timerId=null; }
    const event=getEvent();
    if (!event) return null;
    const strenuous=state.fatigueTurns>0 && ((choiceItem.effects?.stress||0)>0 || (choiceItem.effects?.academic||0)>1);
    if (!timedOut && (!requirementMet(choiceItem.condition) || strenuous)) return null;
    const effects=choiceItem.effects||{};
    const before={...state.stats};
    Object.entries(effects).forEach(([key,value])=>{ if (key in state.stats) state.stats[key]=clamp(state.stats[key]+value); });
    let impact=[];
    Object.entries(effects).forEach(([key,value])=>{if(value) impact.push(`${GameData.statNames[key]} ${value>0?'+':''}${value}`)});
    let result=choiceItem.result || '선택한 행동이 다음 장면으로 이어졌다.';
    if (timedOut) result=`시간이 끝나 기본 선택이 자동으로 진행되었다. ${result}`;
    if (choiceItem.flag) state.flags[choiceItem.flag]=true;
    if (state.stats.stress>=100) {
      state.stats.stress=82;
      state.stats.academic=clamp(state.stats.academic-2);
      state.stats.friendship=clamp(state.stats.friendship-1);
      state.fatigueTurns=2;
      result+=' 스트레스가 한계에 도달해 과로 상태가 되었다. 잠시 회복이 필요해 학업능력 -2, 교우관계 -1이 적용되고 다음 두 턴에는 무리한 선택이 제한된다.';
      impact.push('과로 페널티: 스트레스 82로 조정, 학업능력 -2, 교우관계 -1');
    } else if (state.fatigueTurns>0) {
      state.fatigueTurns--;
    }
    state.history.push({month:event.month,title:event.title,choice:choiceItem.text,result,effects:impact,stats:{...state.stats},timedOut});
    state.turn++;
    if (state.turn>=GameData.events.length) state.ended=true;
    return {result,impact,before,after:{...state.stats},timedOut,ended:state.ended};
  }
  function skipTimedOut() {
    const choices=getChoices();
    const fallback=choices.find(c=>c.unlocked) || choices[0];
    return choose(fallback,true);
  }
  function startTimer(onTick,onTimeout) {
    if (timerId) clearInterval(timerId);
    let remaining=getTimerSeconds();
    onTick(remaining);
    timerId=setInterval(()=>{
      remaining--;
      onTick(remaining);
      if (remaining<=0) {
        clearInterval(timerId);timerId=null;
        onTimeout();
      }
    },1000);
  }
  function stopTimer() { if(timerId){clearInterval(timerId);timerId=null;} }
  function getEnding() {
    if (!state) return null;
    const s=state.stats;
    const jihoHelped=!!(state.flags.helpedJiho||state.flags.toldAdultJiho||state.flags.supportedJiho);
    let text;
    if(s.morality>=65 && s.friendship>=55) text='당신은 주변의 마음을 살피고 관계를 이어가는 방법을 배웠습니다. 새로운 교실에서도 타인의 목소리를 존중하는 사람으로 성장했습니다.';
    else if(s.academic>=65 && s.stress<70) text='당신은 목표를 세우고 꾸준히 실천하는 힘을 길렀습니다. 성취뿐 아니라 회복과 균형도 함께 챙길 수 있게 되었습니다.';
    else if(s.stress>=75) text='3년 동안 많은 부담을 경험했습니다. 힘든 순간에 도움을 요청하고 스스로를 돌보는 것도 중요한 능력임을 기억하세요.';
    else if(s.morality<35) text='여러 선택을 통해 관계와 책임의 의미를 살펴보았습니다. 다음에는 행동이 다른 사람에게 미치는 영향도 함께 생각해볼 수 있습니다.';
    else text='완벽한 선택만 한 것은 아니지만, 경험을 돌아보며 자신의 기준과 다음 걸음을 생각하게 되었습니다.';
    const schoolNote=jihoHelped
      ? '지호는 믿을 수 있는 어른과 연결되고, 자기 속도대로 학교생활을 이어갔습니다. 한 번의 행동이 모든 문제를 해결한 것은 아니지만, 도움을 요청하고 곁에 있어 준 것이 지원을 시작하는 계기가 되었습니다.'
      : '지호의 어려움은 충분히 일찍 알려지지 않았습니다. 괴롭힘의 책임은 괴롭힌 사람에게 있습니다. 앞으로 비슷한 상황을 보면 혼자 해결하려 하기보다 믿을 수 있는 어른에게 알리고, 당사자의 안전과 의사를 존중하며 도움을 연결할 수 있습니다.';
    return {text,schoolNote,jihoHelped,history:state.history,stats:{...s},name:state.characterName};
  }
  function setRenderCallback(callback) { onRender=callback; }
  return {start,getState,getEvent,getChoices,getTimerSeconds,choose,skipTimedOut,startTimer,stopTimer,getEnding,setRenderCallback};
})();
