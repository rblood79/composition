# ADR-911: Layout/Slot Frameset 완전 재설계 — pencil app 호환

## Status

Implemented — 2026-05-02 direct cutover + G5 Pencil import/export parity closure. 2026-05-03 post-cutover fix 군은 2026-05-05 rollback 으로 폐기됐고, 2026-05-06 current main follow-up 패치로 Frames 탭 / Skia frame body / Slot 표시 / shared frame multi-page refresh / Nodes panel Frames tree parity 회귀를 다시 닫았다.

> **재개 사유** (2026-04-30): 본 ADR 은 ADR-912 (Editing Semantics UI — reusable component + slot 추상) 의 **frame-bundled preset 편의 확장** 임이 framing 재정의 됐고, 2026-04-30 ADR-912 가 Component/Slot base 를 `Implemented` 로 승격했다. 본 ADR 은 여전히 ADR-912 에 영향을 주거나 기준을 제공하지 않는다. `Frame.reusable` / `Frame.slot` / `Ref.descendants` schema 의 사용자 가시 편집 base 는 ADR-912 기준을 따른다. 본 ADR 의 이전 ##Slot section## 소유권 표현은 잘못된 설계 전제였고, ADR-912 기준으로 supersede 된다. **재개 범위**: P3-ε / P3-ζ 는 FramesTab / frame preset UX 가 완료된 ADR-912 기능을 더 쉽게 쓰게 하는 보조 흐름으로만 재설계한다.

> **동결 보존 범위**: Phase 0~2 (Implemented) + Phase 3 의 P3-α/β/γ/δ + δ fix #1+#2+#3+#4 + B1 filter + θ scope land + θ regression fix #1 (~commit `e4f24697` + 세션 49 후속) 모두 보존. P3-θ regression fix #1 은 frame instance composition body 채택 정책 GREEN — frame schema 자체 land 는 ADR-912 base 와 무관하게 실 사용자 가시 동작 (frame default + page slot fill) 보존 가치.

> **재개 조건 및 closure 결과**: 충족됨. ADR-912 Component/Slot base 완료(2026-04-30) 후 P3-ε / P3-ζ 는 ADR-912 기능의 frame authoring 편의 확장으로 재설계했고, 사용자 브라우저 회귀 검증까지 완료했다. 이후 2026-05-02 direct cutover 로 G3 canonical frame action surface 와 G4 legacy layout store/명칭 충돌 잔여를 닫았고, G5 Pencil import/export parity 를 완료해 본 ADR 을 `Implemented` 로 승격한다.
>
> **ADR-916 우선순위 조정 closure (2026-05-02)**: ADR-916 이 `CompositionDocument` canonical store/API 및 import/export adapter boundary 를 닫은 뒤, 본 ADR 의 G3/G4/G5 잔여도 순차 closure 했다. ADR-914 는 completed archive 에 Superseded 로 이동했으며, `imports` resolver/cache 잔여 scope 는 ADR-916 canonical import registry 와 본 ADR G5 Pencil adapter 로 흡수됐다.

> **Direct cutover 정정 (2026-05-02)**: 개발 단계라 기존 사용자/데이터 보존, feature flag, dev migration trigger, backup/rollback 을 유지하지 않는다. `VITE_FRAMES_TAB_CANONICAL` / `isFramesTabCanonical()` / `migrationP911` / FramesTab dev migration UI 를 제거했고, FramesTab/PageLayoutSelector read path 는 canonical reusable FrameNode surface 로 고정했다. G4 명칭 충돌 항목인 `PanelSlot` / `BottomPanelSlot` 은 `PanelArea` / `BottomPanelArea` 로 rename 완료했다. `useLayoutsStore` / `layoutActions` legacy store 본체도 제거했다.

### 진행 로그

