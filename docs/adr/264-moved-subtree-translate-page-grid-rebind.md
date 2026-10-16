# ADR-264: 이동만 한 서브트리의 patch 축소 · 줌 page grid 재바인드 제거

## Status

Proposed — 2026-10-16

- 사용자 요청: `/create-adr 2단계 후속 — 이동만 한 형제 patch 축소 + 줌 재바인드 제거` (2026-10-16)
- 방향을 정한 사용자 원문: 「남은 두 꼬리 (patch 영역 축소, 줌 재바인드 제거) 를 먼저 하는것이 좋지않나?」 (2026-10-16) — Canvas 성능 계획의 3단계 (선택 전환) · 4단계 (Rust 판정) 보다 앞에 둔다. 3단계는 이 ADR 과 겹치지 않아 병행할 수 있다.
- 이미 정해진 것: 2단계 닫는 조건은 ADR-263 HC2 그대로 — 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %, 줌 p99 ≤ 20 ms (production 레인). ADR-263 은 사용자 결정 2 「측정 기록으로 종결」 로 Implemented 됐고, 이 ADR 이 그 미달 두 자리를 받는다. Rust 이관 판정은 4단계 (이 ADR 종결 뒤 재측정 — ADR-921 은 되살리지 않는다). 측정이 설계보다 먼저 (카운트 RED → 수정 → ratchet 하향, measurement-validity §5).
- 리뷰: [reviews/264.md](reviews/264.md) Round 1 (codex, 2026-10-16) HIGH 2 · MEDIUM 1 — 옮기기 알고리즘의 반례 (root 의 부모 문맥까지 옮김 · root-only damage 가 `overflow: visible` 자식을 누락 · 저장된 clip 교차 결과의 평행이동) → r1 반영: 자손 문맥만 옮기고 root 문맥 보존 · damage = 서브트리 전 요소 합집합 · clip 은 바깥 불변 clip 에서 다시 전파 (대안 A · R1 · G1 · breakdown §2). Round 2 (codex, 2026-10-16) 수리 검증 통과 — 세 건 closed · 신규 차단 0 · pending 0 이라 전제 확정 (premise-decision-points 종결 계약).

Related: [ADR-263 그리기 명령 패치·실행 비용 축소](completed/263-render-command-patch-execute-cost.md) (직전 단계 — G5 미달 두 자리의 출처) · [ADR-189 커밋 레인 record 증분화](completed/189-commit-lane-incremental-record.md) (subtree splice · damage 의 원 결정) · [ADR-232 page placement](completed/232-page-placement-as-layout-derivation.md) 후속의 `columns: "auto"` (재바인드 경로의 출처) · [ADR-246 카운트 ratchet](completed/246-deterministic-count-ratchet-and-begin-frame-harness.md) (집행 수단) · [ADR-916 통합 Rust 엔진](completed/916-unified-rust-engine.md) (SpatialIndex 의 소속)

## Context

### 문제

ADR-263 G5 production 짝 측정 (2026-10-16, `pnpm perf:build-dist` + `--serve-dist`, headless Chromium, before/after 교대 2 쌍) 에서 2단계 닫는 조건 두 자리가 남았다.

| 시나리오 (prod)          | ADR-263 전 p99 / drop    | ADR-263 뒤 p99 / drop    | 닫는 조건              | 남은 비용 (after 프로필)                                                                |
| ------------------------ | ------------------------ | ------------------------ | ---------------------- | --------------------------------------------------------------------------------------- |
| 중첩 5k 편집 (`pnw5000`) | 34 ~ 35 ms / 4.3 ~ 5.9 % | 24 ~ 26 ms / 1.0 ~ 1.6 % | ≤ 20 ms · < 1 % — 미달 | `applyCommitSubtreeCommandPatch` 2.7 ~ 7.2 % · `visitElement` — patch root 가 ~1만 명령 |
| 평평 5k 줌 (`pw5000`)    | 28 ~ 37 ms / 2.8 ~ 3.3 % | 27 ~ 28 ms / 2.5 ~ 2.8 % | ≤ 20 ms — 미달         | `bindInColorMode` — 줌마다 scene 전체 재바인드                                          |
| 중첩 5k 줌               | 26 ~ 28 ms               | 17.6 ms / 0 %            | 충족                   | —                                                                                       |

