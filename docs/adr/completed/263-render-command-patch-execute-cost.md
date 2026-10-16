# ADR-263: 그리기 명령 패치·실행 비용 축소

## Status

Implemented — 2026-10-16 (측정 기록으로 종결 — 사용자 결정 2 「측정 기록으로 종결」 2026-10-16)

Accepted — 2026-10-16 (`/execute-adr 263` 호출 + [reviews/263.md](../reviews/263.md) Round 2 pending 0 · HIGH 전부 fixed)

> **종결 (G5, 2026-10-16)**: production 짝 측정 (HEAD ↔ HEAD + 이 ADR, 교대 2 쌍) — 중첩 5k 줌 p99 26 ~ 28 → 17.6 ms · drop 0 % (HC2 충족), 중첩 5k 편집 p99 34 ~ 35 → 24 ~ 26 ms · drop 4.3 ~ 5.9 → 1.0 ~ 1.6 % (미달), 평평 5k 줌 28 ~ 37 → 27 ~ 28 ms (미달), 평평 5k drag 20 그대로. 남은 꼬리는 그리기 명령 실행이 아니다 (`executeCommandRange` 가 프로필 상위에서 빠짐): 중첩 편집은 레이아웃 이동 영역이 patch root 를 ~1만 명령으로 키우는 것, 평평 줌은 줌이 page grid 자동 열 수를 바꿔 scene 을 다시 바인드하는 것 — 대안 B · C 도 닿지 않는 자리라 사용자 결정 2 로 측정 기록 종결. 4단계 Rust trigger (「그리기 명령 > 8 ms/frame」) 재료: dev record p95 중첩 5k 줌 3.0 · 평평 2.7 ms — 미충족. 수치 · 프로필: breakdown §기록 G5.

> **Phase 0 (2026-10-16)**: 그리기 명령 층 카운트 (`renderCounters.ts` → 하니스 `counts.render`) 가 등급 A (2회 같은 값) 로 잡혔고, 새 카운트의 A 등록 절차 (`--add-keys`) 와 회귀 시 `block` 시험이 생겼다. 중첩 5k drag 는 프레임마다 preview → patch (~1만 명령, 검증 4 회 순회) → full 재기록 · node picture 153 개 재기록이다. 줌 꼬리는 record (JS) 쪽이라 사용자 결정 1 의 전제가 성립하지 않는다. 표 · 레버 순서: breakdown §1 Phase 0 결과.

> **Phase 1 (2026-10-16)**: 명령 읽기가 piece-table Proxy 를 지나지 않는다 (`createCommandReader` — 지금 segment 범위를 들고 벗어날 때만 이분 탐색, 복사 0). 실행 · damage sequence · picture 이미지 수집 · patch 검증이 쓴다. ratchet 에 `render.*` 11 키를 등급 A 로 등록 (seed 60 · 600, 2회 같은 값) — Proxy 읽기 상한 0. 원복 RED: 수정 전 읽기로 되돌리면 seed 60 edit 0 → 2,205 · drag 0 → 22,947 · seed 600 edit 0 → 25,425 로 두 번 다 넘어 `block`.

> **Phase 2 (2026-10-16)**: full 재기록이 viewport 의 SpatialIndex 후보 + 조상 closure 만 실행한다 (`executeViewportRenderCommands` — damage 와 같은 sequence 기계, 노드 picture 는 self span 을 sequence index 로 옮겨 재생). 쓸 수 없으면 (hit bounds 밖 paint · drag · 형제 비킴 · 후보가 절반 넘음) 선형 실행이 컬링 서브트리를 끝으로 점프한다. 넓이 0 상자가 그리는 것은 hit bounds 밖 paint 로 본다. 중첩 5k (dev) 줌 방문 930k → 39k · record p95 25.9 → 3.0 ms. 원복 RED: seed 600 edit 방문 2,265 → 25,125 등 A 5 키 초과로 `block`. live: viewport 경로 = 선형 full 픽셀 0 차 (줌 0.5 · 1 · 2).

