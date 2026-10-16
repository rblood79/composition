# ADR-263 design breakdown — 그리기 명령 패치·실행 비용 축소

> 본문: [../completed/263-render-command-patch-execute-cost.md](../completed/263-render-command-patch-execute-cost.md). 이 문서가 Phase · 파일 · 검증의 정본이다. `docs/adr/evidence/` 와 `.agent/runs/` 는 로컬 전용이라 실측 결론은 여기 §기록에 둔다.

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

### Phase 0 결과 (2026-10-16)

계측: `skia/renderCounters.ts` (dev 전용 고정 필드 — 명령 방문 · 컬링 소비 · picture 재생으로 건너뛴 명령 · Proxy index 읽기 · 실행 시점 segment 수 · 스크롤 범위 방문 · patch 검증 순회 · patch 교체 수) 를 하니스 recorder 가 `counts.render` 로 기록한다 (`perf-baseline.mjs` — 채널 추가로 recorder 해시가 바뀐다). 조건: dev 5173 · headless Chromium · `--fixed-inputs` · 부류 `zoom,edit,drag`. **결정성**: 중첩 600 을 2회 — `render.*` 전 키가 세 부류 모두 같은 값 (등급 A).

| 시나리오 · 부류 (content 프레임 수)       | 명령 방문 / 프레임 | 그중 컬링 소비 | Proxy 읽기 / 프레임 | patch 교체 / 회 | patch 검증 순회 / 회 | 스크롤 범위 방문 / 프레임 |     node picture miss |
| ----------------------------------------- | -----------------: | -------------: | ------------------: | --------------: | -------------------: | ------------------------: | --------------------: |
| 중첩 5k zoom (49 — coverage 28 · zoom 21) |             18,988 |  16,122 (85 %) |              19,316 |               — |                    — |                         0 |         16,090 (cold) |
| 중첩 5k edit (15 — invalidate)            |             19,359 |  19,098 (99 %) |              79,029 |          11,925 |         47,700 (4 ×) |                    26,135 |                   624 |
| 중첩 5k drag (189 — invalidate)           |             19,220 |  17,989 (94 %) |              68,732 |           9,871 |         39,484 (4 ×) |                     5,584 | 28,941 (153 / 프레임) |
| 평평 5k zoom (43)                         |             14,897 |   9,531 (64 %) |              15,023 |               — |                    — |          2,500 (재바인드) |                 5,398 |
| 평평 5k edit (15)                         |             14,989 |   9,966 (66 %) |              15,008 |               3 |                   12 |                     5,000 |                     0 |

읽은 것:

- **drag 중 patch 호출자**: drag 프레임마다 `root.subscribePreviews` (drag 의 실제 요소 · 형제 비킴 preview 재배치) → `CatalogCanvas` `reflowScene` → 다음 프레임 `scene.sync()` → `applyCommitSubtreeCommandPatch` → `invalidateContent()` (full) 다. 189 프레임 = patch 189 회. 중첩 5k 의 patch root 는 ~1만 명령 (전체의 ~절반) 이라 Phase 5 의 「k ≪ N 이면 건너뜀」 조건이 성립하지 않는다 → Phase 5 진행.
- **patch 가 node picture 를 전부 버린다**: patch 는 root 서브트리 요소마다 `invalidateNodePicture` 를 부른다 (`subtreeCommandPatch.ts`). 중첩 drag 는 프레임당 153 개 picture 를 다시 기록한다. 다섯 자리에 없던 여섯째 비용 — Phase 5 에서 「skia data 참조 · 크기가 같으면 picture 유지」 를 같이 본다 (캐시 키가 이미 `dataRef` · w · h 라 무효화 없이도 stale 이 아님을 확인한 뒤).
- **Proxy**: 실행 방문 수만큼 + patch 검증 순회 (현재 쪽 2 회) 가 Proxy 를 지난다. segment 수는 실행당 1 ~ 2 — span map 의 segment 선형 탐색은 상위가 아니다.
- **컬링**: full 재기록 방문의 64 ~ 99 % 가 화면 밖 서브트리 안을 하나씩 소비한 것이다 → Phase 2 (점프 + 공간 질의) 의 대상이 그대로 확인됐다.
- **스크롤 범위**: 중첩 5k edit 1 회에 26k 방문 (5 호출) — page body 가 scroll 상자라 전체 DFS.
- **record ↔ flush (사용자 결정 1 재료)**: dev 라벨로 평평 5k zoom record p95 11.9 ms / flush 0.7 ms, 중첩 5k zoom record p95 25.9 ms / flush 1.5 ms. 줌 꼬리는 GPU flush 가 아니라 JS 재기록이다 → 결정 1 의 조건 (「flush · snapshot 이면」) 이 성립하지 않아 줌 목표는 이 ADR 에 남는다 (질문 생략). production 짝 측정은 G5 에서.

