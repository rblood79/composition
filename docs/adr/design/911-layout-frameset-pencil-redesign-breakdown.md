# ADR-911 Layout/Slot Frameset 완전 재설계 — 구현 상세

> **상위 ADR**: [ADR-911](../completed/911-layout-frameset-pencil-redesign.md) (Status: Implemented — 2026-05-02)
> **의존 ADR**: ADR-903 (Implemented 2026-04-26) + ADR-916 (Implemented 2026-05-02). `useLayoutsStore` / `layoutActions` 본체는 2026-05-02 legacy layout store removal 로 삭제됐고, ADR-911 G5 Pencil import/export parity 도 완료됨.
> **총 예상 규모**: historical plan. 2026-05-02 이후 feature flag / migration / backup / adapter shim 유지 전제는 direct cutover 로 superseded.

> **2026-05-02 current override**: 아래 Phase 1~4의 migration/dual-mode/shim 계획은 역사적 설계 기록이다. 현재 구현 기준은 canonical frame surface (`canonicalFrameStore`) + active `CompositionDocument` 가 in-memory SSOT이고, current DB `layouts` row 는 persistence mirror 로만 남는다. `apps/builder/src/builder/stores/layouts.ts` / `stores/utils/layoutActions.ts` 는 삭제 완료. Phase 5 는 `apps/builder/src/adapters/pencil/**` + shared mapper + ADR-916 import payload adapter 통합으로 완료.
>
> **2026-05-05 rollback / 2026-05-06 follow-up**: 2026-05-03 post-cutover frame scope fix 군은 사용자 환경 회귀 누적으로 폐기됐다. 2026-05-06 current main follow-up 패치에서 page-frame refresh body/Slot projection, shared frame multi-page projection, Layout Preset Slot replace, frame/page body auto-selection, Nodes panel Frames tree parity 를 다시 닫았다. 현행 frame authoring/render input 은 active `CompositionDocument` / canonical frame projection 기준이며, `layout_id` mirror 는 adapter fallback/export boundary 로 격리한다.

---

## 0. Phase 의존 그래프

```
P1 (G1): Layout migration 도구 + layoutTemplates 28 Slot 변환
   ↓
P2 (G2): FramesTab UI 재설계 + dual-mode 운영
   ↓
P3 (G3): layoutActions cascade 재작성 (canonical-native)
   ↓
P4 (G4): legacy 0 + PanelSlot→PanelArea rename + 명칭 충돌 해소
   ↓
P5 (G5): pencil .pen import/export adapter + ADR-916 imports adapter boundary 통합
```

| Phase  | 의존                       | 병렬 가능 | 예상 시간 | 위험 |
| ------ | -------------------------- | --------- | --------- | ---- |
| **P1** | ADR-903 E-6 IndexedDB 완료 | —         | ~8h       | HIGH |
| **P2** | P1 G1 통과                 | —         | ~12h      | MED  |
| **P3** | ADR-916 G2 + P2 G2 통과    | —         | ~8h       | HIGH |
| **P4** | ADR-916 G5 + P3 G3 통과    | —         | ~8h       | LOW  |
| **P5** | ADR-916 G6 + P4 G4 통과    | —         | ~6h       | MED  |

---

## Phase 1 (G1): Layout migration 도구 — 8h

### 목적

`layoutTemplates.ts` 28 Slot 정의와 사용자 IndexedDB 의 legacy layout-bound elements 를 canonical `FrameNode` (pencil schema) 로 일회성 변환. 시각 회귀 없이 cutover.

### P1-a: SlotElement → FrameNode.slot 변환 알고리즘

**대상**: `apps/builder/src/builder/templates/layoutTemplates.ts`

기존 `LayoutTemplate.slots` 배열과 `LayoutTemplateElement.tag === "Slot"` 노드를 canonical `FrameNode.slot` field (`false | string[]`) 로 변환.

**변환 규칙**:

| 기존 (legacy)                            | 변환 후 (canonical)                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `tag: "Slot", props: { name: "header" }` | `slot: ["header"]` (부모 reusable FrameNode 의 field)                                       |
| `SlotProps.required === true`            | `placeholder: { label: slotName, required: true }` (FrameNode.placeholder field)            |
| `slot_name: "sidebar"` prop              | `descendants["sidebar"]` key path (slash 구분자 없으면 최상위 slot key)                     |
| `LayoutPreset` (slot 구조 preset)        | `reusable: true` FrameNode + template library entry (presetDefinitions.ts → canonical 변환) |

**구현 위치**: `apps/builder/src/lib/db/migrationP911.ts` (신규)

```ts
// apps/builder/src/lib/db/migrationP911.ts

import type { FrameNode, RefNode } from "@composition/shared";
import type { LayoutTemplate } from "../../builder/templates/layoutTemplates";

/**
 * legacy LayoutTemplate → canonical reusable FrameNode 변환
 *
 * slot 메타:
 *   LayoutTemplate.slots[] → FrameNode.slot = slots.map(s => s.name)
 *   각 SlotElement (tag="Slot") → FrameNode 자식에서 제거 + descendants key 등록
 */
export function convertTemplateToCanonicalFrame(
  template: LayoutTemplate,
): FrameNode {
  const slotNames = template.slots.map((s) => s.name);

  return {
    id: template.id,
    type: "frame",
    name: template.name,
    reusable: true,
    slot: slotNames.length > 0 ? slotNames : false,
    placeholder: template.slots.some((s) => s.required)
      ? {
          label: template.slots.find((s) => s.required)?.name ?? "content",
          required: true,
        }
      : undefined,
    children: flattenTemplateElements(template.elements), // Slot 노드 제거 후 구조 유지
    descendants: buildDescendantsFromSlots(template.slots),
  };
}

/**
 * template elements 에서 tag="Slot" 제거 + 나머지 구조 보존
 * Slot 위치는 descendants key 로 대체됨
 */
function flattenTemplateElements(
  elements: LayoutTemplate["elements"],
): FrameNode["children"] {
  return elements
    .filter((el) => el.tag !== "Slot")
    .map((el) => ({
      id: crypto.randomUUID(),
      type: "frame" as const,
      name: el.tag,
      props: el.props,
    }));
}

/**
 * SlotProps[] → descendants override 맵 초기화
 * 각 slot name → children: [] (빈 placeholder — 사용자가 채움)
 */
function buildDescendantsFromSlots(
  slots: LayoutTemplate["slots"],
): Record<string, { children: [] }> {
  return Object.fromEntries(slots.map((s) => [s.name, { children: [] }]));
}
```

**검증**: `convertTemplateToCanonicalFrame(singleColumnTemplate)` 결과의 `slot === ["header","content","footer"]` 확인.

### P1-b: 사용자 IndexedDB layout-bound elements 변환

**대상**: `apps/builder/src/lib/db/migrationP911.ts` (이어서)

ADR-903 P3-E E-6 이후 IndexedDB elements 의 `parent_id` 는 이미 canonical frame node id 로 변환됨. 그러나 legacy `Layout` rows 가 IndexedDB `layouts` store 에 잔존하고, `layouts` store 의 rows 가 canonical document tree 와 동기화되지 않은 경우 자동 변환.

**변환 절차**:

```
(a) db.layouts.getByProject(projectId) → legacy Layout[] 조회
(b) selectCanonicalDocument() 로 canonical tree 에 이미 FrameNode 존재하는지 확인
    - 존재하면: skip (ADR-903 P3 에서 이미 변환됨)
    - 미존재하면: hoistLayoutAsReusableFrame(layout, elements) 실행
(c) 변환된 FrameNode → document.children 에 삽입 + persistence
(d) legacy Layout row 는 P4 완료 시점까지 보존 (read-through shim)
```

**backup 전략**:

```ts
// 변환 전 자동 backup
const backupKey = `composition-layout-redesign-backup:${projectId}:${Date.now()}`;
localStorage.setItem(backupKey, JSON.stringify({ layouts, elements }));
// backup 보존 기간: 30일 (이후 자동 삭제)
```

**dry-run 모드**: `migrationP911.dryRun(projectId)` 호출 시 실제 write 없이 변환 결과만 반환. 개발 환경에서 콘솔 출력으로 검토 후 production migration.

### P1-c: roundtrip 시각 비교 절차 (G1-c)

**목적**: 변환 전후 Skia/CSS 양축 시각 동일성 검증.

**절차**:

```
(1) 변환 전 Builder 스크린샷 캡처 (Chrome MCP parallel-verify skill)
(2) migrationP911.dryRun() 로 변환 결과 메모리에 적용 (DB write 없음)
(3) 변환 후 Builder 스크린샷 캡처 (동일 페이지 / 동일 줌 레벨)
(4) screenshot diff: pixelmatch 사용, threshold 0.01 (1% 허용)
(5) diff > 0 → 변환 알고리즘 수정, diff = 0 → G1-c 통과
(6) CSS (Preview) 양축도 동일 절차
```

**자동화 스크립트**: `apps/builder/src/lib/db/__tests__/migration911.visual.test.ts` (신규)

```ts
// 시각 비교 테스트 (parallel-verify skill 경유)
it("layoutTemplate singleColumn: visual diff 0 after canonical conversion", async () => {
  const before = await captureBuilderScreenshot({
    templateId: "single-column",
  });
  await migrationP911.dryRun("test-project");
  const after = await captureBuilderScreenshot({ templateId: "single-column" });
  const diff = pixelmatch(before, after, null, WIDTH, HEIGHT, {
    threshold: 0.01,
  });
  expect(diff).toBe(0);
});
```

**G1 통과 조건 요약**:

| 조건                                      | 측정 방법                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| (a) 28 Slot 전수 변환                     | `allTemplates.every(t => convertTemplateToCanonicalFrame(t).slot !== false)` |
| (b) IndexedDB elements → descendants 변환 | `db.elements.getByProject().every(el => el.layout_id == null)` (P4 이후)     |
| (c) screenshot diff 0건                   | pixelmatch diff = 0 (위 visual test)                                         |

### P1 변경 파일 목록

| 파일                                                            | 변경 유형 | 내용                                                                           |
| --------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------ |
| `apps/builder/src/lib/db/migrationP911.ts`                      | **신규**  | 변환 도구 (dryRun + apply)                                                     |
| `apps/builder/src/lib/db/__tests__/migration911.visual.test.ts` | **신규**  | roundtrip 시각 비교 테스트                                                     |
| `apps/builder/src/builder/templates/layoutTemplates.ts`         | **수정**  | `LayoutTemplate` 에 `canonicalFrame?: FrameNode` 병기 (P4 완료 후 legacy 제거) |
| `apps/builder/src/lib/db/indexedDB/adapter.ts`                  | **수정**  | `migrationP911` 진입 호출 추가 (schemaVersion 체크)                            |

---

## Phase 2 (G2): UI 재설계 + dual-mode 운영 — 12h

### 목적

`LayoutsTab` → `FramesTab` 전면 재설계. canonical reusable frame authoring UI 구현. 1주 dual-mode 운영 후 legacy cutover.

---

### P2-0: 현재 상태 인벤토리 (2026-04-27 기준)

#### 현재 FramesTab 책임

`apps/builder/src/builder/panels/nodes/FramesTab/FramesTab.tsx` (541 lines)

| 책임                     | 현재 구현                                                       | legacy/canonical 판정 |
| ------------------------ | --------------------------------------------------------------- | --------------------- |
| frame 목록 표시          | `useLayoutsStore(state => state.layouts)` — Layout[] 직접 소비  | **legacy**            |
| frame 선택               | `useSelectedReusableFrameId()` (P3-B canonical selector)        | canonical             |
| frame elements 로드      | `db.elements.getByLayout(frameId)` + `el.layout_id === id` 필터 | **legacy**            |
| frame elements 메모      | `elementsMap.filter(el => el.layout_id === currentFrame.id)`    | **legacy**            |
| frame 생성               | `useLayoutsStore(state => state.createLayout)`                  | **legacy**            |
| frame 삭제               | `useLayoutsStore(state => state.deleteLayout)`                  | **legacy**            |
| frame 초기 로드          | `useLayoutsStore(state => state.fetchLayouts)` (mount effect)   | **legacy**            |
| element 트리 표시        | `buildTreeFromElements(frameElements)`                          | neutral (재사용 가능) |
| element 선택 / 편집 전달 | `setSelectedElement` / `sendElementSelectedMessage` props       | neutral               |

**읽기 access pattern**: `useLayoutsStore` 3개 selector (layouts / setCurrentLayout / createLayout / deleteLayout / fetchLayouts) + `elementsMap` O(1) Map.

**쓰기 access pattern**: `createLayout` (Supabase DB write + store 갱신) → `deleteLayout` (Supabase + cascade) → `fetchLayouts` (Supabase read).

#### useLayoutsStore 결합 파일 (P2 직접 전환 대상)

실측 grep (2026-04-27): `useLayoutsStore` 직접 import 파일 = **19개**. 전체 `layout_id` / `currentLayoutId` 결합 포함 시 **50+ 파일**이나, P2 scope 는 FramesTab 및 직접 연결 editors 에 한정.

| 파일 (P2 전환 대상)                                                | 현재 의존                                                               | P2 처리 방향                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------- | -------------------------------- |
| `panels/nodes/FramesTab/FramesTab.tsx`                             | layouts[] / createLayout / deleteLayout / fetchLayouts / `el.layout_id` | **canonical-native 재작성**      |
| `panels/properties/editors/PageLayoutSelector.tsx`                 | `useLayoutsStore.fetchLayouts` (주석 deprecated)                        | **RefNode.ref 선택 UI 재작성**   |
| `panels/properties/editors/LayoutSlugEditor.tsx`                   | `useLayoutsStore.updateLayout`                                          | **FrameNameEditor 흡수 대기**    |
| `panels/properties/editors/ElementSlotSelector.tsx`                | `useLayoutsStore.getState().layouts`                                    | `frame.slot` 내부 전환           |
| `panels/properties/editors/LayoutPresetSelector/usePresetApply.ts` | `useLayoutsStore`                                                       | frameTemplateApply 재작성        |
| `workspace/canvas/BuilderCanvas.tsx`                               | `useLayoutsStore(state => state.layouts)`                               | **P3 scope** (cascade 재작성 시) |
| `panels/components/ComponentsPanel.tsx`                            | `useLayoutsStore(state => state.currentLayoutId)`                       | **P3 scope**                     |
| `builder/main/BuilderCore.tsx`                                     | `useLayoutsStore` 참조                                                  | **P3 scope**                     |
| `hooks/usePageManager.ts`                                          | `layout_id != null` 혼용                                                | **P3 scope** (G3 cascade)        |

