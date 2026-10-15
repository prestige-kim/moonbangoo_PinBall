# 프로그램 구조 및 성능 사전 분석

분석일: 2026-10-15. 범위: 현재 체크아웃의 운영 소스·설정·QA 도구·기존 검증 기록에 대한 정적 분석. 이번에는 프로그램 실행, 빌드, 성능 검사, 패키지 설치를 하지 않았다.

| 근거 구분 | 이번 문서의 의미 |
|---|---|
| 코드 확인 | 현재 파일을 직접 읽어 확인한 동작·상수·호출 관계 |
| 기존 실행 기록 | 저장된 보고서의 결과. 해당 소스·조건에서의 증거이며 새 실행 결과가 아님 |
| 측정 가설 | 코드상 비용 발생 가능성. 병목이나 개선 효과는 미확정 |
| 미확인 | 현재 코드·기록으로 판단할 수 없는 사항 |

분석 HEAD는 `f8a3631333d7592136555d81f09b92aebeddd357`(분기 `codex/four-maps-local`)이다. 마지막 배포 기록의 SHA는 `12a2f071ddafbb59a775131291d8e2fd91fb9a76`. 이번에 `docs/deployment-2026-10-15/candidate-source.json`의 운영 파일 **68개 SHA-256을 현재 파일과 읽기 전용으로 대조해 모두 일치**함을 확인했다. 이는 현재 서비스에 새로 접속한 검증이 아니다. 원격 `git ls-remote --symref origin HEAD`는 DNS 오류로 실패했으므로 현재 원격 기본 브랜치와 실서비스 최신 상태는 **미확인**이다.

## 1. 프로그램 개요

**어른뭉방구 — 핀볼**은 공을 직접 쏟고 섞어 맵에 발사한 뒤 도착 순위로 당첨자를 정하는 브라우저 게임이다(`index.html`, `js/main.js: chooseWinners`). 모임 등의 시각적 추첨이 핵심 사용 사례다. 참가자 그룹과 수량, 추첨 규칙, 물리 설정을 바꿔 실행한다.

현재 구현은 배포 이력이 있는 정적 웹 앱이며, 별도 비교·검토 페이지와 자동 QA 도구도 포함한다. 패키지 버전 `0.0.0`은 QA 패키지의 값으로 제품 완성도나 릴리스 버전을 뜻하지 않는다.

| 실제 표시 맵 | ID / 지형 버전 | 코드에서 확인한 컨셉 |
|---|---|---|
| 연못 정원 | `classic` / 2 | 핀·범퍼·회전 장애물·좁아지는 통로 |
| 바람 도서관 | `twinfold` / 10 | 움직이는 서가·책받침·바람 구간 |
| 빗살 협곡 | `cascade` / 7 | 엇갈린 빗살·움직이는 지형·바위 받침 |
| 태엽 공장 | `rhythm` / 5 | 회전 드럼·분배 통로·타격 패드 |

표시명은 `js/map-registry.js: MAP_NAMES/mapInfo`가 담당한다. 맵 데이터의 내부 이름과 사용자 표시명을 혼동하면 안 된다. 맵 너비는 1,000, 높이는 11,200, 결승 y는 11,000이다(`js/maps.js`, `js/maps/*.js`).

구현되지 않은 것으로 확인되는 실행 구조는 서버 경기 처리·사용자 계정·서버 DB·실시간 온라인 대전이다(운영 진입점과 JS에서 해당 연결 경로 없음). 향후 제품 로드맵은 미확인이다. 전체 참가자 공정성 holdout 검증 완료는 README에서도 보장하지 않으며, 모든 시드·환경의 완주나 시간 균형을 보장하는 상태도 아니다.

## 2. 주요 기능 및 사용자 실행 흐름

