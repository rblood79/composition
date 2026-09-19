# ADR-225 Phase 0 — 잔여 어휘 인벤토리 동결 (2026-09-19)

> [ADR-225](../completed/225-reusable-layout-vocabulary-alignment.md) G0 근거 (`docs/adr/evidence/` 는 gitignore 라 design 에 둔다 — review round 2 m2). breakdown §2 의 확장 정규식을
> `apps/builder/src` 에 실행해 49 파일 (production 27 · test 22) 을 재현했고, 파일마다 `rename` /
> `canonical` / `platform` / `history` 하나를 부여했다. 미분류 0.

## 1. 재현

```text
grep -rlE 'FramesTab|FrameList|FrameElementTree|frameActions|selectedReusableFrameId|SelectedReusableFrameId|ReusableFrameLayouts|ReusableFrameLayoutSummary|FrameSlotsSection|createReusableFrame|deleteReusableFrame|updateReusableFrame|selectReusableFrame|getNextFrameName|useCanonicalFrameSelectionStore|canonicalFrameStore|NAVIGATOR_SECTION_IDS\.(frames|frameLayers)|navigator-(frames|frame-layers)|frame-tree' apps/builder/src
→ 49 (test 22)
```

HEAD `cec7f9721`, working tree clean. 기준선 49 = 판정 대상이며 1.5× 임계 (74) 미만.

## 2. 심볼 rename 표 (Phase 2 에서 한 번에 적용)

| 현재                                                                                                        | 목표                                                                                                                                                                        | 범주   |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `panels/navigator/FramesTab/` · `FramesTab` · `FramesTabContent` · `FramesTabProps`                         | `panels/navigator/LayoutsTab/` · `LayoutsTab` · `LayoutsTabContent` · `LayoutsTabProps`                                                                                     | rename |
| `FrameList` · `FrameListItem` · `FrameListProps` · `FrameListNode` · `FrameListItemContent`                 | `LayoutList` · `LayoutListItem` · …                                                                                                                                         | rename |
| `FrameElementTree`                                                                                          | `LayoutElementTree`                                                                                                                                                         | rename |
| `LayoutPresetSelector/FrameSlotsSection`                                                                    | `LayoutPresetSelector/LayoutSlotsSection`                                                                                                                                   | rename |
| `stores/canonical/canonicalFrameStore.ts`                                                                   | `stores/canonical/reusableLayoutStore.ts`                                                                                                                                   | rename |
| `ReusableFrameLayoutSummary` · `useCanonicalFrameSelectionStore`                                            | `ReusableLayoutSummary` · `useReusableLayoutSelectionStore`                                                                                                                 | rename |
| `selectedReusableFrameId` · `use/get/setSelectedReusableFrameId`                                            | `selectedReusableLayoutId` · `use/get/setSelectedReusableLayoutId`                                                                                                          | rename |
| `canonicalDocumentToReusableFrameLayouts` · `get/useCanonicalReusableFrameLayouts`                          | `canonicalDocumentToReusableLayouts` · `get/useCanonicalReusableLayouts`                                                                                                    | rename |
| `stores/utils/frameActions.ts`                                                                              | `stores/utils/reusableLayoutActions.ts`                                                                                                                                     | rename |
| `create/delete/update/selectReusableFrame` · `updateReusableFrameName` · `getNextFrameName`                 | `create/delete/update/selectReusableLayout` · `updateReusableLayoutName` · `getNextLayoutName`                                                                              | rename |
| `CreateReusableFrameInput` · `ReusableFrameRef` · `ReusableFrameUpdate`                                     | `CreateReusableLayoutInput` · `ReusableLayoutRef` · `ReusableLayoutUpdate`                                                                                                  | rename |
| `NAVIGATOR_SECTION_IDS.frames/frameLayers` = `navigator-frames` / `navigator-frame-layers`                  | `.layouts/.layoutLayers` = `navigator-layouts` / `navigator-layout-layers` (구 id 는 hydration 승계)                                                                        | rename |
| `.frame-tree`                                                                                               | `.layout-tree`                                                                                                                                                              | rename |
| i18n `navigator.frames/addFrame/noFrames/selectFrame` · `properties.frame/applyFrame/removeFrame(FromPage)` | `navigator.layouts/addLayout/noLayouts/selectLayout` · `properties.applyLayout/removeLayout(FromPage)` + 신규 `noLayout` · `selectReusableLayout` · formatted `usingLayout` | rename |