P2 scope 직접 전환: 5개 파일. P3 scope (G3 cascade 재작성 시 전환): 4개 파일.

#### Phase 1 함수 layer 재사용 가능 항목

`apps/builder/src/lib/db/migrationP911.ts` (185 lines, 45 tests PASS):

| 함수                              | 서명                                                                                    | P2 활용                                    |
| --------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ |
| `convertTemplateToCanonicalFrame` | `(template: LayoutTemplate) => FrameNode`                                               | LayoutPresetSelector → frame template 변환 |
| `hoistLayoutAsReusableFrame`      | `(layout: Layout) => FrameNode`                                                         | dev 환경 manual trigger migration          |
| `dryRunMigrationP911`             | `(adapter, projectId, canonicalDoc) => Promise<MigrationP911Result>`                    | dev 검증 trigger UI                        |
| `applyMigrationP911`              | `(currentDoc: CompositionDocument, result: MigrationP911Result) => CompositionDocument` | apply 시 canonical doc 갱신                |

**`selectCanonicalDocument`** (`apps/builder/src/builder/stores/elements.ts:1892`): canonical document selector — P2 재작성 시 직접 사용.

---

### P2-a: FramesTab 재설계 (canonical-native authoring)

**대상**: `apps/builder/src/builder/panels/nodes/FramesTab/FramesTab.tsx`

현재 `FramesTab.tsx` 는 ADR-903 P3-C 에서 `LayoutsTab` 에서 rename 되었지만, 내부 로직은 여전히 `useLayoutsStore.layouts[]` + `getByLayout()` legacy 경로. 본 Phase 에서 canonical-native 로 전환.

**핵심 변경**:

```tsx
// Before (legacy bridge)
const { layouts } = useLayoutsStore();
const frameElements = useMemo(
  () => elements.filter((el) => el.layout_id === currentLayoutId),
  [elements, currentLayoutId],
);

// After (canonical-native)
const canonicalDoc = useStore(selectCanonicalDocument);
const reusableFrames = useMemo(
  () =>
    canonicalDoc.children.filter(
      (n): n is FrameNode => n.type === "frame" && n.reusable === true,
    ),
  [canonicalDoc],
);
const selectedFrame = reusableFrames.find(
  (f) => f.id === selectedReusableFrameId,
);
const frameChildren = selectedFrame?.children ?? [];
```

**UI 구조** (pencil 표준 authoring 패턴):

```
FramesTab
├── FrameList            -- reusable frames 목록 (reusable: true 노드)
│   ├── FrameListItem    -- 각 frame: name + slot badge + ref count
│   └── AddFrameButton   -- createReusableFrame(name) 호출
├── FrameDetails         -- 선택된 frame 상세 편집
│   ├── FrameNameEditor  -- frame.name 인라인 편집
│   ├── SlotList         -- frame.slot 메타 편집
│   │   └── SlotItem     -- slot name + required + placeholder 편집
│   └── DescendantsList  -- frame.descendants override 목록 (P4 이후 full UI)
└── FrameActions
    ├── DeleteFrame      -- canonical document mutation
    └── DuplicateFrame   -- deep clone (descendants 포함)
```

**`createReusableFrame` 액션** (canonical document mutation):

```ts
// apps/builder/src/builder/stores/utils/frameActions.ts (신규)
export function createReusableFrameAction(name: string): FrameNode {
  const frameNode: FrameNode = {
    id: crypto.randomUUID(),
    type: "frame",
    name,
    reusable: true,
    slot: false, // 초기에는 slot 없음 (사용자가 SlotList 에서 추가)
    children: [],
  };
  // canonical document 에 추가
  useStore.getState().addNodeToDocument(frameNode);
  return frameNode;
}
```

### P2-b: legacy editor 처리 방향

| 컴포넌트                  | 현재 상태                    | P2 처리                                                                 |
| ------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `PageLayoutSelector.tsx`  | legacy `page.layout_id` 기반 | **재설계**: page RefNode 의 `ref` field 선택 UI (reusable FrameNode id) |
| `LayoutBodyEditor.tsx`    | layout body element 편집     | **통합**: FrameDetails.DescendantsList 로 흡수 (P3 이후 폐기)           |
| `LayoutSlugEditor.tsx`    | layout slug 편집             | **흡수**: FrameNameEditor + `metadata.slug` 필드 병기                   |
| `LayoutPresetSelector/`   | legacy preset 선택           | **변환**: canonical reusable frame library 로 전환 (아래 P2-c)          |
| `ElementSlotSelector.tsx` | slot 연결 UI                 | **유지**: `frame.slot` field 표시로 내부만 변경                         |

**PageLayoutSelector 재설계 핵심**:

```tsx
// Before: page.layout_id → Layout[] 에서 선택
<Select
  items={layouts}
  value={page.layout_id}
  onChange={(id) => updatePage({ layout_id: id })}
/>

// After: page RefNode.ref → reusable FrameNode[] 에서 선택
<Select
  items={reusableFrames}
  value={pageRefNode?.ref ?? null}
  onChange={(frameId) => updatePageRef({ ref: frameId })}
/>
```

### P2-c: LayoutPresetSelector → reusable frame template 라이브러리

`apps/builder/src/builder/panels/properties/editors/LayoutPresetSelector/presetDefinitions.ts` 의 preset 정의를 P1 에서 변환한 canonical FrameNode 로 교체.

**처리 방향**:

- `LayoutPresetSelector/index.tsx` — reusable frame template 선택 UI 로 재설계
- `presetDefinitions.ts` → `frameTemplateDefinitions.ts` rename + 내용은 P1 변환 결과 import
- `ExistingSlotDialog.tsx` → frame.slot 편집 UI 로 재활용 (pencil slot 의미 그대로)
- `usePresetApply.ts` → `useFrameTemplateApply.ts` rename + canonical document mutation 으로 재작성

### P2-d: dual-mode 운영 절차 + cutover 신호

**1주 dual-mode 병행 운영**:

```
Day 0: P2 land → FramesTab (canonical) 가 default, LayoutsTab (legacy) 가 feature flag 뒤 유지
Day 1-7: 사용자 접근 시 FramesTab 자동 전환 + 상단 banner "프레임 UI가 업데이트됐습니다"
Day 7: issue report 0건 확인 → legacy LayoutsTab 숨김 (완전 제거는 P4)
```

**feature flag**: `featureFlags.ts` 에 `FRAMES_TAB_CANONICAL = true` 추가.

**cutover 신호** (G2 판정 기준):

```bash
# 1주 후 이 두 조건 모두 만족 시 P3 진입 허가
grep -rn "LayoutsTab" apps/builder/src/builder/panels/ | wc -l  # -> feature flag 뒤 1건만 허용
# + GitHub issue tracker: "frame" 또는 "layout" 관련 UI regression 0건
```

**G2 통과 조건 요약**:

| 조건                        | 측정 방법                                                    |
| --------------------------- | ------------------------------------------------------------ |
| (a) 시각 회귀 0             | `mockLargeDataV2` + 샘플 프로젝트 parallel-verify 25/25 PASS |
| (b) dual-mode 1주 issue 0건 | GitHub issue 수동 확인 (frame/layout 키워드)                 |

### P2-e: dev 환경 migration 진입점 (manual trigger)

P3-E E-6 write-through 자동화는 P3 작업이지만, P2 구현 중 **dev 환경 검증**을 위해 legacy `layouts[]` → canonical `frames[]` 수동 변환 옵션이 필요하다.

**진입점 선택지**:

| 옵션     | 위치                               | 트리거                | P3 write-through 와의 관계                             |
| -------- | ---------------------------------- | --------------------- | ------------------------------------------------------ |
| A (권장) | `FramesTab` 개발자 메뉴 (dev-only) | 버튼 클릭             | 동일 `dryRunMigrationP911` + `applyMigrationP911` 호출 |
| B        | `initializeProject` 내 조건부 분기 | 프로젝트 로드 시 자동 | P3 write-through entry 의 선행 버전 (P3 진입 시 제거)  |

옵션 A 선택: P2 scope 를 최소화하고, P3 진입 시 정식 write-through 진입점(옵션 B)으로 교체.

**구현 (dev-only, FramesTab 내)**:

```ts
// FramesTab.tsx — DEV 전용 migration trigger (P3 완료 시 제거)
const handleDevMigrate = useCallback(async () => {
  if (!projectId || process.env.NODE_ENV !== "development") return;
  const db = await getDB();
  const adapter: MigrationP911Adapter = {
    layouts: { getByProject: (id) => db.layouts.getByProject(id) },
  };
  const canonicalDoc = selectCanonicalDocument(
    useStore.getState(),
    useStore.getState().pages,
    useLayoutsStore.getState().layouts,
  );
  const result = await dryRunMigrationP911(adapter, projectId, canonicalDoc);
  if (result.errors.length === 0 && result.hoisted.length > 0) {
    const newDoc = applyMigrationP911(canonicalDoc, result);
    // canonical document 갱신 (useStore.getState().setCanonicalDocument 또는 동급)
    console.info(`[P911 dev] hoisted ${result.hoisted.length} frames`, newDoc);
  } else {
    console.warn("[P911 dev] dry-run result:", result);
  }
}, [projectId]);
```

**Chrome MCP 검증 (P1-c roundtrip)**: `dryRunMigrationP911` 결과 콘솔에서 `hoisted.length === layouts.length` 확인 후 `FramesTab` UI 에 frame 목록이 정상 표시되는지 검증.

---

### P2 Step 분해 + sub-budget

총 12h 배분. **2026-04-27 세션 37 진입 시 5-PR 보수 분할 채택** — selectCanonicalDocument 매 render 호출 비용 + zustand selector cache 함정 (memory: `feedback-zustand-selector-cache.md`) 회피용:

| Sub-PR | 내용                                                                                                            | Step 매핑        | 상태                                 |
| ------ | --------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------ |
| **A**  | `frameActions.ts` skeleton (legacy wrapper). `isFramesTabCanonical()` flag 는 2026-05-02 direct cutover 로 제거 | P2-a 부분 + P2-d | ✅ land → flag 제거 완료             |
| **B**  | `FramesTab.handleAddFrame/handleDeleteFrame/handleSelectFrame` → `frameActions` 위임 (functional 동등)          | P2-a 잔여        | ✅ 2026-04-27 (PR pending)           |
| **C**  | read path canonical 전환 — `selectCanonicalDocument` + `useMemo`/`getState` 패턴                                | P2-a 잔여        | ✅ 2026-04-27 (PR pending)           |
| **D**  | `FrameList` 분리 (FrameDetails / SlotList 는 D2/E 로 deferred)                                                  | P2-b             | ✅ 2026-04-27 main land (`b391c42a`) |
| **D2** | `FrameElementTree` 분리 — Layers 헤더 + tree 렌더 + placeholder                                                 | P2-b 잔여        | ✅ 2026-04-27 main land (`604b11f3`) |
| **E1** | `PageLayoutSelector` dual-mode read 전환 + `slotAndLayoutAdapter` description 보존                              | P2-c 부분        | ✅ 2026-04-27 (PR pending)           |
| **E2** | `usePresetApply.ts` canonical mutation 전환 (write 경로 P3-D 종속 — defer)                                      | P2-c 잔여        | 🔄 P3-D 종속 — 별도 ADR 로 처리      |
| **E3** | dev migration trigger (handleDevMigrate)                                                                        | P2-e             | 폐기 — 2026-05-02 direct cutover     |
| **E4** | cutover (`VITE_FRAMES_TAB_CANONICAL=true` default 전환)                                                         | P2-f + P2-g      | flag 제거 — canonical read 고정      |
| **G**  | parallel-verify 25/25 + 1주 dual-mode + cutover                                                                 | P2-f + P2-g      | dual-mode 폐기                       |

| Step       | 내용                                                                                                                      | 시간 | RED/GREEN 사이클                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | :--: | ---------------------------------------------------------------------------------------------------- |
| **P2-0**   | 현재 FramesTab 코드 인벤토리 + 의존 그래프 작성                                                                           |  1h  | — (분석)                                                                                             |
| **P2-a**   | `FramesTab.tsx` canonical-native 재작성 (`useLayoutsStore` → `selectCanonicalDocument`) + `frameActions.ts` CRUD skeleton |  3h  | RED: `useLayoutsStore` import 제거 → type-check fail / GREEN: `reusableFrames` selector 연결 후 PASS |
| **P2-b**   | `FrameList.tsx` / `FrameDetails.tsx` / `SlotList.tsx` 신규 컴포넌트 + `AddFrameButton`                                    |  2h  | RED: FrameList 렌더 테스트 fail / GREEN: `reusableFrames` prop 전달 후 PASS                          |
| **P2-c**   | `PageLayoutSelector.tsx` 재작성 (RefNode.ref UI) + `usePresetApply.ts` canonical mutation 전환                            |  2h  | RED: `useLayoutsStore` import 제거 → type-check fail / GREEN: `reusableFrames` 선택 후 PASS          |
| **P2-d**   | `FRAMES_TAB_CANONICAL` dual-mode bridge                                                                                   | 0.5h | 폐기 — canonical read 고정                                                                           |
| **P2-e**   | dev migration trigger (handleDevMigrate) + Chrome MCP P1-c roundtrip 검증                                                 |  1h  | 폐기 — DB/dev migration 불필요                                                                       |
| **P2-f**   | `mockLargeDataV2` parallel-verify 25/25 PASS + 1주 dual-mode 시작                                                         |  1h  | dual-mode 폐기, targeted regression 으로 대체                                                        |
| **P2-g**   | 1주 후 G2-(b) issue 0건 확인 → P3 진입 승인                                                                               | 0.5h | 폐기 — 즉시 전환                                                                                     |
| **buffer** | type-check 수정 / 예기치 못한 legacy 의존 해소                                                                            |  1h  | —                                                                                                    |

**vitest 검증 포인트**:

```bash
# P2-a 완료 후 — frameActions CRUD 유닛 테스트
pnpm test frameActions --run

# P2-c 완료 후 — PageLayoutSelector 렌더 테스트 (useLayoutsStore mock 없이)
pnpm test PageLayoutSelector --run

# P2-f — parallel-verify
pnpm type-check
```

**coexistence 원칙 (P3-E 14 파일과의 graceful 공존)**:

- P2 scope 직접 전환 대상: FramesTab + 5개 editors 파일
- P3 scope 파일 (BuilderCanvas / ComponentsPanel / usePageManager / BuilderCore): P2 에서 **수정 없음** — `useLayoutsStore` legacy bridge 유지, G3 cascade 재작성 시 전환
- `stores/layouts.ts` 본체: P2 에서 **수정 없음** — adapter shim 그대로 유지 (P4 완료 시 최소화)
- `LayoutBodyEditor.tsx` / `LayoutSlugEditor.tsx`: P2 에서 **통합 대기** — FrameDetails 흡수 완료 후 P3-e 에서 삭제

---

### P2 변경 파일 목록

| 파일                                                                  | 변경 유형     | 내용                                    |
| --------------------------------------------------------------------- | ------------- | --------------------------------------- |
| `panels/nodes/FramesTab/FramesTab.tsx`                                | **재작성**    | canonical-native selector 전환          |
| `panels/nodes/FramesTab/FrameList.tsx`                                | **신규**      | reusable frame 목록 컴포넌트            |
| `panels/nodes/FramesTab/FrameDetails.tsx`                             | **신규**      | frame 상세 편집 (name/slot/descendants) |
| `panels/nodes/FramesTab/SlotList.tsx`                                 | **신규**      | frame.slot 메타 편집 UI                 |
| `stores/utils/frameActions.ts`                                        | **신규**      | canonical frame CRUD actions            |
| `panels/properties/editors/PageLayoutSelector.tsx`                    | **재작성**    | RefNode.ref 선택 UI                     |
| `panels/properties/editors/LayoutBodyEditor.tsx`                      | **통합 대기** | FrameDetails 로 흡수 (P3 이후 폐기)     |
| `panels/properties/editors/LayoutSlugEditor.tsx`                      | **통합 대기** | FrameNameEditor 흡수 (P3 이후 폐기)     |
| `panels/properties/editors/LayoutPresetSelector/presetDefinitions.ts` | **수정**      | P1 canonical FrameNode import           |
| `panels/properties/editors/LayoutPresetSelector/usePresetApply.ts`    | **재작성**    | canonical document mutation             |
| `utils/featureFlags.ts`                                               | **수정**      | `FRAMES_TAB_CANONICAL` flag 추가        |

---

## Phase 3 (G3): cascade 재작성 — 8h

### 목적

`layoutActions.ts` 의 4 core cascade action (`deleteLayout` / `cloneLayout` / `addPageToLayout` / `removePageFromLayout`) 을 canonical FrameNode mutation 으로 완전 재작성. legacy `layout_id` 기반 cascade 완전 제거. 50+ fixture roundtrip 테스트.

### 2026-04-30 중간 hardening: legacy cascade slices

G3 전체 canonical 전환 전, 사용자 가시 회귀를 먼저 닫은 slices:

- Slice #1 `duplicateLayout` immediate merge:
  - `createDuplicateLayoutAction` 은 cloned layout element subtree 를 IndexedDB 에 `insertMany` 한 뒤 live Zustand `elementsMap` 에 merge 하지 않았다.
  - 그 결과 Frame 복제 직후 새 body/Slot 이 Frames authoring surface 에 즉시 나타나지 않고, 새로고침 후에야 DB snapshot 으로 복원될 수 있었다.
  - fix: clone payload 의 새 `layout_id`, 새 id, remapped `parent_id`, `page_id:null` 을 유지한 채 `mergeElements(newElements)` 를 같은 턴에 호출한다.
- Slice #2 `deleteLayout` orphan page-ref cleanup:
  - canonical frame projection 이 없어 element cascade 를 skip 하는 삭제 경로에서도 Page `layout_id` 를 삭제되는 layout id 로 남겨둘 수 있었다.
  - fix: `db.pages.getAll()` 기반 Page ref cleanup 은 projection guard 밖에서 항상 실행하고, element deletion 만 `frameExists` guard 안에 둔다.
- test: `apps/builder/src/builder/stores/utils/__tests__/layoutActions.test.ts` 가 DB insert/store merge payload 와 frame projection 없음 + page ref cleanup 을 함께 검증한다.

주의: 이 slice 는 legacy `layoutActions.ts` 안정화이며 G3 최종 조건을 대체하지 않는다. 아래 canonical-native `deleteReusableFrame` / `duplicateReusableFrame` / `setPageFrameRef` 전환과 50+ fixture roundtrip 은 계속 잔여다.

### P3-a: deleteLayout → deleteReusableFrame (canonical)

**현재 `createDeleteLayoutAction`의 legacy 패턴**:

```ts
// 현재 (legacy): layout_id 기반 cascade
const layoutElements = allElements.filter((el) => el.layout_id === id);
await Promise.all(layoutElements.map((el) => db.elements.delete(el.id)));
```

**재작성 (canonical)**:

```ts
// After: canonical document tree mutation
export function deleteReusableFrame(frameId: string): void {
  const doc = selectCanonicalDocument(useStore.getState(), ...);

  // 1. 이 frame 을 ref 하는 RefNode 목록 수집 (page 연결 해제)
  const refNodes = collectRefNodesForFrame(doc, frameId);

  // 2. 각 RefNode.ref = null 로 초기화 (page 는 orphan frame 없이 독립 존재)
  refNodes.forEach(ref => updateNodeInDocument({ id: ref.id, ref: null }));

  // 3. canonical document.children 에서 해당 FrameNode 제거
  removeNodeFromDocument(frameId);

  // 4. IndexedDB persistence (canonical document 전체 persist)
  persistCanonicalDocument();

  // 5. history record
  recordHistory({ action: "deleteReusableFrame", frameId });
}
```

**undo/redo 지원**: history entry 에 `{ type: "deleteReusableFrame", snapshot: FrameNode }` 저장. undo 시 `restoreFrameNode(snapshot)` 호출.

### P3-b: cloneLayout → duplicateReusableFrame (canonical)

deep clone — `descendants` override 맵 포함, id 전수 신규 생성.

```ts
export function duplicateReusableFrame(frameId: string): FrameNode {
  const source = findNodeInDocument(frameId) as FrameNode;
  const clone = deepCloneWithNewIds(source); // descendants 내부 id 도 재생성
  clone.name = `${source.name} Copy`;
  addNodeToDocument(clone);
  persistCanonicalDocument();
  return clone;
}
```

### P3-c: addPageToLayout / removePageFromLayout → setPageFrameRef

기존 `page.layout_id` 설정 대신 `pageRefNode.ref = frameId` 설정.

```ts
// addPageToLayout → setPageFrameRef
export function setPageFrameRef(pageId: string, frameId: string | null): void {
  const pageNode = findPageNode(pageId); // type:"frame" + metadata.type:"page"
  updateNodeInDocument({ id: pageNode.id, ref: frameId });
  persistCanonicalDocument();
}
```

### P3-d: 50+ fixture roundtrip 테스트

**위치**: `apps/builder/src/builder/stores/utils/__tests__/frameActions.test.ts` (신규)