> **Phase 3 (2026-10-16)**: 편집 · drag 프레임이 바뀐 영역만 다시 그린다 — scene sync 가 patch 의 이전 ∪ 이후 hit bounds 를 damage 로 내고 (`CatalogCanvasUpdate.damage`), content node 가 `renderDamageSkia` 를 다시 제공한다. 무효화는 clean · damage · full 셋이고 full 은 실제 full 재기록까지 남는다 (H2). patch 전 · 후 어느 쪽이든 hit bounds 밖 paint (그림자 · outline · transform) 가 있으면 full (H1). 글자는 `clipText` 가 아니면 상자 밖으로 그려지므로, 넘친 글자를 전 · 후로 추적해 damage 를 버리고 full 로 간다. damage 는 content surface 로 잘린다 (다 잘려 안 보이는 변경은 다시 그리지 않음). 중첩 5k (dev) 편집 15 · drag 189 프레임 전부 damage 경로. 원복 RED: damage 제공을 끄면 seed 600 edit full 0 → 15 등으로 `block`. live 19 건 (값 · 글자 · 이동 · 크기 · 형제 재배치 · 그림자 추가 · 제거 · 삭제 · 새로 넘친 글자 · 넘쳤던 글자 · padding 안 편집 뒤 blit · 잘린 요소 · 줌 3) 이 같은 상태의 선형 full 과 0 px 차, 가드를 빼면 그림자 잔상 1,450 px · 글자 1,118 px 로 RED.

> **Phase 4 (2026-10-16)**: scroll/auto 상자가 자손 extent 를 편집 사이에 들고 있고, 편집은 바뀐 서브트리의 기여만으로 갱신한다 (`catalogUpdatedScrollExtent` — 먼 가장자리가 물러났을 수 있을 때만 이전 기여를 읽고, 물러났으면 다시 잰다). 구조 변경 · clip 여부가 바뀐 자손은 다시 잰다. 중첩 5k (dev) 편집 15 회의 스크롤 범위 방문 392,028 → 106,266 (전체 descent 78 → 6), drag 1,055,460 → 874,812, 평평 5k 편집 75,000 → 30. 원복 RED: extent 를 들지 않으면 seed 600 edit 전체 descent 0 → 15 등으로 `block`. 무작위 동치: 순수 함수 2,000 건 · binding 300 단계 (전체 재계산과 같음).

> **Phase 5 (2026-10-16)**: patch 검증이 쪽마다 span 을 한 번만 읽고 (ID 수집 + span context 완전성), 교체 뒤에도 남는 요소의 노드 picture 를 버리지 않는다 (캐시 키가 이미 node data · 크기 — 지운 요소만 푼다). 중첩 5k (dev) drag 189 프레임: 검증 순회 7,462,500 → 3,731,250 · picture 재기록 20,845 → 381. 원복 RED: seed 60 · 600 edit 순회 90 → 135 로 `block`.

- 사용자 요청: `/create-adr 그리기 명령 패치·실행 비용 축소` (2026-10-16)
- 방향을 정한 사용자 원문: 「Canvas 코어의 Rust 통합을 최종 방향으로 삼는 것 … 레이아웃 → geometry·공간 인덱스 → 스냅·선택·컬링 → 그리기 명령 순으로」 (2026-10-15) → 측정 뒤 합의한 Canvas 성능 계획의 **2단계** (「0단계 시작」 · 「1단계 시작」 2026-10-16 으로 진행 승인).
- 이미 정해진 것: 측정이 설계보다 먼저 (「측정부터먼저인가 설계부터가 먼저인가」 → 측정 먼저). 2단계 닫는 조건은 계획 제시 때 적은 값 — 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %, 줌 p99 ≤ 20 ms. Rust 이관 판정은 이 ADR 이 아니라 4단계 (trigger 시 새 ADR — ADR-921 은 되살리지 않는다).
- 리뷰: [reviews/263.md](../reviews/263.md) Round 1 (codex, 2026-10-16) HIGH 2 · MEDIUM 2 를 본문 · breakdown 에 반영 (HC3 · HC4 · HC5 · R1 · R2 · R6 · G0 ~ G3 개정) → Round 2 수리 검증 통과 — 네 건 closed · 신규 차단 0 · LOW 1 deferred (offset 컨테이너 자손 보강, breakdown §3 · §4). pending 0 이라 전제 확정 (premise-decision-points 종결 계약).

Related: [ADR-189 커밋 레인 record 증분화](189-commit-lane-incremental-record.md) (이 ADR 이 되살리는 damage 기계의 원 결정) · [ADR-153 measurement-first 렌더 최적화](153-render-optimization-measurement-first-adoption.md) (node picture 캐시 · ping-pong snapshot) · [ADR-248 통합 catalog 문서](248-unified-catalog-document.md) (damage provider 가 삭제된 커밋의 소속) · [ADR-246 카운트 ratchet](246-deterministic-count-ratchet-and-begin-frame-harness.md) (집행 수단)

