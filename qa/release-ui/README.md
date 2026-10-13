# 결과 로고·진행 안내 제거 검증

결과 로고의 54px 금색 메달 배경과 58px 이미지가 겹치던 구조를 제거했다. 새 80×70 로고는 배경·테두리·그림자 없이 독립 표시하며, 장식선은 로고 아래로 배치한다.

진행 하단의 camera-hints 노드와 CSS 및 getViewport의 참조를 제거했다. 화면 영역은 화면 크기와 실제로 보이는 설정·HUD·미니맵·정지 버튼을 기준으로 계산한다.

- `qa/result-logo.test.cjs`: 로고 배경 제거, 안내 노드·CSS·계산 의존 제거.
- `tests/ui-launch.test.cjs`: 안내 노드가 없는 실제 조건을 모의해 기존 패널·포커스·viewport 검사를 유지.
- `node qa/release-ui/browser.cjs`: 실제 마우스/터치 완주·출발 기록/완주 순서/시간 재현, 18 viewport/DPR에서 로고 내부 이미지 유지·장식/닫기 버튼 겹침 없음·가로 넘침 없음·콘솔/네트워크 오류0.
- `node qa/release-ui/previews.cjs`: 실제 현재 UI로 README 설정·진행·정지 이미지를 저장한다. 정지 버튼이 나타나면 경기 viewport가 그 버튼 위로 제한되는지 검사한다.
- `npm run qa`: 212개 통과, 실패0. 전체 결과는 results/qa.txt. 실제 정지 버튼 영역 검사는 수정된 stop-button ID를 사용한 previews 검사에서도 통과했다.

원형 셔플의 최종 holdout 공정성은 여전히 미검증이며 README와 기존 보고서에 명시한다. 이번 수정은 경기 맵·경기 물리·셔플·출발/재현 프로토콜을 바꾸지 않는다.

공개 페이지 터치 재현 검사에서 투영 좌표 `61.99999999999999`가 출발 구역의 최소 `62`보다 작아 기존의 엄격한 재현 검사에 거부되는 사례를 재현했다. js/hand-start.js가 생성하는 출발 좌표를 기존의 정확한 허용 구간으로 clamp해 저장하도록 수정했다. 재현 형식·signature·검사 허용치는 바꾸지 않으며, 손상된/구버전 기록은 여전히 거부한다. 실제 실패 입력은 replay-boundary-source.json, 생성 좌표·정확한 재현·잘못된 기록 무변경 거부는 qa/replay-boundary.test.cjs로 검증한다.
