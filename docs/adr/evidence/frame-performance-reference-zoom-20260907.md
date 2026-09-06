# ZoomControls transient 표시 갱신 — 2026-09-07

## 원인과 변경

가이드 §2·3의 transient subscribe/ref 소비 원칙을 camera 경로에 대조했다. 정정된 fiber 실행 집계로 120회 wheel zoom 입력 중 ZoomControls가 99회 실행된 반면 canonical 발행은 0회였다. 원인은 `useViewportPresentationZoom`의 React external-store 구독이었다.

ZoomControls는 `subscribeViewportPresentationZoom`으로 native input의 value만 갱신한다. 직접 입력 중인 텍스트는 덮어쓰지 않고, blur/취소 후 최신 presentation 값을 다시 표시한다. 구독은 cleanup에서 해제하며 React state는 사용자 편집에만 사용한다. 숫자 입력 Escape→blur 충돌은 취소 표시로 차단하고, Enter는 blur에서 한 번만 확정한다. 버튼/화살표는 이벤트 시점의 최신 zoom을 읽는다. camera/Canvas/Spec/CSS/Preview 데이터 경로와 readiness는 유지한다.

기준은 `f2c91105e`이며 기존 문서 정정 WIP는 보존했다.

## 진단과 정상 production 비교

120회 고정 wheel 입력과 500ms settle, production profiling 진단:

| 항목                          | before | after |
| ----------------------------- | -----: | ----: |
| ZoomControls 실제 실행        |     99 |     0 |
| 입력 중 전체 React commit     |    104 |    15 |
| settle 포함 전체 React commit |    107 |    18 |
| canonical domainPublication   |      0 |     0 |

집계는 이전 commit 재사용 fiber를 제외하고 PerformedWork를 확인한다. 기존의 잘못된 actualDuration-only 방식은 사용하지 않았다. 남은 18 commit이 있으므로 camera 전체 React commit 0을 달성했다고 판정하지 않는다. 같은 진단의 pan도 settle 포함 7 commit/domain 0으로 관측했으며, 이번 수정 범위는 ZoomControls에 한정한다. hover/drag의 전체 commit 0은 이번 단계에서 검증하지 않았다.

아래 CPU 값은 별도의 일반 production, 600요소 고정 fixture, 600회 동일 zoom wheel, visible Chrome, frame capture on/GPU timer off, CDP threadTicks/Chrome trace다. before/after, after/before, before/after 순서 3쌍을 사전 고정하고 측정 중 다른 빌드/테스트를 실행하지 않았다.

| 쌍     | CPU before→after (ms/s) | p95 before→after (ms) | p99 before→after (ms) |
| ------ | ----------------------: | --------------------: | --------------------: |
| 1      |       291.848 → 271.422 |           10.8 → 10.5 |           18.6 → 16.7 |
| 2      |       278.868 → 271.559 |           10.4 → 10.6 |           15.2 → 17.0 |
| 3      |       291.094 → 275.239 |           10.4 → 10.4 |           17.7 → 16.8 |
| 중앙값 |       291.094 → 271.559 |           10.4 → 10.5 |           17.7 → 16.8 |

CPU 중앙값 **6.71% 감소**. renderer RAF 620회와 long task 0은 양쪽 동일하다. 두 번째 쌍의 frame tail과 중앙값 p95는 악화됐으며 모든 지표 개선을 주장하지 않는다. 이 장비의 상대 비교이고 통계적 유의성이나 타기기 성능은 미입증이다. 불필요한 React 갱신 제거와 세 쌍 CPU 감소를 근거로 채택한다.

## 검증과 한계

- ZoomControls/viewport presentation: 2 files, 10 tests PASS. 표시 변화가 React Profiler commit을 만들지 않음, unmount 해제, 직접 입력 보존, invalid 입력 복원, 최신 zoom 화살표, Escape 취소, Enter 단일 확정을 확인했다.
- 일반 production live: wheel 후 숫자/실제 camera 일치, 125% Enter 반영, 200% Escape 취소, 9999% 입력 복원, 100% menu 반영 PASS. page error 0.
- preflight(type baseline 0), git diff --check PASS. 비교 중 오류 0, visible, fixture SHA 동일. 기존 startup Pretendard 404는 양쪽에 남았다.
- Canvas와 DOM 숫자 표시의 실제 일치를 검증했으며 시각 스타일 변경은 없다. 전 컴포넌트 pixel matrix는 반복하지 않았다.

원본은 로컬 `docs/migrations/evidence/frame-performance/reference-transient-20260907/`의 최초 pan/zoom 진단과 `reference-zoom-20260907/`의 after 진단, manifest/source SHA, 각 pair trace, summary.json, live.json, tests.log, preflight.log에 있다. 인증 snapshot은 `/private/tmp`에만 둔다. 롤백은 ZoomControls의 React zoom 구독·controlled input으로 복귀하는 범위이며 저장 데이터 마이그레이션은 없다. commit/push 없음.