| 단계 | 기능과 내부 처리 |
|---|---|
| 소개 → 설정 | 색상 그룹별 수량, 맵, 추첨 규칙 선택. 총 공 수 1~50개 검증(`Physics`, `parseNames`, `colorNames`) |
| 준비 → 붓기 | 유리관을 드래그해 기울이고 실제 중력·충돌 계산으로 공을 쏟음(`HandScene.stepPour`) |
| 원형 셔플 → 발사 | 포인터로 원형 영역 안에서 공을 섞고 출구로 이동. `ShuffleInput` → `HandScene`/`HandShuffle` → `ThrowGate` |
| 비행 → 경기 | 확정된 상단 출발 슬롯으로 시각적 비행. 끝점 표시 후 120Hz 경기 계산 시작(`HandFlight`, `main.js`) |
| 경기 | 선두 추적 카메라, 실시간 순위·미니맵, 충돌 효과·음향, 속도·확대·이동 조절 |
| 결과 | 1등·꼴등·N번째·상위 N명 추첨. 첫 완주 후 중도 정지 가능하며 미완주 공은 최종 순위를 받지 않음 |
| 재실행 | 같은 멤버로 새로 섞기, 다시 설정, 직전 출발 기록 재현, 홈·음악 크레딧 링크 |

기본 물리는 크기 12, 중력 620, 반발력 0.72. UI 범위는 각각 8~16, 350~1500, 0.35~0.92이며 게임 속도는 0.5~3배다(`index.html`). 물리 생성자의 내부 허용 범위는 UI보다 넓으므로 QA에서 직접 주입하는 조건과 사용자 설정을 구별해야 한다.

기본맵은 랜덤 스킬과 정지 구제를 지원한다. 추가 맵의 등록 기본 정책은 `skills:false`, `recovery:false`다(`map-registry.js`, `Physics.mapPolicy`). 테마 데이터가 여러 개 존재하더라도 모든 테마가 현재 UI에서 선택 가능한지는 별도 확인이 필요하다.

## 3. 기술 스택 및 의존성

| 구분 | 확인한 기술 / 요구사항 |
|---|---|
| 운영 코드 | HTML5, CSS, 일반 JavaScript. 클래스·화살표 함수·Map/Set·선택적 체이닝 등을 사용. ECMAScript 목표 버전 설정·트랜스파일 없음 |
| UI / 그래픽 | DOM·CSS + Canvas 2D. React/Vue, 외부 물리 엔진, WebGL/WebGPU 호출 없음 |
| 음향 | Web Audio API 합성 효과음 + `HTMLAudioElement` 로컬 MP3 음악(`AudioEngine`) |
| 앱 의존성 | 운영용 npm 의존성 없음. `<script>`로 로컬 JS를 순서대로 로드 |
| 개발 / QA | Node.js CommonJS, 내장 `node:test`, Playwright `1.64.0`. lockfile v3 |
| 개발 런타임 | 프로젝트 자체 `engines` 지정 없음. 잠금 파일의 Playwright 요구사항은 Node `>=20` |
| 에셋 | 로컬 PNG/SVG, WOFF2(Pretendard Variable), MP3. 이미지 생성 도구는 실행 시 의존성이 아님 |
| 배포 | 빌드 없는 정적 파일 제공. 마지막 확인 기록은 GitHub Pages `main` 루트 자동 배포 |

`npm test`/`npm run qa`는 `node --test --test-concurrency=4 tests/*.test.cjs qa/*.test.cjs`, `qa:sim`과 `qa:browser`는 별도 검사 진입점이다(`package.json`). 일반 이용에는 Node/Python이 필요 없다. README의 로컬 HTTP 예시는 `python3 -m http.server 8765 --bind 127.0.0.1`이다. `file://` 오프라인 실행은 README의 안내이며 이번에 직접 확인하지 않았다.

## 4. 아키텍처와 핵심 모듈

운영 코드는 IIFE가 `window.CosmicPinball` 네임스페이스에 기능을 등록하는 구조다. 번들러·ES 모듈 import·DI 프레임워크 없이 `index.html`의 스크립트 순서에 의존한다.

