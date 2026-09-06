# Projection 중복 직렬화 재사용 — 2026-09-06

## 변경과 기준

가이드 §2의 파생 계산 재사용, §3의 비용 귀속 및 일반 production 재측정 원칙을 적용했다. 앞선 CPU profile에서 `stableSerialize` self 약 31ms와 익명 하위 callback 약 14ms가 관측됐다. raw scene과 resolved page가 공유하는 props/배열을 같은 서명 계산 안에서 반복 직렬화하는 경로를 줄였다.

`stableSerialize`에 호출 단위 WeakMap을 전달한다. 중복 객체의 정렬·재귀 직렬화 결과를 재사용하고 `createResolvedProjectionSignature` 호출이 끝나면 버린다. 호출 간 캐시는 없으며 동일 객체의 다음 편집도 다시 읽는다. 기존 정렬 순서·문자열·hash 계산식·projection 필드와 readiness는 유지한다. Spec/CSS/Preview 소비 데이터, Zustand 구독 및 발행 횟수는 바꾸지 않았다.

before는 `75c73dd1f`에 앞선 미커밋 layoutCache 개선을 포함한 현재 상태, after는 이번 재사용만 추가한 상태다. 이전 단계 수치와 합산하지 않는다.

## 고정 비교

600요소 동일 fixture와 저장 snapshot, 50회 폭 편집과 복원, 일반 production, visible Chrome, frame capture on/GPU timer off. before/after, after/before, before/after 순서 3쌍을 사전 고정했다. 측정 중 다른 테스트·빌드는 실행하지 않았다. Chrome DevTools trace와 CDP threadTicks를 사용하며 회귀 테스트 실행 시간을 성능 증거로 사용하지 않는다.

| 쌍     | CPU before→after (ms/s) | frame p99 before→after (ms) | long task before→after |
| ------ | ----------------------: | --------------------------: | ---------------------: |
| 1      |       238.904 → 236.226 |                 54.1 → 53.4 |                13 → 12 |
| 2      |       240.324 → 236.340 |                 54.5 → 52.2 |                 15 → 7 |
| 3      |       238.133 → 227.975 |                 53.4 → 47.5 |                 14 → 6 |
| 중앙값 |       238.904 → 236.226 |                 54.1 → 52.2 |                 14 → 7 |

CPU 중앙값은 **1.12% 감소**, frame p95는 **9.4→9.4ms**, renderer RAF는 **51→51회**다. 세 쌍 모두 CPU가 줄었으나 작은 표본이며 통계적 유의성이나 다른 장비의 성능을 입증하지 않는다. 편집 stall 전체 해결이 아니라 중복 계산 축소로 채택한다.

## 검증

- scene snapshot / layout signature / publisher: 3 files, 20 tests PASS. 기존 hash `1832414373`, 공유·복사 객체 동등성, 동일 객체의 style/배열 변경·복원과 기존 fills/same-count projection 무효화를 확인했다.
- 일반 production live: 폭 237px 변경 → render command bounds 237 → 실제 main submission 증가 → Undo props/bounds 복원 PASS.
- codex:preflight 및 git diff --check PASS.
- 비교 구간 page error 0, visible, fixture hash 동일. 양쪽 시작 시 기존 Pretendard 404만 있고 측정 중 오류는 없다.
- 수명 검토: WeakMap은 매 signature 호출에서 생성되고 외부에 보관하지 않는다. object identity가 다음 편집의 무효화를 막지 않는다. 저장 데이터·Preview/CSS 출력 변경이 없으므로 별도 전 컴포넌트 pixel matrix는 반복하지 않았다.

로컬 원본: `docs/migrations/evidence/frame-performance/reference-projection-20260906/`의 manifest/build SHA, run-comparison.py, summary.json, 각 pair의 edit-trace.json, live.json, tests.log, preflight.log. 인증 snapshot은 `/private/tmp`에만 유지한다. rollback은 이번 `buildSceneSnapshot.ts` 직렬화 재사용 변경만 원복하면 된다. commit/push는 수행하지 않았다.