## Context

### 문제

0단계 production 측정 (2026-10-15 ~ 16, `pnpm perf:build-dist` + `--serve-dist`, Playwright headless Chromium · `--profile`, 1단계 스냅 수정 뒤) 에서 남은 JS 비용 1위는 그리기 명령 실행이다.

| 시나리오 (prod)          | p95 / p99 (ms) | drop  | 상위 self-time                                                                                                                            |
| ------------------------ | -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 중첩 5k 편집 (`pnw5000`) | 22.8 / 30.0    | 4.3 % | `executeCommandRange` 11.5 % · `catalogScrollRange` 4.1 % · `applyCommitSubtreeCommandPatch` 2.6 % · `hasCompleteSubtreeSpanContext` 상위 |
| 중첩 5k 줌               | 17.2 / 18.9    | 0.6 % | `executeCommandRange` 10.1 %                                                                                                              |
| 평평 5k 줌 (`pw5000`)    | 17.6 / 29.1    | 3.3 % | JS 상위가 낮음 (`visitElement` 1.4 · `catalogScrollRange` 0.9 · `executeCommandRange` 0.7) — 꼬리 원인 미분해                             |
| 중첩 5k drag             | 21.6 / 24.9    | 0.6 % | `executeCommandRange` 3.6 · `applyCommitSubtreeCommandPatch` 3.6 · `getSubtreeElementIds` 2.9 · `hasCompleteSubtreeSpanContext` 상위      |

Rust 엔진 wasm 은 어느 시나리오의 상위에도 없다 (평평 5k edit 0.6 % 하나). 비용은 JS 의 그리기 명령 층에 있다.

### 코드 사실 — 비용이 N 에 비례하는 다섯 자리

1. **편집 · drag 프레임이 damage 없이 전체 스트림을 다시 실행한다.** `SkiaRenderer.renderContent` 는 `pendingDamage` 가 있고 content node 에 `renderDamageSkia` 가 있을 때만 부분 재기록 (`renderDamagedContent`, ADR-189 Phase 3) 을 탄다 (`apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts` `canRenderDamage` · `renderContent`). 그런데 catalog scene 의 content node 는 `renderSkia` 하나만 준다 (`apps/builder/src/builder/catalogRuntime/canvasScene.ts` `contentNode`), 그리고 `CatalogCanvas.tsx` 의 `invalidateContent()` 호출 5곳 (scene sync · reorder · refresh · image · drag offset 변경) 은 모두 damage 인자가 없다. `executeDamageRenderCommands` (`renderCommands.ts`) 는 export 돼 있으나 호출자가 0 이다. 옛 provider (`renderDamageSkia` → `executeDamageRenderCommands`) 는 ADR-248 Phase 4e-9-3 (`d58bb8b61`) 의 옛 소스 삭제에서 같이 지워졌고 catalog scene 으로 다시 연결되지 않았다. patcher 는 여전히 damage 를 계산한다 — `applyCommitSubtreeCommandPatch` 가 `damageBounds` 를 돌려주지만 `canvasBinding.ts` `update()` 가 버린다.
2. **명령 하나를 읽을 때마다 Proxy trap 을 지난다.** stream 의 `commands` 는 `createSegmentedCommandBuffer` 가 만든 Proxy 다 (`renderCommands.ts`, ADR-189 piece-table). `executeCommandRange` 의 `commands[i]` 마다 `get` trap → `isArrayIndex` (문자열 ↔ 숫자 변환 4회) → `commandAt` (segment 이분 탐색) 이 돈다. segment 는 patch 마다 늘고 rebind 전까지 합쳐지지 않는다.
3. **화면 밖 서브트리도 명령을 하나씩 건너뛴다.** 컬링은 `ELEMENT_BEGIN` 에서 `skipDepth = 1` 로 들어가 짝 `ELEMENT_END` 까지 명령을 하나씩 소비한다 (`executeCommandRange`). `subtreeSpans` 가 끝 위치를 이미 알지만 실행은 그것을 쓰지 않는다. 줌 · cleanup 의 full 재기록은 그래서 가시 요소 수가 아니라 전체 명령 수에 비례한다.
4. **편집마다 스크롤 조상의 범위를 서브트리 전체로 다시 잰다.** `canvasBinding.ts` `update()` 는 바뀐 노드의 조상 중 scroll/auto 상자를 만나면 `scrollStateOf` → `catalogScrollRange` (`canvasOverflow.ts`) 로 그 상자의 자손 전체를 DFS 한다. page body 가 `overflow: auto` 면 편집 1회가 페이지 전체 방문이다.
5. **patch 검증이 span 전체를 여러 번 훑는다.** `applyCommitSubtreeCommandPatch` 는 `getSubtreeElementIds` 를 current · replacement 에 각각 돌리고, `hasCompleteSubtreeSpanContext` 도 span 을 다시 훑는다 (`subtreeCommandPatch.ts`). patch root 가 body 같은 큰 상자면 각각 O(N) 이다. drag 중 어떤 경로가 patch 를 부르는지는 아직 확정하지 않았다 (Phase 0).