| 핵심 파일 / 구성 요소 | 책임과 연결 |
|---|---|
| `js/main.js` | `UI`, `Physics`, `Renderer`, `Camera`, `Effects`, `AudioEngine`, 준비/발사 객체 생성. 설정 정규화·상태 전환·프레임 루프·결과 결정 |
| `js/maps.js`, `js/map-registry.js`, `js/maps/*.js` | 지형·맵 정책·표시명·장식 스타일 등록. 물리와 렌더러가 같은 지형 참조 |
| `js/physics.js: Physics` | 시드 RNG, 출발 배치, 고정 스텝, 충돌·필드·스킬·구제·결승 순위·이벤트 |
| `js/shuffle.js: HandShuffle`, `js/hand-scene.js: HandScene` | 준비 단계의 별도 물리 모델과 붓기·셔플 렌더링 |
| `js/shuffle-input.js`, `js/throw-gate.js` | 포인터 제스처 수명 관리와 출구 발사 판정 |
| `js/hand-start.js` | 출발 위치·속도 확정, 버전 2 기록 생성·호환성 검사·재현 |
| `js/hand-flight.js: HandFlight`, `js/cinematic.js: Cinematic` | 확정 슬롯으로 비행, 소개/설정과 공통 캔버스·에셋 처리 |
| `js/renderer.js: Renderer`, `js/themes.js`, 맵 `*-style.js` | 경기·배경·장애물·공·라벨·미니맵, 색상/해상도 설정·캐시 |
| `js/camera.js`, `js/race-standing.js` | 화면 좌표 변환·추적·이동/확대, 표시용 선두 판정 |
| `js/ui.js`, `style.css` | DOM 설정·HUD·결과·레이아웃·포커스·직전 기록 저장 |
| `js/effects.js`, `js/audio.js`, `js/display-budget.js` | 입자·충돌 연출, 음향, 표시 해상도 예산 |

핵심 경로는 `index.html → 모듈 등록 → main 초기화 → UI/포인터 이벤트 → mixing → flight → running → finish`다. `P.app`은 상태·물리·렌더러·진단값 등을 QA에 노출한다. `Cinematic`에 남아 있는 과거 연출 코드 전체가 현재 비행 경로인 것은 아니다. 현재 비행은 `main.renderCinema → HandFlight.render`다.

운영 JS는 브라우저 메인 스레드에서 실행한다. `Worker`, `SharedArrayBuffer`, `OffscreenCanvas` 작업자 경로는 확인되지 않았다. 이미지 로딩/디코딩·오디오 재생 Promise 등은 비동기지만 경기 계산을 다른 JS 스레드로 옮기지는 않는다. 반면 `qa/sim/run.cjs`, `qa/final-review/audit.cjs`, `qa/race-tension/measure.cjs`는 Node `worker_threads`로 검사만 병렬화한다.

## 5. 화면 렌더링 및 입력 처리 구조

`index.html`의 경기 `game-canvas`, 연출 `cinema-canvas`, 고정 재질 `game-surface`, 미니맵과 DOM 패널을 겹친다. `style.css`의 반응형 레이아웃·전환과 Canvas 그림이 함께 화면을 만든다. 영상 파일은 검토 자료이며 정상 경기의 필수 렌더링 경로는 아니다.

| 항목 | 실제 처리 |
|---|---|
| 갱신 루프 | `main.frame(timestamp)`가 `requestAnimationFrame`을 계속 예약. 설정·결과 화면도 완전한 이벤트 전용 정지 화면이 아님 |
| 경기 렌더 | 배경 → 보드/장애물 → 효과 → 공/완주자 → 라벨/당첨 연출. 카메라 변환과 세로 가시 범위로 그릴 대상을 제한(`Renderer.render`) |
| HUD | 약 0.1초마다 순위·시간·미니맵 갱신. 전환 직후에는 viewport를 더 자주 읽음 |
| 캐시 | 종이/비네트·보드 타일·공/이름 스프라이트를 일반 메모리 캔버스에 캐시. 보드 타일은 과거 밀도 캐시를 제거하고 현재 것을 보유 |
| 이미지 | 맵별 배경 v2·장애물 재질은 `Image`로 로드하고 준비 전 대체 그림 사용. 배경 onload에서 revision을 바꿔 캐시 재생성 |
| GPU | Canvas 2D와 CSS 합성 사용은 확인. 실제 GPU 가속 여부·GPU 모델·백엔드·드라이버는 미확인. WebGL 컨텍스트를 생성하지 않음 |

주 입력은 마우스/터치의 Pointer Events다. `ShuffleInput`은 포인터 캡처, 좌표·시간 전달, 다중 접촉 취소, blur/숨김/회전 시 제스처 취소를 처리한다. 이벤트 → 준비 상태·포인터 속도 갱신 → 다음 고정 스텝 → 다음 rAF 표시 순서다. `Camera.bind`는 드래그 이동과 두 포인터 핀치를 처리하며 버튼으로 확대·축소·추적을 조절한다. 휠 줌 등록은 없다.