둘 다 그리기 명령 실행 (`executeCommandRange`) 이 아니다 — ADR-263 의 다섯 레버가 닿지 않는 자리다. 4단계 Rust trigger 「그리기 명령 > 8 ms/frame」 은 미충족 (dev record p95 3 ms 대) 이라 Rust 이관으로 풀 문제도 아니다.

### 코드 사실 — 두 꼬리는 같은 한 가지 일이다: 「자리만 옮긴 서브트리를 다시 기록한다」

1. **편집: 형제가 자리만 옮겨도 patch root 가 부모로 올라가 형제 전부를 다시 기록한다.** `apps/builder/src/builder/catalogRuntime/canvasBinding.ts` `geometryRegion` (1814 ~ 1842) 은 seed 의 상자가 바뀌면 부모를 비교하고, 부모 rect 가 그대로여도 (block 흐름이 고정을 증명하지 못하면) 형제를 전부 비교해 **rect 가 바뀐 형제가 하나라도 있으면 `regionRoot = parentId`** 로 올린다 (1835). 형제의 변화는 거의 전부 x · y 뿐이다 — 같은 코드가 「이동한 상자는 자식을 옮기지 못한다 (rect 는 부모 기준 지역 좌표)」 를 알고 크기가 바뀐 형제만 `descend` 한다 (1765 ~ 1769). 그런데 patch 는 region root 의 서브트리를 통째로 다시 만든다: `buildSubtreeCommandStream` 이 형제와 그 자손 전부를 `visitElement` (node data 읽기 · 명령 생성 · 절대 bounds) 하고, `applyCommitSubtreeCommandPatch` (`workspace/canvas/skia/subtreeCommandPatch.ts`) 가 current · replacement 두 span 을 훑어 `selfSpans` · `subtreeSpans` · `subtreeBuildContextByElement` · `boundsMap` · `hitBoundsMap` 을 요소마다 다시 쓴다 (422 ~ 469 · 653 ~ 698). 중첩 5k 의 patch root 는 ~1만 명령 (전체 19k 의 절반, ADR-263 Phase 0 표: 편집 1회 patch 교체 11,925 · 검증 순회 47,700 → Phase 5 뒤 절반) 이다. 자리만 옮긴 형제의 명령은 `ELEMENT_BEGIN` 의 `x` · `y` (부모 기준 — `renderCommands.ts` 1598 `renderRelX` · `renderRelY`) 만 다르고 자손 명령은 바이트 단위로 같다.
2. **줌: 열 수가 바뀌면 page 내용이 그대로인데 scene 을 전부 다시 묶는다.** `apps/builder/src/builder/workspace/canvas/catalog/CatalogCanvas.tsx` `syncAutoColumns` (782 ~ 801) 는 프레임마다 `catalogAutoColumns` (`catalogRuntime/pageLayoutSettings.ts` 101) 로 지금 줌에서 보이는 폭에 맞는 정수 열 수를 계산하고, 바뀌면 `workspace.setAutoColumns` → `packages/shared/src/catalog/runtime/compositionRoot.ts` `setAutoColumns` (3242 ~ 3255: `catalog:root` 의 grid track 만 바꾸고 `computeLayout`, page frame 의 x · y 가 하나라도 바뀌면 true) → `scene.refresh()` → `canvasScene.ts` `rebind("page-grid")` → `bindCatalogCanvas` 전체 (`bindInColorMode`) 다. 전체 재바인드는 record 를 전부 다시 읽고 노드를 전부 다시 등록하고 스트림을 처음부터 기록하며 node picture 가 cold 가 된다 (ADR-263 Phase 0 표: 평평 5k 줌 content 43 프레임에 picture miss 5,398 · 스크롤 범위 방문 2,500 「재바인드」). `setAutoColumns` 자신의 주석이 「page frame 이 옮겨지고 그 내용은 레이아웃을 유지한다」 고 적고 있다 — 바뀌는 것은 page root 마다 절대 위치 하나다. 같은 `refresh()` 를 page grid 편집 (gap · columns · direction — `CatalogCanvas.tsx` 767 ~ 774) 도 부른다.
3. **옮기기가 공짜는 아니다 — 절대 좌표 맵과 공간 인덱스.** 명령은 부모 기준이지만 `boundsMap` · `hitBoundsMap` (`renderCommands.ts` 1526 · 1531) · `clipContextByElement` · `subtreeBuildContextByElement` (1482, `parentAbsX/Y`) 는 절대 좌표이고, `hitBoundsMap` 은 상자 ∩ 조상 clip 이라 단순 평행이동이 아니다 (clip 경계를 지나는 요소는 교차 결과가 비선형으로 바뀐다). SpatialIndex (Rust, `syncSpatialIndex` 1404 — hit bounds 로 upsert) 도 요소마다 갱신한다. 따라서 「자리만 옮긴 서브트리」 의 최소 비용은 **자손 수에 비례하는 좌표 산술 + 인덱스 upsert** 이고, 지금 비용은 거기에 node data 읽기 · 명령 재생성 · 두 span 검증 · picture 무효화 (Phase 5 로 일부 완화) 가 얹힌 것이다. 얼마가 남는지는 측정으로 정한다 (Phase 0).

