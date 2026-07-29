# ADR-172 구현 상세 — 팬 경로 파생 비용 제거

> 본 문서는 [ADR-172](../172-pan-path-derived-cost.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문 참조.

## 1. Phase 0 — inventory (2026-07-29 실측 완료분)

### 1-1. 측정 방법과 한계

MCP 브라우저 탭이 `visibilityState: hidden` 이라 **rAF 정지 + 타이머 1Hz 스로틀**이 걸린다 (메모리 `reference-chrome-mcp-hidden-tab-raf-pause-stale-overlay`). 이벤트 구동 팬 측정이 불가능해 두 갈래로 분리했다.

- **비용(ms)** — 대상 함수에 라이브 입력을 stash 한 뒤 **동기 반복 호출**로 측정 (타이머 무관). 스케일은 `page-components` 요소를 클론해 확장. 합성 요소와 실제 요소의 요소당 시그니처 길이가 1,363 vs 1,434 bytes 로 일치해 스케일 측정의 대표성을 확인했다.
- **빈도** — 코드로 확정. `viewport/useViewportControl.ts:349` 가 팬 델타를 rAF 당 1회 store 에 반영 → `BuilderCanvas` 리렌더 → 아래 3지점 재실행.

**한계 (Phase 5 에서 해소 대상)**: end-to-end 팬 프레임은 미측정 — 아래 수치는 "측정된 함수 비용 × 코드로 확정한 빈도" 다. `performance.now()` 가 0.1ms 로 양자화돼 소규모 값은 정밀도가 낮고, N=9,728 두 회차가 2.1/3.9ms 로 갈린 것은 JIT·GC 편차다.

### 1-2. 팬 프레임당 재실행 지점 4개

| #   | 지점                                                   | 위치                                                  | 성격                                 |
| --- | ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------ |
| P-1 | `layoutInputKey` → `createPageLayoutSignature`         | `hooks/useLayoutPublisher.ts:86-97`                   | **useMemo 없음** — 훅 본문 직접      |
| P-2 | `sceneStructureSnapshot` useMemo                       | `BuilderCanvas.tsx` (deps 에 `panOffset`/`zoom`)      | 카메라 결합                          |
| P-3 | `layoutPublisherInputs` → `new Map(elementById)`       | `renderers/rendererInput.ts:67` (visible page 당 1회) | 방어적 복사 + 카메라 결합            |
| P-4 | `buildSkiaFrameContent` 의 `commandChildrenMap` 재구축 | `skia/skiaFramePipeline.ts:260-274`                   | **Skia 축** — blit 프레임에도 매 rAF |

P-1~P-3 은 React 축(리렌더 유발), P-4 는 Skia 축이다. `SkiaCanvas.tsx:665` 의 `buildSkiaFrameContent` 앞에 프레임 종류별 early return 이 없어 camera-only(blit) 프레임에서도 `filteredChildIds` 전체를 순회하며 새 `Map` + 새 배열을 만든다. **P-4 는 현 규모에서 무해로 이미 실측됐다** — 2026-07-27 프레임 분해 실측(팬 중 JS 조립 = content.build + plan.build 합계 0.07~0.13ms/frame, "사실상 0" 격하 판정). 문제는 절대값이 아니라 비례성 — 이 구간만 캐시 게이트 없이 매 프레임 O(N) 이라, Phase 0 은 **대규모 N 재측정**이다.

**정상 확인 2건** (과잉 수정 방지) — `executeRenderCommands` 는 `contentNode.renderSkia` 안이라 재래스터 시에만 실행되고(`skiaFramePipeline.ts:318-330`), 노드 Picture 캐시(`stream.selfSpans`, ADR-153 Phase 3)는 이미 가동 중이다.

### 1-3. 측정값

**P-1 `createPageLayoutSignature`** — 요소당 `LAYOUT_STYLE_KEYS` 73개 + `LAYOUT_PROP_KEYS` 43개를 문자열로 이어붙인다 (요소당 약 1.4KB).

| 노드 수 | p50        | p95    | 생성 문자열 |
| ------: | ---------- | ------ | ----------- |
|      62 | 0.3ms      | —      | 77KB        |
|     980 | 5.9ms      | 18.8ms | 1.3MB       |
|   4,868 | 33.4ms     | 44ms   | 6.4MB       |
|   9,728 | **63.1ms** | 76.5ms | **12.8MB**  |

**P-2 `buildSceneStructureSnapshot`**

| 노드 수 | p50       | p95   | 하위 분해 (N=9,728)                                                             |
| ------: | --------- | ----- | ------------------------------------------------------------------------------- |
|      62 | 0.1ms     | 0.6ms | —                                                                               |
|     980 | 0.3–0.5ms | 0.6ms | —                                                                               |
|   4,868 | 1.3ms     | 1.4ms | —                                                                               |
|   9,728 | 2.1–3.9ms | 4.6ms | `buildDepthMap` 0.8 · `buildPageDataMap` 0.4 · `buildPageFrames` 0.2 · 기타 0.7 |

**P-3 `new Map(elementById)`** — N=4,868 에서 0.2ms, N=9,728 에서 0.4ms (visible page 당).

**합계 (팬 프레임당)**

| 노드 수 | P-1  | P-2 | P-3 | 합계      | 60fps 예산 대비 |
| ------: | ---- | --- | --- | --------- | --------------- |
|      62 | 0.3  | 0.1 | ~0  | ~0.4ms    | 2%              |
|     980 | 5.9  | 0.4 | ~0  | ~6.4ms    | 38%             |
|   4,868 | 33.4 | 1.3 | 0.2 | ~35ms     | 초과 (약 28fps) |
|   9,728 | 63.1 | 3.0 | 0.4 | **~66ms** | 초과 (약 15fps) |

### 1-4. 핵심 발견 — 카메라 필드가 dead 다

`LayoutPublisherInput` 은 `panOffset` / `zoom` 을 선언하지만 (`renderers/rendererInput.ts:28,30`) **어디서도 읽지 않는다**:

- `hooks/useLayoutPublisher.ts` 전체에 `panOffset` / `zoom` 참조 **0건**
- `hooks/` + `renderers/` 전체에 `input.panOffset` / `input.zoom` 소비 **0건**

즉 P-3 의 카메라 결합은 **동작에 기여하지 않는 잔재**이고, 제거는 순수 삭제다. P-2 는 다르다 — `buildVisiblePageSet({ containerSize, pageFrames, panOffset, zoom })` 이 실제로 카메라를 쓴다 (§3).

### 1-5. Phase 0 잔여 inventory — **완료 2026-07-29** (P-4 재측정만 이연)

- [x] `ScenePageSnapshot.isVisible` 소비자 전수 → **읽기 0건** (`.isVisible` 프로퍼티 접근 grep 0건. `builder/layout/types.ts:31` 은 패널 슬롯의 동명이필드로 무관). 생성만 되고 아무도 읽지 않는 dead 필드 → **4-1-a 확정**, 나아가 필드 자체 삭제
- [x] 같은 확인에서 **`SceneStructureSnapshot.viewportVersion` 도 소비자 0건** 발견 (생성 `buildSceneSnapshot.ts:240` + 타입 선언뿐) → 카메라 직접 해싱이라 남기면 팬마다 snapshot identity 파괴. Phase 3 에서 함께 삭제
- [x] `layoutPublisherInputs` / `frameLayoutPublisherInputs` 두 경로 대칭 → **동일 결함 확인**. 둘 다 deps 에 `panOffset`/`zoom` + `sceneSnapshot`, 둘 다 `new Map(elementById)` 방어 복사. Phase 1 에서 대칭 정리
- [x] `createPageElementsSignature` 비용 → `id:parent_id` 만 이어붙임 (요소당 약 40B). P-1(`createPageLayoutSignature`, 요소당 1.4KB)의 **3% 미만** — 같은 memo 에 포함하되 별도 처방 불요
- [x] **P-4 `commandChildrenMap` 재구축 비용 — 대규모 N 재측정** → **완료 2026-07-30**. 9,600 자식에서 p50 2.06ms / p95 3.72ms (60fps 예산 12~22%) 로 skip 기준(0.1ms) 크게 초과 → **Phase 1.5 진행** (R7 종결). 측정표·방법은 §2.5
- [x] `childrenMap` 반환값 소비자 전수 + mutate 여부 → **mutate 0건** (`childrenMap.set/delete/clear` 는 `renderCommandStream.bench.ts:129` 픽스처뿐). 소비처는 `skiaFramePlan.ts:172` / `SkiaCanvas.tsx:273,294` / `buildSpecNodeData` 로 전부 읽기 → 캐시화 안전 (**R6 해소**)
- [x] (추가) `elementById` mutate 소비자 → **0건** → `ReadonlyMap` 전환 안전 (**R3 해소**)
- [ ] 편집 경로 실측 baseline (Phase 6 판정 근거) — 본 ADR 범위 밖, Phase 5 완료 후

---

## 2. Phase 1 — 카메라 dead 필드 제거 (P-3) — **완료 2026-07-29 (`49b845089`)**

**전제**: §1-4 에서 미소비 확인 완료.

| 작업                                                                                             | 파일                                     |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `LayoutPublisherInput` 에서 `panOffset` / `zoom` 필드 삭제                                       | `renderers/rendererInput.ts:28,30`       |
| `BuildPageLayoutPublisherInputOptions` / frame 대응 옵션에서 동일 필드 삭제                      | `renderers/rendererInput.ts`             |
| `buildPageLayoutPublisherInput` / `buildFrameLayoutPublisherInput` 반환에서 삭제                 | 〃                                       |
| `elementById: new Map(elementById)` → `ReadonlyMap` 전달 (복사 제거)                             | `renderers/rendererInput.ts:67`          |
| `layoutPublisherInputs` / `frameLayoutPublisherInputs` useMemo deps 에서 `panOffset`/`zoom` 제거 | `BuilderCanvas.tsx:516-527`, `585-` 대응 |
| 호출부 인자 정리                                                                                 | `BuilderCanvas.tsx:501-512`, `588-`      |

**주의**: `ReadonlyMap` 전환 전에 소비자가 `elementById` 를 mutate 하지 않는지 grep 확인. mutate 하는 소비자가 있으면 그 지점만 지역 복사로 남기고 사유를 주석에 남긴다.

**검증**: 이 Phase 의 완료 기준은 "`layoutPublisherInputs` deps 에서 `panOffset`/`zoom` 이 사라짐"이다. **이 Phase 만으로는 팬 중 재생성이 멈추지 않는다** — deps 에 남는 `sceneSnapshot`(`BuilderCanvas.tsx:524`)과 `visiblePages`(`:517`)가 카메라 결합 스냅샷(`:466-483` deps 에 `panOffset`/`zoom`)의 산출물이라, identity 안정화는 Phase 3 까지 반영되어야 완성된다. Phase 2 의 실효 전제는 **Phase 1 + Phase 3 둘 다**다.

---

## 2.5. Phase 1.5 — Skia 프레임 콘텐츠 재사용 (P-4) — **완료 2026-07-30 (`2e25a5acd`)**

**R7 재측정 결과 진행 판정.** 현 규모에서는 2026-07-27 프레임 분해 실측이 이 구간을 "사실상 0"(JS 조립 합계 0.07~0.13ms/frame)으로 격하 판정했으나, 2026-07-30 대규모 N 재측정에서 **9,600 자식 p50 2.06ms / p95 3.72ms**(60fps 예산 12~22%)로 skip 기준(0.1ms)을 크게 초과했다. 측정표는 [ADR §"R7 종결"](../172-pan-path-derived-cost.md) 참조.

측정 방법 — 원본 루프를 실제 입력으로 재현했다. `buildSkiaFrameContent` 는 hidden 탭에서 아예 돌지 않으므로(rAF 정지) 입력 stash 지점을 **rAF 밖(React 렌더 경로 `createSkiaRendererInput` + layout getter)** 으로 옮겨 임시 노출했고, 측정 후 제거했다. 동기 반복 벤치는 타이머 무관이라 hidden 탭에서도 유효하다 (§9).

`min` 값이 40–58 ns/child 로 선형인 반면 p50/p95 가 초선형으로 뛰는 것은 **GC 압력**이다 — 매 프레임 Map + 배열 수천 개를 새로 할당하는 것이 실제 동작이므로 p50 을 실측치로 삼았다.

React 축(P-1~P-3)만 고치면 blit 프레임에 `commandChildrenMap` O(N) 재구축이 남아 **Hard Constraint 1 이 성립하지 않는다** — 축 ① 을 닫으려면 4지점 전부가 필요하다.

### 2.5-1. 설계

`commandChildrenMap` 은 `getCachedCommandStream` 의 **입력**이고, 그 캐시는 이미 5중 키(`registryVersion` / `pagePosVersion` / `framePosVersion` / `layoutVersion` / `rootSignature`)로 hit/miss 를 판정한다 (`skia/renderCommands.ts:347-388`). 같은 키가 hit 이면 `commandChildrenMap` 도 재구축할 이유가 없다.

→ **같은 5중 키로 `commandChildrenMap` 을 함께 캐시**한다. 별도 키를 신설하지 않는다 — 두 캐시의 무효화 시점이 갈리면 스트림과 childrenMap 이 어긋난다.

### 2.5-2. 작업

| 작업                                                                                              | 파일                                   |
| ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `commandChildrenMap` 을 커맨드 스트림 캐시와 동일 키로 memo (모듈 캐시 또는 스트림 반환값에 동봉) | `skia/skiaFramePipeline.ts:259-274`    |
| 반환값 `childrenMap` 소비자가 프레임별 새 identity 를 전제하지 않는지 확인                        | `skia/skiaFramePipeline.ts:335` 소비처 |
| 캐시 무효화 경로가 `invalidateCommandStreamCache()` 와 일치하는지 확인                            | `skia/renderCommands.ts`               |

**금지**: `commandChildrenMap` 전용 캐시 키 신설 (스트림과 무효화 시점이 갈림). 반환 Map 을 소비자가 mutate 하고 있으면 캐시화 대신 그 소비자를 먼저 고친다.

### 2.5-3. 반영 결과

`getCachedCommandStream` 이 childrenMap 을 **lazy builder**(`() => Map`)로 받고 `{ childrenMap, stream }` 을 반환한다. 캐시 hit 이면 builder 를 호출하지 않고 동봉된 값을 그대로 돌려준다 — blit 프레임은 5중 키가 전부 그대로라 항상 hit 이다. **builder 를 미리 호출해 값으로 넘기면 lazy 가 무의미해진다.**

**정합성 전제는 스트림 캐시가 이미 의존하던 것과 같다**: `filteredChildIds` 갱신은 항상 `publishLayoutMapsBatch`(→ `_sharedLayoutVersion++`)와 짝을 이루고, `renderNodesMap` 변경은 `SkiaCanvas.tsx:267` 의 `useEffect([rendererInput])` 명시 invalidate 가 덮는다. 스트림이 childrenMap 으로부터 만들어지는 이상 "스트림 재사용이 정당하면 childrenMap 재사용도 정당하다" 가 성립한다. 오히려 종전에는 캐시 hit 프레임에서 스트림(캐시)과 childrenMap(매번 새로 조립)의 **세대가 갈려** 있었고 이번 변경이 그 비대칭을 없앤다 (R6 해소).

계약 테스트 7건 — `skia/commandStreamCache.test.ts`: miss 에서만 builder 호출 / hit 은 같은 identity / 5중 키 각각 변경 시 재호출(stale 반환 금지, 5 케이스) / `invalidateCommandStreamCache()` 가 둘 다 버림.

**live 미검증**: blit 프레임 캐시 hit 은 rAF 가 필요한데 MCP 탭이 `visibilityState: hidden` 이라 Skia 프레임 자체가 돌지 않는다 (R4 와 동일 제약). 프레임 단위 확인은 Phase 5 에서 visible 창으로.

---

## 3. Phase 2 — `layoutInputKey` 메모이제이션 (P-1) — **완료 2026-07-29 (`fc51d75a8`)**

**Phase 1 + Phase 3 선행 필수.** `layoutInputKey` 를 `useMemo(..., [pages, framePages])` 로 감싸도 `pages`(= `layoutPublisherInputs`) identity 가 팬마다 바뀌면 매번 miss 다. Phase 1 은 직접 카메라 deps(`panOffset`/`zoom`)를 제거하고, Phase 3 이 deps 에 남는 `sceneSnapshot`/`visiblePages` 의 카메라 결합을 끊는다 — 둘 다 반영되어야 identity 가 안정된다. memo 자체는 Phase 3 전에 넣어도 무해하나(매 프레임 miss 로 현상 유지), G2 는 Phase 3 후에만 통과 가능하다.

### 3-1. 보존해야 할 계약 (CRITICAL)

`useLayoutPublisher.ts:82-85` 주석이 명시한다 — `addElement` 는 `elements`/`layoutVersion` 갱신 후 `pageIndex`/`elementsMap` 을 **별도 commit** 으로 rebuild 하고, 두 번째 commit 은 `layoutVersion` 이 변하지 않는다. 그래서 page/frame **input 구조 자체**가 publish trigger 에 포함돼야 신규 child 가 layoutMap 없이 투명/미등록 상태로 남지 않는다.

→ **deps 를 `layoutVersion` 단독으로 좁히면 안 된다.** `pages`/`framePages` 배열 identity 를 deps 로 유지하고, 그 identity 가 카메라와 무관해지도록 Phase 1 로 처리하는 것이 본 설계의 순서 근거다.

### 3-2. 작업

| 작업                                                                      | 파일                                |
| ------------------------------------------------------------------------- | ----------------------------------- |
| `layoutInputKey` 를 `useMemo` 로 감쌈 (deps = `[pages, framePages]`)      | `hooks/useLayoutPublisher.ts:86-97` |
| `dimensionKey` / `readinessKey` 도 동일 처리 (같은 렌더 본문 문자열 조립) | 〃 `:67-80`, `:101-106`             |
| 주석 갱신 — 왜 deps 가 배열 identity 인지 (§3-1 근거) 명시                | 〃                                  |

### 3-3. 반영 결과 + R1 재발 차단 가드

세 키 모두 `useMemo(..., [framePages, pages])`. **정적 가드 2건**을 `useLayoutPublisher.static.test.ts` 에 추가해 계약을 기계 집행한다:

1. 세 키가 `useMemo` 로 감싸져 있고 훅 본문 직접 조립(`const X = [...pages`)이 복귀하지 않음
2. `[framePages, pages]` deps 가 정확히 3회 등장하고, **`[layoutVersion` 로 시작하는 deps 배열은 `useEffect` 단 1곳**뿐 — memo deps 로 새어 들어가면 2 이상이 되어 FAIL

기존 첫 테스트의 `const layoutInputKey = [...pages, ...framePages]` 패턴 단언은 memo 로 형태가 바뀌어 `[...pages, ...framePages]` 존재 확인으로 완화했다 (형태가 아니라 **입력 구성**이 계약이므로).

**G1 live 검증** (R1 의 직접 검증, 새로고침 후 재확인): 요소 추가 직후 신규 child 가 layoutMap 에 발행(82→83) + 좌표 `20,456 100x20` + Skia 노드 등록 → **투명/미등록 0건**. undo 정리 시 layoutMap 에서도 제거(83→82)되어 삭제 경로도 memo 를 빠져나가지 않음을 함께 확인.

---

## 4. Phase 3 — `sceneStructureSnapshot` 카메라 축 분리 (P-2) — **완료 2026-07-29 (`02f634f10`)**

P-2 는 카메라를 **실제로 쓴다** — `buildVisiblePageSet({ containerSize, pageFrames, panOffset, zoom })`. 따라서 삭제가 아니라 **분리**다.

### 4-0. 반영 결과

`buildSceneSnapshot.ts` 를 세 함수로 갈랐다 — `buildSceneStructureCore`(카메라 인자 미수신) / `resolveSceneVisibility`(카메라 의존, O(페이지), visible set 대표 `key` 반환) / `composeSceneStructureSnapshot`(순수 조립). 기존 `buildSceneStructureSnapshot` 은 셋을 잇는 호환 wrapper 로 남아 테스트·벤치가 그대로 쓴다 — **라이브 렌더 경로에서는 쓰지 말 것** (카메라가 core 에 다시 묶인다).

**identity 안정화는 ref 캐시가 아니라 key deps 다.** 초안은 `useRef` 로 `{core, key, snapshot}` 을 캐시했으나 `react-hooks/refs` 가 렌더 중 ref 접근을 금지해 11 error 가 났다 (오염이 `sceneSnapshot` 을 쓰는 하류 useMemo 로 전파). 대신 `sceneVisibility.key` 를 합성 useMemo 의 deps 로 쓴다 — key 가 같으면 visibility 내용(visible frame ids + content/position 버전 2종)이 동일해 어느 렌더의 객체를 써도 값이 같고, stale 이 없다. `exhaustive-deps` disable 1줄이 그 계약의 표시다.

`isVisible` 제거로 `pageSnapshots` 전체가 카메라 무관이 되어 **4-1-b 의 얕은 복사조차 불필요**해졌다.

ADR-136 signature 계약은 불변 — core 가 접두(`layoutVersion:pagePositionsVersion:elementCount:pageCount`)를 만들고 compose 가 뒤에 visible\* 2종 + projection signature 를 붙여 **기존과 동일한 해시 입력 문자열**을 만든다. `.claude/rules/canvas-rendering.md` §9 의 입력 목록에 `isVisible` 은 애초에 없었다.

### 4-1. 분리선

`scene/buildSceneSnapshot.ts:112-183` 을 두 단계로 가른다.

| 단계                    | 내용                                                                             | 카메라 의존 | 비용      |
| ----------------------- | -------------------------------------------------------------------------------- | ----------- | --------- |
| **core** (카메라 무관)  | `buildDepthMap` · `buildPageDataMap` · `buildPageFrames` · `contentVersion` 해싱 | ❌          | O(N)      |
| **visibility** (카메라) | `buildVisiblePageSet` → `visiblePageIds` → `pageSnapshots[].isVisible` 주입      | ✅          | O(페이지) |

`pageSnapshots` **안에서는** `isVisible` 이 두 단계에 걸치는 유일한 필드다 (`buildSceneSnapshot.ts:179`). 단 카메라 의존 산출물은 그것만이 아니다 — visibility 단계가 함께 소유해야 하는 표면:

- `document.visiblePageIds` / `document.visiblePageFrames` (`buildSceneSnapshot.ts:126-134`)
- `document.visibleContentVersion` / `document.visiblePagePositionVersion` (`:188-203` — visiblePageFrames 를 순회해 해싱; `SkiaCanvas.tsx:623-641` 이 content 무효화 신호로 소비)
- `sceneVersion` (`:228-238` — 위 visible\* 2종을 입력으로 함) — 이 값이 `projectionVersion`(`renderers/rendererInput.ts:74`)으로 publisher input 에 실려 `layoutInputKey`(`hooks/useLayoutPublisher.ts:95`)에 들어간다. 페이지 경계를 넘는 팬에서 visible set 이 바뀌면 sceneVersion 이 바뀌어 republish 가 트리거되는 것은 **의도 동작**이다 (신규 가시 페이지의 레이아웃 발행).
- `viewportVersion` (`:240-248` — 카메라 직접 해싱)

**visibility 단계 산출물의 identity 안정성 요구 (CRITICAL)**: visible set 이 불변인 팬 프레임에서는 이전 산출물(Set/배열/스냅샷 객체)의 identity 를 유지해야 한다 — 매 프레임 새 객체를 만들면 `visiblePages`(`BuilderCanvas.tsx:491-495`)와 `layoutPublisherInputs` 가 다시 팬마다 재생성되어 G2 가 통과 불가다. visible set 시그니처 비교 후 불변이면 이전 결과를 그대로 반환한다.

`isVisible` 처리 방식 2안 중 Phase 0 잔여 inventory 결과로 택일:

- **4-1-a** — `isVisible` 을 `ScenePageSnapshot` 에서 빼고 소비자가 `visiblePageIds.has(id)` 로 조회 (계약 변경, 소비자 수정 필요)
- **4-1-b** — core 결과를 얕은 복사해 `isVisible` 만 덧입히는 visibility 단계 (계약 유지, 페이지 수만큼 얕은 복사)

→ **4-1-a 채택** (2026-07-29). 읽는 소비자가 0건이라 "계약 변경, 소비자 수정 필요" 라는 4-1-a 의 유일한 비용이 실재하지 않았다. 삭제된 리터럴 5곳은 전부 픽스처(테스트 3 · 벤치 1)와 frame synthetic snapshot 1곳이다.

### 4-2. 작업

| 작업                                                                    | 파일                              |
| ----------------------------------------------------------------------- | --------------------------------- |
| `buildSceneStructureCore()` 추출 (카메라 인자 미수신)                   | `scene/buildSceneSnapshot.ts`     |
| `resolveSceneVisibility(core, { containerSize, panOffset, zoom })` 신설 | 〃                                |
| `BuilderCanvas` 에서 useMemo 2개로 분리 — core deps 에 카메라 제외      | `BuilderCanvas.tsx:449-500`       |
| `sceneVersion` signature 입력 목록 영향 확인 (ADR-136 계약)             | `scene/` + canvas-rendering.md §9 |

**ADR-136 주의**: `sceneVersion` = layoutVersion + pagePositionsVersion + projection content signature 이고, projection-relevant field 추가/이동 시 signature 입력 목록 동시 갱신 의무가 있다 (`.claude/rules/canvas-rendering.md` §9). `isVisible` 을 옮길 때 이 목록을 확인한다.

---

## 5. Phase 4 — 계측 상설화

Phase 5 검증과 회귀 감시의 근거를 남긴다. ADR-153 (Implemented) 의 `perfMarks` 인프라를 그대로 쓴다.

| 작업                                                            | 파일                         |
| --------------------------------------------------------------- | ---------------------------- |
| `PERF_LABEL` 에 팬 경로 라벨 추가 (`render.derived.scene` 등)   | `builder/utils/perfMarks.ts` |
| P-1 / P-2 재계산 지점에 `observe()` 배선 (dev 한정 아님 — 상시) | 해당 3지점                   |
| 팬 중 재계산 **횟수** 카운터 (0 이어야 함) 추가                 | 〃                           |

> 본 세션의 임시 계측(`[TEMP-PROBE]`)은 되돌렸다. Phase 4 는 그것을 정식 라벨로 재도입하는 작업이다.

---

## 6. Phase 5 — 검증

### 6-1. 정적

- [ ] `pnpm type-check` 통과
- [ ] `LayoutPublisherInput` 에 `panOffset`/`zoom` 0건 (grep)
- [ ] `useLayoutPublisher` 훅 본문에 비-memo 문자열 조립 0건 (grep)
- [ ] `skiaFramePipeline` 의 `commandChildrenMap` 이 커맨드 스트림과 **동일 키**로 캐시됨 (별도 키 0건, Phase 1.5 반영 시)
- [ ] 기존 테스트 그린 — 특히 `renderers/__tests__/buildFrameRendererInput.test.ts`

### 6-2. live behavior (CLAUDE.md §완료 기준 — test PASS 단독 종결 금지)

`visibilityState` 문제로 rAF 가 죽으므로 **사용자 실행 또는 visible 창**에서 수행한다.

- [ ] **G1** — `addElement` 2-commit 시나리오: 요소 추가 직후 신규 child 가 캔버스에 정상 렌더 (투명/미등록 0건). Phase 2 의 최대 위험.
- [ ] **G2** — 팬 중 P-1/P-2 재계산 횟수 **0** (Phase 4 카운터)
- [ ] **G3** — 페이지 경계를 넘는 팬에서 새 페이지가 진입/이탈 시 정상 렌더 (visibility 분리 회귀 감시)
- [ ] **G4** — 프레임 편집 모드 / 브레이크포인트 전환 / undo·redo 후 레이아웃 발행 정상
- [ ] **G5** — 60fps 유지 (`useGPUProfiler`)

### 6-3. 스케일 회귀

Phase 0 의 클론 스케일러를 테스트로 승격해 N=1,000 / 5,000 에서 팬 프레임당 파생 비용이 **상수**임을 단언한다 (요소 수에 비례하면 FAIL).

---

## 7. Phase 6 — 편집 경로 판정 (조건부)

Phase 5 완료 후 편집 경로를 실측한다. `createPageLayoutSignature` 는 편집 경로에서는 **레이아웃 캐시 키라는 정당한 목적**이 있어 단순 제거 대상이 아니다.

- 편집당 비용이 **16ms 를 넘는 요소 수 임계**를 실측으로 확정
- 임계가 실사용 규모(예: 1,000) 이하로 내려오면 → Pen #12/#14 형 **mutation 시점 dirty 집합** 전환을 별도 ADR 로 제안
- 임계가 실사용 규모를 크게 상회하면 → 이연 사유를 본 ADR §Risks 에 기록하고 종결

**본 ADR 은 여기까지 하지 않는다** — 편집 경로 전환은 `layoutCache` 계약 전체를 바꾸는 별도 범위다.

---

## 8. 파일 변경 요약

| 파일                                  | Phase | 성격                 |
| ------------------------------------- | ----- | -------------------- |
| `renderers/rendererInput.ts`          | 1     | 필드 삭제            |
| `skia/skiaFramePipeline.ts`           | 1.5   | 캐시 재사용 (조건부) |
| `BuilderCanvas.tsx`                   | 1, 3  | deps 정리·분리       |
| `hooks/useLayoutPublisher.ts`         | 2     | 메모이제이션         |
| `scene/buildSceneSnapshot.ts`         | 3     | 함수 분리            |
| `scene/sceneSnapshotTypes.ts`         | 3     | 계약 (4-1-a 채택 시) |
| `builder/utils/perfMarks.ts`          | 4     | 라벨 추가            |
| `scene/__tests__/` (신규 스케일 회귀) | 5     | 테스트               |

Phase 1~4 는 각각 독립 커밋 가능하며, **Phase 1·3 → 2 순서가 강제**다 (§3 전제 — Phase 2 의 실효는 Phase 1 과 Phase 3 둘 다 필요. Phase 3 없이 Phase 2 만 넣으면 `pages` identity 가 팬마다 깨져 memo 가 매 프레임 miss). Phase 1.5 는 Phase 0 측정 결과에 조건부이고 다른 Phase 와 순서 의존이 없다.

**축 ① 완결 조건**: Phase 1 + 1.5 + 2 + 3 이 모두 반영되어야 "팬 프레임당 파생 비용이 요소 수에 상수"(G5)가 성립한다. 하나라도 빠지면 그 지점이 O(N) 으로 남는다.

---

## 9. 재현 절차 (측정)

```js
// 1) 대상 함수에 라이브 입력 stash (임시 계측)
// 2) 페이지 컨텍스트에서 동기 반복 호출
const bench = (fn, it) => {
  for (let i = 0; i < 3; i++) fn();
  const t = [];
  for (let i = 0; i < it; i++) {
    const s = performance.now();
    fn();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  return t[(it * 0.5) | 0];
};
// 3) 스케일은 한 페이지 요소를 클론해 id/parent 재배선 (§1-1 대표성 확인 완료)
```

**MCP 탭 함정**: `document.visibilityState === "hidden"` 이면 rAF 정지 + 타이머 1Hz 스로틀이라 이벤트 구동 측정이 불가능하다. 동기 호출 벤치는 영향을 받지 않는다.