키보드는 DOM 버튼/폼과 `UI.bindSceneKeys`의 Tab 포커스 순환·Escape 설정 취소/모바일 패널 닫기 등에 사용한다. 경기 조종용 키보드 단축키·게임패드 경로는 없다. 공 쏟기·셔플을 키보드만으로 수행하는 대체 조작은 확인되지 않았다.

입력·물리·그림·DOM이 같은 메인 스레드를 공유한다. 설정 변경의 동기 `localStorage` 쓰기와 preview/resize, 고비용 프레임이 입력 대기에 영향을 줄 가능성이 있지만 실제 입력 지연은 측정하지 않았다.

## 6. 성능 관련 코드와 설정

| 항목 | 설정 / 코드 근거와 의미 |
|---|---|
| 물리 주기 | `main.js: STEP=1/120`, `Physics.step`: tick 정수로 시뮬레이션 시간 계산. 디스플레이 FPS와 분리 |
| 프레임 시간 | `frame`의 dt 상한 0.12초. 숨긴 탭은 계산/그리기를 건너뛰고 시간 기준 초기화. 실제 경과 시간 전체를 따라잡지 않음 |
| 계산 예산 | `updateRace`: `dt × speed × (접전 시 0.32)`를 누적, 프레임당 최대 48스텝. 잔여 accumulator는 다음 프레임으로 남김 |
| 준비 계산 | `HandScene.update`: accumulator 상한 0.05초, 120Hz 처리. `HandShuffle.step`: 속도/반경에 따라 1~12 하위 스텝 |
| FPS / 동기화 | 고정 표시 FPS 상한·VSync 선택 API 없음. rAF 전달 주기는 브라우저/주사율/절전 정책에 의존. FPS 진단은 약 0.75초마다 계산 |
| 기본 해상도 | `themes.js: renderDensity`: `min(max(1,DPR),4,sqrt(12000000/(width×height)))`. 고해상도에서는 CSS 픽셀당 밀도가 1보다 낮아질 수 있음 |
| 동적 해상도 | `DisplayBudget`: 90개 간격 표본, 하위 10% 부근 기준 주기. 지연 비율 >18% 또는 기준 <23.5fps이면 ×0.85, 최소 0.65. 여유 6구간 후 +0.08, 최대 1 |
| 품질 하향 | `main.adjustQuality`: 플레이 중 22fps 미만이 6초 넘으면 효과 품질 한 단계 하향, cooldown 8초. 사용자 저장 품질은 덮어쓰지 않음 |
| 효과 예산 | 입자 high/medium/low 900/420/140(`themes.js`), 재사용 pool(`Effects`). 효과음 동시 voice 4·hit 간격 0.30초(`SOUND_CONFIG`) |
| 이미지 타일 밀도 | `Renderer.boardTile`: 이미지 배경은 최대 2, 절차적 대체 타일은 최대 4. 확대·DPR·배경 revision에 따라 재생성 |

`P.CONFIG.lowFpsThreshold=45`가 선언되어 있어도 현재 자동 품질 판정은 `main.js`의 22fps 조건이다. 설정 선언만으로 실제 사용값을 단정하면 안 된다.

**CPU 관련 코드 확인:** `Physics._indexObstacles`는 정적 장애물을 96 단위 공간 격자에 한 번 등록한다. `step`은 매 tick 동적 장애물 pose와 격자를 재구성하고 공별 접촉을 계산하며, 공끼리 충돌을 두 차례 해결한다. `_pairs`와 셔플 `pairs`도 공간 격자를 사용하므로 모든 경우를 단순 전체 공 쌍 순회로 설명할 수 없다. 국소 밀집도·접촉 수·동적 지형 수·스킬에 따라 비용이 달라진다. 카메라와 렌더링·음향·DOM 처리가 이 계산과 한 스레드를 공유한다.

**메모리 관련 코드 확인:** 동적 격자 bucket/entry, 접촉 목록, `getRanking`의 filter/sort/concat, 프레임 내 여러 순위 조회가 단기 객체를 만든다. 공 trail은 3tick마다 점을 추가하며 최대 14개를 유지한다. `drainEvents`는 이벤트 배열을 교체한다. 셔플 격자/후보 쌍도 반복 생성한다. 효과 입자는 pool을 사용하지만 모든 경로가 무할당인 것은 아니다.