### 3-domain 판정

D3 시각 스타일의 Builder (Skia) consumer **내부** 실행 경로다. D1 · D2 · catalog 문서 · 저장 형식 · 레이아웃 결과 (엔진 입력 · 출력) 는 바꾸지 않는다. Preview (DOM) 대칭은 시각 결과 무변경으로 유지한다 — 바뀌는 것은 같은 그림을 만드는 데 다시 기록하는 양뿐이다. Generator / catalog 확장 없음.

### Hard constraints

- **HC1 시각 결과 동일**: 옮기기 경로 뒤의 픽셀이 같은 상태의 전체 재바인드 + 선형 full 과 같다 (0 px 차). stale pixel (이동 전 자리 잔상) 0.
- **HC2 닫는 조건 (production 레인, ADR-263 HC2 승계)**: 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 %, 평평 5k 줌 p99 ≤ 20 ms. 중첩 5k 줌 ≤ 20 · 평평 5k drag ≤ 20 유지. dev 수치는 인용하지 않는다.
- **HC3 picking · overlay 정합**: 옮기기 뒤 `boundsMap` · `hitBoundsMap` · SpatialIndex · clip context 가 전체 재바인드의 값과 같다 — 선택 상자 · hover 아웃라인 · 클릭 판정 · 휠 스크롤 대상 (canvas-interaction.md §8.5) 이 그림과 어긋나지 않는다.
- **HC4 카운트 먼저**: 수정 전 카운트가 RED 로 고정되고, 수정과 같은 커밋에서 ratchet 상한이 내려간다 (ADR-246 · `--add-keys` A 등록). 원복 RED 는 ratchet `block` 으로 확인한다.
- **HC5 Skia 전용 시각 효과 0** (D3 대칭) — 바뀌는 것은 기록 비용뿐.

### Soft constraints

- 3단계 (선택 전환) 와 겹치지 않는 파일 범위 (`structure.ts` · Layers 구독은 건드리지 않는다).
- 4단계 Rust 판정 입력: 종결 뒤 남은 프로필을 §기록에 남긴다 (trigger 재료 — 그리기 명령 시간 · 경계 비용 · geometry 소유 통합 요구).
- 하니스 · live oracle 은 ADR-263 의 것을 잇는다 (`perf-baseline.mjs` `counts.render` · `adr263-render-path-live.mjs` 의 dev 전역 `__composition_RENDER_PATH_DEBUG__`).

## Alternatives Considered

### 대안 A: 「서브트리 옮기기」 한 기계 — patch root 를 seed 에 두고 자리만 옮긴 형제 · page root 는 좌표만 옮긴다