### 3-domain 판정

D3 시각 스타일의 Builder(Skia) consumer **내부** 실행 경로다. D1 (DOM/접근성) · D2 (Props/API) · catalog 문서 · 저장 형식은 바꾸지 않는다. Preview(DOM) 대칭은 시각 결과 무변경으로 유지한다 — 바꾸는 것은 같은 그림을 얼마나 적게 다시 그리는가뿐이다. Generator / catalog 확장 없음 (해당 체크 비대상).

### Hard constraints

- **HC1 시각 결과 동일**: 부분 재기록 · 건너뛰기 · 버퍼 변경 뒤의 픽셀이 같은 상태의 full 재기록과 같다. stale pixel (지운 요소 · 이동 전 자리 잔상) 0.
- **HC2 닫는 조건 (production 레인)**: 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %, 줌 p99 ≤ 20 ms. 평평 5k drag p99 ≤ 20 ms (1단계 결과) 유지. 판정은 `--serve-dist` production 빌드 기준이다 — dev 수치는 React DEV 부담이 섞여 인용하지 않는다.
- **HC3 비용 비례**: 편집 1회의 명령 방문 수는 전체 명령 수 N 이 아니라 바뀐 서브트리 크기 k 와 damage 면적에 비례한다 (ADR-189 HC1 승계). 줌 · cleanup full 재기록은 **공간 질의 경로** (viewport rect 로 SpatialIndex 후보 + 조상 closure 만 실행 — `buildDamageRenderCommandSequence` 와 같은 기계) 에서 가시 후보 수에 비례한다. 공간 질의를 쓸 수 없는 장면 (unsafe paint · SpatialIndex 없음) 은 선형 실행으로 가되 컬링된 서브트리 **내부** 명령은 방문하지 않는다 — 이 경로의 방문 수는 화면과 겹친 부모의 직계 형제 수만큼 남는다 (review r1 M1).
- **HC4 실패는 full 로 수렴**: 증분 경로가 안전을 보장할 수 없는 장면은 지금처럼 full 재기록한다 — hit bounds 밖 paint (그림자 · outline · transform) 가 patch **전 또는 후** 에 있는 경우 (효과 제거 · unsafe 요소 삭제 · transform 원복 포함), 거부된 splice, 같은 snapshot 구간에 쌓인 full 요청. full 요청은 실제 full 재기록이 끝날 때까지 뒤 damage 요청보다 우선한다. 조용한 부분 실패 금지 (review r1 H1 · H2).
- **HC5 집행**: 결정적 카운트는 pre-push ratchet (ADR-246, `pnpm gate:perf-ratchet`) 과 vitest 로 막는다. 새 카운트는 `--update` 로 넣지 않는다 — `applyUpdate` 는 새 지표를 B (경고만) 에 넣고 값 0 은 등록하지 않아 (`apps/builder/scripts/perf-ratchet-gate.mjs` `judge` · `applyUpdate` · `decide`) 회귀를 막지 못한다. 2회 같은 값을 확인한 새 카운트를 0 포함 A 상한으로 등록하는 절차를 Phase 0 에서 만들고, 원복 RED 는 unit 실패가 아니라 그 판정 함수의 `block` 으로 확인한다 (review r1 M2). PR · status check 는 이 저장소의 수단이 아니다.

### Soft constraints

- damage · piece-table · node picture 캐시 기계는 이미 있다 (ADR-153 · 188 · 189). 새 계층보다 끊긴 배선 복구와 상수 비용 제거가 먼저다.
- 4단계 Rust 판정의 trigger 하나가 「2단계 뒤에도 그리기 명령 > 8 ms/frame」 이다. 이 ADR 의 종결 측정이 그 판정의 입력이 된다.

## Alternatives Considered