**테스트 시나리오** (50 fixtures):

| 카테고리                  | 개수 | 시나리오                                                                                    |
| ------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| deleteReusableFrame       | 15   | 단순 삭제 / ref 보유 frame 삭제 / descendants 있는 frame 삭제 / 중첩 frame 삭제 / undo 복원 |
| duplicateReusableFrame    | 10   | 빈 frame / slot 있는 frame / descendants 있는 frame / 중첩 frame / name 충돌                |
| setPageFrameRef           | 10   | 연결 / 해제 / 재연결 / null 처리 / 존재하지 않는 frame 처리                                 |
| roundtrip read-write-read | 15   | canonical serialize → deserialize 정합 / IndexedDB persist-load 정합 / undo-redo 정합       |

**roundtrip 검증 패턴**:

```ts
it("deleteReusableFrame: roundtrip read-write-read 정합", async () => {
  const before = selectCanonicalDocument(store.getState(), ...);
  deleteReusableFrame("frame-1");
  const after = selectCanonicalDocument(store.getState(), ...);

  // 1. frame 제거 확인
  expect(after.children.find(n => n.id === "frame-1")).toBeUndefined();

  // 2. ref 연결 해제 확인
  const refNodes = collectAllRefNodes(after);
  expect(refNodes.every(r => r.ref !== "frame-1")).toBe(true);

  // 3. undo → 원상 복원
  undo();
  const restored = selectCanonicalDocument(store.getState(), ...);
  expect(restored).toEqual(before);
});
```

### P3-e: LayoutBodyEditor / LayoutSlugEditor 폐기

P2 에서 FrameDetails 로 흡수 완료 확인 후 파일 삭제. G3 측정 명령 (아래) 에서 이 파일의 `layout_id` ref 0 확인.

**G3 통과 조건 측정**:

```bash
# G3 측정: layoutActions 영역 legacy 0 확인
grep -rnE "layout_id|currentLayoutId|useLayoutsStore|createLayout|deleteLayout" \
  apps/builder/src/builder/stores/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v "frameActions\|frameTemplateDefinitions\|legacy-layout-adapter" \
  | wc -l
# → 0
```

| 조건                                   | 측정 방법                          |
| -------------------------------------- | ---------------------------------- |
| (a) 50+ fixture roundtrip 정합 0 drift | `pnpm test frameActions` 전수 PASS |
| (b) undo/redo 정상                     | undo/redo fixture 15건 PASS        |

### P3 변경 파일 목록

| 파일                                             | 변경 유형     | 내용                                                  |
| ------------------------------------------------ | ------------- | ----------------------------------------------------- |
| `stores/utils/frameActions.ts`                   | **확장**      | P2 에서 시작, P3 에서 4 cascade action 완성           |
| `stores/utils/layoutActions.ts`                  | **대폭 수정** | legacy cascade 제거, canonical 위임                   |
| `stores/utils/__tests__/frameActions.test.ts`    | **신규**      | 50+ fixture roundtrip 테스트                          |
| `panels/properties/editors/LayoutBodyEditor.tsx` | **삭제**      | FrameDetails 흡수 완료 확인 후                        |
| `panels/properties/editors/LayoutSlugEditor.tsx` | **삭제**      | FrameNameEditor 흡수 완료 확인 후                     |
| `hooks/usePageManager.ts`                        | **수정**      | `mergedMap` 합성에서 `el.layout_id != null` 매칭 제거 |

---

## Phase 4 (G4): legacy 0 + 명칭 충돌 해소 — 8h

### 목적

`useLayoutsStore` / `Layout` entity 폐기 (canonical FrameNode 흡수 완료). Builder UI panel 명칭 충돌 해소 (`PanelSlot` → `PanelArea`). Skia rendering / workflow 영역 명칭 충돌 해소.

### P4-a: useLayoutsStore 폐기

ADR-903 P3-B 에서 `selectedReusableFrameId` 로 canonical selector 가 추가됨. P3 에서 cascade action 이 canonical-native 로 전환 완료. 잔존 `useLayoutsStore` call site 목록:

```bash
grep -rn "useLayoutsStore" apps/builder/src/ --include='*.ts' --include='*.tsx'
```

각 call site 를 `useStore(selectCanonicalReusableFrames)` 또는 `frameActions.*` 로 교체. 교체 완료 후 `stores/layouts.ts` 본체를 adapter shim 최소화 (ADR-903 P5-C 완전 해체 전까지는 compat re-export 1-2개만 유지).

**adapter shim 최종 형태** (P4 완료 시점):

```ts
// apps/builder/src/builder/stores/layouts.ts
// @deprecated — ADR-911 Phase 4 adapter shim. P5-C 에서 완전 제거 예정.
// 잔존 이유: 외부 call site 제로 확인 전 compat re-export 유지.

export { useSelectedReusableFrameId } from "./layoutState";
// 나머지 export 0
```

**`Layout` entity 폐기**: `types/builder/layout.types.ts` — `Layout` interface `@deprecated` 마크 + `LegacyLayout` alias 추가. P5-C 에서 완전 제거.

### P4-b: PanelSlot → PanelArea / BottomPanelSlot → BottomPanelArea (rename)

**근거**: `apps/builder/src/builder/layout/PanelSlot.tsx` 의 "slot" 은 Builder UI 패널 배치 영역 의미. pencil 공식 slot (`frame.slot` field) 과 의미 충돌. 격리를 위해 rename.

**rename 대상**:

| Before                               | After                                | 내용                       |
| ------------------------------------ | ------------------------------------ | -------------------------- |
| `builder/layout/PanelSlot.tsx`       | `builder/layout/PanelArea.tsx`       | panel arrangement 컴포넌트 |
| `builder/layout/BottomPanelSlot.tsx` | `builder/layout/BottomPanelArea.tsx` | 하단 panel 컴포넌트        |
| `PanelSlotProps` interface           | `PanelAreaProps`                     | props 타입                 |
| `panel-slot` CSS class               | `panel-area`                         | CSS selector               |

**import 교체**: `builder/layout/index.ts` + 모든 consumer (BuilderCore 등) — `PanelSlot` → `PanelArea` import 교체.

```bash
# rename 영향 범위 확인
grep -rn "PanelSlot\|BottomPanelSlot" apps/builder/src/ --include='*.ts' --include='*.tsx'
# 예상: ~10-15 call sites
```

**Why**: pencil slot 의미를 composition 코드베이스에서 단일화. `PanelArea` 는 UI 패널 배치 영역 의미가 명확하고 pencil schema 의 `slot` 과 충돌 없음.

### P4-c: Skia rendering / workflow `Frame` — 유지 (의미 일치)

**보정 (2026-04-27 inventory 결과)**: 이전 ADR-911 본문에 포함되었던 `skiaFrameHelpers` / `workflowFrame*` rename 항목은 **철회**. 코드베이스 실측 결과 Skia/workflow 의 `Frame` 단어는 canonical FrameNode 의 시각 표현 또는 page-level FrameNode reference 로 pencil `frame` 의미와 정합.

**유지 대상 (rename 불필요)**:

| 위치                                                                                      | 의미                                               | 근거                             |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| `workspace/canvas/skia/skiaFrameHelpers.ts::buildPageFrameMap`                            | page-level FrameNode → canvas viewport bounds 매핑 | canonical FrameNode 의 시각 표현 |
| `workspace/canvas/skia/skiaFramePlan.ts` (`FrameRenderPlan`, `BuildFrameRenderPlanInput`) | canonical FrameNode → render plan 변환             | 의미 일치                        |
| `workspace/canvas/skia/skiaFramePipeline.ts` (`buildSkiaFrameContent`)                    | render frame content build                         | 의미 일치                        |
| `workspace/canvas/skia/types.ts` (`FrameType`, `FrameInputSnapshot`, `FrameRenderPlan`)   | render plan 타입                                   | 의미 일치                        |
| `workspace/canvas/skia/workflowRenderer.ts::PageFrame`, `renderPageFrameHighlight`        | page-level FrameNode 시각 표현                     | 의미 일치                        |
| `workspace/canvas/skia/workflowHitTest.ts` / `workflowMinimap.ts` 의 frame 지역 변수      | pageFrame instance reference                       | 의미 일치                        |
| `workspace/canvas/skia/skiaWorkflowSelection.ts::PageFrameLike`                           | 동일                                               | 의미 일치                        |
| `workspace/canvas/skia/skiaOverlayBuilder.ts::FrameCacheState`                            | render frame cache                                 | 의미 일치                        |
| `workspace/canvas/utils/gpuProfilerCore.ts::FrameStats`                                   | RAF profiling                                      | pencil 무관                      |

**참고**: ADR-911 Terminology 섹션의 "충돌 없음 — pencil 무관 또는 의미 일치" 표 참조. Decision §Terminology 명문화 (commit f4047af1).

### P4-d: repo-wide grep 0 검증

**G4 통과 조건**:

```bash
# (a) stores/layouts.ts 본체 — shim 외 legacy 코드 0
grep -n "createLayout\|deleteLayout\|cloneLayout\|fetchLayouts" \
  apps/builder/src/builder/stores/layouts.ts
# → 0 (shim re-export 만 허용)

# (b) panels 영역 legacy 0
grep -rn "LayoutsTab\|legacy layout_id" \
  apps/builder/src/builder/ --include='*.ts' --include='*.tsx' \
  | grep -v "legacy-layout-adapter" | wc -l
# → 0

# (c) useLayoutsStore call site 0
grep -rn "useLayoutsStore" apps/builder/src/ \
  --include='*.ts' --include='*.tsx' \
  | grep -v "stores/layouts.ts" | wc -l
# → 0

# (d) 명칭 충돌 해소 — Builder UI panel slot 만 (Skia/workflow Frame 은 의미 일치 유지)
grep -rn "PanelSlot\|BottomPanelSlot" apps/builder/src/ \
  --include='*.ts' --include='*.tsx' | wc -l
# → 0 (PanelArea / BottomPanelArea 로 전환 완료)

# 참고: skiaFrameHelpers / skiaFramePlan / workflowFrame* 는 canonical FrameNode
# 의 시각 표현으로 의미 일치 — rename 대상 아님 (ADR-911 Terminology 보정)
```

### P4 변경 파일 목록

| 파일                                  | 변경 유형     | 내용                                                |
| ------------------------------------- | ------------- | --------------------------------------------------- |
| `stores/layouts.ts`                   | **대폭 축소** | adapter shim 최소화 (export 1-2개 compat)           |
| `types/builder/layout.types.ts`       | **수정**      | `Layout` → `LegacyLayout` @deprecated               |
| `builder/layout/PanelSlot.tsx`        | **rename**    | → `PanelArea.tsx` (PanelSlotProps → PanelAreaProps) |
| `builder/layout/BottomPanelSlot.tsx`  | **rename**    | → `BottomPanelArea.tsx`                             |
| `builder/layout/index.ts`             | **수정**      | export path 업데이트                                |
| 전체 PanelSlot consumer (~10-15 파일) | **수정**      | import `PanelArea` / `BottomPanelArea`              |

**Skia/workflow `Frame` 영역은 변경 없음** — `skiaFrameHelpers` / `skiaFramePlan` / `skiaFramePipeline` / `workflowRenderer.PageFrame` / `workflowHitTest` / `workflowMinimap` 등은 canonical FrameNode 의 시각 표현으로 의미 일치 → 유지 (ADR-911 Terminology 보정 commit `f4047af1`).

---

## Phase 5 (G5): pencil 호환 검증 — 6h

> **Status (2026-05-02)**: Implemented. `apps/builder/src/adapters/pencil/` 에 document-level adapter 와 fixture 5종 roundtrip test 를 추가했고, `packages/shared/src/types/pencil-adapter.types.ts` 의 Phase 5+ stub 을 실제 mapper 로 승격했다. ADR-916 `normalizeCompositionImportPayload()` 는 같은 mapper 를 사용해 fetched `.pen` payload 를 canonical import document 로 normalize 한다.

### 목적

샘플 `.pen` 파일 5종 import → composition canonical document 변환 → roundtrip export → schema-equivalent 검증. ADR-914 는 Superseded 되었으므로 imports resolver/cache 통합은 ADR-916 의 canonical import/export adapter boundary 를 기준으로 명세한다.

### P5-a: pencil .pen import adapter

**위치**: `apps/builder/src/adapters/pencil/` (신규 디렉토리)

```
apps/builder/src/adapters/pencil/
├── pencilImport.ts      -- .pen → CompositionDocument 변환
├── pencilExport.ts      -- CompositionDocument → .pen 변환
├── pencilSchemaMap.ts   -- schema 1:1 매핑 테이블
├── types.ts             -- PencilDocument / PencilNode 타입 (펜슬 schema)
└── __tests__/
    ├── pencilImport.test.ts
    └── pencilRoundtrip.test.ts
```

**pencilSchemaMap.ts** — pencil 공식 schema ↔ composition canonical 매핑:

| pencil field                                            | composition canonical                                      | 변환 규칙                  |
| ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| `node.type: "frame"`                                    | `FrameNode.type: "frame"`                                  | 직접 매핑                  |
| `node.type: "ref"`                                      | `RefNode.type: "ref"`                                      | 직접 매핑                  |
| `node.reusable: boolean`                                | `FrameNode.reusable: boolean`                              | 직접 매핑                  |
| `node.slot: false \| string[]`                          | `FrameNode.slot: false \| string[]`                        | 직접 매핑                  |
| `node.descendants: Record<string, DescendantsOverride>` | `RefNode.descendants: Record<string, DescendantsOverride>` | 직접 매핑                  |
| `node.clip: boolean`                                    | `FrameNode.clip: boolean`                                  | 직접 매핑                  |
| `node.placeholder`                                      | `FrameNode.placeholder`                                    | 직접 매핑                  |
| `document.imports`                                      | `CompositionDocument.imports`                              | 직접 매핑                  |
| pencil 무대응 필드                                      | `metadata.composition*` namespace 격리                     | composition 확장 필드 격리 |

**pencilImport.ts 실제 변환 surface**:

```ts
// apps/builder/src/adapters/pencil/pencilImport.ts

import type { CompositionDocument } from "@composition/shared";
import type { PencilDocument } from "./types";

export function importPencilDocument(
  payload: PencilDocument | PencilNode,
  options?: PencilDocumentImportOptions,
): CompositionDocument;
```