- 설명: 스트림에 `translateSubtree` (가칭) 를 둔다 — 서브트리 root 의 `ELEMENT_BEGIN` x · y 만 고치고, 자손의 `boundsMap` 을 (dx, dy) 로 옮기고 clip · hit bounds 는 root 의 불변 바깥 clip 에서부터 위에서 아래로 다시 교차하며 (저장된 교차 결과를 옮기지 않는다 — 리뷰 r1 M3), root 자신의 부모 문맥 (build context) 은 보존하고 자손의 문맥만 옮기며 (r1 H1), SpatialIndex 를 upsert 한다. damage 는 서브트리 모든 요소의 이전 ∪ 이후 hit bounds 합집합 (`overflow: visible` 자식은 root 밖에 있을 수 있다 — r1 H2). 명령 재생성 · node data 읽기 · span 검증 · picture 무효화 0. 두 호출자: (a) `geometryRegion` 이 「rect 의 x · y 만 바뀌고 크기 · 엔진 입력 · 자손이 그대로」 인 형제를 region 에 넣지 않고 옮기기 목록으로 보낸다 (부모 rect 가 바뀌면 지금처럼 부모가 root — 그때는 형제 내용도 바뀔 수 있다). (b) `setAutoColumns` 가 page root 마다 Δ 를 돌려주고 scene 이 재바인드 대신 root 를 옮긴다 (page frame 의 크기가 바뀌거나 root 집합이 바뀌면 지금처럼 재바인드). 옮길 수 없는 서브트리 (hit bounds 밖 paint · topLayer · fixed/sticky · transform · drag offset · span context 불완전) 는 기존 patch · 재바인드로 간다.
- 근거: Flutter 의 `RepaintBoundary` + `Transform` 레이어는 자식 picture 를 다시 기록하지 않고 offset 만 바꾼다; Chromium 의 compositing 은 transform 만 바뀐 layer 를 재래스터 없이 옮긴다 (`cc::Layer` transform tree). 이 저장소에서는 명령이 이미 부모 기준이라 (ADR-189) 그 성질을 쓰기만 하면 된다.
- 위험: 기술 **M** (hit bounds 의 clip 교차 비선형 · 제외 조건 누락 시 picking 어긋남 — 동치 테스트로 막는다) / 성능 **L** (자손 수 비례 좌표 산술 + upsert — 지금보다 상수가 작다; 얼마나 작은지는 Phase 0) / 유지보수 **M** (patch 와 옮기기 두 경로가 같은 맵 불변식을 지켜야 한다 — 「옮기기 결과 == 전체 재구축 결과」 동치 테스트가 계약) / 마이그레이션 **L** (경로를 끄면 지금 동작 — dev 전역으로 live 대조).

### 대안 B: 절대 좌표 맵을 지연 계산 (부모 기준 저장, 읽을 때 조상 체인 합산) 으로 바꿔 이동을 O(1) 로

- 설명: `boundsMap` · `hitBoundsMap` 을 절대값 대신 부모 기준으로 들고, 읽기마다 조상 합산. 이동은 root 한 줄 수정.
- 근거: 씬 그래프 (three.js `matrixWorld` dirty 전파) 방식.
- 위험: 기술 **H** (맵 소비자가 20+ 곳 — overlay · picking · 스크롤 · 측정 · 하니스; SpatialIndex 는 어차피 절대값 upsert 가 필요해 O(자손) 이 남는다) / 성능 **M** (읽기마다 조상 체인 — hover · overlay 는 프레임마다 읽는다) / 유지보수 **H** (좌표계 두 벌) / 마이그레이션 **M**.

### 대안 C: 줌 중에는 열 수를 바꾸지 않는다 (제스처 settle 뒤에만)

- 설명: `syncAutoColumns` 를 카메라 제스처 중 멈추고 settle 때 한 번만 재바인드.
- 근거: ADR-226 · 221 의 「제스처 중 DOM 쓰기 0 · settle 스냅샷」 과 같은 결.
- 위험: 기술 **L** / 성능 **L** (줌 꼬리만) / 유지보수 **L** / 마이그레이션 **L** — 그러나 **사용자 가시 동작이 바뀐다** (줌 중 page 격자가 따라오지 않고 손을 뗀 뒤 뛴다) 하고 편집 꼬리 · page grid 편집의 재바인드에는 닿지 않는다. HC2 의 편집 조건을 못 채운다.