외부 사례: Chromium compositor 는 무효화 rect 만 다시 래스터하고 display list 를 R-tree 로 질의한다 (`cc::DisplayItemList` · `PictureLayerImpl` 타일 무효화). Skia 는 `SkPictureRecorder::beginRecording(bounds, SkRTreeFactory)` 로 기록한 picture 를 재생할 때 bbox 계층으로 화면 밖 연산을 건너뛴다. Flutter 는 `RepaintBoundary` 로 바뀌지 않은 층의 picture 를 재사용한다. Figma 는 WebGL 타일 단위로 다시 그린다. Pencil (pen.dev) 는 이 저장소가 이미 따른 snapshot blit + 정착 뒤 재렌더 모델이다 (`SkiaRenderer.classifyFrame` 주석).

### 대안 A: 현 구조 안에서 끊긴 배선 복구 + 상수 비용 제거

- 설명: (1) Proxy 를 거치지 않는 명령 순회 — 실행기가 segment 를 직접 돌거나 patch 뒤 버퍼를 평평한 배열로 압축, (2) full 재기록의 컬링 — viewport 공간 질의로 후보 + 조상 closure 만 실행 (불가 장면은 컬링된 서브트리를 `subtreeSpans` 끝으로 점프), (3) damage 부분 재기록 재연결 — `update()` 가 patch 의 `damageBounds` 와 patch 전후 unsafe 여부를 모아 scene sync 결과로 내고, renderer 는 clean · damage · full 을 구분해 full 을 우선하며, content node 가 `renderDamageSkia` (`executeDamageRenderCommands`) 를 제공하고, drag offset 변경은 이동 전후 상자 합집합을 damage 로 넘김, (4) 스크롤 범위를 바뀐 자식만으로 갱신, (5) patch 검증의 중복 span 순회 제거. 각 항목을 Phase 0 카운트로 골라 RED → 수정 → ratchet A 상한 등록 · 하향.
- 위험: 기술 MEDIUM (damage 정확성 — 기계는 ADR-189 에서 pixel oracle 로 검증됐으나 catalog scene 에서는 새 배선) / 성능 LOW / 유지보수 MEDIUM (full · damage 두 경로의 동일성 유지) / 마이그레이션 LOW (각 단계가 flag 없이 되돌릴 수 있는 국소 변경, 실패 시 full)

### 대안 B: 페이지 · 서브트리 단위 retained picture 층 (RepaintBoundary 식)

- 설명: page root (또는 큰 컨테이너) 서브트리를 R-tree bbox 계층이 있는 SkPicture 로 기록해 두고, 카메라 변경 · cleanup 은 그 picture 재생 (Skia 가 화면 밖을 건너뜀), 편집은 해당 층만 다시 기록.
- 위험: 기술 MEDIUM / 성능 HIGH (5k 요소가 한 page 에 있으면 편집 1회 = 그 층 전체 재기록 — 층을 잘게 나누면 node picture 캐시와 이중 캐시) / 유지보수 HIGH (층 경계 · 무효화 규칙이 새 계층) / 마이그레이션 MEDIUM

### 대안 C: 타일 래스터 캐시 (Chromium · Figma 식)

- 설명: content surface 를 타일로 나누고 줌 단계별로 래스터해 두었다가 damage 와 겹친 타일만 다시 래스터.
- 위험: 기술 HIGH (`SkiaRenderer` 의 snapshot · ping-pong · camera-only blit 재작성) / 성능 MEDIUM (GPU 메모리 · 줌 단계 전환 비용) / 유지보수 HIGH / 마이그레이션 HIGH

### 대안 D: 명령 실행을 Rust/wasm 으로 이관

- 설명: 명령 해석 · 컬링 · damage 선택을 Rust 로 옮김 (ADR-921 계열).
- 위험: 기술 HIGH (CanvasKit draw 호출은 JS API 라 명령마다 JS ↔ wasm 경계가 남는다 — 해석만 옮기면 경계 비용이 늘 수 있다) / 성능 MEDIUM (미측정) / 유지보수 HIGH / 마이그레이션 HIGH

### Risk Threshold Check

| 대안 | HIGH+                          | 판정                                   |
| ---- | ------------------------------ | -------------------------------------- |
| A    | 없음                           | 통과                                   |
| B    | 성능 · 유지보수                | A 가 HIGH 를 피하므로 루프 불요        |
| C    | 기술 · 유지보수 · 마이그레이션 | 동일                                   |
| D    | 기술 · 유지보수 · 마이그레이션 | 동일 — 그리고 계획상 판정 시점이 4단계 |

## Decision

