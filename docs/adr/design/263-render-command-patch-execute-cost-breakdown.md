# ADR-263 design breakdown — 그리기 명령 패치·실행 비용 축소

> 본문: [../263-render-command-patch-execute-cost.md](../263-render-command-patch-execute-cost.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

## 0. 전제 lock-in (fork 4 질문)

1. **base / 응용**: 기존 ADR 의 분리가 아니다. ADR-189 (damage 부분 재기록 · piece-table) 와 ADR-153 (node picture 캐시 · ping-pong) 이 base 이고, 이 ADR 은 그 기계를 catalog scene (ADR-248) 에 다시 연결하고 실행 상수 비용을 덜어내는 응용이다.
2. **schema**: 문서 · 저장 schema 변경 0. 바뀌는 것은 Builder Skia 실행 경로 내부 (`RenderCommandStream` 소비 방식 · `CatalogCanvasSceneSync` 결과에 damage 추가) 뿐이다.
3. **선행 전제 reverse 검증**: ADR-189 의 「damage = 이전 ∪ 이후 bounds · hit bounds 밖 paint 는 full fallback」 전제를 그대로 쓴다. ADR-248 이 damage provider 를 지운 것은 결정이 아니라 옛 소스 일괄 삭제의 부수 효과다 (`d58bb8b61` 메시지 「옛 소스 72 · 테스트·지원 217」, 대체 배선 없음) — 의존 방향 반전 아님.
4. **판독**: 사용자가 요청할 때 `/review-adr 263`.

## 1. Phase 0 — 측정 분해 · 레버 선정 (G0)

목적: 다섯 비용 자리 중 어느 것이 실제 프레임 시간을 만드는지 카운트로 고른다. 가설로 대상 코드를 정하지 않는다 (measurement-validity §5).

- **content 프레임 사유 집계**: `SkiaRenderer.classifyFrame` 의 `reason` (`invalidate` · `cleanup` · `registry` · `zoom-refresh` · `coverage-refresh`) 과 `renderDamagedContent` 성공 · 실패 사유를 시나리오별 (평평 · 중첩 600 / 5k × edit · zoom · drag · scroll) 로 센다. 하니스: `apps/builder/scripts/perf-baseline.mjs` frame 레인 (`--fixed-inputs --call-counts`), production 은 `--serve-dist`.
- **프레임당 실행 카운트**: 방문 명령 수 · Proxy `get` 접근 수 · `commandAt` 호출 수 · segment 수 · 컬링으로 건너뛴 명령 수 · node picture hit/miss. 기존 dev 카운터 `addCommandCount` (`renderCommands.ts`) · `takeDrawStats` 를 하니스가 읽을 수 있게 하고, 없으면 call-count 프로브로 대신한다.
- **record ↔ flush 분해**: `PERF_LABEL.RENDER_SKIA_RECORD_CONTENT` 와 flush · snapshot 구간을 production 빌드에서 잴 수 있는지 확인 (지금 `isDev` 게이트). 평평 5k 줌 p99 29 ms 의 소속 판정 재료 (사용자 결정 1).
- **drag 중 patch 호출자**: 중첩 5k drag 에서 `applyCommitSubtreeCommandPatch` · `getSubtreeElementIds` 를 부르는 경로 (drag 시작 · 형제 비킴 · 놓기) 와 patch root 크기.
- **편집 1회 스크롤 범위 방문 수**: `catalogScrollRange` 의 방문 노드 수 · 호출 수 (page body 가 `overflow: auto` 인 시드에서).
- **결정성**: 고른 카운트는 같은 옵션 2회가 같은 값 (등급 A). 아니면 레버 후보에서 뺀다.
- **ratchet 등록 절차 (review r1 M2)**: 지금 `--update` (`perf-ratchet-gate.mjs` `applyUpdate`) 는 새 지표를 B 에 넣고 값 0 은 `judge` 의 `newKeys` 조건 (`actual[key] > 0`) 때문에 빠진다. `decide` 는 A 초과만 막으므로 새 카운트는 회귀를 막지 못한다. `--add-class` 처럼 `--add-keys <seed>/<class>=<a.json>,<b.json> --keys <k1,k2>` 를 둔다 — 두 보고의 값이 같은 키만 A 로 넣고 (0 포함), 기존 A · B 상한은 바꾸지 않으며, 다른 값이면 거부. 시험: 등록한 키를 0 → 5,000 · 100 → 1,000 으로 바꾼 보고를 `judge` → `decide` 하면 `block`. 각 Phase 의 원복 RED 는 이 판정으로 확인한다 (unit 실패만으로 대신하지 않는다).

### Phase 0 결과

(실행 시 기록 — 시나리오 × 카운트 표, 고른 레버와 기대 효과, 사용자 결정 1 재료)

## 2. Phase 1 — 명령 순회의 Proxy 제거 (G1)

- 대상: `renderCommands.ts` `executeCommandRange` · `createSegmentedCommandBuffer` · `replaceCommandRange` · `commandAt`.
- 방향 (Phase 0 결과로 확정): (a) 실행기가 segment 목록을 직접 순회하는 반복자 — 복사 0, 또는 (b) segment 수가 상한을 넘으면 평평한 배열로 압축. (a) 가 ADR-189 G2 (splice write ≤ k) 를 건드리지 않는다.
- 같이 볼 소비자: `recordSelfSpan` (재진입 실행) · `collectSpanImageRefs` · `buildDamageRenderCommandSequence` · `getSubtreeElementIds` — 모두 `commands[i]` 접근.
- 검증: 실행된 draw 명령 목록 (명령 타입 · elementId 순서) 이 수정 전과 같은 unit · Proxy 접근 카운트 0 · 원복 RED · ratchet `--update`.

## 3. Phase 2 — full 재기록의 컬링: 공간 질의 경로 + 서브트리 점프 (G2)

review r1 M1: 점프만으로는 화면과 겹친 부모의 leaf 형제마다 BEGIN 을 읽어야 해서 가시 1개 · N = 600 / 5,000 에서 방문 605 / 5,005 (codex 시뮬레이션) — 가시 수 비례가 아니다. 그래서 두 경로를 둔다.

- **공간 질의 경로 (기본)**: content full 재기록 (줌 refresh · cleanup · invalidate) 도 viewport (padding 포함 culling bounds) 를 rect 로 `spatialIndex.queryRect` → `buildDamageRenderCommandSequence` (후보 + 조상 closure, 형제 순서 보존) → 실행. damage 경로와 같은 기계라 새 계층이 없다. 방문 수 = 후보 + closure.
  - 후보 보강 (R2): SpatialIndex 는 offset 전 hit bounds 를 안다. drag 대상 · 비킨 형제 (`getDragVisualOffset` · `getSiblingOffset`) · page 위치 delta 가 걸린 요소는 offset 을 적용한 상자로 viewport 교차를 따로 판정해 후보에 더한다.
  - offset 컨테이너의 자손 (review r2 LOW deferred): `buildDamageRenderCommandSequence` 는 후보의 조상만 잇고 자손은 자동으로 넣지 않는다 (`relevantChildren` 재귀). offset 이 걸린 컨테이너를 후보로 더할 때는 offset 을 물려받는 자손까지 넣거나, 그 컨테이너가 있으면 full 로 간다. 지금 drag 는 top-layer 가 unsafe 라 full fallback 이므로 production 재현은 없다 — 기존 전역 unsafe 검사를 후보 한정 검사로 줄이지 않는다. G2 · G3 offset fixture 에 컨테이너 + 자손을 넣는다.
  - 쓸 수 없는 경우: `WASM_FLAGS.SPATIAL_INDEX` 꺼짐 · index 없음 · sequence null (`damageUnsafeElementIds` 가 viewport 후보에 걸림 — hit bounds 밖 paint) → 선형 경로.
- **선형 경로 (fallback)**: `executeCommandRange` 컬링 블록의 판정은 그대로, skip 이면 `subtreeSpans.get(elementId).end` 로 점프 (스택 상태는 짝 `ELEMENT_END` 를 소비한 것과 같게). 컬링된 서브트리 **내부** 방문 0 — 형제 BEGIN 은 남는다 (HC3 에 명시).
- 주의: `visible: false` 분기와 record 재진입 (spans 없음) 은 결과가 같아야 한다. overflow visible 자식이 조상 상자 밖에 그려지는 경우 — 현행 컬링은 조상이 화면 밖이면 자식도 건너뛴다. 공간 질의 경로는 자식 hit bounds 로 고르므로 결과가 달라질 수 있다 → oracle 은 「현행 선형 실행」 이 아니라 **같은 상태의 무컬링 full 실행 픽셀** 과 비교하고, 차이가 현행이 놓치던 것을 그리는 쪽이면 기록 후 수용, 반대면 결함.
- 검증: 가시 leaf 1 + 화면 밖 N−1 시드 (평평 · 중첩) 에서 N = 600 / 5,000 공간 질의 방문 수가 같은 상수 · 선형 경로의 컬링 서브트리 내부 방문 0 · draw 명령 목록 동일 (offset fixture 포함) · ratchet A 등록 · 원복 `block`.

## 4. Phase 3 — damage 부분 재기록 재연결 (G3)

- **전후 unsafe (review r1 H1)**: `applyCommitSubtreeCommandPatch` 는 `currentIds` 의 `damageUnsafeElementIds` 표시를 지우고 replacement 표시만 넣는다 — 그림자를 지우면 사후 검사는 안전하다고 보고 damage 는 hit bounds 만 비워 이전 그림자가 남는다 (codex 프로브: `applied: true` · damage `{100,100,80,40}` · unsafe 빈 집합, 이전 그림자 중심 x = 60). 결과에 `unsafeBefore` (currentIds ∩ 이전 unsafe ≠ ∅) · `unsafeAfter` 를 싣고, 어느 쪽이든 참이면 그 update 는 `fullRequired`. `reRegister` 만 된 노드도 등록 전후 unsafe 를 같은 규칙으로 본다. 이전 paint bounds 를 따로 보관하는 정밀화는 범위 밖 (그 장면은 full).
- **damage 수집**: `canvasBinding.ts` `update()` 가 patch 마다 `applyCommitSubtreeCommandPatch` 의 `damageBounds` 를 합쳐 `CatalogCanvasUpdate` (`status: "patched"`) 에 싣는다. `reRegister` 만 된 노드 (patch root 아님) 는 그 상자를 damage 로.
- **무효화 상태 (review r1 H2)**: `SkiaRenderer.invalidateContent` 를 clean · damage · full 셋으로 바꾼다. full 요청은 실제 full 재기록 (`renderContent` 의 full 분기 완료) 까지 유지되고 뒤 damage 요청은 합치지 않는다. `canRenderDamage` 는 full 대기 중이면 거짓. `renderDamagedContent` 가 실패하면 full 로. 시험: full → damage · damage → full · full → damage × 3 · damage → damage 합집합 (prototype 메서드 직접 실행 + 픽셀).
- **scene → renderer**: `canvasScene.ts` `sync()` 결과에 damage 를 넘기고, `CatalogCanvas.tsx` `syncScene` 이 `renderer.invalidateContent(damage)` 로 부른다. rebound (전체 bind) 는 damage 없음 (full).
- **content node**: `CatalogCanvasScene.contentNode` 가 `renderDamageSkia(canvas, bounds)` 를 제공 — `executeDamageRenderCommands(ck, canvas, stream, bounds, fontMgr)`. SpatialIndex 가 없거나 sequence 가 null 이면 null → renderer 가 full 로.
- **damage 후보 보강**: `executeDamageRenderCommands` 의 SpatialIndex 후보에 offset 이 걸린 drag · 형제 요소를 Phase 2 와 같은 규칙으로 더한다 (그렇지 않으면 새 위치의 drag 대상이 damage 안에서 빠진다).
- **drag**: `CatalogCanvas.tsx` 의 drag revision 변경 `invalidateContent()` 를 이동 요소 · 비킨 형제의 이전 · 이후 상자 합집합 damage 로. 이전 상자는 직전 프레임에 그린 offset 으로 계산한다 (`getDragVisualOffset` · `getSiblingOffset` 의 직전 값 보관).
- **스크롤**: `scrollBy` → dirty → patch 경로라 같은 damage 수집을 탄다 — 스크롤 상자 clip rect 를 damage 로 쓰는지 확인.
- **fallback**: `damageUnsafeElementIds` (그림자 · outline · transform) 가 걸리면 full. 사유는 ADR-189 의 damage metric (`recordDamageMetric` · `damageFallbackCount`) 으로 집계.
- 검증 (oracle = 같은 상태의 full 재기록): 편집 유형별 픽셀 diff 0 — safe → unsafe · unsafe → safe (그림자 제거) · unsafe 요소 삭제 · transform 원복 · 값 (fill) · 글자 길이 · 이동 · 삭제 · 추가 · drag 프레임 연속 · 스크롤 · 부모 크기 변화로 형제 재배치 · 겹친 형제 · page 겹침 (activeRoot 순서). Skia 픽셀은 페이지에서 못 읽으므로 browser vitest 또는 headed Playwright 스크린샷으로 비교 (메모리 `reference-skia-canvas-pixels-unreadable-in-page`).

## 5. Phase 4 — 스크롤 범위 증분 (G4)

- 대상: `canvasOverflow.ts` `catalogScrollRange` · `canvasBinding.ts` `scrollStateOf` (bind 시 등록 · update 시 조상 재계산).
- 방향: scroll 상자마다 직계 자손 extent 최대값을 보관하고, 바뀐 rect 가 그 값을 넘으면 증분 갱신. 줄어들 수 있는 변경 (최대 자식의 축소 · 삭제 · 이동) 은 전체 재계산.
- 검증: 증분 ↔ 전체 결과 무작위 동치 ≥ 1,000건 (스냅 수정 때의 오라클 방식, `snapSpacing.test.ts` 참고) · 편집 1회 방문 수 카운트 · 원복 RED.

## 6. Phase 5 — patch 검증 중복 순회 축소 (Phase 0 결과에 따라)

- 대상: `subtreeCommandPatch.ts` `applyCommitSubtreeCommandPatch` — `getSubtreeElementIds` 2회 · `hasCompleteSubtreeSpanContext` 2회 · topLayer · bounds 검사가 각각 span 을 돈다. replacement 쪽 id 는 `buildSubtreeCommandStream` 이 이미 `subtreeSpans` 로 안다.
- Phase 0 에서 drag · 편집의 patch root 가 작다 (k ≪ N) 고 나오면 이 Phase 는 건너뛴다 (O(k) 는 계약 범위 안).

## 7. 종결 (G5)

- production 레인 짝 측정 (수정 전 commit ↔ 수정 후, 같은 `perf:build-dist` 방식): 중첩 5k 편집 · 줌 · drag, 평평 5k 줌 · drag. 결과 표를 §기록에.
- live exercise: 실제 builder (dev 서버 + 저장된 인증 세션) 에서 편집 · 줌 · drag · 스크롤 후 잔상 없음 확인 + `/cross-check` (Preview 와 같은 그림).
- ratchet: 낮아진 카운트 `--update` 를 수정과 같은 커밋에.
- 문서: ADR 본문 Status · Live Exercise, README, CHANGELOG (성능 회귀 수정 트리거).
- 4단계 Rust 판정 입력: 종결 뒤 프레임당 그리기 명령 시간을 §기록에 남긴다 (trigger 「> 8 ms/frame」).

## 기록

- 2026-10-16 review r2 (codex) 수리 검증 통과 — r1 네 건 closed, 신규 차단 0, LOW 1 deferred (위 §3 offset 컨테이너 자손). 전제 확정.
- 2026-10-16 review r1 (codex) 반영: H1 전후 unsafe → full · H2 무효화 3상태 · M1 공간 질의 경로 + 점프 fallback · M2 ratchet A 등록 절차 (`--add-keys`).
- 2026-10-16 작성. 근거 측정: `.agent/runs/2026-10-15-canvas-rust-baseline/prod/summary.txt` (로컬 전용). 코드 사실 확인 기준 main `3384c3a3d`.