**유지 (raw canonical boundary)**: `FrameNode` · `type: "frame"` · `isReusableFrameNode` · `createReusableFrameNode`
(adapter + actions 내부 factory) · `upsertReusableFrame` · `withFrameMetadata` · `ReusableFrameRecord` ·
`getReusableFrameMirrorId` · `applyPageFrameBinding*` · `applyDeleteReusableFrameCanonicalPrimary` ·
`createFrameBodyElement` · `frameElementScope` / `useCanonicalFrameElementScopes` · Pencil adapter.

**유지 (platform/component)**: `visibleFrameRoots` · `frameAreas` · `requestAnimationFrame` · iframe · catalog
`Frame`/`MaskedFrame` · 컨텍스트 메뉴 `group: "Frame"` / `ungroup: "Unframe"` (ADR-130 frame 컨테이너 묶기) ·
`properties.parentFrame/topFrame` (선택 이동 — 실제 frame 컨테이너).

## 3. 49 파일 분류

| #   | 파일 (`apps/builder/src/`)                                                        | 범주                 | 근거                                                         |
| --- | --------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------ |
| 1   | `adapters/canonical/__tests__/canonicalMutationRunner.static.test.ts`             | rename (경로 문자열) | allowlist 경로 `FramesTab/FramesTab.tsx` 갱신                |
| 2   | `adapters/canonical/__tests__/exportSsotGrepGate.test.ts`                         | rename (경로 문자열) | 주석 경로만                                                  |
| 3   | `adapters/canonical/__tests__/g6ParityCompletion.static.test.ts`                  | rename (경로·심볼)   | source-string assertion 갱신                                 |
| 4   | `adapters/canonical/canonicalMutations.ts`                                        | rename (주석)        | `getCanonicalReusableFrameLayouts()` 예시 주석               |
| 5   | `adapters/canonical/index.ts`                                                     | **canonical**        | `createReusableFrameNode` — raw FrameNode factory            |
| 6   | `builder/components/dialog/AddPageDialog.tsx`                                     | rename               | store import                                                 |
| 7   | `builder/config/actionIcons.static.test.ts`                                       | rename (경로)        | `FramesTab/FrameList.tsx` lookup                             |
| 8   | `builder/config/actionIcons.ts`                                                   | rename (주석)        | 소비처 목록 주석                                             |
| 9   | `builder/hooks/__tests__/useIframeMessenger.canonical.test.ts`                    | rename               | source-string assertion                                      |
| 10  | `builder/hooks/useIframeMessenger.ts`                                             | rename               | store import · selection id                                  |
| 11  | `builder/main/BuilderCore.static.test.ts`                                         | rename               | `getSelectedReusableFrameId()` assertion                     |
| 12  | `builder/main/BuilderCore.tsx`                                                    | rename               | store import                                                 |
| 13  | `builder/panels/components/ComponentsPanel.tsx`                                   | rename               | selection id 구독                                            |
| 14  | `builder/panels/navigator/FramesTab/__tests__/FrameElementTree.test.tsx`          | rename               | feature test                                                 |
| 15  | `builder/panels/navigator/FramesTab/__tests__/FrameList.test.tsx`                 | rename               | feature test                                                 |
| 16  | `builder/panels/navigator/FramesTab/__tests__/FramesTab.test.tsx`                 | rename               | feature test                                                 |
| 17  | `builder/panels/navigator/FramesTab/FrameElementTree.tsx`                         | rename               | feature component                                            |
| 18  | `builder/panels/navigator/FramesTab/FrameList.tsx`                                | rename               | feature component (`.frame-tree`)                            |
| 19  | `builder/panels/navigator/FramesTab/FramesTab.static.test.ts`                     | rename               | feature static test                                          |
| 20  | `builder/panels/navigator/FramesTab/FramesTab.tsx`                                | rename               | feature owner                                                |
| 21  | `builder/panels/navigator/FramesTab/index.ts`                                     | rename               | barrel                                                       |
| 22  | `builder/panels/navigator/NavigatorPanel.css`                                     | rename               | `.frame-tree` selector                                       |
| 23  | `builder/panels/navigator/NavigatorPanel.style.static.test.ts`                    | rename               | 경로·section id assertion                                    |
| 24  | `builder/panels/navigator/NavigatorPanel.tsx`                                     | rename               | `FramesTab` import·`FramesTabContent`                        |
| 25  | `builder/panels/navigator/navigatorSectionIds.ts`                                 | rename               | section id 값·키                                             |
| 26  | `builder/panels/navigator/tree/LayerTree/LayerTree.virtualization.static.test.ts` | rename (경로)        | 호출부 목록                                                  |
| 27  | `builder/panels/properties/editors/LayoutBodyEditor.tsx`                          | rename               | `FrameSlotsSection` import                                   |
| 28  | `builder/panels/properties/editors/LayoutPresetSelector/FrameSlotsSection.tsx`    | rename               | feature component                                            |
| 29  | `builder/panels/properties/editors/PageLayoutSelector.static.test.ts`             | rename               | source-string assertion                                      |
| 30  | `builder/panels/properties/editors/PageLayoutSelector.tsx`                        | rename               | 사용자 문구 6 + store import                                 |
| 31  | `builder/panels/properties/editors/PageParentSelector.test.tsx`                   | rename               | mock 경로                                                    |
| 32  | `builder/panels/properties/editors/PageParentSelector.tsx`                        | rename               | store import                                                 |
| 33  | `builder/panels/properties/PropertiesPanel.tsx`                                   | rename               | store import                                                 |
| 34  | `builder/stores/canonical/__tests__/canonicalFrameStore.test.ts`                  | rename               | → `reusableLayoutStore.test.ts`                              |
| 35  | `builder/stores/canonical/canonicalFrameStore.ts`                                 | rename               | → `reusableLayoutStore.ts` (내부 `isReusableFrameNode` 유지) |
| 36  | `builder/stores/index.ts`                                                         | rename               | barrel re-export                                             |
| 37  | `builder/stores/utils/__tests__/frameActions.indexSync.test.ts`                   | rename               | → `reusableLayoutActions.indexSync.test.ts`                  |
| 38  | `builder/stores/utils/__tests__/frameActions.test.ts`                             | rename               | → `reusableLayoutActions.test.ts`                            |
| 39  | `builder/stores/utils/__tests__/selectReusableFrameContext.test.ts`               | rename               | → `selectReusableLayoutContext.test.ts`                      |
| 40  | `builder/stores/utils/frameActions.ts`                                            | rename               | → `reusableLayoutActions.ts` (내부 raw factory 유지)         |
| 41  | `builder/workspace/canvas/BuilderCanvas.tsx`                                      | rename               | selection id 구독                                            |
| 42  | `builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.static.test.ts` | rename               | source-string assertion                                      |
| 43  | `builder/workspace/canvas/hooks/useCanvasElementSelectionHandlers.ts`             | rename               | `selectReusableFrame` caller                                 |
| 44  | `builder/workspace/canvas/renderers/invalidationPacket.ts`                        | rename               | summary type import                                          |
| 45  | `builder/workspace/canvas/skia/frameAreas.test.ts`                                | rename (test title)  | 파일·함수는 **platform** (`computeFrameAreas` 유지)          |
| 46  | `builder/workspace/canvas/skia/visibleFrameRoots.test.ts`                         | rename (test title)  | 파일·함수는 **platform** (`visibleFrameRoots` 유지)          |
| 47  | `builder/workspace/canvas/skia/visibleFrameRoots.ts`                              | rename (주석)        | 파일·함수는 **platform**                                     |
| 48  | `builder/workspace/canvas/skia/workflowEdges.ts`                                  | rename (파라미터)    | `_selectedReusableFrameId` 미사용 파라미터                   |
| 49  | `i18n/i18nWiring.static.test.ts`                                                  | rename               | 경로·key assertion                                           |