실제 node-level mapping 은 shared `pencilPrimitiveToComponent()` / `componentToPencilTree()` 가 소유한다. Builder adapter 는 file-open/roundtrip semantics 에서는 원본 `reusable` 값을 보존하고, ADR-916 import registry 경로에서는 `forceTopLevelReusable` 옵션으로 external `.pen` top-level node 를 reusable master 로 승격한다.

### P5-b: 샘플 .pen 파일 5종 roundtrip 테스트

**테스트 대상 5종** (complexity 순):

| #   | 파일명                   | 특성                            |
| --- | ------------------------ | ------------------------------- |
| 1   | `sample-minimal.pen`     | frame 1개, slot 없음            |
| 2   | `sample-slots.pen`       | reusable frame + 3 slot         |
| 3   | `sample-ref.pen`         | reusable frame + 2 ref instance |
| 4   | `sample-descendants.pen` | ref + descendants override      |
| 5   | `sample-imports.pen`     | imports field + 외부 .pen 참조  |

**roundtrip 검증**:

```ts
// apps/builder/src/adapters/pencil/__tests__/pencilRoundtrip.test.ts

it.each(SAMPLE_FILES)("roundtrip: %s", async (filename) => {
  const penDoc = await loadFixture(filename);

  // import
  const canonicalDoc = importPencilDocument(penDoc);

  // export 역방향
  const reExported = exportCanonicalToPencil(canonicalDoc);

  // schema-equivalent 검증 (binary diff 가능 영역만)
  expect(reExported.children).toEqual(
    penDoc.children.map(stripCompositionMetadata),
  );
  expect(reExported.imports).toEqual(penDoc.imports);
  // Note: id / metadata 는 composition 추가 필드이므로 strict equal 미적용
});
```

### P5-c: ADR-916 imports resolver 통합 인터페이스 명세

ADR-916 은 `.pen` 파일의 `imports` field 를 canonical core hook 으로 유지하고, import/export adapter boundary 에서 외부 reusable frame 을 로컬 canonical document 에 합성한다. 본 P5 에서 ADR-916 이 흡수한 imports resolver/cache scope 가 의존할 인터페이스를 정의한다.

**실제 통합 인터페이스**:

```ts
// apps/builder/src/resolvers/canonical/importPayloadAdapter.ts
export function normalizeCompositionImportPayload(
  payload: unknown,
  source: string,
): CompositionDocument;

// packages/shared/src/types/pencil-adapter.types.ts
export function pencilDocumentToCompositionDocument(
  document: PencilDocument,
  options?: PencilDocumentImportOptions,
): CompositionDocument;

export function compositionDocumentToPencilDocument(
  document: CompositionDocument,
  options?: PencilExportOptions,
): PencilDocument;
```

**ADR-916 연계 방식**: standalone `importResolver.register("pencil", ...)` registry 는 두지 않는다. ADR-916 default import fetcher 가 same-origin JSON 을 받아 `normalizeCompositionImportPayload()` 로 canonical/Pencil payload 를 판별하고, Pencil-style payload 는 shared mapper 경유로 canonical `CompositionDocument` 로 normalize 한다. ADR-914 standalone scope 는 Superseded 이다.

**G5 통과 조건**:

| 조건                                     | 측정 방법                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| (a) 샘플 5종 roundtrip schema-equivalent | `pnpm -F @composition/builder exec vitest run src/adapters/pencil/__tests__/pencilRoundtrip.test.ts` 5/5 PASS |
| (b) ADR-916 통합 인터페이스 타입 정합    | `pnpm run codex:typecheck` PASS                                                                               |

### P5 변경 파일 목록

| 파일                                                | 변경 유형 | 내용                                                                 |
| --------------------------------------------------- | --------- | -------------------------------------------------------------------- |
| `adapters/pencil/pencilImport.ts`                   | **신규**  | .pen → canonical 변환                                                |
| `adapters/pencil/pencilExport.ts`                   | **신규**  | canonical → .pen 역변환                                              |
| `adapters/pencil/pencilSchemaMap.ts`                | **신규**  | 1:1 매핑 테이블                                                      |
| `adapters/pencil/types.ts`                          | **신규**  | PencilDocument / PencilNode 타입                                     |
| `adapters/pencil/__tests__/pencilImport.test.ts`    | **신규**  | import unit test                                                     |
| `adapters/pencil/__tests__/pencilRoundtrip.test.ts` | **신규**  | 5종 roundtrip 검증                                                   |
| `packages/shared/src/types/pencil-adapter.types.ts` | **수정**  | shared Pencil node/document mapper + ADR-916 import payload boundary |
| `adapters/pencil/fixtures/`                         | **신규**  | 샘플 .pen 파일 5종 (mocked schema)                                   |

---

## 6. 결정 사항

| ID     | 결정                            | 선택                                          | 근거                                             |
| ------ | ------------------------------- | --------------------------------------------- | ------------------------------------------------ |
| **D1** | pencil schema 호환 버전         | 현재 pencil 최신 schema (2.x) 기준            | 사용자 결정: "pencil 공식 명칭 그대로 사용"      |
| **D2** | composition 확장 필드 namespace | `metadata.composition*` prefix                | ADR-903 §3.10 패턴 준용, pencil 미지원 필드 격리 |
| **D3** | dual-mode 운영 기간             | 폐기 — 2026-05-02 direct cutover              | 개발 단계라 기존 사용자/데이터 보존 불필요       |
| **D4** | adapter shim 최종 제거 시점     | 완료 — legacy layout store 본체 삭제          | ADR-916 final SSOT 와 동시 closure               |
| **D5** | PanelArea CSS class 전환        | `panel-slot` → `panel-area` (CSS도 동시 변경) | 의미 충돌 완전 격리                              |

---

## 7. 후속 ADR 연계

| ADR                                   | 관계                                                         | 선행 조건 |
| ------------------------------------- | ------------------------------------------------------------ | --------- |
| ADR-912 (Editing Semantics UI)        | 본 ADR FramesTab 위 reusable/ref/override UX 기준 제공       | 완료됨    |
| ADR-913 (tag→type rename)             | ADR-916 G5 field quarantine 에서 함께 정렬                   | 완료됨    |
| ADR-914 (imports + DesignKit)         | Superseded. `imports` fetch/cache scope 는 ADR-916 으로 흡수 | —         |
| ADR-916 (canonical document SSOT)     | 잔여 P3/P4/P5 의 선행 store/API + adapter boundary           | 완료됨    |
| ADR-910 (themes/variables)            | 독립 진행 가능                                               | —         |
| ADR-903 P5-C (adapter shim 완전 해체) | 본 ADR P4 G4 + ADR-916 G5 adapter quarantine 와 동시 정렬    | P4 G4     |

---

## 8. 참조

- [ADR-911 본문](../completed/911-layout-frameset-pencil-redesign.md)
- [ADR-903 Phase 3 frameset breakdown](903-phase3-frameset-breakdown.md)
- [ADR-903 residual grep audit](903-residual-grep-audit-2026-04-26.md)
- [ADR-903 phase 5 persistence imports breakdown](903-phase5-persistence-imports-breakdown.md)
- [pencil app schema docs](https://pencil.dev/)
