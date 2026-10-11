'use strict';
// Generate measured tables only after every required result file exists.
const fs=require('node:fs'),{quantile}=require('./stats.cjs');
const read=n=>JSON.parse(fs.readFileSync('qa/results/'+n+'.json','utf8'));
const sim=read('simulation-summary'),extended=read('extended'),hand=read('hand-fairness'),keyboard=read('keyboard-fairness'),controller=read('controller'),life=read('lifecycle'),quality=read('quality'),bench=read('step-benchmark'),browser=read('browser-after');
if(sim.configs.length!==64||sim.configs.some(c=>c.summary.runs!==300)||hand.arms.length!==2||keyboard.arms.length!==2||extended.fairness.length!==2||life.rounds.length!==10)throw new Error('Incomplete audit evidence; do not generate a final report');
const f=x=>Number(x).toFixed(2),p=x=>x<.0001?x.toExponential(3):Number(x).toFixed(6),arm=x=>x?'ON':'OFF',table=(headers,rows)=>'| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n'),range=a=>f(Math.min(...a))+'–'+f(Math.max(...a));
const totals={};for(const c of sim.configs)for(const[k,v]of Object.entries(c.summary.violations))totals[k]=(totals[k]||0)+v;
const games=sim.configs.reduce((s,c)=>s+c.summary.runs,0),over=sim.configs.reduce((s,c)=>s+c.summary.time.over120,0),under=sim.configs.reduce((s,c)=>s+c.summary.time.under10,0);
const matrix=sim.configs.map(({config:c,summary:s})=>[c.count,`${c.radius}/${c.gravity}/${c.restitution}`,arm(c.skills),s.runs,`${f(s.time.p50)}/${f(s.time.p95)}/${f(s.time.max)}`,`${s.time.over120} (${f(s.time.over120/s.runs*100)}%)`,Object.values(s.violations).reduce((a,b)=>a+b,0),s.participantFairness?(s.participantFairness.validApproximation?p(s.participantFairness.pValue):'적용 불가')+' / '+f(s.participantFairness.maxDeviationPercentagePoints)+'pp':'단독',s.slotFairness?(s.slotFairness.validApproximation?p(s.slotFairness.pValue):'적용 불가')+' / '+f(s.slotFairness.maxDeviationPercentagePoints)+'pp':'단독']);
const fairness=[];for(const a of hand.arms)for(const[k,label]of [['participant','참가자 ID'],['groups','색상 그룹'],['startSlots','출발 슬롯'],['shuffleOrder','셔플 위치 순서']]){const s=a[k];fairness.push([arm(a.skills),label,s.counts.join(', '),f(s.statistic),s.df,p(s.pValue),f(s.maxDeviationPercentagePoints)+'pp']);}
const kRows=keyboard.arms.flatMap(a=>[['participant','참가자 ID'],['groups','색상 그룹']].map(([key,label])=>{const s=a[key];return [arm(a.skills),label,s.n,s.counts.join(', '),p(s.pValue),f(s.maxDeviationPercentagePoints)+'pp'];}));
const rescue=[];for(const a of extended.fairness)for(const[k,label]of [['on','ON'],['off','OFF']]){const s=a[k];rescue.push([arm(a.skills),label,s.complete,`${f(s.duration.p50)}/${f(s.duration.p95)}/${f(s.duration.max)}`,`${s.rescues.p50}/${s.rescues.p95}/${s.rescues.max}`,p(s.participant.pValue),p(s.groups.pValue),p(s.slot.pValue)]);}
const lifeRows=life.rounds.map((r,i)=>[i+1,`${r.count}/${r.unique}/${r.shown}`,f(r.wallSeconds),`${f(r.frameTime.running.p50)}/${f(r.frameTime.running.p95)}/${f(r.frameTime.running.max)}`,f(r.heap.usedSize/1048576),`${r.listeners}/${r.rafPending}/${r.contexts}/${r.canvasInDOM}`,r.caches.sprites]);
const violations=sim.configs.flatMap(c=>c.summary.representatives.map(r=>({config:c.config,seed:r.seed,errors:r.errors,remaining:r.remaining})));fs.writeFileSync('qa/results/violation-summary.json',JSON.stringify({games,violations:totals,representatives:violations},null,2));
const perf=[];for(let i=0;i<2;i++){const rows=bench.results.slice(i*10,(i+1)*10);perf.push([arm(i===1),rows.length,range(rows.map(r=>r.stepP50)),range(rows.map(r=>r.stepP95)),f(quantile(rows.map(r=>r.stepP50),.5)),f(quantile(rows.map(r=>r.stepP95),.5))]);}
const durationRows=hand.arms.map(a=>['손 원형',arm(a.skills),a.participant.n,`${f(a.duration.p50)}/${f(a.duration.p95)}/${f(a.duration.max)}`]).concat(keyboard.arms.map(a=>['키보드',arm(a.skills),a.participant.n,`${f(a.time.p50)}/${f(a.time.p95)}/${f(a.time.max)}`]));
const text=`## 수치 부록

### 실행 환경과 범위

측정일 2026-10-11 KST. Node v24.16.0, 시스템 Chrome ${life.browser}, Playwright 1.64.0, macOS 로컬입니다. 메인 행렬은 ${sim.started}~${sim.finished}(UTC), workers=${sim.workers}. 각 조합은 같은 목록 release-audit-0000~0299를 사용합니다. 원시 기록은 [simulation.json.gz](../../qa/results/simulation.json.gz), 요약은 [simulation-summary.json](../../qa/results/simulation-summary.json)입니다. 압축 해제 데이터 SHA-256: \`${sim.sha256Uncompressed}\`.

UI 경계(index.html:100–103)는 크기 8/12/16, 중력 350/620/1500, 반발 0.35/0.72/0.92, 속도 0.5/1/3입니다. 메인 표는 속도 1의 실제 물리 64조합이며, 6개에서는 물리 27×스킬 2를 전수, 다른 공 수에서는 기본 물리×스킬 2를 실행했습니다. 유효 당첨 규칙은 매 경기 독립 오라클로 재계산했습니다. 그룹과 속도는 아래 독립 비교 표본으로 검사했으며 전체 교차곱으로 해석하지 않습니다.

| 검사 | 완료 표본 | 결과 |
| --- | --- | --- |
| 메인 물리 행렬 | ${games.toLocaleString('en-US')}판(64×300) | 아래 위반표·조합별 시간 |
| 기본 6개, rescue ON/OFF | 4,000판(스킬별 각 1,000쌍) | 두 상태 모두 4,000/4,000 완주 |
| 같은 시드 두 번 | ${extended.repeatability.length}쌍, 1,200판 | 완전 일치 ${extended.repeatability.filter(x=>x.equal).length}/${extended.repeatability.length} |
| 그룹 메타데이터 비교 | ${extended.groupInvariance.length}개 비교 사례 | 순위·시간 일치 ${extended.groupInvariance.filter(x=>x.equal).length}/${extended.groupInvariance.length} |
| 실제 손 붓기+2초 원형 동작 | 2,000판(스킬별 1,000) | 오류 경기 ${hand.arms.reduce((s,a)=>s+a.rows.filter(r=>Object.values(r.errors).some(Boolean)).length,0)} |
| 실제 키보드 출발 계산 | 600판(스킬별 300) | 오류 경기 ${keyboard.arms.reduce((s,a)=>s+a.errors,0)}; 공정성 별도 실패 |
| main 제어기 프레임률/속도 | ${controller.runs.length}개 비교(기준 300판) | 완주 ${controller.runs.filter(r=>r.complete).length}, 순위·시간 완전 일치 ${controller.runs.filter(r=>r.equal).length} |
| 실제 rAF, 500개 10판 | 10판/5,000개 완주 | 중복 0·누락 0, 결과 목록도 매번 500개 |

제어기 비교는 60Hz 기준에 30Hz/144Hz/지터(144,30,60,8,90,5,120,20Hz 반복)/속도 0.5/3을 적용했습니다. 렌더·손 입력 mock 범위이며 출발 후 실제 main의 고정 스텝을 검사합니다. 두 판 반복 표본은 release-repeat-0000~0299, 제어기는 release-controller-0000~0299입니다. UI 수량/N 범위·제조한 동시 도착·중도 종료는 추가 회귀 검사로 확인했습니다.

### 수치 안전성과 판정

${table(['관찰 기준','위반 경기 수(중복 합산 가능)'],Object.entries(totals).map(([k,v])=>[({finite:'NaN/Infinity',bounds:'보드 외곽 이탈',velocity:'속도 >5,000',polygon:'폴리곤 내부 중심(12스텝 표본)',ranking:'순위 중복/누락',oracle:'독립 당첨 오라클 불일치',timeout:'240초 제한 초과'})[k],v]))}

대표 위반 시드: ${violations.length?violations.slice(0,8).map(v=>'\`'+v.seed+'\` ('+JSON.stringify(v.config)+')').join('; '):'관찰된 위반 없음'}. 기준별 원시 건수와 대표 시드는 [violation-summary.json](../../qa/results/violation-summary.json)에 있습니다. 모든 얇은 벽의 연속 관통은 이 표만으로 보장하지 않습니다. 최대 관찰 속도는 ${f(Math.max(...sim.configs.map(c=>c.summary.maxSpeed)))}입니다. 엔진의 속도 제한 뒤 충돌/스킬이 추가 속도를 만들 수 있어 1,050 초과 자체를 폭주로 분류하지 않았습니다.

### 조합별 종료 시간과 공정성

시간은 물리 시뮬레이션 초이며 붓기·비행·모달 시간을 제외합니다. p50/p95는 정렬 표본의 floor((n−1)×p)입니다. 속도 0.5에서는 실제 경기 구간이 대략 두 배가 되며 느린 프레임에서는 더 길어질 수 있습니다. 전체 메인 표본에서 120초 초과 ${over}/${games}(${f(over/games*100)}%), 10초 미만 ${under}/${games}(${f(under/games*100)}%). 종료 시간 제한은 영구 끼임을 증명하거나 배제하는 기준이 아닙니다.

${table(['공 수','크기/중력/반발','스킬','판 수','p50/p95/max 초','>120초','위반 합','참가자 p / 최대편차','슬롯 p / 최대편차'],matrix)}

참가자/슬롯 기대빈도는 300/N입니다. N=200/500은 기대빈도 <5이므로 카이제곱 근사 p-value를 적용하지 않습니다. N=1은 분포 검정이 없습니다. 이 표의 많은 p-value는 탐색용이며 다중 검정 보정 없이 단일 p<0.05만으로 편향을 확정하지 않습니다. 메인 행렬의 유효 분포 검정은 참가자·슬롯 각각 58개(총 116개)입니다. Bonferroni 0.05/116=0.000431 기준에서도 6개·스킬 ON의 크기8/중력620/반발0.35 슬롯 p=1.97e-5, 크기12/중력350/반발0.35 슬롯 p=2.98e-5는 유의해 엔진 단독 위치 편향도 관찰됐습니다. 메인 표의 슬롯은 원본 Physics 초기 y→x 순서이며 실제 손 출발 슬롯과 구분합니다.

### 실제 손 출발의 우승 분포 — R10

기본 6개, 빨강 2/초록 2/파랑 2, 1280×720, 같은 기울이기·붓기 후 2초 원형 손동작, release-hand-0000~0999. 출발 슬롯은 캡처한 시작 y→x 오름차순(낮은 y가 1번), 셔플 순서는 발사 직전 source.x→y 오름차순입니다. 셔플 난수 소비 순서와 같은 뜻은 아닙니다. 각 arm 1,000판이므로 참가자/슬롯 기대빈도 166.67, 그룹 기대빈도 333.33입니다.

${table(['스킬','분류','우승 횟수(순서대로)','χ²','자유도','p-value','최대 편차'],fairness)}

출발 슬롯과 셔플 위치 순서는 스킬 두 상태에서 모두 유의합니다. 8개 손 분포 검사 Bonferroni 기준 0.05/8=0.00625에서도 네 위치 검정은 유지됩니다. 슬롯 6 우승률은 OFF 21.8%, ON 23.3%(기대 16.67%)입니다. 참가자 ID·색상 그룹 검정은 이 프로토콜에서 유의하지 않았으며, 이것이 임의 손동작이나 모든 설정의 공정성 보장은 아닙니다. 이름/그룹만 바꾼 실제 손 출발 ${hand.nameInvariant.filter(x=>x.equal).length}/${hand.nameInvariant.length}쌍은 같은 starts였습니다.

원인 후보는 hand-start.js:31–40의 실제 위치 높이 보존, maps.js의 비대칭 경로/출구, hand-scene.js의 한 방향 붓기입니다. 현 위치를 유지하는 게임 경험과 슬롯별 동일 추첨 확률은 서로 다른 요구입니다. 관찰만으로 특정 코드 한 줄의 인과관계가 확정되지는 않습니다. 제안: 지원 추첨 프로토콜과 위치별 허용 오차를 먼저 정하고, 위치/소유자 배정 또는 맵을 별도 밸런스 버전에서 검토합니다(예상 1–2일+대규모 재검증). 이번에는 변경하지 않았습니다.

### 키보드 출발의 우승 분포 — R11

새 Enter 경로와 같은 grip/end, 실제 HandScene 붓기 후 원형 손동작 없이 발사. 같은 6개/세 색상/기본 물리, release-keyboard-0000~0299, 각 스킬 300판입니다.

${table(['스킬','분류','판 수','우승 횟수','p-value','최대 편차'],kRows)}

OFF의 마지막 두 ID(파랑) 우승률 44.67%는 기대 33.33%보다 11.33pp 높습니다. 참가자 p=0.000288, 그룹 p=0.000105는 4개 키보드 분포 검사 보정 기준 0.0125에도 유의합니다. 예시 release-keyboard-0000부터 고정 목록으로 재현할 수 있으며 단일 시드 자체는 분포 편향의 증거가 아닙니다. ON에서 유의하지 않은 결과가 OFF 결함을 해소하지 않습니다. 원인 후보: main.js:267–269의 ready 직후 자동 발사, cinematic.js:221–256의 순서에 따른 초기 충돌/정렬, 실제 높이 보존 인계. 충분한 자동 혼합이나 소유자 배정을 검토하되 실제 확률/시드 결과가 달라지므로 밸런스 변경 제안으로 남깁니다(예상 0.5–1일+재검증). R02는 키보드 완주 접근성만 해결했고, 이 경로를 공정한 추첨 방식으로 승인하지 않습니다.

${table(['출발 프로토콜','스킬','판 수','p50/p95/max 초'],durationRows)}

### 막힘 방지 ON/OFF

기본 6개 직접 엔진 출발의 release-fair-0000~0999를 같은 시드로 짝지었습니다. 이 절의 그룹 통계는 ID를 1,4 / 2,5 / 3,6으로 묶는 합성 그룹이며 앞 절의 실제 UI 연속 색상 그룹과 다릅니다. OFF는 QA 인스턴스 rescueDelay=Infinity로만 비교했고 런타임은 변경하지 않았습니다. ON에서는 스킬 OFF 1,000/1,000, ON 999/1,000판에 rescue 이벤트가 있었지만 OFF도 전원 완주했습니다. 이 표본에서 rescue 발동이 곧 영구 정체를 뜻하지 않습니다. 끝까지 도착하지 않은 빈도는 두 상태 모두 0/1,000입니다.

${table(['스킬','막힘 방지','완주','시간 p50/p95/max','발동 p50/p95/max','참가자 p','그룹 p','슬롯 p'],rescue)}

ON/OFF의 우승자는 스킬 OFF 519/1,000, ON 499/1,000판에서 바뀌었습니다. 따라서 막힘 방지는 결과에 실제 영향을 줍니다. ID별 짝지은 McNemar 검정의 최소 p는 OFF ${p(Math.min(...extended.fairness[0].pairedParticipantMcNemar.map(x=>x.pValue)))}, ON ${p(Math.min(...extended.fairness[1].pairedParticipantMcNemar.map(x=>x.pValue)))}이며 6개 ID 보정 기준 0.00833에서 특정 ID의 유리함은 확정되지 않았습니다. 이 비교는 다른 밀도/물리/실제 손 출발의 무편향을 보장하지 않습니다. ON의 OFF-skills 슬롯 p=0.030657도 탐색·다중 검정 범위입니다.

### CPU·브라우저 반복 성능

Node 실제 물리, 기본 500개, 스킬별 10시드, 첫 1초 제외 모든 step. 아래 p50/p95는 **경기별** 표본이며 pooled quantile이 아닙니다. 동시 감사 부하가 있는 로컬 측정입니다.

${table(['스킬','경기','경기별 step p50 범위 ms','경기별 step p95 범위 ms','p50들의 중앙값 ms','p95들의 중앙값 ms'],perf)}

500개 실제 Chrome rAF 10판, 기본 물리/속도 3/high, 매번 새 시드, 동시 Node 감사 부하. wall은 시작 클릭부터 모달과 결과 전체 표시까지입니다. GC 후 JS heap만 측정했고 전체 프로세스 메모리가 아닙니다.

${table(['판','도착/고유/모달 행','벽시계 초','running frame p50/p95/max ms','GC 후 heap MiB','리스너/rAF/AudioContext/DOM canvas','sprite cache'],lifeRows)}

최종 콘솔 ${life.console.length}, 네트워크 오류 ${life.networkErrors.length}. 리스너 68·활성 rAF 1·AudioContext 1·DOM canvas 3은 일정했습니다. heap ${f(life.rounds[0].heap.usedSize/1048576)}→${f(life.rounds[9].heap.usedSize/1048576)}MiB, sprite ${life.rounds[0].caches.sprites}→${life.rounds[9].caches.sprites}개입니다. 유한 색상 glow 캐시 증가가 관찰돼 R06으로 기록했습니다. 10판만으로 장시간 무누수를 보증하지 않습니다. 각 경기 mixing의 최대 프레임 간격은 ${range(life.rounds.map(r=>r.frameTime.mixing.max))}ms로 시작/이전 GC/설정·입력 대기 구간이 포함됩니다. 이를 경기 running의 p95로 섞지 않았으며 mixing 구간의 현장 기기 체감은 별도 확인이 필요합니다.

품질 비교는 정지한 500개 초기 화면, 1280×720/DPR3, 20회 warm-up+200회 동기 render CPU입니다. 실제 게임 전체 FPS 검증이 아닙니다.

${table(['품질','실효 DPR','canvas 픽셀','입자 상한','render CPU p50/p95 ms'],quality.result.map(r=>[r.quality,r.dpr,r.pixels,r.particleLimit,`${f(r.renderCpuP50)}/${f(r.renderCpuP95)}`]))}

픽셀·입자 상한 감소는 확인됐지만 이 CPU 표본에서 low가 더 빠르다는 결과는 나오지 않았습니다. 정지 화면 캐시/동시 부하/실제 입자 부재를 고려해야 합니다. 모바일 FPS 개선이라고 주장하지 않습니다.

### 수정 전/후와 브라우저

| 항목 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 전체 자동 검사 | 181/181 통과(재현·접근성 결함을 잡지 못함) | 192/192 통과·실패 0 |
| REPLAY-RELEASE-0 서로 다른 손 출발 | 우승 marble-2→marble-4, 전체 순위 불일치 | 저장 starts 복원 순위·시간 완전 일치; 손상/설정/ID 검사 통과 |
| 실제 브라우저 직전 재현 | 불일치 | 전체 순위·시간 일치; 새 컨텍스트 localStorage 복원 후도 일치 |
| Node↔Chrome 캡처 출발 | 전수 미실행 | 1표본 순위·시간 완전 일치(다른 엔진 전수 아님) |
| 키보드만으로 출발 | mixing에서 30초 timeout | running 및 결과 dialog 도달. R11 공정성은 미해결 |
| 작은 muted/subtle 문자 | 최소 2.45:1/3.69:1 | 종이 4.93:1, 패널 5.37:1 |
| favicon 요청 | 실제 404 두 번 | 최종 로컬 console/network/HTTP 오류 0 |

최종 로컬 하위 경로 로드: 콘솔 ${browser.loads[0].console.length}, requestfailed ${browser.loads[0].failed.length}, 앱 HTTP 오류 ${browser.loads[0].httpErrors.length}. 라이브는 기준 커밋이라 favicon 404가 두 번 발생하며 PW+CDP의 중복 로그는 4행입니다. 라이브 주요 JS/CSS는 수정 전 기준 소스와 일치합니다. push/배포가 없어 수정 후 라이브 통과라고 기록하지 않습니다.

15개 viewport/DPR에서 가로 overflow 0, 실제 결과 dialog 포커스와 ESC 닫힘, 다시 설정하기·초기화·새로고침 intro 복귀를 확인했습니다. 터치 합성 pinch는 camera.zoom 0.3423→0.6417, pageScale=1, 회전 후 좌표 유한/running, 설정 패널 scrollTop 0→476. storage getter 예외도 intro 부팅, XSS 실행/삽입 img 0, INPUT 포커스 F 무시를 확인했습니다. 진짜 background hidden은 획득하지 못했으므로 별도 미검증입니다. 근거는 browser-edge.json/background.json과 setup-*.png/mobile-final.png입니다.

P0/P1 수정 커밋은 각각 3c961a1(재현), a038aeb(키보드 완주), 11fa472(대비)입니다. 5096b66은 작은 배포 메타/아이콘 수정입니다. 물리/맵/스킬/당첨/막힘 방지 계산은 원본과 같습니다. 키보드는 기존에 진행할 수 없던 경로가 생겼으므로 그 경로의 출발 분포는 R11로 새로 측정했습니다. 저장 재현은 새 손동작을 수행하던 동작에서 이전 starts를 복원하는 동작으로 바뀌며 이 시드 호환성 범위를 위 결정론 절에 기록했습니다.
`;
const file='docs/release-check/REPORT.md',before=fs.readFileSync(file,'utf8');if(!before.includes('## 수치 부록'))throw new Error('Report marker absent');fs.writeFileSync(file,before.replace(/## 수치 부록[\s\S]*/,text));console.log({games,violations:totals,over120:over,under10:under});