- **2026-05-06 — rollback follow-up frame/page tree closure**: 2026-05-05 rollback 후 재현된 page-body frame 적용/refresh 시 body/Slot/Skia hatch marker 누락, Layout Preset Slot 누적, frame/page tab body auto-selection, shared frame multi-page refresh projection, synthetic projection `order_num` DB write 오류를 current main 패치군으로 닫았다. Frames 탭 UI tree 도 Pages 탭과 같은 `TreeBase` / `VirtualizedTree`, `section` / `section-content`, `frame-tree` 단일 class 기준으로 정리했다. 검증: FramesTab targeted vitest 4 files / 39 tests PASS + Pages tab parity baseline 2 files / 6 tests PASS + frame/component canonical regression sweep 및 `pnpm run codex:preflight` PASS.
- **2026-05-05 — rollback note**: 2026-05-03 post-cutover FramesTab / Skia frame scope fix 군은 build error 정합화 및 canonical-hydration fix 3종과 함께 사용자 환경 누적 회귀로 폐기됐다. 폐기 baseline 은 `225532ea9` 이며, 해당 작업은 완료 근거가 아니라 2026-05-06 follow-up patch 의 재진입 배경으로만 보존한다.
- **2026-05-03 — post-cutover FramesTab / Skia frame scope fix (ROLLED BACK 2026-05-05)**: direct cutover 이후 page/body 가 frame 수만큼 Layers tree 에 중복 표시되고 frame Slot 이 Skia 에 정상 표시되지 않던 회귀를 canonical frame scope/write-through 기준으로 닫았던 작업. targeted vitest 는 PASS 했지만 사용자 browser-side 회귀가 누적되어 rollback 됐다.
- **2026-05-02 — G5 final closure / Implemented**: `apps/builder/src/adapters/pencil/` 에 Pencil document-level import/export adapter, schema map, type re-export, 5개 `.pen` fixture, import/roundtrip tests 를 추가했다. `packages/shared/src/types/pencil-adapter.types.ts` 의 Phase 5+ stub 함수는 실제 순수 매핑 함수로 승격했고, ADR-916 import payload adapter 는 같은 mapper 를 사용해 `.pen` top-level node 를 reusable canonical master 로 normalize 한다. 검증: targeted vitest 3 files / 24 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — G5 first cleanup slice**: Layout selection state 의 `currentLayoutId` backward-compat alias 를 제거하고 `selectedReusableFrameId` 단일 상태로 고정했다. `layouts.ts` persist payload, `layoutActions.ts`, `BuilderCore`, `useIframeMessenger`, `ComponentsPanel`, 관련 static/unit tests 를 갱신했다. 검증: targeted vitest 4 files / 19 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — G5 second cleanup slice**: `PageLayoutSelector` 의 page-frame binding write boundary 를 `apps/builder/src/adapters/canonical/pageFrameBinding.ts` 로 이동했다. 컴포넌트는 legacy `layout_id` field/persistence helper 를 직접 import 하지 않고, adapter 가 canonical document store 를 먼저 갱신한 뒤 현재 DB 구조에 필요한 `pages.layout_id` mirror payload 만 격리해 persist 한다. 검증: targeted vitest `pageFrameBinding.test.ts` + `PageLayoutSelector.static.test.ts` 2 files / 3 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — G3/G5 third cleanup slice**: `layoutActions` 의 reusable frame create/delete/duplicate cascade 에서 legacy field 접근을 `apps/builder/src/adapters/canonical/frameLayoutCascade.ts` 로 이동했다. `deleteLayout` 은 `nextPages + nextLayouts` 로 canonical document 를 먼저 재구성하고 `exportLegacyDocument()` 결과를 live elements mirror 로 반영한다. DB 의 `layout_id` 기반 page/element cleanup 은 adapter 내부 persistence payload 로만 유지한다. 검증: targeted vitest `layoutActions.test.ts` 1 file / 9 tests PASS + `pnpm run codex:typecheck` PASS.
- **2026-05-02 — G3/G5 fourth cleanup slice**: Frame element read/hydration fallback 을 `apps/builder/src/adapters/canonical/frameElementLoader.ts` 로 이동했다. `FramesTab` 의 hydrated 판정/filter, `BuilderCore` refresh 복원, `usePageManager` page-frame element load, `pageFrameBinding` adapter 내부 load 가 같은 adapter API 를 사용한다. 검증: targeted vitest 6 files / 29 tests PASS.
- **2026-05-02 — G3/G5 fifth cleanup slice**: properties/canvas runtime 의 `matchesLegacyLayoutId` 직접 import 를 제거하고 `isFrameElementForFrame()` adapter predicate 로 통일했다. 대상: `ElementSlotSelector`, `usePresetApply`, `resolvePageWithFrame`, frame body selection/hover, frame renderer input. 검증: targeted vitest 7 files / 36 tests PASS.
- **2026-05-02 — G3/G5 sixth cleanup slice**: Page/frame mirror id read/write helper 를 `apps/builder/src/adapters/canonical/frameMirror.ts` 로 분리했다. `usePageManager`, `PageParentSelector`, `ElementSlotSelector`, `resolvePageWithFrame` 는 더 이상 `legacyElementFields` 를 직접 import 하지 않고 frame mirror adapter API 를 사용한다. 검증: targeted vitest 5 files / 28 tests PASS.
- **2026-05-02 — G3/G5 seventh cleanup slice**: `useIframeMessenger` 와 `AddPageDialog` 의 page-frame mirror read/write 도 `frameMirror` adapter 로 전환했다. Preview `UPDATE_ELEMENTS`/`UPDATE_PAGES` payload 와 page URL preview 생성은 더 이상 `legacyElementFields` 를 직접 import 하지 않는다. 검증: targeted vitest 4 files / 19 tests PASS.
- **2026-05-02 — G3/G5 eighth cleanup slice**: Element ownership mirror read/write 를 `frameMirror` adapter 로 확장했다. `elementCreation`, `useElementCreator`, `FrameElementTree`, `FrameSlotSection`, `SliderEditor`, `multiElementCopy`, `canvasDeltaMessenger`, `usePresetApply` 는 frame element ownership payload 를 직접 legacy helper 에서 읽거나 쓰지 않는다. 검증: targeted vitest 7 files / 45 tests PASS.
- **2026-05-02 — G3/G5 ninth cleanup slice**: Validation/properties/canvas layout/skia read hot path 의 frame ownership read 를 `frameMirror` adapter 로 전환했다. `useValidation`, `useErrorHandler`, `PropertiesPanel`, `LayoutBodyEditor`, `LayerTree` drop validation, `elements` page layout invalidation, canvas selection, layout publish/cache, full-tree layout, Skia overlay/selection/visible roots 는 frame ownership payload 를 직접 legacy helper 에서 읽지 않는다. 검증: targeted vitest 13 files / 51 tests PASS.
- **2026-05-02 — G3/G5 tenth cleanup slice**: Store/canonical bridge 의 frame mirror write 를 `frameMirror` adapter 로 전환했다. `canonicalElementsView` 의 canonical→Element derived view 와 `instanceActions` detach materialization 은 frame ownership payload 를 직접 legacy helper 로 쓰지 않는다. 검증 중 기존 `activeDescendants` 오타를 `activeLegacyDescendantMap` 으로 수정했다. 검증: targeted vitest 4 files / 46 tests PASS.
- **2026-05-02 — G3/G5 eleventh cleanup slice**: Project sync, layout templates, Preview runtime 의 frame mirror read/write 를 `frameMirror` adapter 로 전환했다. `projectSync`, `layoutTemplates`, `CanvasRouter`, `CanonicalNodeRenderer`, preview layout resolver/App 은 frame ownership payload 를 직접 legacy helper 에서 읽거나 쓰지 않는다. 검증: targeted vitest 4 files / 6 tests PASS.
- **2026-05-02 — G3/G5 twelfth cleanup slice**: Slot ownership mirror read/write 를 `slotMirror` adapter 로 분리했다. `PropertiesPanel`, `usePresetApply`, `resolvePageWithFrame`, preview layout resolver/App 은 `slot_name` payload 를 직접 legacy helper 에서 읽거나 쓰지 않는다. 검증: targeted vitest 4 files / 16 tests PASS.
- **2026-05-02 — ADR-913/916 G5 thirteenth cleanup slice**: Component semantics mirror read/write 를 `componentSemanticsMirror` adapter 로 분리했다. `ComponentSlotFillSection`, editing semantics fixture, store bridge, instance lifecycle action 은 component marker payload 를 직접 legacy helper 에서 읽거나 쓰지 않는다. 검증: targeted vitest 6 files / 57 tests PASS.
- **2026-05-02 — ADR-916 projection removal follow-up**: FramesTab/PageLayoutSelector/ComponentsPanel 과 BuilderCanvas/canvas drag-drop read path 는 active canonical document 를 사용하고, `selectCanonicalDocument()` projection rebuild 를 더 이상 수행하지 않는다. 검증: targeted vitest 8 files / 25 tests PASS.
- **2026-05-02 — ADR-916 projection removal follow-up #2**: BuilderCore frame refresh/publish, usePageManager hydrate, elementCreation history/reorder caller 경로도 active canonical document 또는 frame mirror adapter 로 전환했다. caller/store action 레벨의 `selectCanonicalDocument()` rebuild 는 제거했고, 잔여는 sync/adapter boundary 로 축소했다. 검증: targeted vitest 12 files / 60 tests PASS.
- **2026-05-02 — legacy layout store removal**: `stores/layouts.ts` / `stores/utils/layoutActions.ts` 삭제. frame CRUD/selection 은 `frameActions` 가 canonical document + `canonicalFrameStore` 를 직접 갱신하고 DB `layouts` 는 persistence mirror 로만 사용한다. 초기 hydrate 는 DB `layouts` mirror snapshot 을 canonical reusable frame shell 에 seed 한 뒤 elements 를 upsert 한다. `useLayoutsStore` import site 는 production source 에서 0건이다. 검증: targeted vitest 11 files / 51 tests PASS + `pnpm run codex:preflight` PASS.
- **2026-04-26 (세션 35)**: Proposed. Phase 0 ~ 4 sub-budget 작성, design breakdown 발행 (843줄)
- **2026-04-27 (세션 36)**: Phase 1 함수 layer 완결 — `convertTemplateToCanonicalFrame` / `flattenTemplateElements` / `buildDescendantsFromSlots` / `hoistLayoutAsReusableFrame` / `dryRunMigrationP911` / `applyMigrationP911` (vitest 45/45 PASS, commits batch in PR #249 + `f4047af1`)
- **2026-04-27 (세션 37)**: Phase 2 진입 — **PR-A: frameActions canonical wrapper + FRAMES_TAB_CANONICAL feature flag** (commit `e9e388ca`)
  - `apps/builder/src/builder/stores/utils/frameActions.ts` 신규 — `createReusableFrame` / `deleteReusableFrame` / `updateReusableFrameName` / `selectReusableFrame` (legacy `useLayoutsStore` wrapping, P3 이후 직접 canonical mutation 으로 전환)
  - `apps/builder/src/utils/featureFlags.ts` — `isFramesTabCanonical()` + `framesTabCanonical` 필드 추가 (default `false`, dual-mode 운영용)
  - vitest 7/7 PASS / type-check 0
  - **scope 보호**: FramesTab.tsx 미수정 — 기존 동작 0 변화. PR-A 는 baseline 확장만
- **2026-04-27 (세션 37 후속)**: **PR-B: FramesTab consumer → frameActions 위임** (functional 동등) (PR #251 / `007c40f3`)
  - `FramesTab.tsx` `handleAddFrame` / `handleDeleteFrame` / `handleSelectFrame` → `createReusableFrame` / `deleteReusableFrame` / `selectReusableFrame` 호출로 전환
  - 핸들러 시그니처 단순화: `(frame: Layout)` → `(frameId: string)` — `frame.id` 만 사용하던 내부 정합화
  - 제거: `Layout` 타입 import / `setCurrentLayoutInStore` / `createLayout` / `deleteLayout` 직접 destructure (frameActions wrapper 경유)
  - 유지: `useLayoutsStore.layouts[]` read (PR-C 에서 canonical 전환 예정) / `fetchLayouts` mount effect
  - type-check 0 / FramesTab 자체 vitest 부재 → PR-A frameActions 7/7 vitest 로 wrapper 행위 검증 (functional 동등 보장)
- **2026-04-27 (세션 37 후속)**: **PR-Followup-A: FramesTab 컴포넌트 vitest baseline 잠금** (PR #252 / `7ccb86a0`)
  - 5 시나리오: 빈 frames / 2개 렌더 / Add / Select(id) / Delete + stopPropagation. mock 9 모듈
- **2026-04-27 (세션 37 후속)**: **PR-C: FramesTab read path canonical 전환** (TDD RED → GREEN, PR #253 / `e9be92e4`)
  - `FramesTab.tsx` 에 `reusableFrames` useMemo 도입 — `isFramesTabCanonical()` flag 분기로 dual-mode read
    - **legacy path** (default false): `layouts.map(l => ({ id: l.id, name: l.name }))`
    - **canonical path** (true): `selectCanonicalDocument(state, pages, layouts).children.filter(reusable: true).map(...)` — `metadata.layoutId` (legacyToCanonical 보존) 으로 id 정규화 → legacy CRUD 와 정합
  - **selector cache 함정 회피** (memory: `feedback-zustand-selector-cache.md`): useMemo 안에서 `useStore.getState()` 호출. selector 등록 안 함. deps: `[layouts, pages, elementsMap]`
  - `currentFrame` / `handleAddFrame.layouts.length+1` / `handleDeleteFrame.remaining` / JSX `layouts.map → reusableFrames.map` 모두 `reusableFrames` 기반으로 통일
  - vitest 8/8 PASS (5 legacy baseline + 3 canonical mode: 목록 표시 / non-frame 필터 / id 정규화) + type-check 0 + frameActions 회귀 0
- **2026-04-27 (세션 37 후속)**: **PR-D: FrameList 컴포넌트 분리** (functional 동등, PR #254 / `b391c42a`)
  - `FrameList.tsx` 신규 — frame 목록 + Add/Delete 버튼 (props: `frames` / `selectedFrameId` / `onSelect` / `onDelete` / `onAdd`)
  - `FramesTab.tsx` 의 `sidebar_layouts` JSX 영역 (62 lines) 을 `<FrameList>` 컴포넌트로 교체. `CirclePlus` import 제거
  - `__tests__/FrameList.test.tsx` 신규 (6 시나리오: 빈 / 2개 렌더 / active 클래스 / Add / Select / Delete + stopPropagation)
  - 검증: vitest 14/14 PASS (FrameList 6 + FramesTab 8) / frameActions 7/7 (회귀 0) / type-check 0
  - **Why**: 프레젠테이션 분리 — 데이터 source (legacy/canonical) 결정과 frame CRUD 로직은 부모 책임, FrameList 는 props 기반 결정적 UI 만 담당. PR-E 진입 시 동일 컴포넌트 재사용 가능
- **2026-04-27 (세션 37 후속)**: **PR-D2: FrameElementTree 컴포넌트 분리** (functional 동등, PR #255 / `604b11f3`)
  - `FrameElementTree.tsx` 신규 — Layers 헤더 + Collapse All 버튼 + tree 렌더 + placeholder. `renderFrameTree` 함수 흡수. props: `tree` / `frameId` / `selectedElementId` / `expandedKeys` / `toggleKey` / `onCollapseAll` / `onElementClick` / `onElementDelete`
  - `FramesTab.tsx` 의 `renderFrameTree` (135 lines) + `sidebar_elements` JSX (35 lines) → `<FrameElementTree>` 호출 (15 lines). lucide icons (`Minimize`/`ChevronRight`/`Box`/`Trash`/`Settings2`) + `iconProps` + `ElementTreeItem` import 제거
  - `__tests__/FrameElementTree.test.tsx` 신규 (12 시나리오): placeholder 2 (frameId null / tree 빈) / tree 렌더 5 (1-level / Slot 명명 / nested expanded / nested collapsed / active) / interactions 5 (element click + frameId 매핑 / Delete + stopPropagation / body Settings / ChevronRight toggle / Collapse All)
  - 검증: vitest 33/33 PASS (FrameList 6 + FrameElementTree 12 + FramesTab 8 + frameActions 7) / type-check 0
  - **Why**: FramesTab 이 orchestrator 역할만 남도록 UI 책임 완전 분리. `renderFrameTree` 가 더 이상 `useCallback` 으로 부모 hook deps 에 묶이지 않아 메모이제이션 부담 감소. PR-E 진입 시 `<FrameElementTree>` 가 page-bound element tree 같은 다른 consumer 에 재사용 가능
- **2026-04-27 (세션 37 후속)**: **PR-E1: PageLayoutSelector dual-mode read 전환** (functional 동등, PR pending)
  - `PageLayoutSelector.tsx` 의 read path 를 PR-C FramesTab 패턴 동일하게 dual-mode 전환 — `isFramesTabCanonical()` flag 분기
    - **legacy path** (default false): `useLayouts()` hook 결과 그대로 사용
    - **canonical path** (true): `selectCanonicalDocument(state, pages, layouts).children.filter(reusable: true)` — `metadata.layoutId` 로 id 정규화하여 legacy `page.layout_id` 와 정합 유지
  - **selector cache 함정 회피**: useMemo 안에서 `useStore.getState()` 호출. deps: `[layouts, pages, elementsMap]`
  - `slotAndLayoutAdapter.convertLayoutToReusableFrame` 의 `metadata` 에 `description` 보존 추가 — canonical mode 에서 PageLayoutSelector 의 description 표시 회귀 방지
  - write (`handleLayoutChange`) 는 그대로 — `pages.update(layout_id)` legacy 직접 호출. P3-D 이후 canonical document mutation (RefNode.ref 변경) 으로 전환
  - 검증: type-check 0 / FramesTab 33/33 회귀 0 / canonical adapters 78/78 회귀 0
- **2026-04-27 (세션 37 후속)**: **PR-E2 skip 결정** — `usePresetApply.ts` read 는 이미 `selectCanonicalDocument` 사용 (dual-mode 친화적). write (`type="Slot"` element + `addComplexElement`) 는 P3-D 의 canonical document write API 도입 후 별도 ADR 로 처리. Phase 2 cutover 에 필수 아님 (사용자 시각 차이 없음 — read level 에서만 dual-mode 분기).
- **2026-04-27 (세션 37 후속)**: **PR-E3: dev-only canonical migration trigger** (PR pending)
  - `FramesTab.tsx` 에 dev-only "Migrate to Canonical" 버튼 + `handleDevMigrate` handler 추가
  - `dryRunMigrationP911(adapter, projectId, canonicalDoc)` + `applyMigrationP911(canonicalDoc, result)` (in-memory) 호출. 결과 콘솔 group 로그
  - production 단락: `process.env.NODE_ENV === "development"` 체크. production build 영향 0
  - **persistence 미구현**: canonical document store write API 가 없음 (P3-D 종속). Chrome MCP P1-c roundtrip dev 검증 용도만
  - 검증: type-check 0 / FramesTab 33/33 회귀 0 / migrationP911 45/45 회귀 0 / db 전체 126/126 회귀 0
- **2026-04-27 (세션 37 후속)**: **PR-E4: Phase 2 cutover — flag default true 전환** (PR pending)
  - `featureFlags.ts` `isFramesTabCanonical()` default `false → true`. `getFeatureFlags()` 내부 default 도 동시 갱신
  - 사용자 환경변수 override 가능 (`VITE_FRAMES_TAB_CANONICAL=false`) — emergency rollback 경로 보장
  - **canonical mode** 가 production default 가 됨 — FramesTab + PageLayoutSelector 모두 `selectCanonicalDocument` projection 으로 read
  - 검증: type-check 0 / 156/156 vitest PASS (FramesTab 33 + frameActions 7 + migrationP911 45 + canonical adapters 71) — vitest 는 mockState 격리로 default 변경 영향 0
  - **1주 모니터링** (사용자 issue report 0건 확인) 후 본 ADR Status: `In Progress` → `Phase 2 Implemented` 승격
- **Phase 2 cutover 완료** — read path canonical 전환 + 컴포넌트 분리 + dev migration trigger + 모니터링 진입. 잔여 영역 (P3 cascade 재작성, P4 DB schema migration, P5 hybrid 6 cleanup) 은 본 ADR 의 Phase 3-5 로 분리 진행
- **2026-04-27 (세션 42)**: **회귀 fix #1 — 복합 컴포넌트 page_id/layout_id 미주입** (PR #271 / `fde05cd8`)
  - 사용자 dev 검증 시 ListBox 등록 후 화면 미렌더 + `[ADR-903] sanitizeElement: page_id/layout_id 없음` 경고
  - **Root cause**: `createElementsFromDefinition` (factories/utils/elementCreation.ts) 가 parent + children Element 생성 시 page_id / layout_id 명시 주입 안 함. 단순 컴포넌트 경로 (`useElementCreator.ts:198`) 와 비대칭. canonical mode default true 후 `pageElementsSnapshot` / `selectCanonicalDocument` page-indexed 분기에서 누락
  - **Fix**: `ElementCreationContext` 인터페이스 신설 + `createElementsFromDefinition(definition, context)` 시그니처 확장 + parent/children 모두에 `page_id: layoutId ? null : pageId` / `layout_id: layoutId` 명시 주입 + ComponentFactory.createComponent 호출 시 context 전달
  - 검증: type-check 3/3 PASS / 3 files +50/-2
  - **monitoring 카운터 1차 reset** — fix land 시점부터 새 1주 시작
- **2026-04-27 (세션 43)**: **회귀 fix #2 — canonical legacyProps element top-level fields 미보존** (PR #272 / `ccc06b30`)
  - fix #1 후 dev 검증 시 자식 있는 복합 컴포넌트 (ToggleButtonGroup / InlineAlert) Preview 미렌더 (ListBox 정상). 패턴: 자식 0 정상 / 자식 다수 미렌더
  - **사용자 dev console evidence**: ToggleButtonGroup id='e77bbf03' + 자식 ToggleButton x3 parent_id='e77bbf03' 정확 매칭 (Builder store 정상). 미렌더 원인 = Preview canonical 변환 단계
  - **Root cause**: `legacyToCanonical` 의 metadata 가 `legacyProps: element.props` 만 보존하고 element top-level fields (`id` / `parent_id` / `page_id` / `layout_id` / `order_num` / `fills`) 미주입 → `CanonicalNodeRenderer` 의 `legacyUuid = legacyProps.id ?? node.id` fallback 으로 canonical path-id (segId) 사용 → shared renderer (`renderInlineAlert` / `renderToggleButtonGroup`) 의 `childrenMap.get(element.id)` 가 segId 로 lookup → 자식의 parent_id (원본 UUID) 와 mismatch → 자식 0 lookup → InlineAlert 빈 div / ToggleButtonGroup RAC invariant throw
  - **Fix**: 3 위치 metadata.legacyProps 에 element top-level fields 명시 spread (`{ ...element.props, id, parent_id, page_id, layout_id, order_num, fills }`)
    - `apps/builder/src/adapters/canonical/index.ts:164` (`convertElementToCanonical` 본체)
    - `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts:257` (slot adapter)
    - `apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts:313` (`convertElementWithSlotHoisting`)
  - 검증: type-check 3/3 PASS + 사용자 dev 환경 검증 OK (ToggleButtonGroup / InlineAlert / ListBox 모두 정상 렌더)
  - **monitoring 카운터 2차 reset** — fix #2 land 시점부터 새 1주 시작 (~2026-05-04+ 추가 연장). 이후 ADR-916 선행 결정으로 monitoring 기반 Phase 2 Implemented 승격 경로는 historical record 로만 유지한다.
  - **체크리스트 추가 권장** (Phase 3+ 진입 시): canonical adapter 의 metadata 보존 시 element top-level fields 6종 (id/parent_id/page_id/layout_id/order_num/fills) 명시 spread 의무. 신규 adapter 작성 시 동일 패턴 강제 (별도 ADR 또는 rule 명문화 후보)
- **2026-04-27 (세션 45)**: **Phase 2 closure 5단계 사전 체크리스트 land** — `docs/adr/design/911-closure-checklist.md`
  - monitoring 종결 (~2026-05-04+) 후 즉시 Implemented 승격 가능하도록 사전 작성했으나, 이후 ADR-916 선행 결정으로 checklist 는 historical 문서가 됨
  - Step 1 (Status + 진행 로그 entry) / Step 2 (CHANGELOG entry) / Step 3 (README 갱신, partial Implemented 패턴) / Step 4 (본문 archive 보류, Phase 3+4+5 진행 중) / Step 5 (reference link 정합 보류)
  - ADR-109 partial Implemented 사례 답습 — Phase 전체 land 가 아닌 핵심 Gate (G2) 충족 시 partial Implemented 승격 가능
- **2026-04-28 (세션 46)**: **Phase 3 fundamental 결함 발견 — frame canvas authoring 시각 path 미구현 + monitoring 종결 framing 정정**
  - **사용자 회귀 보고**: FramesTab → 새 Frame 추가 → Layout preset 적용 시 Skia 캔버스에 영역 구분 slot 들이 시각화되지 않음
  - Chrome MCP evidence (Builder dev runtime, 세션 46):
    - `pagePositions: { 234dc7c9: { x: 0, y: 0 } }` — page 1개만 등록 / **frame body 좌표 0건**
    - `editingContextId: null` — frame editing context 진입 path 자체 없음
    - elementsMap 에 frame body (id=91c01890, layout=f49ac75d) + 2 Slots 정상 등록되지만 캔버스 viewport 외부
    - `childrenMap.root = [page body, Frame 1 body, Frame 2 body]` — frame body 가 root 자식이지만 page 캔버스 viewport 밖
    - opt D 검증: page.layout_id orphan reference 정정 (`17344067 → f49ac75d`) 후에도 pagePositions 미갱신 — page-frame 연결만으로 시각화 미발생 확정
  - **결함 위치**: ADR-911 cutover commit `7b6f4eb9` 가 단순 `featureFlags` default flip (4 file / 38/-8 라인, 실 logic 0건) — frame canvas authoring 시각 path 는 dual-mode 시절부터 미구현. cutover 의 회귀가 아니라 **ADR-911 자체의 fundamental 미완성**
  - **Gate G2 (시각 회귀 0) 위반 확정** — Phase 2 closure 5단계 체크리스트는 보류. monitoring 6일 대기 framing 무의미 (사용자 결정: monitoring 종결 의미 없음, fix 가 본질)
  - **본 세션 진행**: design breakdown 신규 sub-phase land 만 (`docs/adr/design/911-phase3-frame-canvas-authoring-breakdown.md`). 본격 fix (1주+ HIGH) 는 별도 세션
  - **scope 분리**: 본 결함 = frame body **base render** (영역 자체 캔버스 표시) — ADR-911 의 P3 신규 sub-phase. ADR-912 의 시각 마커 (reusable/ref/override 표식) 는 본 base render 위에 land 가능 — prerequisite 관계
  - **본 세션 보너스 fix**: ADR-903 P3-E follow-up — `getByLayout` 7 caller canonical 마이그레이션 (`1f732be3`) + composition-pre-1.0 legacy fallback (`f299d373`). LayerTree + Inspector 정상화 ✅ / Skia 캔버스 시각화는 본 P3 작업 후
- **2026-04-28 (세션 47)**: **P3-α land — `framePositions` store 도입 (Gate G3-α PASS)**
  - `apps/builder/src/builder/stores/elements.ts` — `framePositions: Record<string, {x, y, width, height}>` + `framePositionsVersion: number` 추가 (pagePositions 와 분리: page 는 global pageWidth/Height 공유, frame 은 width/height 개별)
  - 신규 setter 2건: `updateFramePosition(frameId, patch)` (partial merge — drag/resize 통합) + `removeFramePosition(frameId)` (frame 삭제 cleanup, 미존재 frame 은 no-op + version 미증분)
  - 데이터 모델 결정 = 대안 A (별도 framePositions 맵). pagePositions consumer 8곳 영향 0건, domain 분리 우선
  - 초기 좌표 자동 init 은 P3-β (computeLayoutGroups 확장) 로 위임. P3-α 는 명시 호출 시에만 갱신
  - vitest `framePositions.test.ts` 5/5 PASS (insert / 위치 patch / size patch / remove / no-op no-bump) + type-check 3/3 PASS
  - **caller 0건** — Skia render path 통합은 P3-δ. 본 land 는 데이터 layer 만
- **2026-04-28 (세션 47 후속)**: **P3-β land — `computeFrameAreas` + `FrameAreaGroup` 도입 (Gate G3-β PASS)**
  - `apps/builder/src/builder/workspace/canvas/skia/workflowEdges.ts` 에 신규 export 2건 추가
    - `interface FrameAreaGroup { frameId, frameName, x, y, width, height }`
    - `computeFrameAreas(doc, framePositions): FrameAreaGroup[]` — `doc.children.filter(reusable: true)` + `metadata.layoutId` 우선 (legacy CRUD 정합) + framePositions miss 시 `{0,0,0,0}` fallback
  - **설계 결정: 별도 함수 (NOT modify computeLayoutGroups)** — 기존 `LayoutGroup` 의 page-sharing semantic 과 frame canvas area semantic 분리. workflowRenderer / skiaOverlayBuilder / invalidationPacket / BuilderCanvas 4 caller 영향 0건. "확장" 은 모듈 (workflowEdges.ts) 단위 유지
  - **caller 0건 유지** — BuilderCanvas / Skia render 통합은 P3-δ. 본 land 는 compute layer 만
  - 검증: `frameAreas.test.ts` 6/6 PASS (null doc / non-reusable filter / metadata.layoutId 우선 / framePositions miss fallback / name 부재 fallback / 다중 frame 순서 보존) + type-check 3/3 + canvas/ 광역 vitest 174/174 PASS (회귀 0)
- **2026-04-28 (세션 47 후속)**: **P3-γ land — frame editing indicator 결정 + integration test (Gate G3-γ PASS, B 채택)**
  - **설계 분기 발견**: design breakdown 의 "`editingContextId` 갱신" 표현이 consumer 분석 후 부정확 — `editingContextId` (`elements.ts`) 는 element id 타입, `resolveClickTarget` 의 parent_id chain 탐색에 사용. frameId (legacy layoutId) 직접 대입 시 click target 분해 실패 → `useCanvasElementSelectionHandlers.ts:187` 의 자동 exit trigger → 사용자 첫 클릭만에 frame editing 종료 회귀 위험
  - **B 채택**: indicator 는 `useLayoutsStore.selectedReusableFrameId` (ADR-903 P3-B 에서 도입, 이미 `selectReusableFrame` 이 갱신 중). `editingContextId` 와 semantic 분리 — `framePositions` 별도 map 결정과 동일 domain 분리 패턴
  - 변경 = test + 문서 정정만. 실제 코드 변경 0건 — 기존 `selectReusableFrame` 동작 유지
  - 신규 integration test: `selectReusableFrameContext.test.ts` 4/4 PASS (frameId 갱신 / null 해제 / 연속 호출 / currentLayoutId backward-compat alias 동시 갱신)
  - design breakdown 정정: §2 P3-γ 행 / §4 G3-γ 행 / §4.5 결정 근거 추가
  - 캔버스 read path 통합은 P3-δ Skia render PR 에 동시 land (dead read 회피)
- **2026-04-28 (세션 47 후속)**: **P3-δ-1 inventory land — render 경로 chain + 결정 분기 3건 사전 lock-in**
  - **Render 경로 chain 확정**: `BuilderCanvas → createSkiaRendererInput → skiaFramePipeline → collectVisiblePageRoots → getCachedCommandStream → buildRenderCommandStream`. **Root cause 위치**: `visiblePageRoots.ts:15` 가 `rendererInput.pages` (page 만) iterate — frame body 가 elementsMap 에 있지만 page 아니므로 root list 진입 path 0
  - **변경 surface 5 파일 ~80 line + test**: 신규 `visibleFrameRoots.ts` / `skiaFramePipeline.ts:229` rootElementIds 병합 / `renderCommands.ts:209-243` cache key + framePositionsVersion / `rendererInput.ts:76-106` framePositions 통합 / `BuilderCanvas.tsx:230-380` selector 추가
  - **결정 분기 3건 권고**: D1=A (`el.layout_id === frameId` 매칭, ADR-903 P3-E E-6 검증 패턴), D2=B (신규 `collectVisibleFrameRoots`, P3-α/β 의 domain 분리 패턴 일관), D3=A (`bodyPagePositions` 단일 맵 통합, renderCommands 시그니처 미변경)
  - 권고 채택 시 P3-δ 본격 land 비용 재산정 = **~1d (HIGH 2d 의 lower bound)** — inventory 가 진입 위험 50% 감소
  - design breakdown §4.6 사전 land — 다음 세션에서 D1/D2/D3 사용자 승인 후 즉시 진입 가능
- **2026-04-28 (세션 47 후속)**: **P3-δ land — Skia render 통합 (D1=A / D2=B / D3=A 채택, Gate G3-δ 진입)**
  - 변경 5 파일 + test 신규: `rendererInput.ts` (framePositions/Version/frameAreas 필드 추가) / `visibleFrameRoots.ts` 신규 / `skiaFramePipeline.ts` (rootElementIds + bodyPagePositions 단일 맵 병합) / `renderCommands.ts` (cache key 4중 → 5중, framePositionsVersion 추가) / `BuilderCanvas.tsx` (framePositions/Version selector + computeFrameAreas useMemo + createSkiaRendererInput 인자 통합)
  - **D1=A 채택**: `el.layout_id === frameId` + `parent_id` 가 body type 인 element 만 frame body 후보 (slot 등 내부 자식 false negative). ADR-903 P3-E E-6 검증 패턴 + 단순 fallback
  - **D2=B 채택**: 신규 `collectVisibleFrameRoots(rendererInput): {rootElementIds, bodyPagePositions}` — `collectVisiblePageRoots` 와 동일 shape, caller 가 spread 병합
  - **D3=A 채택**: `bodyPagePositions` 단일 맵 통합 — `buildRenderCommandStream` 시그니처 미변경
  - 검증: `visibleFrameRoots.test.ts` 6/6 PASS (frameAreas 비어있음 / layout_id 매칭 / framePositions miss fallback / element 부재 silent skip / 다중 frame / body 가 아닌 parent 제외) + canvas/ 광역 vitest 14 파일 180/180 PASS (회귀 0) + type-check 3/3 PASS
  - **Gate G3-δ (a) 충족 path 확보** — frame body 가 root list 진입 → DFS 그려짐. 시각 검증은 Chrome MCP 사용자 시나리오 (P3-ζ) 에서 수행
  - 잔여: P3-ε hit-test/drag/selection (1.5d MED) + P3-ζ Chrome MCP 회귀 검증 (0.5d LOW)
- **2026-04-28 (세션 47 후속)**: **P3-δ fix #1 + #2 land — Chrome MCP evidence 기반 회귀 fix (Gate G3-δ (a) 시각 evidence 확보)**
  - **fix #1**: `collectVisibleFrameRoots` 의 `type === "body"` 체크 추가. 실 회귀 시나리오 (Chrome MCP evidence): elements 배열 순서가 `[Slot, Slot, body]` 일 때 composition-pre-1.0 legacy `layout_id` propagation 으로 자식 Slot 도 동일 layout_id 보유 → 첫 매칭이 Slot 이 되어 frame body 로 잘못 등록. `type==="body"` 체크가 가장 단순하고 안전한 가드 — parent_id chain 탐색 로직 제거
  - **fix #2 (P3-β 보강)**: BuilderCanvas 의 `framePositions` 자동 init useEffect 추가. frameAreas 의 미초기화 frame 마다 page 영역 우측 (`pageWidth + PAGE_STACK_GAP`) 부터 수직 stack 배치. 이미 init 된 frame 은 skip (idempotent — 사용자 drag 좌표 보존). framePositions deps 미포함 (effect 안 `getState` snapshot, 무한 루프 회피)
  - **시각 evidence (Chrome MCP 2026-04-28)**: `framePositions: { 5c9f91cd: {x:470, y:0, width:390, height:844} }` — Frame 1 이 page (390px) 우측 80px GAP 후 (470,0) 자동 배치. screenshot 에 frame body 큰 사각형 (390×844) 시각화 확정 — 직전 screenshot 과 비교 시 Frame body 가 캔버스에 그려짐
  - 검증: `visibleFrameRoots.test.ts` 7/7 PASS (신규 케이스 2: type !=='body' 인 Slot 첫 매칭 시 silent skip / 같은 layout_id 의 다중 body element 첫 매칭만 등록) + canvas/ 광역 14 파일 181/181 PASS (회귀 0) + type-check 3/3 PASS
  - **Gate G3-δ (a) 충족** — frame body 가 root 진입 + 좌표 적용 + 시각화 evidence 확보. (b) DFS 자식 (slot) 시각화 + (c) Chrome MCP 사용자 시나리오 GREEN 은 P3-ε / P3-ζ 에서 후속 검증
  - 잔여 P3 trail A: P3-ε hit-test/drag/selection (1.5d MED) + P3-ζ slot 자식 시각화 + Chrome MCP 회귀 검증 (0.5d LOW)
- **2026-04-28 (세션 47 종결)**: **P3-δ fix #3 발견 — slot 자식 시각화 0건 / fullTreeLayout 발행 path 부재 (다음 세션 진입 대기)**
  - **Chrome MCP 추가 evidence (systematic-debugging Phase 1-2)**: frame body 자체는 시각화 ✅ 하지만 자식 (Slot 3개) 시각화 ❌. screenshot 에 빈 사각형만 표시
  - **Root cause 확정**: `useLayoutPublisher` (`hooks/useLayoutPublisher.ts:32`) 가 `visiblePages.map(...)` 만 처리 — frame body input 0건 / `publishLayoutMap(layoutMap, page_id)` 두번째 인자 = `bodyElement.page_id` (frame body 는 null) → frame body 와 자식 의 fullTreeLayout 호출 path **자체 부재** → layoutMap.get(slotId) === undefined → DFS 진입은 하지만 width=0 / height=0 → invisible
  - **fix #3 scope (~1d HIGH)** = `useLayoutPublisher` 시그니처 확장 (`framePages` 추가) + `buildFrameRendererInput` 신규 + `BuilderCanvas` `frameLayoutPublisherInputs` useMemo + `publishLayoutMap` 키 fallback chain
  - **결정 분기 3건 (다음 세션 진입 시 사용자 승인 대기)**: D4=A (buildFrameRendererInput 신규, page-centric 비대칭) / D5=A (publishLayoutMap fallback chain `page_id ?? layout_id ?? id`) / D6=A (단일 dimensionKey 에 frame entry 추가)
  - design breakdown §4.7 사전 land — 다음 세션 즉시 진입 가능
  - **본 세션 47 종결**: 7 commits land + Chrome MCP 4회 검증. P3-δ 의 Gate G3-δ (a) 시각 evidence 일부 (frame body 만) 충족, (b) slot 자식 시각화 + (c) Chrome MCP 사용자 시나리오 GREEN 은 fix #3 land 후 가능
  - 본 세션 누적 commits: P3-α `f03c6d8b` / P3-β `783baab1` / P3-γ `aaa700c1` / P3-δ-1 inventory `e1e038d6` / P3-δ Skia render `3f1d9aa5` / P3-δ fix #1+#2 `5d5adce5` / 본 entry (P3-δ fix #3 design land)
- **2026-04-28 (세션 47 후속, 본문 보강)**: **revision 2 — Hard Constraint #6 + Gate G6 신설 (Properties 패널 ##Slot section##)**
  - 사용자 직접 확인 + pencil app `.pen` 2.11 schema MCP 직접 fetch (`mcp__pencil__get_editor_state`) 로 `Frame.slot: false | string[]` 호환 확정 — array 의 각 element 는 권장 reusable component ID
  - Hard Constraint #6 추가: Properties (Inspector) 패널의 별도 ##Slot section## (`[+]` slot 활성화/추가 + `[-]` slot 제거/해제), Style 패널 (D3) 침범 없음
  - Gate G6 신설: section 노출 + slot field 상태 표시 + 컨트롤 동작 + ADR-912 ##Component section## 와 패널 공존 / UI 충돌 0
  - **2026-04-28 세션 50+ hardening 으로 superseded**: 위 Slot section / Gate G6 소유권은 ADR-912 로 이관. 본 ADR 은 해당 base UI 를 구현하지 않는다
  - References 보강: pencil components docs + keyboard-shortcuts docs URL + `.pen` 2.11 핵심 type 명시
  - ADR-912 본문 동시 revision 2 — 6 요소 확장 (⑥ Origin 토글 추가, `Cmd+Opt+K`/`Cmd+Opt+X` pencil 단축키 호환 baseline, Properties 패널 ##Component section## 위치 결정)
- **2026-04-28 (세션 48)**: **P3-δ fix #3+#4 + B1 filter land (frame canvas authoring 마감) + P3-θ scope 사전 land**
  - **fix #3 (slot 자식 시각화)**: D4=A (`buildFrameRendererInput` 신규, page-centric 함수와 분리) / D5=A (`publishLayoutMap` key fallback chain `page_id ?? layout_id ?? id`) / D6=A (단일 dimensionKey 통합) / `useLayoutPublisher` 시그니처 확장 (`framePages` 추가). 회귀 fix: body element 가 자기 자신의 child 가 되어 `RangeError: Maximum call stack size exceeded` → `buildFrameRendererInput` 의 pageElements 에서 body 제외 (page 경로 nonBodyElements 와 동일 정책)
  - **fix #4 (frame 영역 size — 사용자 회귀 fix)**: 기존 `height: pageHeight` (viewport 크기) → frame body 보다 큰 빈 영역 → `bodyElement.props.style.width/height` 명시 px 우선 + 없으면 component-sized default (320×200) + `page_id===null` canonical reusable 우선
  - **B1 filter (사용자 noise 회귀 fix, 2026-04-30 UX follow-up 으로 superseded)**: `computeFrameAreas(doc, framePositions, selectedReusableFrameId)` 시그니처 확장 → `selectedReusableFrameId === null` 시 빈 배열. design breakdown §4.7 옵션 B1 채택 (B2 모든 reusable → B1 selected only). 이후 Frames 탭 UX 검증에서 Page 추가와 동일한 multi-canvas overview 가 더 적합하다고 판단되어, Frames mode 는 reusable frame 전체를 Page layout direction 으로 배치하고 `selectedReusableFrameId` 는 Node tree/properties 의 현재 frame indicator 로만 유지한다.
  - **P3-θ scope land (다음 세션 진입 prerequisite)**: Chrome MCP evidence (Page bound to Frame, frame element page_id=null → page rendering 에서 자동 제외 확증) → ADR-911 의 핵심 기능 (pencil component composition) 미구현. design breakdown §4.10 사전 land — slot fill resolution (D7=B 별도 resolver / D8=A legacy slot_name 매칭 / D9=A 무조건 적용), ~1.5d MED. P3-α/β/γ/δ + fix #1~#4 = frame 자체 편집 / P3-θ = frame instance composition (page slot fill)
  - **Gate G3-δ 충족**: (a) frame body 시각화 ✅ + (b) slot 자식 시각화 ✅. (c) Chrome MCP 사용자 시나리오 GREEN 은 P3-θ 후 — page 영역 inline frame slot 노출
  - 검증: type-check 3/3 PASS / canvas vitest 15/15 파일 189/189 PASS (회귀 0) / 신규 `buildFrameRendererInput.test.ts` 6/6 + `frameAreas.test.ts` 7/7 (B1 filter test 2 추가)
  - 본 세션 commits: docs revision 2 `c63ae536` / fix #3+#4+B1 `e4f24697` / 본 entry + P3-θ design land

- **2026-04-28 (세션 49)**: **P3-θ Slot Fill Resolution land — Gate G3-θ a/b/c/e 충족 (frame instance composition 진입)**
  - **결정 분기 land**: 사용자 D7=B / D8=A / D9=A 모두 권고대로 승인. design breakdown §4.10 의 권고 채택.
  - **D7=B (별도 resolver)**: 신규 `apps/builder/src/builder/workspace/canvas/scene/resolvePageWithFrame.ts` — `pageIndex` 의 `page_id` 의미 보존, page rendering 진입점 `buildPageDataMap` 에서 명시 호출. canonical document 도입 시 `selectCanonicalDocument` 와 정합 가능.
  - **D8=A (legacy slot_name 매칭)**: page root element 의 `slot_name` (props.slot_name 또는 element.slot_name) 이 frame Slot 의 `name` 과 일치 시 page element 의 `parent_id` 를 해당 Slot 의 id 로 재매핑. 매칭 안 된 slot_name 은 `"content"` fallback. canonical descendants 전환은 ADR-913 Phase 5-A (`slot_name` cleanup) 시 동기화.
  - **D9=A (무조건 적용)**: feature flag 없이 모든 layout-bound page 에 적용. 기존 동작은 미완성 상태 — 사용자 기대가 명확.
  - **Override 분리 (G3-θ c)**: page slot fill 이 매칭된 Slot 의 default 자식 (frame element 중 `parent_id===slot.id`) 은 결과에서 제외 (hide). 매칭 안 된 Slot 의 default 자식은 그대로 노출 → frame default header/footer Text 는 page 가 해당 slot 으로 fill 안 했으면 보존
  - **변경 surface land**: (1) `resolvePageWithFrame.ts` 신규 (157 lines, body 우선순위 / Slot 매칭 / hidden default child / parent_id 재매핑 + page non-root 보존 + deleted 제외) (2) `buildSceneIndex.buildPageDataMap` 통합 — 기존 page-only 분기 → resolver 호출
  - **검증**:
    - type-check 3/3 PASS
    - canvas vitest 16/16 파일 197/197 PASS (회귀 0)
    - 신규 `resolvePageWithFrame.test.ts` 8/8 PASS — T2 (frame default 노출) / T3 (page slot:content fill + frame default content 자식 hide) / 회귀 (layout 미바인딩 / frame body 미존재 / non-root 보존 / fallback 'content' / props.slot_name + element.slot_name 양방향 / deleted 제외)
  - **잔여 G3-θ (d) Chrome MCP screenshot**: 사용자 dev 환경 검증 — 다음 세션 사용자 확인 후 Implemented 후속 가능

- **2026-04-28 (세션 49 후속)**: **P3-θ regression fix #1 — body 채택 정책 전환 (frameBody → pageBody)**
  - **회귀 보고 (사용자)**: Frame 적용 시 page 영역 투명 / 내용 모두 사라짐 / Frames 탭에서 frame 삭제 시 정상 복귀
  - **Root cause**: 초기 P3-θ resolver 가 `bodyElement = frameBody` 로 root 채택 → frame body 의 `width/height` (P3-δ fix #4 default 320×200) 가 page (390×844) 보다 훨씬 작음 → page 영역 일부만 그려짐 + page-body 의 시각 속성 (background/padding) 손실 + slot_name 미매칭 page root element 가 fallback Slot 매칭 실패 시 orphan → 미렌더 → 사용자에게 "투명/내용 사라짐" 으로 인식
  - **Fix**: `bodyElement = pageBody` 유지 (frame body 자체는 결과 제외) + frame body **의 자식들** (Slot×N) 의 `parent_id` 를 page-body 로 reparent + frame Slot 의 자식 (Text 등) 은 그대로 (parent_id=Slot.id 유지) + slot_name 미매칭 page element 는 page-body 자식 그대로 유지 (orphan 방지) + frame body 또는 page body 미존재 시 `hasFrameBinding=false` 로 fallback
  - **정책 정합 (design breakdown §4.10)**: "frame body subtree 를 page body 자식으로 가상 merge" 의 정확한 의도 = frame body **자체** 가 아닌 frame body **의 자식들** 을 reparent. page width/height/시각 속성 보존 + slot_name 미매칭 element orphan 방지
  - **회귀 fixture 2 추가**:
    - "frame Slot 0건 (빈 frame body) → page element 가 page-body 자식 유지 (orphan 방지)"
    - "page width/height/배경 시각 속성 보존 (page body 가 root 유지)"
  - 검증: type-check 3/3 PASS / canvas vitest 16/16 파일 199/199 PASS / `resolvePageWithFrame.test.ts` 10/10 (T2/T3 expected 갱신 + 회귀 fixture 2 추가)
  - **사용자 추가 보고 잔여**: "새로고침시 초기화" — page.layout_id IndexedDB persistence 흐름 분석 미완. 본 fix 반영 후 사용자 dev 재검증 필요

- **2026-04-28 (세션 49 후속) — 동결 결정**: **본 ADR Phase 3 후속 (P3-ε / P3-ζ) 진행 정지**
  - **결정 사유**: ADR-912 codex 3차 리뷰 + 사용자 framing 재정의 — 본 ADR 은 ADR-912 (reusable component 추상) 의 **frame-bundled preset 응용**. 의존 방향이 거꾸로 박혀 있었음 (baseline ADR-903 Phase 4 framing 의 stale).
  - **현재 land 보존**: Phase 0~2 + P3-α/β/γ/δ + δ fix #1~#4 + B1 + θ scope + θ regression fix #1 모두 보존. 사용자 가시 동작 (frame default + page slot fill GREEN) 유지.
  - **정지 영역**: P3-ε (FramesTab inline frame editing 진입), P3-ζ (Chrome MCP 회귀 검증 추가), G3-θ (d) Chrome MCP screenshot — 모두 ADR-912 Component/Slot base 완료 후 재개.
  - **다음 진입**: ADR-912 Component/Slot base 완료 → 본 ADR 은 P3-ε / P3-ζ 를 frame authoring 편의 확장으로 재설계 진입.
- **2026-04-28 (세션 50+ 후속) — 의존 방향 hardening**:
  - 이전 "ADR-911 ##Slot section##" 소유권 표현은 잘못된 설계 전제였음.
  - Slot section base 는 ADR-912 가 완료한다. 본 ADR 은 이를 재정의하지 않고, 완료된 기능을 FramesTab / preset UX 에서 편하게 쓰게 하는 확장만 담당한다.
- **2026-04-30 — 재개 조건 충족**:
  - ADR-912 가 Component/Slot base 와 G4-A~H gate 를 `Implemented` 로 닫음.
  - 본 ADR 의 P3-ε / P3-ζ 는 이제 재개 가능하나, scope 는 ADR-912 기능을 호출하거나 추천값/preset/FramesTab 편의 진입점을 제공하는 확장으로만 제한한다.
- **2026-04-30 — P3-ε drag gate Pencil 기준 재정의**:
  - `docs/pencil-copy` 기준으로 drag 는 Frame 전용 특수 기능이 아니라 document node 의 canvas 직접 조작이다. `x/y` 는 drag 로 갱신되지만, layout 이 위치를 소유하는 경우에는 자유 이동이 아니라 layout-aware reorder/drop 으로 commit 된다.
  - Frames tab multi-canvas overview 의 Frame canvas 자체 위치는 overview layout 이 소유한다. 따라서 P3-ε 는 "Frame canvas 자유 drag" 를 필수 gate 로 두지 않고, Frame body/Slot/child hit-test + selection + hover + Node tree/Properties sync 를 필수로 둔다. Drag 는 manual-position child 에서 local `x/y` 갱신, auto-layout child 에서 reorder/drop intent, overview Frame canvas 에서 explicit non-draggable 로 정리한다.
- **2026-04-30 — P3-ε implementation slice #1**:
  - Frame body 빈 영역 hover 에 이어 selection fallback 도 rendered frame area 의 topmost order 와 맞춘다.
  - Canvas drag gate 는 `position:absolute` manual-position child 를 reorder/drop path 에 태우지 않고 drag delta 를 `style.left/top` 으로 commit 한다. Auto-layout child 는 기존 layout-aware reorder/drop path 를 유지하고, body 는 기존처럼 drag 대상에서 제외한다.
  - 사용자 dev 검증: Frame body / Slot 선택 후 Properties/Style 패널의 Transform·Layout 변경이 적용됨을 확인했다. 이는 P3-ε 의 Node tree/Properties sync 항목을 충족한다.
  - 검증: `useElementHoverInteraction.test.ts`, `useDragBridge.test.ts`, `selectionHitTest.test.ts` targeted Vitest + builder type-check PASS.
- **2026-04-30 — P3-ζ browser regression closure**:
  - 사용자 브라우저 검증으로 Frames 탭 기본 렌더, 새로고침 후 body/slot 유지, Pages↔Frames 전환, Frame body/Slot hover+selection, Transform/Layout 편집, Frame 적용 Page, 동일 Frame 다중 Page 적용, Tabs 복합 컴포넌트 회귀, drag 위치 소유권 기준을 모두 확인했다.
  - 이로써 P3-δ (c) Chrome 사용자 시나리오, G3-θ (d) screenshot/user scenario, G3-ε, G3-ζ 를 frame authoring 편의 확장 범위에서 닫는다.
  - 당시 잔여는 ADR-911 본문 Gate 기준의 G3 cascade 회귀 0, G4 legacy adapter 0건 + 명칭 충돌 해소, G5 pencil import/export schema-equivalent 검증이었다. 이후 2026-05-02 direct cutover + G5 final closure 로 닫았다.
- **2026-04-30 — G3 cascade slice #1 (`duplicateLayout` immediate merge)**:
  - `createDuplicateLayoutAction` 이 cloned layout element subtree 를 IndexedDB 에 `insertMany` 한 뒤 live Zustand `elementsMap` 에 merge 하지 않아, 복제한 Frame body/Slot 이 새로고침 전 authoring surface 에 누락될 수 있는 회귀를 보강했다.
  - cloned subtree 는 새 `layout_id`, 새 id, remapped `parent_id`, `page_id:null` 을 유지하며, DB write-through 와 같은 턴에 `mergeElements(newElements)` 로 store 를 동기화한다.
  - 회귀 테스트: `layoutActions.test.ts` 에 slot+child 포함 frame clone fixture 를 추가해 DB insert payload 와 live store merge 를 함께 검증한다.
  - 당시 잔여: G3 전체 완료 조건인 canonical-native `deleteReusableFrame` / `duplicateReusableFrame` / `setPageFrameRef` 전환, 50+ fixture roundtrip, undo/redo 검증은 ADR-916 G2 canonical store/API 이후 재개하기로 했다. 이후 direct cutover 에서 canonical frame action surface 로 정리했다.
- **2026-04-30 — G3 cascade slice #2 (`deleteLayout` orphan page-ref cleanup)**:
  - `createDeleteLayoutAction` 의 canonical frame projection guard 는 element cascade skip 용도로 유지하되, 삭제되는 layout row 를 참조하는 Page `layout_id` 는 frame projection 유무와 무관하게 항상 `null` 로 해제한다.
  - 이로써 stale layout row 삭제나 projection race 상황에서도 Page 가 존재하지 않는 Frame 을 계속 가리키는 orphan reference 를 남기지 않는다.
  - 회귀 테스트: canonical document 에 frame 이 없는 삭제 시나리오에서 `removeElements` 는 호출하지 않지만 `db.pages.update(pageId, { layout_id:null })` 와 live `setPages` 는 실행됨을 검증한다.
  - 당시 잔여: element cascade 자체는 `layout_id` legacy fallback 기반이었고, canonical-native frame subtree mutation 으로의 완전 전환은 ADR-916 G2 이후 후속 G3 작업이었다. 이후 adapter boundary + active `CompositionDocument` path 로 정리했다.
- **2026-04-30 — G3 cascade slice #3 (`setPages` page frame binding invalidation)**:
  - Frame 삭제 액션이 `stores/elements.ts` 의 standalone compatibility store 를 갱신하고, Skia/PageLayoutSelector 는 `stores/index.ts` 통합 store 를 구독해 live 화면이 삭제 전 Frame 합성을 유지하던 회귀를 보강한다.
  - `layoutActions` 와 `layouts.getLayoutSlots` 는 `rootStoreAccess.getLiveElementsState()` 로 런타임 통합 Builder store 를 우선 사용하고, 테스트/비브라우저 환경에서만 기존 elements store 로 fallback 한다.
  - `setPages` 는 page list shape / order / `layout_id` 변경 시에만 `layoutVersion` 을 증분해 PageLayoutSelector 직접 apply/unapply 와 `deleteLayout` cleanup 모두 같은 layout publisher/cache invalidation 계약을 사용한다.
  - 회귀 테스트: `rootStoreAccess.test.ts` / `pagesLayoutInvalidation.test.ts` 에서 live store 우선 조회, frame binding 해제 시 `layoutVersion` 증분, title 같은 canvas layout 비영향 metadata 변경 no-bump 를 검증한다.
  - 잔여: canonical-native `setPageFrameRef` write API 로 전환되면 이 live invalidation 계약도 ADR-916 canonical mutation boundary 로 이동해야 한다.

## Context

### Domain (SSOT 체인 - [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md))

- **해당 domain**: **없음** — 본 ADR 은 D1/D2/D3 상위에 위치하는 **문서 구조 / Layout-Slot composition 모델** 결정. ADR-903 의 G3 (b)/(c)/(d) 잔여 영역 흡수.

### 배경

[ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) 가 Implemented 승격되었으나, **Phase 3 G3 의 (b)/(c)/(d) 항목** 은 잔여:

- **G3 (b)**: NodesPanel `LayoutsTab` → `FramesTab` 재설계 (canonical `ref`/`slot`/`descendants` 직접 조작). 사용자 가시 frame authoring base 는 닫혔고, 직접 canonical mutation 은 ADR-916 G2 이후 재개
- **G3 (c)**: repo-wide 결합 해체 — 잔여 caller (FramesTab/layoutActions/usePageManager/PageLayoutSelector 등 다수) `el.layout_id === X` 매칭이 여전히 legacy fallback 으로 동작. adapter-only 격리는 ADR-916 G5 field quarantine 에서 닫음
- **G3 (d)**: layout-vs-page 이원화 UI 전원 canonical frame authoring UI 로 치환 — 기능 상실 0. 최종 write source 전환은 ADR-916 G4/G5 이후 확정

본 ADR-903 진행 중 P3-D-5 + P3-E E-6 sweep 으로 일부 caller (`ComponentsPanel.tsx` / `ElementSlotSelector.tsx` / `LayoutPresetSelector/usePresetApply.ts` / `BuilderCore.tsx` / `useCanvasDragDropHelpers.ts` / `BuilderCanvas.tsx` / `workflowEdges.ts` / `elementUtils.ts`) 는 `belongsToLegacyLayout(el, layoutId, doc)` helper 또는 canonical wrapper 경유로 정합화되었으나, **점진 정합화 (helper 교체)** 만으로는 다음 영역이 해소되지 않음:

1. **FramesTab.tsx** — `db.elements.getByLayout()` caller (composition-1.0 후 빈 배열) + `loadFrameElements` + `frameElements` memo 가 `el.layout_id === currentFrame.id` 직접 매칭. 단순 helper 교체로는 frame UI 빈 화면 회귀 가능
2. **layoutActions.ts** — `deleteLayout` / `cloneLayout` 의 elements cascade. write-through 후 `el.layout_id === id` 빈 배열 → cascade 실패 → 데이터 정합 깨질 위험
3. **usePageManager.ts:528** — `mergedMap` 합성 (`selectCanonicalReusableFrames` + `el.layout_id != null` 매칭 혼용)
4. **layoutTemplates.ts** — 28건 Slot 선언 — 신 format 으로 재정의 필요
5. **NodesPanel `LayoutsTab` UI** — frame authoring 인터페이스 미구현. 사용자가 reusable frame + slot 을 직접 편집할 수 있는 UI 부재
6. **`PageLayoutSelector` / `LayoutBodyEditor` / `LayoutSlugEditor`** — page ↔ layout 연결 인터페이스가 legacy `page.layout_id` 기반

### Hard Constraints

1. **pencil app 호환** — 사용자 명시적 결정. 외부 pencil `.pen` 문서를 import/export 할 때 시각/구조 정합 유지. canonical 문서의 `imports` field 와 reusable frame + ref + slot + descendants 문법이 pencil 의 schema 와 1:1 매칭
2. **기존 프로젝트 데이터 보존** — ADR-903 의 IndexedDB 자동 migration (P3-E E-6) 후 elements `parent_id` 가 canonical frame node id 로 변환된 상태. 본 ADR 의 재설계가 이 데이터를 그대로 읽어 frame authoring UI 에 표시
3. **시각 결과 동일성** — 기존 사용자가 만든 layout-bound page 의 Builder/Preview/Publish 3축 출력은 재설계 후에도 시각적으로 동일 (구현 방법은 자유)
4. **ADR-912 우선 조건** — 본 ADR 은 ADR-912 의 UI 토대를 제공하지 않는다. ADR-912 가 Component/Slot base 를 먼저 완료해야 하며, 본 ADR 은 그 기능 위 편의 확장만 제공한다
5. **pencil 공식 명칭 단일 표준** — composition 코드베이스의 명칭 (`Layout` / `Frame` / `Preset`) 중 pencil 공식 명칭 (`frame` / `ref` / `reusable` / `slot` / `descendants` / `clip` / `placeholder`) 과 의미상 충돌하는 영역만 변경. pencil 무관 영역 (Taffy layout engine / CSS layout files / Builder UI panel arrangement) 은 명칭 유지. 강제 alias 또는 신조어 도입 금지
6. **Properties 패널 ##Slot section## 은 ADR-912 base 로 이관** (revision 2 표현 supersede):
   - frame 1 개 선택 시 Properties (Inspector) 패널의 별도 ##Slot section## 에 노출되는 base UI 는 ADR-912 가 소유
   - `Frame.slot: false | string[]` schema 호환과 `[+]` / `[-]` 기본 동작도 ADR-912 gate 에서 완료
   - 본 ADR 은 Slot section 을 새로 정의하지 않는다. 이후 FramesTab / preset UX 에서 해당 ADR-912 기능을 호출하거나 추천값을 제공하는 편의 확장만 가능
7. **Pencil drag semantics** — canvas drag 는 위치 소유권을 따른다:
   - manual-position node 는 drag 로 local `x/y` 를 갱신
   - auto-layout child 는 자유 `x/y` 이동 대신 layout-aware reorder/drop intent 로 commit
   - Frames tab overview 의 Frame canvas 자체는 overview layout 이 위치를 소유하므로 자유 drag 로 `framePositions.x/y` 를 저장하지 않음
   - selection / hover / LayerTree sync / Properties sync 는 frame body 와 slot 에서 필수

### Soft Constraints

1. UI 재설계 동안 기능 상실 0 (legacy adapter 유지하면서 점진 cutover)
2. 신 format 의 reusable frame 편집 UI 가 기존 LayoutsTab 보다 단순하거나 동등 (인지 부담 감소)
3. layoutTemplates 28 Slot 은 마이그레이션 도구 자동화 가능

## Alternatives Considered

### 대안 A: 점진 정합화 (helper 교체 + 부분 UI 패치)

- 설명: 잔여 caller 를 `belongsToLegacyLayout` helper 로 sweep 하고, FramesTab 등 UI 는 부분 수정만. NodesPanel 의 LayoutsTab 도 legacy 형태 유지하면서 내부 동작만 canonical 으로 전환
- 위험: 기술(L) / 성능(L) / 유지보수(**HIGH**) / 마이그레이션(M)
- **유지보수 HIGH**: legacy adapter 가 영구히 잔존 → composition 전체에 layout_id 의존 dead code + 신 컴포넌트 추가 시 어느 경로 사용할지 모호. ADR-903 의 R1 ("source-of-truth 혼동") 영구화

### 대안 B: 완전 재설계 (pencil app 호환) — **사용자 결정**

- 설명: 기존 LayoutsTab UI 를 폐기하고 pencil 의 frame authoring 모델 (reusable frame + slot 메타 + ref instance + descendants override) 그대로 재구성. layoutActions / layoutTemplates / FramesTab / PageLayoutSelector / LayoutBodyEditor / LayoutSlugEditor / ElementSlotSelector 전부 canonical-native 로 신규 작성. legacy adapter 는 read-through one-shot 변환 후 폐기
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(**HIGH**)
- **마이그레이션 HIGH**: UI 전면 교체 + DB cascade 재작성 + layoutTemplates 28 Slot 재정의. 기존 사용자 프로젝트의 frame/layout 구조 자동 변환 정합성 검증 필수
- **유지보수 LOW**: legacy 0 → 단일 SSOT (canonical) → 신 컴포넌트 추가 / pencil import/export 추가 시 단일 경로
- pencil app 호환으로 **외부 디자인 도구 import/export 직접 지원** 가능 → 향후 ADR-903 §3.10 imports resolver (P5-D/E/F) 와 자연스럽게 통합

### 대안 C: pencil 호환 layer 만 추가 + legacy 영구 유지

- 설명: 기존 LayoutsTab + layout_id schema 를 그대로 두고, pencil import/export adapter 만 신규로 추가. 사용자가 pencil 와 호환된 frame/slot UI 를 원하면 별도 모드 진입
- 위험: 기술(L) / 성능(L) / 유지보수(**CRITICAL**) / 마이그레이션(L)
- **유지보수 CRITICAL**: 두 시스템 (legacy LayoutsTab + canonical pencil layer) 영구 공존 → 모든 신 기능을 양쪽에 구현 의무 + 사용자 학습 비용 2배 + UI 일관성 혼란

### Risk Threshold Check

| 대안 |      HIGH+ 갯수       | 판정                                                                                                     |
| ---- | :-------------------: | -------------------------------------------------------------------------------------------------------- |
| A    |   1 (유지보수 HIGH)   | 위험 회피 새 대안 추가 (대안 B/C) ✅                                                                     |
| B    | 1 (마이그레이션 HIGH) | 위험 수용 가능 — 일회성 cutover, 사용자 결정에 부합                                                      |
| C    | 1 (유지보수 CRITICAL) | 근본적으로 다른 접근 추가 (대안 A 점진 정합화) — A 도 유지보수 HIGH 라 회피 불가 → 본 카테고리 자체 기각 |

루프 1회 — 대안 B 의 마이그레이션 HIGH 는 **일회성 (Phase 1 마이그레이션 도구 + Gate G2 시각 회귀 0)** 으로 관리 가능 → 위험 수용.

## Decision

**대안 B: 완전 재설계 (pencil app 호환)** 를 선택한다.

선택 근거:

1. **사용자 명시적 결정** — "변경된 format 에 맞게 (pencil app 과 동일하게) 완전 재설계"
2. ADR-903 의 R1 ("legacy adapter 장기 잔존 → SSOT 혼동") 을 근본 해소. 점진 정합화는 잔존 영역이 영구히 남을 위험 + 신 컴포넌트 추가 시 어느 경로 따를지 모호
3. pencil app 호환으로 외부 디자인 자산 import/export 가 자연스럽게 지원 → 향후 ADR-903 §3.10 `imports` resolver 와 단일 SSOT 통합
4. UI 단순화 — 단일 frame authoring 인터페이스로 사용자 학습 비용 감소
5. ADR-903 G4 (Editing Semantics UI 5요소) 의 토대 제공 — reusable/ref/override 시각 마커가 본 ADR 의 신 UI 위에 자연스럽게 추가 가능

### 기각된 대안 사유

- **대안 A 기각**: 유지보수 HIGH (legacy adapter 영구 잔존) + ADR-903 R1 영구화 + 사용자 결정 ("완전 재설계") 과 충돌
- **대안 C 기각**: 유지보수 CRITICAL (두 시스템 영구 공존) + 사용자 학습 비용 2배 + 신 기능 양쪽 구현 의무

### Terminology — pencil 공식 명칭 정합 (CRITICAL)

본 ADR 은 [pencil.dev 공식 schema](https://docs.pencil.dev/for-developers/the-pen-format) 명칭을 **단일 표준** 으로 채택. composition 기존 명칭 (`Layout` / `Frame` / `Preset`) 은 pencil 명칭과 의미상 충돌하는 영역만 변경하고, 그 외는 유지. 사용자 결정 (2026-04-27): "pencil 의 기능 명칭 그대로 사용해도 된다 — 강제로 맞추거나 alias 만들 필요 없다."

#### Pencil 공식 점유 단어 (canonical document layer)

| 명칭          | 의미                                                  | 코드 위치                                                            |
| ------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| `frame`       | `type: "frame"` 노드 (컨테이너 + 재사용 단위)         | `packages/shared/src/types/composition-document.types.ts::FrameNode` |
| `ref`         | `type: "ref"` 인스턴스 노드                           | 동일::RefNode                                                        |
| `reusable`    | boolean 플래그 — `true` 면 재사용 원본                | 동일::CanonicalNode                                                  |
| `slot`        | `false \| string[]` — 추천 reusable component ID 배열 | 동일::FrameNode.slot                                                 |
| `descendants` | override 맵 (3-mode: patch / replacement / children)  | 동일::RefNode.descendants                                            |
| `clip`        | overflow:hidden 매핑                                  | 동일::FrameNode.clip                                                 |
| `placeholder` | 빈 frame UI hint                                      | 동일::FrameNode.placeholder                                          |
| `imports`     | 외부 `.pen` 참조 hook                                 | 동일::CompositionDocument.imports                                    |

**금지**: 위 단어를 pencil 의 공식 의미가 아닌 다른 용도로 신규 도입.

#### Composition vs Pencil 매핑 (기능 흡수)

| composition 기존                         | pencil 공식 매핑                         | 처리 방향                                              |
| ---------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `Element.tag`                            | `node.type`                              | **rename** (ADR-913 scope)                             |
| `Layout` (entity) + `useLayoutsStore`    | `frame` + `reusable: true` + `slot`      | **폐기 → canonical FrameNode 흡수** (Phase 4)          |
| `tag="Slot"` element                     | `frame.slot` field (`false \| string[]`) | **흡수** (Phase 1 마이그레이션 도구)                   |
| `slot_name` prop                         | `descendants[slotPath]` key path         | **변환** (slash 구분자)                                |
| `componentRole: "instance"` + `masterId` | `type: "ref"` + `ref` field              | **변환**                                               |
| `componentName` (reusable 전용 prop)     | `name` (모든 노드 공통)                  | **흡수**                                               |
| `LayoutPreset` (slot 구조 preset)        | pencil 무대응 → reusable frame template  | **폐기 또는 frame template 라이브러리** (Phase 1 결정) |

→ pencil 의 `frame` + `reusable` + `slot` + `ref` + `descendants` 조합이 composition 의 layout/preset 기능을 모두 커버. 별도 명칭 (`SlotPresetSelector`, `FrameTemplate` 등) 신설 불필요.

#### 충돌 해소 — pencil 표준과 의미 충돌하는 영역 (rename / 폐기 대상)

2026-04-27 inventory 결과: 코드베이스 grep + 의미 분석으로 실제 충돌 영역은 **2 단어 / 4 항목** 만 식별. 이전 추정 (~30 파일) 은 과대 평가였으며 Skia/workflow 의 `Frame` 단어는 canonical FrameNode 의 **시각 표현** 으로 의미 일치 → **유지**.

| 현재                                                                     | 변경 후                         | 근거                                                                                               |
| ------------------------------------------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/layout/PanelSlot.tsx`                          | `PanelArea.tsx`                 | Builder UI panel slot 은 panel arrangement 영역. pencil `slot` (frame 자식 교체 위치) 과 의미 다름 |
| `apps/builder/src/builder/layout/BottomPanelSlot.tsx`                    | `BottomPanelArea.tsx`           | 동일                                                                                               |
| `useLayoutsStore` / `Layout` entity (`types/builder/layout.types.ts:41`) | 폐기 (canonical FrameNode 흡수) | Phase 4 G4 — 19 call sites                                                                         |
| `LayoutsTab` (UI)                                                        | `FramesTab`                     | pencil 표준 정합 — 이미 ADR-911 결정                                                               |

**유지 (의미 일치, rename 불필요)**: `skiaFrameHelpers.ts` / `skiaFramePlan.ts` / `skiaFramePipeline.ts` / `workflowRenderer.PageFrame` / `workflowHitTest`/`workflowMinimap`/`skiaWorkflowSelection` 의 frame 변수 — 모두 canonical FrameNode 의 Skia 시각 표현 또는 page-level FrameNode reference 로 pencil `frame` 의미와 정합.

#### 충돌 없음 — pencil 무관 또는 의미 일치 (명칭 유지)

| 위치                                                                                                                        | 의미                                                    | 처리                                                |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/layout/`                                                                         | Taffy WASM layout engine                                | **유지** — CSS/layout engine 표준 용어, pencil 무관 |
| `apps/builder/src/builder/styles/layout/`                                                                                   | CSS layout files                                        | **유지** — CSS 표준 용어                            |
| `apps/builder/src/builder/layout/`                                                                                          | Builder UI panel arrangement (좌/우/하단 panel)         | **유지** — pencil 무관, panel arrangement 의미 명확 |
| `LAYOUT_PROP_KEYS` / `INHERITED_LAYOUT_PROPS_UPDATE` / `NON_LAYOUT_PROPS_UPDATE`                                            | layoutVersion 캐시 시그니처                             | **유지** — Taffy layout engine 영역                 |
| `panels/styles/hooks/useLayout{Auxiliary,Value,Values}` / `LayoutSection.tsx`                                               | Inspector style panel 의 CSS layout 섹션                | **유지** — CSS layout 의미                          |
| `preview/utils/layoutResolver.ts`                                                                                           | preview iframe layout                                   | **유지** — preview 영역                             |
| `apps/builder/src/builder/workspace/canvas/skia/skiaFrame*.ts` (`skiaFrameHelpers` / `skiaFramePlan` / `skiaFramePipeline`) | canonical FrameNode 의 Skia 시각 표현                   | **유지** — pencil `frame` 의미 일치                 |
| `workflowRenderer.PageFrame` / `workflowHitTest` / `workflowMinimap` / `skiaWorkflowSelection.PageFrameLike`                | page-level FrameNode reference                          | **유지** — pencil `frame` 의미 일치                 |
| `MaskedFrame.spec.ts` / `MaskedFrame.css`                                                                                   | composition Component vocabulary 의 mask frame 컴포넌트 | **유지** — Component vocabulary, pencil 무관        |
| `useFrameCallback.ts` / `gpuProfilerCore.FrameStats`                                                                        | requestAnimationFrame (RAF)                             | **유지** — RAF, pencil 무관                         |
| `useIframeMessenger.ts` / `iframeMessenger.ts`                                                                              | postMessage iframe (HTML 표준)                          | **유지** — pencil 무관                              |
| `panels/datatable/presets/` (`dataTablePresets` / `DataTablePresetSelector`)                                                | DataTable schema preset                                 | **유지** — pencil 무관, composition 고유            |
| `cssComponentPresets.ts` / `cssLabelPresets.ts` / `specPresetResolver.ts`                                                   | Spec/CSS preset resolver                                | **유지** — Spec D3 영역, pencil 무관                |
| `components/particle/presets.ts`                                                                                            | particle effect presets                                 | **유지** — pencil 무관                              |

> 구현 상세: [911-layout-frameset-pencil-redesign-breakdown.md](../design/911-layout-frameset-pencil-redesign-breakdown.md) — 후속 세션에 작성 (Phase 분해 + 파일 변경 목록 + 마이그레이션 도구 + 검증 시나리오)

## Risks

| ID  | 위험                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 프로젝트의 layout-bound page 가 새 frame authoring UI 에서 시각적으로 다르게 렌더 (예: slot 매칭 실패 + descendants override 누락) |  HIGH  | Gate G2 (시각 회귀 0) — Phase 1 마이그레이션 도구가 모든 layoutTemplates 28 Slot + 사용자 프로젝트의 layout-page 결합을 자동 변환. roundtrip 시각 비교 (Builder/Preview 양축 screenshot diff) 후 cutover |
| R2  | UI 재설계 동안 LayoutsTab 사용자가 frame authoring UI 학습 부담 + 일시적 기능 상실                                                      |  MED   | Phase 2 에서 legacy LayoutsTab 과 신 FramesTab 을 1주 이상 병행. 사용자 documentation 우선 작성 + in-app 마이그레이션 안내                                                                               |
| R3  | layoutActions cascade 재작성 중 deleteLayout / cloneLayout 데이터 누락                                                                  |  HIGH  | Phase 3 진입 전 unit test 50+ fixture 추가 (createLayout / deleteLayout / cloneLayout / addPageToLayout 시나리오). roundtrip read-write-read 정합 검증                                                   |
| R4  | pencil schema 와의 1:1 매칭 시 composition 만의 확장 필드 (예: theme override) 가 호환성 위반                                           |  LOW   | composition 확장 필드는 `metadata.composition*` namespace 안에 격리 (ADR-903 §3.10 패턴). pencil import/export 시 metadata 보존                                                                          |
| R5  | layoutTemplates.ts 28 Slot 자동 변환 후 일부 시각 변경 발생 (예: 미세한 padding/gap drift)                                              |  MED   | Phase 1 마이그레이션 도구가 변환 결과를 dry-run + roundtrip 시각 비교 (Skia/CSS 양축) 검증. 사용자 confirm 후 cutover                                                                                    |

잔존 HIGH 위험 = R1, R3 — 모두 Gate 매핑.

## Gates

| Gate                                          | 시점                                 | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                       | 실패 시 대안                                   |
| --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **G1**: Layout migration 도구 land            | Phase 1 완료                         | (a) layoutTemplates.ts 28 Slot 전수 자동 변환 정상 / (b) 사용자 IndexedDB 의 layout-bound elements 가 신 frame node 안의 descendants 로 변환 / (c) dry-run + roundtrip 시각 비교 (Skia/CSS) screenshot diff 0건                                                                                                                                                                                                                                 | 변환 도구 보강 또는 변환 대상 좁히기           |
| **G2**: 시각 회귀 0 (R1 매핑)                 | Phase 2 완료                         | (a) `mockLargeDataV2` + 샘플 프로젝트 100% 시각 회귀 0 (Skia/CSS 양축) / (b) 사용자 cutover 전 1주 dual-mode (legacy + canonical) 운영 후 issue report 0건                                                                                                                                                                                                                                                                                      | dual-mode 기간 연장 또는 specific 시나리오 fix |
| **G3**: cascade 회귀 0 (R3 매핑)              | ADR-916 G2 이후 Phase 3 완료         | (a) deleteLayout / cloneLayout / addPageToLayout / removePageFromLayout 50+ fixture roundtrip read-write-read 정합 0 drift / (b) undo/redo 정상 / (c) canonical-native `deleteReusableFrame` / `duplicateReusableFrame` / `setPageFrameRef` API 사용                                                                                                                                                                                            | layoutActions 재작성 보강                      |
| **G4**: legacy adapter 0건 + 명칭 충돌 해소   | ADR-916 G5 안에서 Phase 4 완료       | (a) `apps/builder/src/builder/stores/layouts.ts` 본체 삭제 / (b) repo-wide grep `LayoutsTab` / `legacy layout_id` 결과 0 / (c) `useLayoutsStore` 호출 site 0건 / (d) **명칭 충돌 해소** — `PanelSlot.tsx` → `PanelArea.tsx`, `BottomPanelSlot.tsx` → `BottomPanelArea.tsx` rename land (Builder UI panel slot ↔ pencil `slot` 의미 격리). repo-wide grep `PanelSlot\|BottomPanelSlot` 결과 0 (`apps/builder/src/builder/layout/` 디렉토리 한정) | adapter shim 디렉토리 한정 + dead code 제거    |
| **G5**: pencil 호환 검증                      | ADR-916 G6 이후 Phase 5 완료         | (a) 샘플 pencil `.pen` 파일 5종 import → composition canonical document 변환 → roundtrip export → 원본과 schema-equivalent (binary diff 가능 영역만) / (b) ADR-916 이 흡수한 `imports` resolver/cache adapter 인터페이스와 통합 가능                                                                                                                                                                                                            | composition 확장 필드 namespace 격리 보강      |
| ~~G6: Properties 패널 ##Slot section## land~~ | ~~Phase 5 완료 또는 별도 sub-phase~~ | **Superseded by ADR-912**. Slot section base, `Frame.slot: false \| string[]` 기본 표시, `[+]` / `[-]` 기본 동작은 ADR-912 가 소유. 본 ADR 은 완료된 ADR-912 Slot 기능에 추천값/preset/FramesTab 편의 진입점만 제공 가능                                                                                                                                                                                                                        | ADR-912 완료 전 본 ADR 에서 구현 금지          |

## Consequences

### Positive

- ADR-903 의 R1 ("legacy adapter 장기 잔존 → SSOT 혼동") 근본 해소 — legacy 0
- pencil app 과 schema 호환 → 외부 디자인 자산 import/export 자연스럽게 지원
- 단일 frame authoring 인터페이스 → 사용자 학습 비용 감소 + UI 일관성
- ADR-903 G4 (Editing Semantics UI 5요소) 의 토대 제공
- ADR-916 이 흡수한 ADR-903 P5-D/E (`imports` resolver/cache) 와 자연스럽게 통합 — DesignKit 통합은 [ADR-915](915-remove-designkit-system.md) 로 제거됐고 ADR-914 는 Superseded 됨
- **pencil 공식 명칭 단일 표준 채택** — 2026-04-27 inventory 결과 실제 충돌 영역은 Builder UI panel slot 2건 (`PanelSlot` / `BottomPanelSlot`) 으로 한정. Skia rendering 의 `Frame` 단어는 canonical FrameNode 의 시각 표현으로 의미 일치 → 유지

### Negative

- UI 전면 재설계 + DB cascade 재작성 + layoutTemplates 재정의 — 일회성 작업량 큼 (~수 주)
- 사용자 cutover 부담 — 기존 LayoutsTab 사용자가 신 FramesTab 학습 필요 (Phase 2 dual-mode 기간으로 완화)
- layoutTemplates 28 Slot 의 변환 결과 일부 시각 drift 발생 가능 (R5) — 사용자 confirm 단계 필요
- Builder UI rename 2 파일 (`PanelSlot.tsx` / `BottomPanelSlot.tsx` → `PanelArea.tsx` / `BottomPanelArea.tsx`) — Phase 4 G4 통과 조건에 흡수, 외부 API 영향 없음 (내부 import 경로만 변경)

## References

- [ADR-903](903-ref-descendants-slot-composition-format-migration-plan.md) — canonical document migration (Implemented 2026-04-26, 본 ADR 의 G3 (b)/(c)/(d) 잔여 흡수)
- [ADR-903 phase 3 frameset breakdown](../design/903-phase3-frameset-breakdown.md) — frameset 흡수 분석 (본 ADR Phase 1 마이그레이션 도구 설계 시 참조)
- [ADR-903 residual grep audit](../design/903-residual-grep-audit-2026-04-26.md) — 잔여 caller inventory (Phase 4 G4 측정 baseline)
- [ADR-916](916-canonical-document-ssot-transition.md) — canonical document SSOT 전환. 본 ADR 의 남은 G3/G4/G5 실행 순서를 선행 gate 로 재정렬
- [ADR-912](912-editing-semantics-ui-5elements.md) — Editing Semantics UI 6요소 + Slot section base. 본 ADR 은 ADR-912 의 영향을 주지 않으며, 완료된 ADR-912 Component/Slot 기능 위 frame authoring 편의 확장만 제공
- [ADR-914](914-imports-resolver-designkit-integration.md) — Superseded. `imports` resolver/cache 잔여 scope 는 ADR-916 + 본 ADR G5 로 흡수
- [pencil app schema (`.pen` 2.11)](https://pencil.dev/) — 본 ADR 의 호환 기준. 핵심 type 직접 확인 (2026-04-28 MCP 직접 fetch):
  - `Entity.reusable: boolean` — origin 마킹
  - `Frame.slot: false | string[]` — false=일반 frame, array=slot (각 element 는 권장 ref id)
  - `Ref.descendants: { [idPath]: {} }` — slash-separated path override
- [pencil app components docs](https://docs.pencil.dev/core-concepts/components) — Component Origin (magenta) / Instance (violet) bounding box 정의 출처
- 사용자 직접 확인 (2026-04-28 세션 47 / 세션 50+ 후속 정정) — Properties 패널 우측에 Component section + Slot section 별도 노출, `[-]` `[+]` `Create component` 컨트롤 명시. 후속 정정: Component/Slot base 는 ADR-912 소유, ADR-911 은 편의 확장