### 대안 D: patch 는 그대로 두고 replacement 를 만들 때 바뀌지 않은 자식의 span 을 복사한다

- 설명: `buildSubtreeCommandStream` 이 node data · 지역 rect 가 같은 자식은 `visitElement` 대신 현재 span 을 복사.
- 위험: 기술 **M** / 성능 **M** (복사 · 맵 재작성이 여전히 region 크기 k ≈ N/2 에 비례 — 복잡도 등급이 안 바뀐다; 자리만 옮긴 자식은 `ELEMENT_BEGIN` 이 달라 결국 옮기기가 필요하다) / 유지보수 **M** / 마이그레이션 **L**.

### 대안 E: Rust/wasm 으로 스트림 · 맵 소유를 옮긴다

- ADR-263 대안 D 와 같다 — 4단계 판정의 몫. trigger 미충족 상태에서 고르지 않는다. 다만 Phase 0 에서 SpatialIndex upsert 가 옮기기 비용의 상한으로 드러나면, 엔진에 `translate_subtree` 를 두는 것 (geometry 소유 통합의 한 조각) 을 4단계 재료로 적는다.

### Risk Threshold Check

| 대안 | HIGH+                              | 판정                                         |
| ---- | ---------------------------------- | -------------------------------------------- |
| A    | 없음                               | 채택 후보                                    |
| B    | 기술 H · 유지보수 H                | 기각                                         |
| C    | 없음 — 그러나 HC2 편집 조건 불충족 | 단독 기각 · 사용자 결정 1 의 보조 수단으로만 |
| D    | 없음 — 복잡도 등급 불변            | 기각                                         |
| E    | (4단계)                            | 이 ADR 범위 밖                               |

루프 불필요 — A 에 HIGH 없음.

## Decision

**대안 A 를 채택한다.** Phase 0 이 두 꼬리의 카운트 (자리만 옮긴 형제가 patch root 명령에서 차지하는 비율 · 줌 1회당 `page-grid` 재바인드 수 · 옮기기의 최소 비용인 자손 수 · 인덱스 upsert 수) 를 등급 A 로 먼저 잡고, 그 뒤 옮기기 기계 → 편집 경로 → 줌 (· page grid 편집) 경로 순으로 간다.

- 위험 수용 근거: A 의 잔존 위험은 「옮기기 결과가 전체 재구축과 다른 경우」 하나로 모이고, 그것은 동치 테스트 (무작위 트리 · clip · 제외 조건 반례) 와 live 픽셀 · 맵 oracle 로 결정적으로 잡힌다. 옮길 수 없는 모양은 기존 경로로 떨어지므로 정확성 하한은 지금과 같다.
- B 기각: 소비자 전면 교체인데 SpatialIndex 때문에 O(자손) 이 남는다 — 비용을 줄이지 못하면서 좌표계를 둘로 만든다.
- C 기각 (단독): 편집 꼬리에 닿지 않고 사용자 가시 동작이 바뀐다. Phase 3 뒤에도 줌이 미달이면 사용자 결정 1.
- D 기각: 복잡도 등급이 그대로다 — region 이 커지는 원인 (형제 이동) 을 두고 복사 상수만 줄인다.
- E 보류: 4단계.

> 구현 상세: [264-moved-subtree-translate-page-grid-rebind-breakdown.md](design/264-moved-subtree-translate-page-grid-rebind-breakdown.md)

### 사용자 결정 2건 (execute-adr 가 해당 Phase 에서 묻는다)

