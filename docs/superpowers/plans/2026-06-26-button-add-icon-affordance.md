# Button 프로퍼티 Add Icon affordance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Button(또는 ToggleButton) 선택 시 프로퍼티 패널에 "Add Icon" 버튼을 추가하여, 클릭하면 Icon 자식 element 를 그 Button 안에 생성한다.

**Architecture:** 새 properties-panel 조건부 섹션 `ButtonChildSection.tsx`(FrameSlotSection 패턴 차용). 데이터/렌더 메커니즘은 전부 기존 재사용 — `useElementCreator.handleAddElement("Icon", …)` + `resolveCreationParentId`(선택 요소=부모). Button.binding / schema 무변경 (ADR-142 RAC leaf 원칙 + RSP `<Button><Icon/><Text/></Button>` 공식 정합). 추가된 Icon 의 iconName/색/크기 편집은 기존 `Icon.binding` content section iconName(`kind:"icon"`, SelectIcon 동형) 패턴으로 처리 — 본 작업은 생성 진입점만.

**Tech Stack:** React 19, Zustand store, `useElementCreator` 훅, `PropertySection`/`ActionIconButton` UI, lucide-react 아이콘.

## Global Constraints

- 응답 한국어, 코드/기술 용어 영어 유지.
- Button.binding **무수정**, `iconName`/`iconPosition`/`staticColor` prop 복원 0 (ADR-142 역행 금지 — 차단 메모리 `feedback-rac-leaf-vs-rsp-composite-icon-bundle`).
- D1(DOM 구조)/D2(props)/D3(시각) schema 무변경 — 순수 빌더 UX 레이어.
- 게이트 1차 범위 = `{ "Button", "ToggleButton" }` (leaf 버튼). ToggleButtonGroup 제외.
- "Add Icon" 단일 버튼만. Add Text / position(start/end) 제어 제외.
- git: web PR 금지. `git add` → `git commit` → push 는 사용자 명시 요청 시만.
- 완료 기준: type-check PASS 단독 불가 — Chrome MCP live exercise 필수.
- type-check baseline 69 (builder), 회귀 0 유지.

---

## File Structure

- **Create**: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`
  - 책임: 선택 요소가 Button/ToggleButton 일 때만 렌더되는 "Add Icon" 섹션. 클릭 → Icon 자식 생성. 단일 책임(생성 진입점), 다른 섹션과 독립.
- **Modify**: `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx`
  - FrameSlotSection 인접에 `<ButtonChildSection elementId={selectedElement.id} />` 조건부 마운트 (import 1줄 + JSX 1줄).
- **Test**: `apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx`
  - 게이트 로직(button-base 류만 렌더) 단위 검증.

---

## Task 1: ButtonChildSection 컴포넌트 (게이트 + Add Icon 생성)

**Files:**

- Create: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`
- Test: `apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx`

**Interfaces:**

- Consumes:
  - `useCanonicalPropertyElement(elementId): PanelNode | undefined` — `panels/properties/hooks/useCanonicalPropertyRead.ts` (선택 요소 read).
  - `useElementCreator(): { handleAddElement }` — `@/builder/hooks`. `handleAddElement(type, currentPageId, selectedElementId, elements, addElement, layoutId, doc)`.
  - `useStore((s) => s.addElement)` / `useStore((s) => s.currentPageId)` / `useStore((s) => s.selectedElementId)` — `../../stores`.
  - `getActiveCanonicalDocument(): CompositionDocument | null` — `../../stores/canonical/canonicalElementsBridge`.
  - `visitCanonicalDocumentElements(doc, cb)` — `../../stores/canonical/canonicalElementsView`.
  - `PropertySection` — `../../components`. `ActionIconButton` — `../../components`.
- Produces: `ButtonChildSection` (named export) — `({ elementId: string }) => JSX.Element | null`. Task 2 가 mount.

- [ ] **Step 1: Write the failing test**

`apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { BUTTON_CHILD_HOST_TAGS } from "./ButtonChildSection";

describe("ButtonChildSection gate", () => {
  it("Button/ToggleButton 만 host 대상", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("Button")).toBe(true);
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButton")).toBe(true);
  });

  it("ToggleButtonGroup / 비-button 은 host 아님", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButtonGroup")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Text")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Frame")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @composition/builder exec vitest run src/builder/panels/properties/ButtonChildSection.test.tsx`
Expected: FAIL — `Cannot find module "./ButtonChildSection"` (파일 미존재).

- [ ] **Step 3: Write the component**

`apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`:

```tsx
import { memo, useCallback } from "react";
import { Plus } from "lucide-react";
import { PropertySection, ActionIconButton } from "../../components";
import { useStore } from "../../stores";
import { useElementCreator } from "@/builder/hooks";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import { useCanonicalPropertyElement } from "./hooks/useCanonicalPropertyRead";
import { iconProps } from "../../../utils/ui/uiConstants";
import type { PanelNode } from "../panelNode";

/**
 * Add Icon 대상 host 태그 (leaf 버튼만). ToggleButtonGroup 은 자식이 ToggleButton
 *   (leaf 버튼)이라 Icon 자식 직접 대상 아님 → 제외. ADR-142: Button=RAC leaf,
 *   아이콘은 자식 element(RSP composite) — binding iconName 복원 0.
 */
export const BUTTON_CHILD_HOST_TAGS: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
]);

/**
 * Button/ToggleButton 선택 시 "Add Icon" 진입점. 클릭 → Icon 자식 element 생성
 *   (resolveCreationParentId 가 선택 Button 을 부모로 parenting). 생성된 Icon 의
 *   iconName/색/크기 편집은 기존 Icon.binding content section 패턴(SelectIcon 동형).
 */
export const ButtonChildSection = memo(function ButtonChildSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId) as
    | PanelNode
    | undefined;
  const addElement = useStore((state) => state.addElement);
  const currentPageId = useStore((state) => state.currentPageId);
  const selectedElementId = useStore((state) => state.selectedElementId);
  const { handleAddElement } = useElementCreator();

  const handleAddIcon = useCallback(async () => {
    const doc = getActiveCanonicalDocument();
    if (!doc || !currentPageId) return;

    const pageElements: PanelNode[] = [];
    visitCanonicalDocumentElements(doc, (el) => {
      pageElements.push(el);
    });
    const filtered = pageElements.filter(
      (el) => !el.deleted && el.page_id === currentPageId,
    );

    await handleAddElement(
      "Icon",
      currentPageId,
      selectedElementId,
      filtered,
      addElement,
      null,
      doc,
    );
  }, [currentPageId, selectedElementId, addElement, handleAddElement]);

  if (!element || !BUTTON_CHILD_HOST_TAGS.has(element.type)) return null;

  return (
    <PropertySection title="Children" id="button-child">
      <ActionIconButton
        onPress={handleAddIcon}
        aria-label="Add Icon"
        tooltip="아이콘 자식 추가"
      >
        <Plus
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </ActionIconButton>
    </PropertySection>
  );
});
```

> 참고: `pageElements` 필터의 `el.deleted` / `el.page_id` 는 ComponentsPanel.getComponentsPanelElements + page-mode 필터(ComponentsPanel.tsx:123-125) 와 동일 패턴. layout 모드는 본 affordance 범위 밖(page-mode 한정).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @composition/builder exec vitest run src/builder/panels/properties/ButtonChildSection.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: type-check**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)`.

> 만약 `iconProps` / `ActionIconButton` / `PanelNode.page_id` 타입 불일치가 나오면: `iconProps` import 경로는 `../../../utils/ui/uiConstants`(Section.tsx 와 동일), `ActionIconButton` 은 `../../components`(PropertiesPanel.tsx:34 와 동일 배럴), `PanelNode` 의 `deleted`/`page_id`/`type` 필드 존재는 ComponentsPanel.getComponentsPanelElements 가 같은 PanelNode[] 로 같은 필터를 쓰는 것으로 보장됨. 경로만 맞추고 재실행.

- [ ] **Step 6: Commit**

```bash
git add apps/builder/src/builder/panels/properties/ButtonChildSection.tsx apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx
git commit -m "feat(button): ButtonChildSection — Add Icon 자식 생성 진입점

선택 요소가 Button/ToggleButton 일 때만 렌더되는 프로퍼티 섹션. Add Icon 클릭 →
useElementCreator.handleAddElement(\"Icon\") 로 Icon 자식 생성(resolveCreationParentId
가 선택 Button 을 부모로). ADR-142 RAC leaf 유지 — binding iconName 복원 0,
Icon=자식 element(RSP composite). 생성된 Icon 편집은 기존 content section iconName 패턴.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PropertiesPanel 마운트

**Files:**

- Modify: `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx` (import 1줄 + FrameSlotSection 인접 JSX 1줄)

**Interfaces:**

- Consumes: `ButtonChildSection` (Task 1 named export) — `({ elementId: string }) => JSX.Element | null`.
- Produces: 없음 (terminal — UI 마운트).

- [ ] **Step 1: import 추가**

`apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:33` (`import { FrameSlotSection } from "./FrameSlotSection";` 바로 아래)에 추가:

```tsx
import { ButtonChildSection } from "./ButtonChildSection";
```

- [ ] **Step 2: JSX 마운트 추가**

`apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:1628` (`<FrameSlotSection elementId={selectedElement.id} />`) 바로 아래에 추가:

```tsx
<ButtonChildSection elementId={selectedElement.id} />
```