배경 v2 네 장은 각각 1024×1536이며 현재 파일 합계 약 12.1MiB(12,715,408바이트)다. 네 장이 모두 RGBA 4바이트로 디코딩되어 유지된다고 가정하면 원본 픽셀만 약 **24MiB**라는 계산상 추정이다. 실제 디코더/캐시/캔버스/GPU 메모리는 미측정이다. 과거 v1 파일의 저장소 존재와 실제 v2 로딩을 구별해야 한다. 전체 화면 버퍼·타일·스프라이트는 여기에 추가된다.

네트워크 I/O는 정적 JS·폰트·그림·음원 요청이 중심이며 경기별 서버 응답은 없다. 준비 전 에셋 다운로드/디코딩은 첫 화면과 첫 사용 비용의 측정 대상이다. 설정 키 `mungbanggu-pinball-settings-v2`와 직전 경기 키 `mungbanggu-pinball-last-round`는 동기 localStorage를 사용하고 실패를 catch한다. 일반 사용자 파일 저장·DB·외부 API 호출은 확인되지 않았다.

## 7. 외부 환경 및 하드웨어 의존성

| 의존 요소 | 확인한 사항 / 미확인 사항 |
|---|---|
| OS / CPU | 운영 코드에 네이티브 바이너리·CPU 아키텍처/명령어 분기 없음. 실제 지원 OS/브라우저 최소 버전 매트릭스는 미확인 |
| 브라우저 API | Canvas 2D, rAF, Pointer Events/capture, Map/Set, 현대 JS 문법, localStorage, dialog, Web Audio/HTMLAudio 사용. API 지원·저장 차단·자동 재생 정책 영향 |
| GPU / 드라이버 | 코드의 특정 GPU 요구조건 없음. Canvas/CSS의 실제 가속·합성·소프트웨어 fallback과 성능은 브라우저 환경에 의존 |
| 화면 | CSS viewport, `devicePixelRatio`, 확대율, 화면 방향·주사율, 창 크기에 따라 버퍼·카메라·패널 배치·갱신 주기가 달라짐 |
| 입력 / 오디오 | 마우스 또는 터치가 직접 조작의 중심. 포인터 timestamp·이벤트 빈도·다중 접촉·오디오 출력/사용자 제스처 정책에 영향받음 |
| 권한 / 환경변수 | 게임에서 카메라·마이크·위치·관리자 권한 요구 없음. 운영용 환경변수·비밀키·서버 설정 없음 |
| QA 환경 | Node 및 Playwright. 브라우저 도구 다수는 `channel:'chrome'`을 지정하여 사용 가능한 Chrome 필요. QA_SOURCE_ROOT 등은 검사 도구 변수이며 게임 설정이 아님 |

브라우저 내부 오디오/디코더/합성 스레드의 사용은 브라우저 구현 사항이다. 앱 자체의 멀티스레드 설계로 간주하지 않는다. 실제 기기 CPU/GPU/RAM, 온도·전력·드라이버·디스플레이 사양은 **미확인**이다.

## 8. 확인된 문제와 성능 최적화 후보

현재 후보에서 CPU/GPU 병목을 확정할 프로파일 자료는 없다. 아래는 코드 구조상 사실과 측정할 가설을 분리한 것이다.

| 코드에서 확인한 비용 구조 | 측정 가설 / 아직 모르는 점 |
|---|---|
| 비행 시 `main.renderCinema`가 놀이판을 그린 뒤 `HandFlight.render`가 `Renderer.render`를 다시 호출하고 cinema canvas로 복사 | 비행 중 중복 그림·전체 화면 복사가 프레임 비용을 늘릴 가능성. 프레임 추적 전 병목 여부 미확정 |
| 설정/소개/결과에서도 rAF 루프 유지 | 유휴 화면 CPU·전력 소비 가능성. 실제 활성 그림과 비용 측정 필요 |
| tick별 격자·접촉·trail·순위 배열 생성 및 셔플 하위 스텝 | 밀집 충돌/빠른 손동작에서 CPU·GC 변동 가능성. 평균 공 수만으로 최대 부하 예측 불가 |
| 큰 PNG 디코딩, DPR별 캔버스·스프라이트·배경 캐시 | 첫 사용 지연·메모리 증가 가능성. 맵 변경/장시간 확대 후 캐시 수명과 최대 메모리 미측정 |
| 같은 스레드의 DOM 조회·저장·그림 | 입력 지연·layout 비용 가능성. HUD 중복 갱신 억제와 viewport 조회 절감은 이미 구현됨 |

