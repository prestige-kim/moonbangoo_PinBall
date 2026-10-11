# 릴리스 QA 실행

Node 24 이상. 게임 런타임 의존성은 0개이며 `playwright`는 QA 전용 devDependency입니다. 테스트용 코드는 index.html에서 참조하지 않습니다.

```sh
npm ci --ignore-scripts
npm test
npm run qa:sim
```

`qa:sim`은 고정 목록 `release-audit-0000`~`release-audit-0299`를 사용합니다. 기본은 **64개 물리 조합 × 300개 시드 = 19,200판**입니다. 6개 공에는 크기(8/12/16) × 중력(350/620/1500) × 반발(0.35/0.72/0.92) × 스킬 OFF/ON의 전체 54조합, 나머지 공 수(1/2/50/200/500)는 기본 물리에서 스킬 OFF/ON입니다. 기본 실행이 요구 전체 교차 매트릭스를 모두 검증한 것은 아닙니다. 작업 시간은 수십 분 이상 걸릴 수 있습니다.

```sh
npm run qa:sim -- --quick --workers=2 --out=qa/results/smoke.json
npm run qa:sim -- --full --seeds=300 --out=qa/results/full.json
node qa/sim/extended.cjs
node qa/sim/groups.cjs
node qa/sim/compare-rescue.cjs
node qa/sim/hand-fairness.cjs
node qa/sim/enrich.cjs
node qa/sim/controller.cjs --seeds=300
node qa/sim/benchmark.cjs
node qa/sim/archive-results.cjs
node qa/sim/report.cjs
node qa/sim/controller.cjs --seeds=1 --out=qa/results/controller-smoke.json
node qa/verify-evidence.cjs
python3 qa/history-scan.py
```

`--full`은 324개 **물리** 조합 × 300 = 97,200판이며 그룹·속도·브라우저까지의 완전 교차곱이 아닙니다. `--seeds`, `--workers`, `--out`으로 자원을 조절할 수 있습니다. smoke 결과로 본 보고서의 통계 표본 수를 대체하지 마세요.

- adapter: 저장소의 실제 maps/physics/shuffle/hand-start를 로드합니다. 게임 물리는 재구현하지 않습니다. main.js 중 DOM 생성 전의 실제 당첨 함수를 분리 로드합니다. 소스 경계가 바뀌면 실패하도록 했습니다.
- oracle: 관찰한 도착 ID·시간·입력 순서로 당첨자를 독립 계산합니다. 유효 N/중도 종료는 별도 경계 검사도 실행합니다.
- engine: 매 스텝 유한수·보드 경계·속도, 12스텝마다 폴리곤 중심 침범을 검사합니다. 모든 얇은 장애물의 연속 충돌 검증은 아니며, 속도 >5,000은 탐색용 폭주 기준입니다. 종료 제한은 **시뮬레이션 시간 240초**로, 시간 초과를 영구 정체의 증명으로 간주하지 않습니다.
- extended: 기본 6개 × 스킬 두 상태 × 막힘 방지 두 상태 × 1,000시드. OFF는 QA 인스턴스에서 rescueDelay만 Infinity로 바꿉니다. production 수정이 없습니다.
- hand: 실제 유리관·충돌·붓기·2초 원형 손동작을 실행합니다. 실제 UI의 같은 색 2개씩 입력 순서를 유지합니다. 현재 뷰포트와 입력 프로토콜에 대한 표본입니다.
- enrich는 hand 결과의 시드로 출발을 다시 계산해 실제 출발 슬롯과 셔플 위치 순서를 붙입니다. R02 Enter 발사는 제품 범위 밖으로 철회됐습니다. 현재 경로는 qa/fairness/README.md를 참고하세요.
- controller: 기존 integration fixture의 실제 main.js를 이용합니다. DOM·렌더러·손 입력만 mock하며 60/30/144Hz, 지터/스파이크, 속도 0.5/1/3을 비교합니다. 실제 다양한 손동작의 프레임 의존성 전체를 대체하지 않습니다.
- stats: 카이제곱 survival p-value, 최대 비율 차이(percentage points), 기대빈도 5 이상 여부. 다중 검정과 표본 한계를 REPORT에서 함께 해석합니다.

브라우저 검사에는 시스템 Google Chrome이 필요합니다. 임시 프로필만 쓰며 현재 사용자 탭·저장소는 변경하지 않습니다. Linux 등에는 `channel: 'chrome'`을 설치된 브라우저에 맞게 바꾸세요. macOS sandbox가 자식 앱/localhost 포트를 막으면 네트워크·실행 권한이 필요합니다.

```sh
npm run qa:browser
node qa/browser/edge.cjs
node qa/browser/lifecycle.cjs
node qa/browser/background.cjs
node qa/browser/quality.cjs
node qa/browser/reload.cjs
```

- run: 임시 로컬 서버의 Pages 하위 경로와 라이브를 각각 실제 마우스로 출발. 완료만 일부 빠른 물리 스텝으로 진행하므로 성능 수치로 쓰지 않습니다. 5개 viewport × DPR 1/2/3, 잘못된 저장 JSON 포함.
- edge: Chromium 합성 터치·핀치, CDP freeze, 회전, 입력 중 F, XSS 라벨·저장 차단. 휴대폰 실기기 검증이 아닙니다.
- lifecycle: 기본 물리 500개, 속도 3, 실제 rAF로 10판. GC 후 heap/리스너/AudioContext/활성 rAF 및 프레임 시간. requestAnimationFrame 취소도 추적하고 같은 timestamp는 한 프레임으로 셉니다.
- background: 별도 화면 표시 Chrome으로 탭/최소화 시도. document.hidden=false이면 숨김 동작을 검증한 것으로 보고하지 않습니다.
- quality: 정지된 500개 공 화면의 품질별 DPR/입자 한도 및 렌더 CPU를 측정합니다. 실제 게임 전체 FPS와는 다릅니다.
- reload: 완료한 출발 기록을 새로운 브라우저 컨텍스트로 복원해 새로고침 후 재현을 확인합니다.

`archive-results`는 기본 시뮬레이션 원시 JSON을 gzip으로 보존하고 SHA-256과 요약을 생성합니다. `report`는 완료된 기록으로 REPORT.md의 수치 부록을 다시 만듭니다. 전체 도착 로그는 각 run 안에서 오라클과 비교하며 압축 기록에는 시드·우승 ID·위반·시간 요약을 보존합니다. 전체 순위는 시드로 재실행해 계산할 수 있습니다. 변경된 원본 코드에서 이전 결과를 재계산하면 같은 증거가 아니므로 감사 커밋과 함께 사용하세요.

결과는 `qa/results/`에 저장됩니다. 시간은 원시 UTC, 보고서 표시 시간은 KST입니다. `QA_SOURCE_ROOT`는 물리·controller·keyboard에서 수정 전 소스 복사본을 사용할 때 지정합니다. 라이브는 수정 전 커밋을 계속 제공하며 이 감사 과정에서 push/배포하지 않습니다.
