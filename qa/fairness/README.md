# 2차 릴리스 QA

`PLAN.md`는 결과를 보기 전에 고정한 기준과 시드 구획이다. `FROZEN.md`는 최종 검사 전 채택 프로토콜 동결 기록이다. 기존 `qa/results/`는 1차 원시 자료이며 이번 결과는 `results/`에 별도로 보존한다.

```sh
node qa/fairness/run.cjs --phase=pilot --seeds=20 --workers=4
node qa/fairness/run.cjs --phase=baseline --seeds=5000 --workers=4
node qa/fairness/run.cjs --phase=candidate --candidate=a --seeds=3000 --workers=4
node qa/fairness/run.cjs --phase=candidate --candidate=b --seeds=3000 --workers=4
# 프로토콜 동결 후, 미사용 시드에서 한 번만:
node qa/fairness/run.cjs --phase=final --seeds=5000 --workers=4
node qa/fairness/run.cjs --phase=screen --seeds=3000 --workers=4
node qa/fairness/run.cjs --phase=duration --seeds=100 --workers=2
node qa/fairness/build-duration.cjs
node qa/fairness/browser.cjs --stage=final
node qa/browser/run.cjs --local-only --out-dir=qa/fairness/results/final-browser
npm run qa
```

모델은 실제 HandScene·HandShuffle·ThrowGate·출발 커밋·Physics·당첨 함수를 native Node adapter에서 실행한다. 단독 시드는 경기뿐 아니라 손 입력 생성에도 사용되므로 경로/설정/소스 버전이 함께 있어야 재현된다. 후보 a/b 명령은 **수정 전 출발 소스**에 대한 실험이다. b가 제품에 적용된 뒤 후보 b를 다시 실행하면 중복 배정이 되므로 실행하면 안 된다. 최종 검사에는 `candidate=none`으로 제품 소스를 그대로 사용한다.

각 `.json.gz`는 시드별 완주 여부/승자/그룹/기하 슬롯/경기 시간/손 파라미터/오라클 오류를 포함한다. 요약 `.json`의 `sha256`은 압축을 푼 원문 JSON 바이트의 해시다. 출력의 `cpuMs`는 프로세스 스케줄링을 포함한 표본 경과 시간이며 실제 CPU 사용 시간이 아니다. 모든 ID/그룹/슬롯 비율에는 Wilson 95% CI가 포함된다. 슬롯 p 값은 참고값이며 제품 합격 기준에 사용하지 않는다.

6/12개 이하 표본은 모든 물리 tick에서 유한수·경계를 검사한다. 더 큰 표본은 비용을 줄이기 위해 120 tick마다 검사한다. 모든 공 수에서 도착 로그/순위 중복·누락과 first/last/nth/top 오라클을 검사한다. 경기 제한 900물리초의 미완주는 검열로 기록한다. 렌더러/FPS/실제 기기 성능/숨김 탭을 시뮬레이터가 검증하지는 않는다.

브라우저 측정은 시스템 Chrome의 별도 임시 context, localhost의 `/moonbangoo_PinBall/` 하위 경로와 CDP 합성 터치 이벤트를 사용한다. 사용자가 열어 둔 탭을 수정하지 않는다. `browser-revert.json`의 live 관측은 수정되지 않은 기존 배포의 상태다.

장시간 실행을 멈출 때는 SIGINT/SIGTERM을 한 번 보내고 실행 중 배치 저장 및 `Paused safely` 메시지를 기다린다. 동일 인자에 `--resume`을 추가해 재개하면 완료 배치는 재실행하지 않는다. 강제 종료 등으로 미저장 실행 중 배치가 남으면 재개를 거부하고 holdout을 조용히 재사용하지 않는다. 소스·설정·Node 버전이 바뀐 재개도 거부한다.

완성된 결과 경로는 모든 단계에서 덮어쓰기를 거부한다. 새 dev 실험은 별도 phase 이름·시드 구획을 사전 등록한다. 수정 전 재현에는 원시 결과의 `sourceCommit`에 해당하는 소스를 사용한다.
