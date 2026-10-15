# LG 디스플레이 최적화 검증 도구

운영 코드에 계측을 삽입하지 않고, 로컬 임시 HTTP 서버와 설치된 Chrome/Playwright를 사용한다. 패키지·브라우저를 설치하거나 시스템 설정을 바꾸지 않는다. 전자칠판 내장 시스템을 원격으로 조작하는 도구가 아니다.

- `results/baseline-source.json`: 작업 시작 HEAD, 운영 68파일 해시, 고정 기준 사본 위치, 보존할 기존 작업 해시. 기준 사본은 이 작업에서 `/tmp`에 작성했다. 사본이 사라졌다면 이 실행의 before 결과를 재생성한 것으로 주장하지 않는다.
- `node qa/lg-display/measure.cjs before|after`: 동일한 7조건(4K/50공 네 맵, 기본맵 4K 반복, 1080p/6공, 1280×720/DPR3/6공). 1.8초 소개·설정, 실제 붓기·셔플·비행, 3.5초 경기, 카메라, 1.8초 결과를 계측한다. 마지막 결과 전환은 수동 물리 fast-forward이며 정상 완주 시간/프레임 검사가 아니다.
- `node qa/lg-display/verify.cjs --flow-only`: 동일 페이지에서 최소 300초 동안 맵을 바꾸며 4K/50공을 실제 rAF로 완주하고, 직전 기록의 빠른 재현 결과를 비교한다. 네 맵의 비행 5진행률×2표시배율에서 기존 이중 렌더 경로와 단일 경로의 game/cinema 캔버스 RGBA를 비교한다. 터치 취소·다중 접촉·resize·blur/방향 이벤트와 경기 핀치를 확인한다.

`measure`는 rAF 간격 p50/p95/p99, 25ms 초과 간격, long task, JS 함수/Canvas 명령 제출 시간, CDP task/script/layout/style 시간, JS heap, 합성 포인터→다음 관측 rAF 간격, CPU 샘플을 저장한다. Canvas 계측 비용도 포함되므로 전후 동일 도구를 사용해야 한다. GPU 실행 시간·OS 전체 CPU/GPU 점유율·화면에 실제 표시되는 시각·실제 터치 지연·이미지 개별 디코딩 시간은 측정하지 않는다. `loadWallMs`는 로컬 networkidle 대기까지 포함한 도구 관측값이다.

계측 phase는 사용자 조작/상태 전환 경계를 포함한다. `flight` 구간에 첫 running 프레임이 포함될 수 있어 `render` 횟수와 `flight` 횟수를 단순히 나누어 정확한 프레임별 호출 수로 취급하지 않는다. 별도 회귀 검사에서 소유권과 정확한 끝점 프레임을 확인한다. before/after CPU 프로파일은 경기 구간만 대상으로 한다.

`verify`의 heap 강제 GC는 라운드 사이 유지 메모리 진단이다. 정상 동작이 GC를 직접 요청하도록 바꾸지 않는다. 5분 표본은 하루 종일 동작·열/메모리 압박·실물 기기 안정성을 보장하지 않는다. 기존 `qa/four-maps/browser.cjs` 및 `qa/deploy-layout-smoke.cjs` 결과는 별도 디렉터리에 저장해 기존 증거를 덮어쓰지 않는다.

엄격한 픽셀 대조는 옵션 없이 실행한다. 이번 원본 4K 대조는 미세 채널 차이로 실패했으며 `verification-attempt2/3.json`에 보존했다. `--flow-only`는 해당 실패를 통과로 바꾸지 않고 독립 기능 검사를 수행한다. `--software-pixels --probe`는 원인 조사용 단일 맵 대조이며 GPU만의 문제라는 가설도 확인하지 못했다.
