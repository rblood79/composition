# Layout publisher 서명 재사용 — 2026-09-06

`24073906a` clean을 기준으로 `useLayoutPublisher`의 전체 layoutInputKey 계산을 `useMemo`로 감쌌다. 유일한 호출자인 BuilderCanvas가 생성하는 page/frame 입력 배열과 layoutVersion을 의존성으로 사용한다. scene/index 입력 교체 시 배열이 재생성되며, layoutVersion 없는 두 번째 index publication도 새 입력으로 감지한다. dimension/readiness key는 기존처럼 매 렌더 읽는다. hash·레이아웃 계산·Zustand·실제 제출 readiness는 변경하지 않았다.

가이드 §3의 확인된 계산에 memo 적용 및 일반 production 재측정 방식이다. 이전 CPU profile의 layout signature 비용을 후보 근거로 재사용했다. 이번 비교는 600요소·동일 snapshot·50회 폭 편집/복원, visible Chrome, frame capture on/GPU timer off, CDP threadTicks와 Chrome trace다. 순서는 before/after, after/before, before/after이며 측정 중 빌드/테스트를 함께 실행하지 않았다.

| 쌍     | CPU before→after (ms/s) | frame p99 before→after (ms) |
| ------ | ----------------------: | --------------------------: |
| 1      |       236.357 → 224.836 |                 54.3 → 48.1 |
| 2      |       239.748 → 240.256 |                 53.5 → 53.0 |
| 3      |       243.781 → 237.404 |                 54.3 → 54.1 |
| 중앙값 |       239.748 → 237.404 |                 54.3 → 53.0 |

CPU 중앙값 **0.98% 감소**, frame p95 **9.4ms 동일**, renderer RAF **51회 동일**. 두 번째 쌍 CPU는 증가했다. 작은 차이로 통계적 유의성이나 다른 기기의 개선을 입증하지 않는다. 동일 입력의 서명 재순회를 줄이는 제한적 변경으로 채택하며 기존 개선율과 합산하지 않는다.

검증:

- 4 files / 22 tests PASS. 새 hook 동작 검증은 동일 입력 재렌더 시 서명 계산·발행 재실행 없음, 같은 layoutVersion의 새 입력 교체 시 재발행, layoutVersion 변경 시 재계산, pending→ready 시 실제 layout map 발행을 확인한다.
- 일반 production live: 폭 237px → render bounds 237 → actual main submission 증가 → Undo props/bounds 복원 PASS.
- preflight, git diff --check PASS. 비교 구간 page errors 0, visibility visible, fixture SHA 동일. 기존 startup Pretendard 404는 양쪽에 남았고 측정 중 오류는 없다.
- Spec/CSS/Preview 입력과 렌더 출력 계산 변경 없음. 전 컴포넌트 pixel matrix 대신 변경 경계의 hook·scene 회귀와 실제 Builder 편집을 확인했다.
- 같은 입력을 제자리 변경하면서 revision도 올리지 않는 호출자는 이 계약을 사용할 수 없다. 현재 유일한 호출자는 scene/index와 layout revision에 따라 입력을 생성한다. 새 호출자 추가 시 이 경계를 유지해야 한다.

원본은 로컬 `docs/migrations/evidence/frame-performance/reference-publisher-20260906/`의 manifest/SHA, 각 pair trace, summary.json, live.json, tests.log, preflight.log에 있다. 인증 snapshot은 `/private/tmp`에만 둔다. 롤백은 이번 useMemo 래핑만 원복하면 된다. commit/push는 수행하지 않았다.