**대안 A** 를 채택한다.

근거:

1. 측정이 가리킨 비용 다섯 자리가 모두 이미 있는 기계의 끊긴 배선 (damage) 이나 상수 비용 (Proxy · 선형 skip · 중복 순회 · 전체 DFS) 이다. 새 계층 없이 N 비례를 k · 가시 수 비례로 바꿀 수 있다.
2. 잔존 기술 위험 (damage 의 stale pixel) 은 ADR-189 의 판정 수단 — 같은 상태의 full 재기록과 픽셀 비교 + `damageUnsafeElementIds` full fallback — 으로 관리된다. 실패는 전부 full 로 수렴한다 (HC4).
3. Phase 0 이 카운트로 레버를 고르므로, 효과가 없는 레버는 착수 전에 빠진다 (measurement-validity §5).

기각 사유:

- **B**: 비용이 몰린 장면 (중첩 · 평평 5k 가 한 page) 에서 층 단위 재기록은 지금의 전체 재실행과 같은 크기다. 층을 잘게 나누면 ADR-153 node picture 캐시와 겹친다. A 의 컬링 건너뛰기가 같은 이득 (화면 밖 생략) 을 새 계층 없이 낸다.
- **C**: `SkiaRenderer` 재작성이고, 지금 꼬리의 원인이 래스터인지 JS 인지도 아직 분해되지 않았다. A 뒤에도 flush · 래스터가 상위면 그때의 증거로 다시 연다.
- **D**: 계획의 4단계가 판정한다 — 이 ADR 의 종결 측정이 그 trigger 입력이다. 지금 옮기면 JS 쪽 상수 비용을 Rust 로 이관해 원인이 가려진다.

> 구현 상세: [263-render-command-patch-execute-cost-breakdown.md](../design/263-render-command-patch-execute-cost-breakdown.md)

### 사용자 결정 2건 (execute-adr 가 해당 Phase 에서 묻는다)