레버 순서 (프레임당 카운트 크기 순, 중첩 5k drag 기준): Proxy 읽기 68.7k (Phase 1) → patch 검증 순회 39.5k + picture 재기록 153 (Phase 5) → 컬링 소비 18.0k (Phase 2) → 전체 재실행 자체 (Phase 3 damage) → 스크롤 범위 5.6k (Phase 4). 구현 순서는 breakdown 의 Phase 번호를 유지한다 (Phase 3 의 damage 가 Phase 2 의 공간 질의 기계를 쓰므로).

ratchet: `perf-ratchet-gate.mjs --add-keys <seed>=<a.json>,<b.json> --keys <k|접두.*> [--accept-recorder]` — 두 보고가 같은 값인 키만 0 포함 A 로 넣고 기존 상한은 바꾸지 않는다. 시험 (`perf-ratchet-gate.test.mjs`): 등록한 키를 0 → 5,000 · 100 → 1,000 으로 회귀시키면 `decide` = `block`, 같은 회귀를 `--update` 로만 넣었으면 `pass` (r1 M2 반례 재현).

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

- 2026-10-16 **G5 종결 측정 (production 짝)** — 빌드: `.cache/perf-ratchet/wt` 를 `prepareWorktree(bdb319d3c)` 로 맞춘 뒤 `perf:build-dist` (before = HEAD, after = HEAD + 이 ADR 의 런타임 diff 만 — `CatalogCanvas.tsx` 는 이 ADR hunk 2 개만, 다른 세션 WIP 제외). 조건: `--serve-dist` · headless Chromium · `--fixed-inputs --profile` · before / after 교대 2 쌍. callback gap p99 (ms) · drop (%):

  | 시나리오     | before ① · ②            | after ① · ②             | HC2                        |
  | ------------ | ----------------------- | ----------------------- | -------------------------- |
  | 중첩 5k 줌   | 28.5 · 26.1 / 1.9 · 1.7 | 17.6 · 17.6 / 0 · 0     | 충족 (≤ 20)                |
  | 중첩 5k 편집 | 35.4 · 34.3 / 5.9 · 4.3 | 24.2 · 25.5 / 1.0 · 1.6 | 미달 (p99 ≤ 20 · drop < 1) |
  | 중첩 5k drag | 23.7 · 25.3 / 0.6 · 1.3 | 21.8 · 21.1 / 1.2 · 0.7 | (기준 없음)                |
  | 평평 5k 줌   | 37.4 · 27.9 / 3.3 · 2.8 | 28.2 · 27.0 / 2.8 · 2.5 | 미달 (≤ 20)                |
  | 평평 5k 편집 | 30.7 · 27.1 / 5.6 · 1.6 | 25.0 · 27.3 / 1.0 · 2.6 | (기준 없음)                |
  | 평평 5k drag | 20.8 · 19.9 / 0.8 · 0.5 | 20.6 · 20.3 / 0.8 · 0.5 | 유지 (같은 폭)             |

  남은 비용 (after 프로필 self-time): `executeCommandRange` 는 상위에서 빠졌다 (Phase 0 중첩 편집 11.5 %). 중첩 편집은 `applyCommitSubtreeCommandPatch` 2.7 ~ 7.2 % · `visitElement` — 레이아웃 이동 영역이 patch root 를 ~1만 명령으로 키워 맵 갱신 · 서브트리 재기록이 k ≈ N/2 에 비례한다 (그리기 실행이 아니라 patch 영역 크기). 평평 줌은 `bindInColorMode` — 줌이 page grid 자동 열 수를 바꿔 scene 을 다시 바인드한다 (`CatalogCanvas` `syncAutoColumns` → `scene.refresh()`). 두 자리 모두 이 ADR 의 다섯 레버 (그리기 명령 층) 밖이다. 4단계 trigger 「그리기 명령 > 8 ms/frame」 재료: dev record p95 중첩 5k 줌 3.0 · 평평 2.7 ms (production 은 더 낮다) — trigger 미충족.