> `selectedElement` 는 해당 JSX 스코프에서 이미 사용 중(FrameSlotSection 이 동일 `selectedElement.id` 전달). 추가 변수 불필요.

- [ ] **Step 3: type-check**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)`.

- [ ] **Step 4: Commit**

```bash
git add apps/builder/src/builder/panels/properties/PropertiesPanel.tsx
git commit -m "feat(button): PropertiesPanel 에 ButtonChildSection 마운트

FrameSlotSection 인접에 조건부 마운트. Button/ToggleButton 선택 시에만 Add Icon
섹션 노출(게이트는 ButtonChildSection 내부).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Live 검증 + CHANGELOG

**Files:**

- Modify: `docs/CHANGELOG.md` (Features 엔트리)

**Interfaces:**

- Consumes: 없음 (검증 + 문서).
- Produces: 없음 (terminal).

- [ ] **Step 1: dev 서버 가동 확인**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173`
Expected: `200` (미가동 시 `pnpm dev` 백그라운드 기동 후 재확인).

- [ ] **Step 2: Chrome MCP live exercise**

빌더에서:

1. Button(아이콘 없는 text-only) 선택 → 프로퍼티 패널에 "Children" 섹션 + "Add Icon" 버튼 노출 확인.
2. "Add Icon" 클릭 → 레이어 트리에 Button 자식으로 Icon element 생성 확인. Preview + Skia 캔버스에 Icon 표시 확인 (생성된 Icon 이 부모 Button color 상속 — 직전 세션 작업).
3. 생성된 Icon 자식 선택 → 프로퍼티 패널 content section 에 기존 iconName(`kind:"icon"`) 필드 노출 확인 → 다른 아이콘 선택 시 반영 확인.
4. 비-button(예: Text 또는 Frame) 선택 → "Children/Add Icon" 섹션 **미표시** 확인 (게이트 정상).

Expected: 4 항목 모두 PASS. **무엇을 exercise 했는지 commit/보고에 명시** (test 개수만 나열 금지 — CLAUDE.md 완료 기준).

- [ ] **Step 3: type-check 최종 확인**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)`.

- [ ] **Step 4: CHANGELOG 반영**

`docs/CHANGELOG.md` 최상단에 추가:

```markdown
## [Button 프로퍼티 Add Icon affordance] - 2026-06-26

### Features

- **Button/ToggleButton 프로퍼티 "Add Icon" 버튼**:
  - Button(또는 ToggleButton) 선택 시 프로퍼티 패널에 "Children" 섹션 + "Add Icon" 버튼 노출 → 클릭하면 Icon 자식 element 를 그 Button 안에 생성
  - **Why**: 아이콘 붙은 Button 은 ADR-142/RSP 공식(`<Button><Icon/><Text/></Button>`)상 자식 element 조합인데, 그간 palette 까지 가야 추가 가능했음. 선택된 Button 컨텍스트에서 바로 추가하는 편의 진입점 제공
  - Button.binding / schema 무변경 (iconName prop 복원 0 — ADR-142 RAC leaf 원칙 유지). 생성된 Icon 의 iconName/색/크기는 기존 Icon content section 패턴(SelectIcon 동형)으로 편집
  - 위치: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`, `PropertiesPanel.tsx`
```

- [ ] **Step 5: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): Button 프로퍼티 Add Icon affordance

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage**:
  - spec "ButtonChildSection.tsx (FrameSlotSection 패턴, 게이트 {Button,ToggleButton}, Add Icon)" → Task 1. ✓
  - spec "PropertiesPanel Content 영역 조건부 마운트" → Task 2. ✓
  - spec "icon 선택 UI 기존 Icon.binding content section 재사용 (신설 0)" → Task 1 은 생성 진입점만, Task 3 Step 2-3 가 기존 content section iconName 편집 동작을 live 검증. ✓
  - spec "검증 — type-check + live exercise" → Task 3. ✓
  - spec "binding/schema 무변경, ADR-142 정합" → Global Constraints + Task 1 (Button.binding 미터치). ✓
- **Placeholder scan**: 모든 step 에 실제 코드/명령/기대값 포함. "add error handling" 류 없음. ✓
- **Type consistency**: `BUTTON_CHILD_HOST_TAGS`(Set) Task 1 정의 → Task 1 test 사용. `ButtonChildSection({ elementId })` Task 1 export → Task 2 mount 시그니처 일치. `handleAddElement(type, pageId, selectedId, elements, addElement, layoutId, doc)` 7-arg = ComponentsPanel.tsx:126-134 실제 호출과 동일. ✓
- **신규 발견 반영**: page-mode 한정(layout 모드 분기 제외)로 단순화 — spec 범위 가드("page-mode")와 정합. ✓
