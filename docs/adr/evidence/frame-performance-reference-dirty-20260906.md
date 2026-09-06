# 미사용 dirty Set 구독 제거 — 2026-09-06

## 원인과 변경

BuilderCanvas가 `dirtyElementIds`를 구독하고 renderer 입력에 전달했지만, 현재 layout publisher와 Skia consumer는 이 필드를 읽지 않았다. layoutVersion effect의 Set 정리가 Canvas를 재렌더하고 입력을 다시 생성했다. 가이드 §2·3의 필요한 상태만 구독하고 불필요한 상위 갱신을 제거하는 방향에 따라 구독과 미소비 input 필드를 제거했다.

store의 dirty 기록/정리, layoutVersion, scene/document revision, canonical/history/저장, matching main submission readiness는 유지한다. 타입 제거에 맞춰 renderer fixture와 시각 검증 harness의 두 호출도 변경했다. `persistentLayoutTree`의 별도 dirty root 인수와 subtree helper는 변경하지 않았다.

기준은 `24073906a` + 직전 publisher useMemo WIP다. 양쪽에 기존 개선을 동일하게 포함한다.

## React 진단과 production 비교

production profiling + CPU sampling의 동일 10회 편집/복원에서:

| 진단                        |  before |   after |
| --------------------------- | ------: | ------: |
| BuilderCanvas render        |      33 |      11 |
| 전체 React commit           |      55 |      44 |
| BuilderCanvas self duration | 140.3ms | 100.6ms |

self duration은 fiber actualDuration에서 직접 자식 시간을 뺀 진단값이다. 단일 profiling 비교의 시간·횟수를 일반 배포 CPU나 모든 시나리오로 일반화하지 않는다.

아래는 별도의 일반 production 빌드, 동일 600요소 snapshot, 50회 폭 편집/복원, visible Chrome, frame capture on/GPU timer off, CDP threadTicks/Chrome trace다. before/after, after/before, before/after 순서 3쌍을 사전 고정했으며 측정 중 다른 빌드/테스트를 실행하지 않았다.

| 쌍     | CPU before→after (ms/s) | frame p99 before→after (ms) |
| ------ | ----------------------: | --------------------------: |
| 1      |       227.579 → 226.890 |                 49.6 → 48.8 |
| 2      |       227.441 → 225.727 |                 50.4 → 48.7 |
| 3      |       230.064 → 204.229 |                 50.6 → 41.1 |
| 중앙값 |       227.579 → 225.727 |                 50.4 → 48.7 |

CPU 중앙값 **0.81% 감소**, frame p95 **9.4ms 동일**, renderer RAF **51회 동일**. 세 번째 쌍 변화가 커 반복 변동성이 있다. CPU 효과는 작고 통계적 유의성/타기기 성능은 입증하지 않는다. 측정된 React 갱신 제거와 미사용 구독 정리를 근거로 채택한다. 기존 단계 개선율과 합산하지 않는다.

## 검증

- renderer input/frame·page roots/publisher: 5 files, 35 tests PASS.
- codex:preflight/type baseline 0, git diff --check PASS. 최초 typecheck의 harness 미제거 필드 두 오류는 해당 전달 제거 후 해소했다.
- 일반 production live: 폭 237px → render bounds 237 → 실제 main submission 증가 → Undo props/bounds 복원 PASS.
- 비교 구간 page error 0, visible, fixture SHA 동일. 양쪽 startup의 기존 Pretendard 404만 남았으며 측정 중 오류 없음.
- Spec/CSS/Preview·시각 속성 계산은 바꾸지 않았다. 입력 consumer 부재를 확인하고 관련 회귀 및 실제 Builder 편집을 검증했다. 전 컴포넌트 pixel matrix는 반복하지 않았다.

로컬 원본은 `docs/migrations/evidence/frame-performance/reference-dirty-20260906/`의 manifest/build SHA, react-profile-before/after.json, cpu-profile-before/after.json, 각 pair trace, summary.json, live.json, tests.log, preflight.log에 있다. 인증 snapshot은 `/private/tmp`에만 유지한다. rollback은 BuilderCanvas 구독과 renderer input 필드 전달을 함께 원복한다. 기존 publisher WIP를 보존하며 commit/push는 수행하지 않았다.
