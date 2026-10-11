# 수정 전 측정

기준 커밋: 6132a255430f5897750135d2caf2a69210bf4f78. 감사 브랜치: release-check/final-audit.

- 기존 자동 검사: 181/181 통과, 실패 0 (`qa/results/tests-before.txt`).
- GitHub Pages API: main 루트 legacy Pages, HTTPS, built, 같은 커밋 배포 (`qa/results/pages-build-before.json`).
- 같은 `REPLAY-RELEASE-0`, 6개, 기본 물리, 서로 다른 저장되지 않는 손 상태: 우승 marble-2 → marble-4, 전체 순위/시간 불일치 (`qa/results/replay-before.json`).
- 원인: js/main.js throwMarbles는 실제 손 출발을 반영하나 js/ui.js rememberRound는 시드·설정만 저장. 재현 버튼이 손 출발을 복원하지 않는다. P0. 물리 규칙 변경 없이 출발 상태 저장/복원으로 수정한다.
- 보안 입력·300개 시드 매트릭스·브라우저 조사 진행 중. 최종 판정은 REPORT.md에 기록한다.