1. **평평 5k 줌 꼬리의 소속** — Phase 0 분해에서 평평 5k 줌 p99 29 ms 가 JS 가 아니라 GPU flush · snapshot 이면, 줌 목표 (HC2) 를 이 ADR 에서 빼고 측정 기록으로 둘지 (A 의 레버가 닿지 않는다).
2. **닫는 조건 미달 시** — Phase 1 ~ 5 를 다 해도 중첩 5k 편집 p99 가 20 ms 를 넘으면, 남은 비용의 측정 기록으로 종결하고 4단계 판정으로 넘길지, 아니면 B · C 를 다시 열지.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | damage 과소 산출로 stale pixel 이 남는다 — 이동 전 자리 · 지운 요소 · 형제 비킴 · 스크롤된 자식 · 부모 크기 변화로 다시 놓인 형제 · **효과 제거 뒤 이전 그림자** (patch 가 `damageUnsafeElementIds` 의 이전 표시를 지우고 replacement 표시만 넣어 사후 검사로는 이전 paint 영역을 모른다). 경로: `subtreeCommandPatch.ts` `applyCommitSubtreeCommandPatch` (unsafe 삭제 · 재등록) · `getSubtreeDamageBounds`, `canvasBinding.ts` `update()`, `SkiaRenderer.ts` `renderDamagedContent`, `CatalogCanvas.tsx` drag invalidate |  HIGH  | damage = 이전 ∪ 이후 상자 (patch root 서브트리 전부). patch 결과에 전후 unsafe 여부를 싣고 어느 쪽이든 unsafe 면 그 step 은 full. drag 는 이동 · 비킴 요소의 전후 합집합. G3 에서 safe → unsafe · unsafe → safe · unsafe 요소 삭제를 포함한 편집 유형별 damage 결과 ↔ full 재기록 픽셀 diff 0 |
| R2  | 컬링 · 공간 질의가 그리는 명령을 같이 건너뛴다 — overflow visible 자식이 조상 상자 밖에 그려지는 경우, drag offset · 형제 offset · page 위치 delta 로 hit bounds 밖에 그려지는 상자 (SpatialIndex 는 offset 전 hit bounds 를 안다), sticky · top-layer. 경로: `renderCommands.ts` `executeCommandRange` 컬링 블록 · `buildDamageRenderCommandSequence` · `subtreeSpans`, `wasm-bindings/spatialIndex.ts` `queryRect`                                                                                                       |  HIGH  | 점프는 지금의 컬링 판정 결과를 바꾸지 않는다 (판정 skip → 끝으로 점프만). 공간 질의 후보에는 offset 이 걸린 요소 (drag · 형제 · page delta) 를 명시로 더한다. G2 에서 실행된 draw 명령 목록이 현행 선형 실행과 같음을 단언                                                                    |
| R3  | 버퍼 압축이 ADR-189 의 splice 비용 계약 (write ≤ k) 을 깬다 — patch 마다 전체 복사하면 편집 1회가 다시 O(N). 경로: `renderCommands.ts` `replaceCommandRange` · `createSegmentedCommandBuffer`                                                                                                                                                                                                                                                                                                                              |  MED   | 압축은 segment 수 상한 초과 시에만, 또는 실행기가 segment 를 직접 순회 (복사 0). G1 이 splice write 카운트를 같이 잰다                                                                                                                                                                        |
| R4  | 스크롤 범위 증분이 범위를 과소 산출 — 자식 삭제로 범위가 줄어드는 경우. 경로: `canvasOverflow.ts` `catalogScrollRange`, `canvasBinding.ts` `scrollStateOf`                                                                                                                                                                                                                                                                                                                                                                 |  MED   | 늘어나는 변경은 증분, 줄어들 수 있는 변경 (삭제 · 축소가 최대 자식) 은 지금처럼 전체 재계산. 증분 ↔ 전체 결과 동치 무작위 테스트                                                                                                                                                              |
| R5  | 카운트는 줄었는데 프레임 시간이 그대로다 (원인이 래스터 · flush). 경로: `SkiaRenderer.ts` flush · `makeImageSnapshot`                                                                                                                                                                                                                                                                                                                                                                                                      |  MED   | Phase 0 에서 record ↔ flush 분해. G5 는 production 레인의 p95/p99 · drop 으로 판정 (대리 지표 아님). 미달이면 사용자 결정 2                                                                                                                                                                   |
| R6  | full 재기록 요청이 뒤 damage 요청에 덮여 사라진다 — `invalidateContent()` 는 full 을 `pendingDamage = null` 로 표현하고 다음 `invalidateContent(rect)` 가 그 자리를 작은 rect 로 채워 `canRenderDamage` 가 참이 된다 (rebind · 이미지 로드 · root 교체 · 거부된 splice 뒤 같은 프레임의 편집). 경로: `SkiaRenderer.ts` `invalidateContent` · `canRenderDamage` · `renderContent`, `CatalogCanvas.tsx` `syncScene`                                                                                                          |  HIGH  | 무효화 상태를 clean · damage · full 셋으로 나누고 full 은 실제 full 재기록이 끝날 때까지 유지 (damage 합치기 무시). `renderDamagedContent` 실패도 full. G3 에 full → damage · damage → full · full → 여러 damage 순서를 고정                                                                  |

## Gates