1. **줌 꼬리가 옮기기로도 미달이면** (Phase 3 뒤 평평 5k 줌 p99 > 20 ms): 대안 C (열 수 변경을 줌 제스처 settle 로 미룸 — 사용자 가시 동작 변경) 를 보조로 넣는가, 아니면 측정 기록으로 둔다.
2. **종결 (G4) 에서 HC2 미달이면**: ADR-263 결정 2 와 같은 형태 — 측정 기록으로 종결 (남은 비용을 4단계 입력으로) vs 남은 비용 자리를 보고 Phase 추가.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 옮기기 뒤 맵 (`boundsMap` · `hitBoundsMap` · clip/build context · SpatialIndex) 이 전체 재구축과 달라 picking · overlay 가 그림과 어긋난다 (HC3) — 리뷰 r1 의 세 반례 (root 부모 문맥 이중 이동 · 저장된 clip 교차 평행이동 · root-only damage) 가 이 위험의 구체 형태 |  HIGH  | G1 동치 (무작위 ≥ 1,000 트리 · clip 경계를 지나는 이동 · 옮긴 뒤 같은 root 편집 · root 밖 `overflow: visible` 자식 포함) + live 에서 옮긴 뒤 클릭 · hover · 선택 상자를 전체 재바인드와 대조 |
| R2  | 옮길 수 없는 모양 (hit bounds 밖 paint · topLayer · fixed/sticky · transform · drag offset · 형제 비킴 · span context 불완전) 을 옮겨 잔상 · 오판                                                                                                                      |  MED   | 제외 조건을 옮기기 입구에서 판정하고 기존 경로로 — 각 조건의 반례가 G1 에 있다                                                                                                               |
| R3  | 편집 분류 오판 — 「자리만 옮긴 형제」 로 봤는데 자손 rect 가 바뀐 경우 (엔진이 지역 rect 를 바꾸는 형태: 크기 불변이지만 내용이 재배치되는 margin · grid placement 등)                                                                                                 |  MED   | 분류 = rect 크기 불변 **그리고** 엔진 입력 (`boundLayoutInputs`) 불변 **그리고** 자손 rect 비교 0 변화 (`descend` 를 옮기기 후보에도 돌린다 — 비교 비용은 카운트로 상한)                     |
| R4  | `setAutoColumns` 뒤 page frame 의 크기 · 내용 레이아웃이 실제로 바뀌는 경우 (track 폭 고정이 아닌 설정)                                                                                                                                                                |  MED   | root rect 의 width · height 가 바뀌면 재바인드 유지 — 옮기기는 x · y 만 바뀐 root 에만                                                                                                       |
| R5  | SpatialIndex upsert (Rust 경계 호출 자손 수만큼) 가 옮기기 비용의 상한으로 남아 HC2 미달                                                                                                                                                                               |  MED   | Phase 0 카운트 (`translateIndexUpserts`) · 미달이면 사용자 결정 2 와 4단계 재료 (엔진 `translate_subtree`)                                                                                   |
| R6  | 측정 — dev 수치 · 유리 케이스만 인용 (measurement-validity Q2 · Q3)                                                                                                                                                                                                    |  MED   | HC2 는 production 짝 교대 2 쌍만 · 불리 케이스 = clip 경계를 지나는 이동 · 1만 노드 문서 줌                                                                                                  |
| R7  | patch 와 옮기기 두 경로의 drift (한쪽만 고친 뒤 맵 불변식이 갈림)                                                                                                                                                                                                      |  MED   | 동치 테스트가 두 경로를 같은 oracle (전체 재구축) 에 대조 · ratchet 키로 경로 사용 비율 감시                                                                                                 |

