/* Run: node test.cjs. Headless controller and full source-logic regression tests. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const events={}, node={innerHTML:'',textContent:'',disabled:false,focus(){},scrollIntoView(){},querySelector(){return {focus(){},scrollIntoView(){}}},querySelectorAll(){return []},addEventListener(k,f){events[k]=f}};
const cx=vm.createContext({assert,console,performance,document:{querySelector:()=>node,addEventListener(){},hidden:false},window:{scrollTo(){},innerWidth:1000}});
for (const f of ['cases.js','rules.js','handoff.js','game.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,f),'utf8'),cx);
vm.runInContext(`
const click=key=>go(key);const expect=(t)=>assert(app.innerHTML.includes(t),t);expect('미발송함 열기');click('start');
for(let j=0;j<4;j++){
 const c=C();click('step:1');assert.equal(stage,0);click('mark:1');click('vote:2');click('step:1');assert.equal(stage,1);click('step:2');assert.equal(stage,1);click('askAI');assert.equal(s.seen.length,0);assert(s.frozen);click('mark:0');assert.equal(s.mark,1);
 c.docs.forEach(x=>click('doc:'+x.id));click('step:2');assert.equal(stage,2);
 c.fields.forEach((f,k)=>{if(f.number)s.lab[k]=String(f.answer);else click('lab:'+k+':'+f.answer)});
 if(j===0){click('contact:1');click('contact:0');assert.equal(s.contact,1);assert(s.seen.includes('q1'));assert(!s.seen.includes('q0'))}click('step:3');assert.equal(stage,3);assert(need(c,s).length);const chosen=[[0,2],[0,1],[0,0],[1,2]][j];chosen.forEach((k,l)=>{click('line:'+l+':'+k);c.lines[l][k].proof[0].forEach(id=>click('ref:'+l+':'+id))});assert.equal(need(c,s).length,0);click('review');assert.equal(scene,'review');assert(review.lab.every(Boolean));assert(review.lines.every(l=>l.ok));assert.equal(review.status,j===2?'원문 발송':'수정 발송');if(j===0){click('revise');assert.equal(s.round,2);click('review');click('revise');assert.equal(scene,'review')}
 assert(!app.innerHTML.includes('올해는 종이팩 분리배출 체험만'));click('seal');assert.equal(scene,'sealed');if(j===3)expect('올해는 종이팩 분리배출 체험만');click('next');}
assert.equal(scene,'handoff');assert.equal(book.length,4);assert.equal(auditData().suggested,1);assert.equal(auditData().actual,4);audit.count='4';click('auditVote:1');click('checkAudit');expect('기록과 일치해');click('finishAudit');assert.equal(scene,'end');expect('마감');click('reset');assert.equal(book.length,0);assert.equal(idx,0);assert.equal(scene,'cover');assert.equal(s.seen.length,0);
// Exhaustively compare all citation subsets (0–3 papers/line), including all interview branches.
let n=0;for(const c of CASES)for(const contact of c.contacts?[0,1,2]:[null]){const f=newFile();f.contact=contact;let ds=docsFor(c,f).map(d=>d.id);f.seen=ds;for(let mask=0;mask<2**ds.length;mask++){const ids=ds.filter((_,j)=>mask>>j&1);if(ids.length>3)continue;for(let line=0;line<2;line++)for(let k=0;k<c.lines[line].length;k++){f.picks=[0,0];f.picks[line]=k;f.refs=[ids,ids];const op=c.lines[line][k],r=assess(c,f).lines[line];assert.equal(r.ok,op.k!=='삭제'&&op.proof.some(p=>p.every(x=>ids.includes(x))));n++}}}
const z=newFile();z.picks=[0,0];z.refs=[['a','b'],['a','b','c']];z.seen=['a'];assert(!assess(CASES[2],z).lines.some(x=>x.ok));z.picks=[2,2];assert.equal(assess(CASES[2],z).status,'발송 보류');console.log('PASS: 4-case lifecycle, first-vote freeze, reporting gates, source-only citations, one interview and revision, correct-AI approval, later notice, personalized handoff, reset; '+n+' sentence/citation combinations.');
`,cx);