rename 48 · canonical 1 (#5) · platform 0 (45~47 은 파일 유지 + 문자열만 rename) · history 0 (source 안에 없음).

## 4. 정규식 밖 Builder chrome 문구

| 파일                     | 현재                                                                                                                                                     | 목표                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageLayoutSelector.tsx` | 섹션 `Frame` · `No Frame` · `Apply Frame` · `Using "…" frame` · `Select a reusable frame for this page` · `Remove frame from this page` · `Remove Frame` | `Layout` · `No Layout` · `Apply Layout` · `Using "…" layout` · `Select a reusable layout for this page` · `Remove layout from this page` · `Remove Layout` |
| `frameActions.ts:258`    | 이름 fallback `"Frame"`                                                                                                                                  | `"Layout"` (사용자 저장 이름은 변경 0 — fallback 만)                                                                                                       |
| `FramesTab.tsx` console  | `[FramesTab] Frame 삭제/생성 에러`                                                                                                                       | `[LayoutsTab] Layout …`                                                                                                                                    |

`PropertySelect.description` 은 현재 렌더되지 않는 prop 이다 (`PropertySelect.tsx:83` "not displayed"). 문구·key 는
정렬하되 표시 동작은 바꾸지 않는다 (HC4).

## 5. source 밖 hit

| 경로                                                             | 판정                          |
| ---------------------------------------------------------------- | ----------------------------- |
| `.claude/rules/state-management.md:79` (`FramesTab 로드`)        | 현행 rule → Phase 3 갱신      |
| `docs/explanation/research/BUILDER_PERF_BASELINE_2026-09.md:165` | 현행 research → Phase 3 갱신  |
| `apps/builder/eslint-local-rules/index.js:57`                    | 경로 allowlist → Phase 2 갱신 |
| `apps/builder/scripts/.tmp-panel-cap/**`                         | untracked 로컬 probe — 제외   |
| `docs/adr/completed                                              | design                        | evidence | reviews | archive/**`·`docs/CHANGELOG*.md` | history — 원문 유지 |
| `.agent/task-state.json`                                         | 로컬 상태 — 대상 아님         |

## 6. 변경 금지 snapshot

- `packages/shared/src/types/composition-document.types.ts` `FrameNode` / `type: "frame"`
- `apps/builder/src/adapters/pencil/**` + `.pen` fixture 5
- `apps/builder/src/adapters/canonical/**` raw selector/factory/binding (test 의 경로 문자열만 예외)
- Canvas geometry (`visibleFrameRoots` · `frameAreas`) · catalog `Frame`/`MaskedFrame`
- pre-225 `docs/adr/completed|design|evidence/**`

게이트: `apps/builder/src/builder/panels/navigator/__tests__/adr225VocabularyRatchet.static.test.ts` 가 §2 의 구
명칭 정규식으로 `apps/builder/src` 를 걸어 allowlist (useSectionCollapse 의 승계 map) 밖 hit 0 을 고정한다.

## 7. round 2 보강 (2026-09-19) — 주석·테스트 제목의 UI 어법

§1 정규식은 심볼·경로만 잡아 주석 `Frames tab` · `Frames 탭` · `Navigator Frames` · `Frame Preset` · `Frames/Layers` 7+건이
남았다 (BuilderCanvas.tsx · workflowEdges.ts · skiaOverlayBuilder.ts · useElementHoverInteraction.ts ×2 · PropertiesPanel.tsx ·
NavigatorPanel.tsx · DataTableCreator.css · frameAreas.test.ts · LayoutsTab.static.test.ts ×2 · LayoutsTab.test.tsx). 전부 Layouts
어법으로 고치고 ratchet 에 `LEGACY_FEATURE_COPY_PATTERN` 을 추가했다 (allowlist: 구 문구의 **부재**를 단언하는
`LayoutBodyEditor.static.test.ts`). 남기는 것: `reusable frame` (raw FrameNode 서술) · `frame body` · `frame title` (Canvas 기하).