## Gates

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                       |
| ---- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| G0   | Phase 0 | 카운트 등급 A (같은 옵션 2회 같은 값): 중첩 5k 편집 1회의 patch root 명령 수와 그중 자리만 옮긴 형제 서브트리의 명령 수 · 자손 수 · 평평 5k 줌 시나리오의 `page-grid` 재바인드 수와 content 프레임 수 · 옮기기 최소 비용 (자손 수 · 인덱스 upsert 수). `--add-keys` 로 A 등록, 인위 회귀 시 `decide` = `block`. 측정 조건 (dev/prod · headless · fixture 종류) 기록                                                                                                                                                                                                                                                              | 결정적이지 않은 카운트는 레버에서 뺀다             |
| G1   | Phase 1 | 옮기기 동치: 무작위 트리 (≥ 1,000, 중첩 clip · scroll offset · 넓이 0 · 숨김 포함) 에서 `translateSubtree` 뒤의 명령 · `selfSpans` · `subtreeSpans` · `boundsMap` · `hitBoundsMap` · clip/build context · SpatialIndex 등록이 같은 상태의 전체 재구축과 같다 · **옮긴 뒤 같은 root 를 편집한 다음 patch** 의 bounds 도 재구축과 같다 · damage 가 서브트리 전 요소의 이전 ∪ 이후 hit bounds 를 덮는다 (root 밖 `overflow: visible` 자식 포함) · 바깥 clip 에 잘렸던 안쪽 clip 이 이동으로 드러나는 경우의 clip · hit 높이가 재구축과 같다 · 제외 조건 7 종의 반례가 각각 `applied: false` · 실행된 draw 명령 목록이 재구축과 같다 | 제외 조건을 넓힌다 (옮길 수 있는 모양을 줄인다)    |
| G2   | Phase 2 | 편집 경로: 중첩 5k 편집 1회의 patch 교체 명령 수가 바뀐 노드 수에 비례 (A 상한 — Phase 0 값의 1/5 이하를 목표로 ratchet) · 옮긴 형제의 node picture 유지 · damage = 옮긴 형제의 이전 ∪ 이후 포함 · 원복 RED = 분류를 끄면 ratchet `block` · live 픽셀 0 차 (이동 전 · 후 · 옮긴 형제 클릭 · hover)                                                                                                                                                                                                                                                                                                                               | 옮기기를 특정 부모 display (flex · grid) 로 좁힌다 |
| G3   | Phase 3 | 줌 경로: 평평 5k 줌 시나리오의 `page-grid` 재바인드 0 (A 상한 0) · page header 배치 · page frame rect 가 재바인드와 같음 · 픽셀 0 차 (줌 0.5 · 1 · 2 에서 열 수가 바뀌는 구간) · page grid 편집 (gap · columns) 도 같은 경로 · 원복 RED                                                                                                                                                                                                                                                                                                                                                                                          | 줌 경로만 재바인드 유지 (사용자 결정 1)            |
| G4   | 종결    | HC2: 중첩 5k 편집 p99 ≤ 20 ms · drop < 1 % · 평평 5k 줌 p99 ≤ 20 ms · 중첩 5k 줌 · 평평 5k drag 유지 — 수정 전 commit 대조 production 짝 교대 2 쌍 · 불리 케이스 (clip 경계 이동 · 1만 노드 줌) 포함 · live exercise (실제 builder 에서 편집 · 줌 · page grid 편집 · 옮긴 요소 선택 · hover · 스크롤) + `/cross-check` + ratchet `--update` · 4단계 입력 (남은 프로필) 을 §기록에                                                                                                                                                                                                                                                | 사용자 결정 2                                      |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 편집 비용이 「레이아웃이 흔들린 영역」 이 아니라 「실제로 내용이 바뀐 노드 수」 에 비례한다 — 긴 flex 열에서 한 항목을 편집해도 아래 형제 전부를 다시 기록하지 않는다 (`canvasBinding.ts` · `subtreeCommandPatch.ts`).
- 줌 · page grid 편집에서 scene 전체 재바인드 (`bindInColorMode`) 가 사라진다 — record 재읽기 · 노드 재등록 · picture cold 가 없다 (`CatalogCanvas.tsx` · `canvasScene.ts` · `compositionRoot.ts`).
- 4단계 Rust 판정이 깨끗해진다 — 남은 비용에서 JS 설계 문제 두 가지가 빠진 뒤의 프로필이 trigger 입력이 된다.
- 옮기기 기계는 drag 의 형제 비킴 · 놓기 (ADR-263 Phase 0: drag 189 프레임 = patch 189 회) 에도 쓸 수 있는 자리다 — 이 ADR 범위 밖, 종결 뒤 후보로 기록.

### Negative

- 스트림 갱신 경로가 둘 (patch · 옮기기) 이 된다 — 동치 테스트가 계약이고, 새 명령 종류 · 새 맵을 더할 때 두 경로를 같이 고쳐야 한다.
- 옮기기도 자손 수 비례다 — 1만 노드 page 하나를 옮기면 1만 번의 좌표 산술 · upsert 는 남는다. 그 상한이 HC2 를 막으면 4단계 (엔진 `translate_subtree`) 로 넘긴다.
- 하니스 recorder 해시가 바뀐다 (`counts.render` 필드 추가 — `--accept-recorder`).