- 2026-10-16 **cross-check** — ADR-248 G3 하니스 (Canvas ↔ DOM): 79 중 78 통과, `paletteBaseCanvas` 1 건 실패는 수정 전 HEAD worktree 에서도 같은 출력 (9,953 줄 byte 동일 — 이 ADR 이 Canvas leg 픽셀을 바꾸지 않음). Preview (DOM) 경로는 이 ADR 이 닿지 않는다.

- 2026-10-16 **Phase 5 닫힘** — Phase 0 에서 중첩 5k 의 patch root 가 ~1만 명령 (k ≈ N/2) 이라 진행. `subtreeCommandPatch.ts` `collectCompleteSubtreeIds` (한 번 읽어 ID + span context 완전성 — `hasCompleteSubtreeSpanContext` · `getSubtreeElementIds` 두 번씩을 대신, 둘은 presentation lane 용으로 남음). 노드 picture: 교체 전 ID 중 교체 뒤에 없는 것만 `invalidateNodePicture` — 남는 요소는 `getCachedNodePicture` 의 `dataRef` · w · h 비교가 바뀐 것만 다시 기록한다 (재등록된 노드 = 새 data). unit (`damageRewire.test.ts`): owner · leaf picture 유지 · 지운 leaf2 picture 풀림 · patchScanCommands = 두 span 길이 합 — 무효화를 되돌리면 RED. ratchet `--update` (patchScanCommands 180 → 90 · drag 12 → 6). 원복 RED (두 번 읽기 + 전부 무효화, 2 회): seed 60 · 600 edit 90 → 135 · drag 6 → 9 → `block`. dev 측정 (중첩 5k): 편집 검증 순회 715,500 → 357,750 · picture miss 624 → 75, drag 7,462,500 → 3,731,250 · 20,845 → 381 · 방문 97,205 → 76,741. live 22/22 두 번 (picture 재생이 바뀐 결과를 남기지 않음).

- 2026-10-16 **Phase 4 닫힘** — `canvasOverflow.ts`: `catalogScrollExtent` (전체 descent — 옛 `catalogScrollRange` 의 몸통) · `catalogSubtreeScrollExtent` (한 서브트리가 owner extent 에 더하는 것 — owner 아래 경로의 offset · 깊이를 전체 descent 와 같은 규칙으로) · `catalogUpdatedScrollExtent` (변경 전 기여가 먼 가장자리에 닿았고 (허용 1e-3) 변경 후 기여가 거기 못 미치면 null = 다시 잼, 아니면 max). `catalogScrollRange` 는 extent 를 받을 수 있다. `canvasBinding.ts`: 상자별 `extents` 를 bind · update 사이에 들고, `update()` 가 바뀐 rect 의 가장 위 서브트리를 nearest clipping owner 별로 모아 변경 후 기여를 먼저 재고 (가장자리 이상이면 이전 기여는 읽지 않는다), 아니면 바뀐 상자의 이전 rect 를 보관해 이전 기여를 잰다. 구조 region · clip 여부가 바뀐 노드 (`clipChanged`) 의 owner · 자신의 extent 는 버린다 (다음에 물을 때 전체). 계획 (breakdown 초안 「직계 자손 최대값」) 과 다른 점: 직계 자손이 아니라 임의 깊이 서브트리를 같은 descent 규칙으로 — overflow visible 자손이 owner 범위에 들어가기 때문. unit: 무작위 트리 2,000 건 증분 = 전체 (증분 > 1,000 · 재측정 > 20, merge 규칙을 빼면 RED) · 5,000 자식 중 하나만 바뀌면 읽는 노드 1 · binding 무작위 편집 300 단계 (삽입 · 삭제 · overflow 토글 · 크기) 동안 들고 있는 extent = 전체 재계산 (invalidation · merge · 이전 rect 보관을 빼면 RED). ratchet: `render.scrollSubtreeVisits` A 등록 + `--update`. 원복 RED (extent 를 들지 않음, 2 회): `seeds.60.edit` scrollRangeCalls 0 → 15 · `seeds.600.edit` scrollRangeVisits 0 → 9,000 → `block`. dev 측정: 중첩 5k 편집 392,028 → 106,266 (전체 descent 78 → 6 — 남은 6 은 먼 가장자리가 물러난 편집), drag 1,055,460 → 874,812, 평평 5k 편집 75,000 → 30, 평평 5k 줌 70,000 그대로 (줌의 page grid 재바인드가 새로 잰다). G4 「방문 ≤ 바뀐 서브트리」 는 늘어나는 편집에서 성립, 가장자리가 물러나는 편집은 설계대로 (R4) 전체 재계산. live: scroll 상자를 휠로 200 · 내용 400 → 700 · 다시 휠 (550 까지) — 선형 full 과 0 px 차.

