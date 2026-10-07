# 마우스 드래그 입력 차단 수정 — 2026-10-07

## 재현과 원인

일반 제품 페이지에서 설정→게임 시작 후 브라우저의 실제 CSS와 hit test를 읽었습니다. 셔플 상태에서도 `cinema-canvas`의 `pointer-events:none`, `touch-action:auto`가 적용되었고 화면 중앙의 마우스 대상은 `HTML`이었습니다.

디스크·서버의 CSS에는 셔플 입력 규칙이 있었지만 브라우저에 로드된 CSS 규칙 목록에는 없었습니다. HTML의 CSS URL이 이전 버전 `style.css?v=pinball-result-20261006` 그대로여서 이전 CSS가 캐시에 남았습니다. 이전 합성 PointerEvent 검수는 캔버스에 직접 dispatch했으므로 이 hit test 차단을 발견하지 못했습니다.

- [수정 전 CSS·hit test 원본](mouse-before.json), [화면](mouse-before.jpg)
- [먼저 실패시킨 회귀 검사](mouse-baseline.txt)

## 최소 수정

`index.html`의 스타일 URL만 현재 CSS SHA-256 앞 12자리로 갱신했습니다: `style.css?v=hand-e6756af51da9`. CSS 내용, 물리, 입력 모듈, 발사 판정, 경기 엔진은 변경하지 않았습니다. 회귀 검사 `tests/shuffle-styles.test.cjs`는 스타일 URL의 내용 해시를 검증하므로 향후 CSS가 바뀌었는데 캐시 키를 놓치면 실패합니다.

보통 새로고침 후 `pointer-events:auto`, `touch-action:none`, 중앙 hit target `cinema-canvas`를 확인했습니다. 캐시 삭제나 강제 새로고침을 사용하지 않았습니다. [수정 후 원본](mouse-after.json), [원래 8개 설정의 화면](mouse-after.jpg).

검수 페이지는 실제 마우스 이벤트의 종류·isTrusted·포인터 캡처를 기록하도록 보완했습니다. 실제 입력에서는 검수용 매 프레임 PNG 생성을 하지 않게 했습니다. 합성 입력 ID 999의 기존 검수는 그대로이며, 아래 검수에서는 합성 입력 버튼을 사용하지 않았습니다.

## 실제 마우스 확인

내장 브라우저 960×784에서 CUA의 마우스 드래그를 직접 실행했습니다. 모든 기록 이벤트는 `pointerType:mouse`, `isTrusted:true`, ID 1입니다. 캔버스의 실제 `setPointerCapture()`를 유지한 채 `gotpointercapture`, 캡처된 이동, 해제 후 `lostpointercapture`가 기록되었습니다.

| 조건 | 관찰 |
| --- | --- |
| 6개 무리를 가로지르는 드래그 | 입력 표본9개, 충돌2회, 실제 x순서 교환, 경계 안 해제는 발사하지 않음 |
| 500개 같은 드래그 | 입력 표본9개, 충돌12,299회, 실제 x순서 교환, 발사하지 않음 |
| 6개 중앙→바깥 빠른 던지기 | 이동0.57065S, 최종 반경0.57065S, 최근 바깥 속도4.50001S/초, 발사됨 |

- [6개 원본](mouse-native-6.json), [캡처](mouse-native-6.jpg)
- [500개 원본](mouse-native-500.json), [캡처](mouse-native-500.jpg)
- [빠른 마우스 던지기 원본](mouse-native-fast-6.json), [비행 캡처](mouse-native-fast-6.jpg)

관련 자동 검사32개 통과 후 전체 `node --test tests/*.test.cjs`는 **126개 통과, 실패0개**, 약30.97초입니다. [전체 로그](mouse-final-tests.txt). Git 공백 검사도 통과했습니다. 실제 휴대폰 터치 검증은 여전히 하지 않았습니다. 앞선 보고서의 네이티브 입력 미확인 항목은 이번 마우스 조건에 한해 후속 검증으로 보완합니다.

기존 8개 참가자, 반경11·중력620·반발력0.72·속도1·소리켬·볼륨35%·최고품질·스킬끔·모션감소끔·빈시드를 복원하고 대기 화면을 유지했습니다. 로컬 http://127.0.0.1:8778/ 를 사용하며 푸시·배포하지 않았습니다. 이 기록을 포함하는 로컬 커밋 제목은 `Refresh shuffle stylesheet cache and verify native mouse drags`입니다.