측정 조건 (모든 Gate 공통): production 빌드 (`pnpm perf:build-dist` → `--serve-dist`), Playwright Chromium headless · foreground, 시드는 합성 5k (평평 · 중첩) — 합성물은 규모 지표로만 쓴다 (Q1). 불리 케이스 (편집 · 줌 refresh · drag) 를 반드시 포함한다 (Q2). 대조군은 같은 빌드 방식의 수정 전 commit (Q3). 픽셀 oracle 은 같은 상태의 full 재기록이며, 시각 대칭은 `/cross-check` (Preview DOM) 로 따로 본다 (Q5).

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                    | 실패 시 대안                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| G0   | Phase 0 | 시나리오별 content 프레임 사유 (registry · drag · cleanup · zoom-refresh · coverage-refresh) 수, 프레임당 명령 방문 수 · Proxy 접근 수 · segment 수, record ↔ flush 시간 분해, drag 중 patch 호출 경로가 기록됨. 각 레버의 대상 카운트가 같은 옵션 2회 같은 값 (등급 A). **새 카운트를 0 포함 A 상한으로 등록하는 ratchet 절차** (2회 동일 확인 · 기존 상한 불변) 가 있고, 등록한 지표를 인위 회귀시키면 `decide` 가 `block` | 결정적이지 않은 카운트는 레버에서 뺀다 · 등록 절차가 없으면 G1 이후 착수 금지 |
| G1   | Phase 1 | 명령 순회의 Proxy 접근 0 (A 상한 0 등록) · 실행된 draw 명령 목록이 수정 전과 같음 · splice write ≤ 재기록 span (ADR-189 G2 유지) · 원복 RED = 수정 전 코드에서 ratchet `block`                                                                                                                                                                                                                                               | Proxy 유지 + 접근 경로만 단축                                                 |
| G2   | Phase 2 | 공간 질의 경로: 가시 leaf 1개 · 나머지 화면 밖인 시드에서 N = 600 / 5,000 의 방문 수가 같은 상수 (후보 + 조상 closure + shell) · unsafe 장면의 선형 경로: 컬링된 서브트리 내부 방문 0 · 두 경로 모두 실행된 draw 명령 목록이 현행 선형 실행과 같음 (offset 이 걸린 drag · 형제 포함) · 원복 RED = ratchet `block`                                                                                                            | 공간 질의 경로를 해당 장면에서 끄고 선형 + 점프만                             |
| G3   | Phase 3 | 편집 유형별 (값 · 글자 · 이동 · 삭제 · 추가 · drag 프레임 · 스크롤 · **safe → unsafe · unsafe → safe · unsafe 요소 삭제**) damage 결과 ↔ full 재기록 픽셀 diff 0 · 무효화 순서 (full → damage · damage → full · full → 여러 damage) 에서 full 유지 · 편집 시나리오 content 프레임의 damage 경로 비율과 fallback 사유가 기록됨                                                                                                | 해당 편집 유형만 full 유지 (부분 승격)                                        |
| G4   | Phase 4 | 스크롤 범위 계산의 편집 1회 방문 수 ≤ 바뀐 서브트리 크기 · 증분 ↔ 전체 결과 동치 (무작위 ≥ 1,000건) · 원복 RED                                                                                                                                                                                                                                                                                                               | 전체 재계산 유지                                                              |
| G5   | 종결    | HC2: 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 % · 줌 p99 ≤ 20 ms (사용자 결정 1 반영) · 평평 5k drag p99 ≤ 20 ms 유지 — 수정 전 commit 대조 짝 측정. live exercise (실제 builder 에서 편집 · 줌 · drag · 스크롤) + `/cross-check` 대칭 + ratchet 상한 `--update` 반영                                                                                                                                                             | 사용자 결정 2                                                                 |

### Live Exercise

2026-10-16, 실행자 live (Playwright headless Chrome → dev 서버 5173, 저장된 인증 세션으로 새 프로젝트) — `apps/builder/scripts/adr263-render-path-live.mjs`. 색 상자 40 · 글자 8 · flex 묶음 · scroll 상자가 있는 page 에서 편집 유형마다 새 경로로 그린 화면을 찍고, 같은 상태를 `__composition_RENDER_PATH_DEBUG__` 로 선형 실행 · full 재기록해 다시 찍어 픽셀을 비교했다. 22/22 PASS (여러 번): viewport 공간 질의 경로 = 선형 full (줌 0.5 · 1 · 2) · 값 · 글자 길이 · 이동 · 크기 · 형제 재배치 · 삭제 · 넘침 없는 글자 상자 · 잘려 안 보이는 요소는 damage 경로에서 0 px 차 · 그림자 추가 · 제거 · 새로 넘친 글자 · 넘쳤던 글자는 full 경로로 0 px 차 (잔상 없음) · padding 안 편집 뒤 끌어온 blit · scroll 상자 휠 스크롤 → 내용 늘림 → 늘어난 범위까지 스크롤 · 페이지 오류 0. 가드 (H1 · 넘친 글자) 를 빼면 그림자 잔상 1,450 px · 글자 1,118 px 로 RED. cross-check: ADR-248 G3 하니스 78/79, 실패 1 (`paletteBaseCanvas`) 은 수정 전 HEAD 에서도 byte 동일 출력.

## Consequences

### Positive

- 편집 · drag 프레임의 재기록이 바뀐 영역만큼으로 줄어 문서 크기와 분리된다 — ADR-189 가 이미 얻었던 성질을 catalog scene 에서 되찾는다.
- 줌 · cleanup 의 full 재기록이 가시 요소 수에 비례한다.
- 종결 측정이 4단계 Rust 판정 (「그리기 명령 > 8 ms/frame」) 의 입력이 된다.

### Negative

- full · damage 두 경로의 픽셀 동일성을 계속 검증해야 한다 (G3 fixture 유지 비용).
- hit bounds 밖 paint (그림자 · outline · transform) 장면은 계속 full 이다 — 그런 요소가 많은 문서는 이 ADR 의 이득을 덜 받는다.
- piece-table 버퍼의 순회 방식이 바뀌면 `renderCommands.ts` 의 버퍼 계약 테스트를 같이 고쳐야 한다.