- 2026-10-16 **Phase 3 닫힘** — 배선: `subtreeCommandPatch.ts` 결과에 `unsafePaint` (교체 전 서브트리의 `damageUnsafeElementIds` · 넘친 글자, 교체 후의 `damageUnsafeElementIds`) · `canvasBinding.ts` `update()` 가 patch 마다 damage 를 합쳐 `damage` 로 냄 (unsafe 하나면 없음 = full, hit bounds 가 전후 모두 없으면 빈 상자 = 다시 그릴 것 없음) · `canvasScene.ts` `catalogSyncDamage` + content node `renderDamageSkia` (`executeDamageRenderCommands` — drag · 형제 비킴 중 null, self span 옮김으로 picture 재생) · `CatalogCanvas.tsx` `syncScene` 한 줄 (`invalidateContent(catalogSyncDamage(synced))`). `SkiaRenderer.ts`: `pendingFull` (full 은 실제 full 재기록 끝까지 · 뒤 damage 무시 · surface 재생성 · resize · dispose 도 full) · `canRenderDamage` 는 full 대기 · 보간 (transition · animation) 중 거짓 · damage 는 content surface 의 scene rect 로 잘림 (전부 밖이거나 빈 상자면 그리지 않고 끝) · damage 재기록 중 넘친 글자가 새로 나오면 버리고 full. 넘친 글자 추적: `nodeRendererText.ts` `TextDrawPoint.overflows` (상자 ± 1 px 밖) → `renderCommands.ts` 가 실행마다 요소별로 갱신 (`hasTextPaintOverflow` · `getTextPaintOverflowEvents`, picture 재생은 기록 때 상태 유지). drag offset 변경 (`CatalogCanvas` drag revision) 은 full 유지 — 비킴 offset 은 SpatialIndex 가 모르는 위치라 damage 후보를 열거할 수 없다 (r2 LOW 와 같은 이유, 보수 선택). unit (`damageRewire.test.ts`): 그림자 제거 · 추가 → `unsafePaint`, 양쪽 안전 → damage · full → damage · damage → full · full → damage × 3 · damage 합집합 · 빈 damage 가 합집합을 넓히지 않음 · 보간 중 full — H1 · H2 가드를 빼면 RED. `phase3BindingDelta` 의 patched 기대값에 damage (한 leaf 상자 · resize 80 ∪ 120) 추가. ratchet: `render.contentDamageRenders` · `contentDamageFallbacks` · `contentFullRenders` A 등록 + `--update`. 원복 RED (damage 제공 끔, 2 회): `seeds.600.edit` contentFullRenders 0 → 15 · contentDamageFallbacks 0 → 15 · execVisited 105 → 2,265 → `block`. live (`adr263-render-path-live.mjs`, dev 5173, headless Chrome) 19/19 두 번: 편집 유형마다 경로 (damage / full) 와 같은 상태의 선형 full 픽셀 0 차 — 가드 (H1 · 넘친 글자) 를 빼면 8 그림자 제거 1,450 px · 10b · 10c 글자 1,118 px 차로 RED. dev 측정 (중첩 5k): 편집 15 · drag 189 프레임 모두 damage, drag 방문 165,221 → 97,205.