**기존 실행 기록:** `qa/performance/README.md`와 `results/after.json`에는 기본 6공·각 5초 Chrome 표본에서 1920×1080/DPR1의 렌더 호출 평균 0.458ms/p95 0.7ms, 3840×2160/DPR1·CPU 2배 제한의 평균 0.568ms/p95 0.9ms가 있다. 프레임 p95는 약 16.7ms였다. JS 렌더 호출 시간으로 GPU 전체 시간·입력 지연이 아니다. 최근 배경/비행 변경과 동일 소스인지 확정할 측정 SHA가 이 결과에 없으므로 **현재 버전 수치로 전용하지 않는다**. 실물 TV 개선을 증명하지도 않는다.

**확인된 게임 품질 제한(실행 기록이며 하드웨어 성능 병목과 별개):** 최신 배포 보고서는 협곡 v7의 이전 1,500경기에서 공 수별 중앙값이 기본맵의 111.21~137.86%, 맵 전체 p95가 118.08%로 ±10% 기준 실패를 기록한다. 도서관 v10의 긴장감 개선 표본 효과는 작고, 후반 임의좌표 18건 중 12건은 이후 고체 접촉 없이 완주했다. 기본맵의 기존 정지 구제 발생도 남아 있다. 이 수치는 각 보고서의 조건에 한정되며 최적화 과정에서 물리 변경을 정당화하거나 전체 경우를 보장하지 않는다.

## 9. 최적화 전 추가 확인이 필요한 정보

| 필요한 확인 / 방법 | 기록할 항목 |
|---|---|
| 최종 운영 소스 고정 | HEAD·운영 파일 해시·원격/실서비스 SHA, 맵 버전, 로딩 에셋. 환경 접근 후 최신 상태 다시 확인 |
| 브라우저 프레임 추적 | Chrome Performance/CDP 등으로 소개·붓기·밀집 셔플·비행·경기·결과를 분리. CPU scripting/layout/paint/composite, long task, 프레임 p50/p95/p99 |
| 같은 조건 비교 | 맵·공 수·seed·출발 기록·물리·스킬·속도·품질·모션 감소·viewport·DPR·주사율·브라우저 버전·표시 배율 기록 |
| 물리와 렌더 비용 분리 | `Physics.step`, 셔플 하위 스텝 수, `Renderer.render`, 중복 비행 render, HUD, 최초 에셋 디코딩을 개별 계측 |
| 메모리 / 첫 사용 | DevTools heap/allocation·캐시 수·canvas 크기·네트워크 타이밍. 냉/온 캐시, 반복 맵 전환·resize·재시작 전후 비교 |
| 입력 반응성 / 환경 | 포인터 이벤트→시뮬레이션→표시 지연, 실제 터치, 숨김 복귀·화면 이동·확대·30/60/120Hz 및 오디오 정책 확인 |

기존 도구는 `qa/performance/browser.cjs`(5초 렌더/프레임/viewport 계측·CDP CPU 제한), `adaptive-browser.cjs`(강제 낮은 표시 배율·터치·재현), `tests/physics-benchmark.cjs` 및 QA 시뮬레이터다. 실행 전 현재 소스와 URL·지원 공 수·설정 일치 여부를 확인해야 한다. 특히 성능 스크립트에는 고정 로컬 URL이 있으며, 과거 대량/500공 자료는 현재 제품 한도 50공의 증거와 구별한다. 이 문서 작성 중 해당 도구는 실행하지 않았다.

회귀 시 유지할 동작은 원형 셔플·물리적 붓기/발사, 확정 출발 슬롯과 비행 끝점 연속성, RNG/120Hz 계산과 결승 동률 규칙, 그룹·50공 제한·추첨 4종, 중도 정지와 미확정 결과, 재시작, 음악/음소거·장면 전환, 카메라·입력·품질, 저장·재현, 맵/미니맵·크레딧·홈 링크다. 품질 저하나표시 배율 변경이 경기 RNG·출발·순위·완주 시간을 바꾸지 않는지 검사한다.

