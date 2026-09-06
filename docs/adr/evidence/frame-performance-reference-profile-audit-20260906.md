# React 진단 집계 정정과 패널 후보 기각 — 2026-09-06

## 판정

DataTablePanel 추가 최적화는 진행하지 않는다. 실제 편집 중 실행은 0회였다. 이전 profiler script가 모든 fiber의 `actualDuration > 0`을 실행으로 세면서, bailout하거나 이전 commit에서 재사용한 fiber의 잔존 시간까지 누적했다. 패널의 memo 경계를 확인한 것이 이 불일치의 발견 계기다.

직전 dirty 구독 제거의 Canvas 수치는 **33→11이 아니라 22→11회**로 정정한다. 전체 React commit 55→44회는 동일하다. 이전의 component self duration 비교(예: 219.1→168.6ms, 140.3→100.6ms)는 효과 근거에서 철회한다. raw CPU sampling과 별도의 일반 production CDP threadTicks/frame 비교는 이 집계 코드를 사용하지 않으므로 그대로 보존한다.

## 원문 기준과 재검증

[React DevTools의 didFiberRender 구현](https://github.com/facebook/react/blob/main/packages/react-devtools-shared/src/backend/fiber/shared/DevToolsFiberChangeDetection.js)은 사용자 코드를 실행하는 component의 PerformedWork flag를 확인해 bailout을 제외한다. [React Profiler 문서](https://react.dev/reference/react/Profiler)의 actualDuration은 Profiler callback의 렌더 시간 계약이며, 임의의 모든 fiber에 남은 duration이 이번 함수 실행을 뜻하는 것은 아니다.

기존 `PanelWorkspace.renderFanout.test.tsx`의 방식과 맞춰 각 root의 직전 commit fiber 집합을 유지한다. 이번 commit에서 새로 방문된 function/forwardRef/memo fiber만 보고 PerformedWork를 검사한다. inactive 준비 구간에도 직전 집합을 갱신하며, 측정 구간만 집계한다. 내부 fiber 접근이므로 React 버전 의존 진단이며 공식 Profiler API 전체를 대체하지 않는다. commit 전에 중단된 render 횟수는 포함하지 않는다.

직전 단계의 변경 전후 production profiling artifacts(`/private/tmp/frame-dirty/profile-before`, `profile-after`)를 그대로 사용했다. 같은 저장 snapshot, 각 10회 폭 편집/복원, headed Chrome, CPU sampling 포함 진단 한 쌍이다. 새로운 일반 production 성능 A/B는 수행하지 않았다.

| 실제 실행/commit             | before | after |
| ---------------------------- | -----: | ----: |
| BuilderCanvas                |     22 |    11 |
| DataTablePanel               |      0 |     0 |
| LayerTree                    |     11 |    11 |
| CanvasSelectionShortcutsHost |     22 |    22 |
| 전체 React commit            |     55 |    44 |

Canvas 실행 감소는 유지되지만 기존 66.7%가 아닌 이 진단의 **50%**다. panel render fan-out 주장은 철회한다. 제품 코드는 변경하지 않았으며, 추가 memo와 상태 발행 병합의 근거도 이번 결과에서는 확인하지 못했다.

## 원본·정정 범위

로컬 `docs/migrations/evidence/frame-performance/reference-profile-audit-20260906/`에 수정 profile.mjs, react-profile-before/after.json, cpu-profile-before/after.json, summary.json, artifact-sha.json을 보관했다. 기존 raw profile은 덮어쓰지 않았다. `frame-performance-reference-edit-20260906.md`, `frame-performance-reference-dirty-20260906.md`, 실행 설계 §10.4/10.5, CHANGELOG의 수치와 공용 상태를 정정했다.

기존 panel memo 회귀 테스트 2개와 preflight, git diff --check가 통과했다. 이 테스트 실행 시간은 성능 증거로 사용하지 않는다. commit/push 없음.