- 2026-10-16 **Phase 2 닫힘** — 공간 질의 경로: `renderCommands.ts` `executeViewportRenderCommands` (viewport 를 `queryRect` → page root + 후보 → `buildDamageRenderCommandSequence` → 같은 `cullingBounds` 로 실행). 후보는 hit bounds 가 viewport 와 겹친 요소라 선형이 그리는 요소의 부분집합이고 빠지는 것은 조상 clip 에 다 잘린 요소뿐 — 그래서 컬링 판정은 선형과 같게 둔다 (breakdown 초안의 「무컬링 픽셀 oracle」 대신 지금 선형 = oracle). sequence 는 복사 구간을 기록해 stream self span 을 sequence index 로 옮기는 map (`SequenceSelfSpans`) 을 내고, damage 경로도 같은 map 으로 노드 picture 를 재생한다. 쓰지 않는 경우: SpatialIndex 없음 · `damageUnsafeElementIds` 비어 있지 않음 · drag offset · 형제 비킴 (`hasDragSiblingOffsets` — index 는 offset 전 상자만 안다, r2 LOW 의 offset 컨테이너 자손 문제를 피하는 보수 선택) · 후보 × 2 > 요소 수. 넓이 0 상자가 container 아닌 DRAW 를 내면 `damageUnsafeElementIds` 에 넣는다 (SpatialIndex `upsert` 가 넓이 0 을 빼서 열거할 수 없다). 선형 경로: `RenderCommandExecutionOptions.subtreeSpans` 가 있으면 컬링 · 숨김 요소에서 서브트리 끝으로 점프 (span 이 그 위치 · 범위와 맞을 때만). unit (`viewportExecution.test.ts`): 점프 전후 그리기 순서 동일 · 컬링 서브트리 안 방문 0 (숨김 group 포함) · 중첩 · 평평 N = 600 / 5,000 의 viewport 방문 수 같은 상수 (< 20) · 그리기 순서 = 선형 · 형제 비킴 · 넓이 0 paint 면 쓰지 않음 · self span 옮김 — 점프 · viewport 를 끄면 RED. ratchet: `render.execCulledJumped` · `viewportSequences` · `viewportFallbacks` A 등록 + `--update` (seed 600 edit 방문 25,125 → 2,265). 원복 RED (점프 · viewport 끔, 2 회) → A 5 키 초과 `block`. dev 측정 (중첩 5k): 줌 방문 930,415 → 38,998 · record p95 25.9 → 3.0 ms, 편집 290,379 → 3,198, drag 3,632,553 → 165,221 / 평평 5k 줌 640,581 → 7,262 · record p95 11.9 → 2.7. live (`adr263-render-path-live.mjs`): viewport 경로 = 선형 full 픽셀 0 차, 줌 0.5 · 1 · 2.

- 2026-10-16 **Phase 1 닫힘** — `renderCommands.ts` `createCommandReader` (평평한 배열은 그대로, piece-table 은 segment 범위 cursor). 소비자: `executeCommandRange` · `collectSpanImageRefs` · `appendCommandRange` (damage sequence) · `subtreeCommandPatch.ts` 검증 3 곳 + replacement 복사. unit: 무작위 splice 1,000 건 (앞 · 뒤 · 무작위 읽기) Proxy 와 동일 · segment 3 개 버퍼 실행의 그리기 순서 = 평평한 배열 · Proxy 읽기 0 (실행기를 `commands[i]` 로 되돌리면 16 으로 RED). ratchet: `--add-keys 60=… 600=… --keys 'render.*' --accept-recorder` 로 11 키 A 등록 (recorder 해시 갱신 — 기존 A 초과 0 인 보고 2 개). G1 원복 RED (리더를 Proxy 읽기로 되돌림, 2 회): `seeds.60.edit` 0 → 2,205 · `seeds.60.drag` 0 → 22,947 · `seeds.600.edit` 0 → 25,425 → `decide` = `block`. 수정 코드 2 회는 `pass`. 실행된 draw 명령은 unit 의 이벤트 순서 동일로 확인 (G1 「목록이 수정 전과 같음」).
- 2026-10-16 **Phase 0 닫힘** — §1 Phase 0 결과.

- 2026-10-16 review r2 (codex) 수리 검증 통과 — r1 네 건 closed, 신규 차단 0, LOW 1 deferred (위 §3 offset 컨테이너 자손). 전제 확정.
- 2026-10-16 review r1 (codex) 반영: H1 전후 unsafe → full · H2 무효화 3상태 · M1 공간 질의 경로 + 점프 fallback · M2 ratchet A 등록 절차 (`--add-keys`).
- 2026-10-16 작성. 근거 측정: `.agent/runs/2026-10-15-canvas-rust-baseline/prod/summary.txt` (로컬 전용). 코드 사실 확인 기준 main `3384c3a3d`.