`hand-start.js: signature`는 맵 객체 전체·물리 tuning·크기·중력·반발력·스킬을 포함한다. 현재 기록 버전은 2이며 지형을 바꾸면 서명 호환성이 달라질 수 있다. 기존 도서관 v8/v9·협곡 v5/v6 기록은 현재 v10/v7에서 거부되고 새로 섞어야 한다는 배포 검증이 있다. 환경 변경 시 같은 기록의 정확 재현, 합성 입력뿐 아니라 실물 장치의 조작, 오디오·DPR 변화·메모리·프레임 지연을 재검증해야 한다.

기존 실행 기록상 최종 전체 테스트 301개와 서비스의 네 맵 50공 대표 흐름·재현·재시작·정지·음악 및 일부 화면/모션 감소 검사가 통과했다. 근거는 아래 배포 보고서다. 이번에는 다시 실행하지 않았으며, 모든 브라우저/하드웨어의 기능·성능 통과를 뜻하지 않는다.

## 10. 참고 파일 및 코드 근거

| 파일 / 핵심 심볼 | 분석에 사용한 근거 |
|---|---|
| `index.html`, `style.css` | 제목·화면·설정 범위·에셋 preload·스크립트 순서·반응형 UI |
| `package.json`, `package-lock.json`, `README.md` | QA 명령·잠긴 의존성·개발 런타임·로컬 실행/배포 안내. README의 과거 연출/음악 설명은 현재 코드와 구별 |
| `js/main.js`: `frame`, `updateRace`, `renderCinema`, `adjustQuality`, `finish` | 상태 머신·고정 스텝·화질·프레임/DOM·결과 처리 |
| `js/physics.js`: `Physics`, `_indexObstacles`, `_pairs`, `step`, `getRanking` | 공간 격자·충돌·구제·순위·메모리 생성 |
| `js/themes.js`: `CONFIG`, `renderDensity`; `js/display-budget.js`: `sample` | DPR·픽셀 예산·입자 한도·동적 표시 해상도 |
| `js/renderer.js`: `render`, `resize`, `boardTile`, `mapBackgroundImage` | 실제 2D 렌더링·가시 범위·캐시·배경 이미지 |
| `js/hand-scene.js`, `js/shuffle.js`, `js/hand-flight.js`, `js/cinematic.js` | 준비 물리·하위 스텝·현재 비행 이중 렌더 경로 |
| `js/ui.js`, `js/shuffle-input.js`, `js/camera.js`, `js/throw-gate.js`, `js/hand-start.js` | DOM/포인터·좌표·발사 판정·저장·기록 서명 |
| `js/effects.js`, `js/audio.js`, `music-credits.html` | pool·효과 예산·음향 API·로컬 음악/라이선스 |
| `js/maps.js`, `js/map-registry.js`, `js/maps/*.js` | 맵 형상·버전·표시명·기능 정책·스타일 |
| `qa/sim/adapter.cjs`, `qa/sim/run.cjs`, `qa/browser/run.cjs`, `QA.md`, `tests/*.test.cjs` | 실제 소스를 불러오는 검사 구조·병렬 QA·기능 회귀 범위 |
| `qa/performance/README.md`, `qa/performance/results/after.json`, `qa/performance/browser.cjs` | 과거 제한된 성능 표본·계측 방법·측정 한계 |
| `docs/deployment-2026-10-15/REPORT.md`, `candidate-source.json`, `verification.json` | 마지막 배포 SHA·운영 해시·기능 검사·알려진 제한 |
| `docs/canyon-ledges/REPORT.md`, `docs/race-tension/REPORT.md` | 맵 시간/접촉·긴장감 관련 기존 검사 조건과 결과 |
| `docs/RELEASE_MANAGEMENT.md` | 배포 기준·기능 보존·검증 기록 관리 규칙 |

이번 결과물은 이 문서 하나다. 기존 `qa/fairness/freeze.cjs` 수정과 미추적 AGENTS/배포 관리 문서/confirm 결과는 다른 작업으로 보존했으며, 소스·실행 설정·의존성·배포 상태를 변경하지 않았다.
