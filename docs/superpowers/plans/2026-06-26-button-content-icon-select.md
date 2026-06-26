# Button Content Section "Icon" 셀렉트 (자식 element 백킹) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Button/ToggleButton 의 프로퍼티 패널 Content 영역에 "Icon" 셀렉트(기본값 None)를 추가하여, 선택된 Button 의 자식 Icon element 를 생성/수정/삭제로 관리한다 (v1 "Children section + Add Icon 버튼"을 forward-fix 교체).

**Architecture:** `ButtonChildSection.tsx` 를 단순 "Add Icon 버튼"에서 `PropertyIconPicker` 기반 셀렉트로 재작성한다. 셀렉트의 표시값은 Button 자식 중 첫 Icon element 의 `iconName` 을 읽고(none=자식 없음), 선택/변경/해제는 자식 Icon element 의 생성(`addElement` 직접 호출 + 미리 만든 id)/`updateElementProps`/`removeElement` 4-way 동기화로 처리한다. `Button.binding` 무수정 — ADR-142 RAC leaf 정합 (DOM 은 `<Button><Icon/>text</Button>`, iconName prop 복원 0).

**Tech Stack:** React 19, Zustand store actions, React-Aria Components, Vitest + React Testing Library, canonical document store.

## Global Constraints

- **ADR-142 정합 절대**: `packages/shared/src/catalog/bindings/Button.binding.ts` 및 `ToggleButton.binding.ts` 무수정. `iconName` prop 복원 0. 아이콘은 Button 의 **자식 Icon element** 로만 표현.
- **자동 selection 변경 금지**: 자식 Icon 생성 시 `useElementCreator.handleAddElement` 를 쓰지 않는다 — 그 함수는 생성 직후 `setSelectedElement(newId)` 로 selection 을 Icon 으로 옮겨 Button 선택이 풀리고 셀렉트가 사라진다. 대신 `FrameSlotSection.handleInsertDefault` 패턴(미리 만든 `crypto.randomUUID()` id + `addElement` 직접 호출)을 사용해 Button 선택을 유지한다.
- **store 파이프라인 순서 보존**: 모든 mutation 은 store action(`addElement`/`updateElementProps`/`removeElement`) 경유 (Memory→Index→History→DB→Preview→Rebalance). 직접 elementsMap mutation 금지.
- **응답·문서·커밋 한국어**, 코드/식별자는 영어 유지. 의회적·영어 은어 회피(`CLAUDE.md` §어휘 규칙).
- **게이트 set 보존**: `BUTTON_CHILD_HOST_TAGS = new Set(["Button", "ToggleButton"])` export 유지 (기존 테스트 의존).
- 작업은 main 직접. push 는 사용자 명시 요청 시에만.

---

## File Structure

- **`apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`** (재작성) — Content 영역 "Icon" 셀렉트 섹션. 자식 Icon element 읽기/CRUD 로직 + `PropertyIconPicker` 렌더.
- **`apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx`** (확장) — 게이트 set 테스트(기존) + 자식 Icon id 해석 헬퍼 단위 테스트(신규).
- **`docs/CHANGELOG.md`** (수정) — v2 변경 엔트리.

PropertiesPanel.tsx 의 `<ButtonChildSection elementId={selectedElement.id} />` 마운트(line 1631)는 그대로 둔다 — 컴포넌트 내부만 교체.

---

## Task 1: 자식 Icon 해석 헬퍼 추출 + 단위 테스트

순수 함수 `findFirstIconChild(children)` 를 추출해 테스트 가능하게 만든다. 이 함수는 Button 자식 목록에서 첫 번째 `type==="Icon"` 이고 `!deleted` 인 element 를 찾는다. 셀렉트의 표시값(현재 iconName)과 CRUD 분기 판정의 단일 소스.

**Files:**

- Modify: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx` (헬퍼 추가 export)
- Test: `apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx`

**Interfaces:**

- Consumes: `PanelNode` 타입 — `apps/builder/src/builder/panels/properties/hooks/useCanonicalPropertyRead.ts` 가 사용하는 element 타입. `{ id: string; type: string; deleted?: boolean; props?: { iconName?: string } }` 구조 부분만 사용. 테스트에서는 최소 형태 객체로 캐스팅.
- Produces: `export function findFirstIconChild(children: ReadonlyArray<{ id: string; type: string; deleted?: boolean }>): { id: string; type: string; deleted?: boolean } | undefined` — 첫 비삭제 Icon 자식 또는 undefined.

- [ ] **Step 1: 헬퍼 테스트 추가 (실패하도록)**

`ButtonChildSection.test.tsx` 에 기존 게이트 describe 블록 아래에 추가:

```tsx
import { findFirstIconChild } from "./ButtonChildSection";

describe("findFirstIconChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstIconChild([])).toBeUndefined();
  });

  it("Icon 자식 없으면 undefined", () => {
    expect(
      findFirstIconChild([
        { id: "t1", type: "Text" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Icon 자식 반환", () => {
    const result = findFirstIconChild([
      { id: "t1", type: "Text" },
      { id: "i1", type: "Icon" },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i1");
  });

  it("삭제된 Icon 은 건너뛴다", () => {
    const result = findFirstIconChild([
      { id: "i1", type: "Icon", deleted: true },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i2");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pnpm --filter @composition/builder exec vitest run src/builder/panels/properties/ButtonChildSection.test.tsx`
Expected: FAIL — `findFirstIconChild` 가 export 되지 않아 import 에러 또는 "is not a function".

- [ ] **Step 3: 헬퍼 구현**

`ButtonChildSection.tsx` 의 `BUTTON_CHILD_HOST_TAGS` export 아래에 추가:

```tsx
/**
 * Button 자식 목록에서 첫 비삭제 Icon element 를 찾는다. 셀렉트 표시값(현재 iconName)
 *   + none/생성/수정 분기 판정의 단일 소스. 자식 없으면 undefined → 셀렉트 "None".
 */
export function findFirstIconChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Icon" && !child.deleted);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @composition/builder exec vitest run src/builder/panels/properties/ButtonChildSection.test.tsx`
Expected: PASS — 게이트 2개 + findFirstIconChild 4개, 총 6 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add apps/builder/src/builder/panels/properties/ButtonChildSection.tsx apps/builder/src/builder/panels/properties/ButtonChildSection.test.tsx
git commit -m "feat(button): findFirstIconChild 헬퍼 — 자식 Icon 해석 단일 소스

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ButtonChildSection 을 Content "Icon" 셀렉트로 재작성

`PropertyIconPicker` 기반 4-way 동기화 셀렉트로 컴포넌트 본체 교체. v1 의 "Add Icon 버튼" UI 제거.

**Files:**

- Modify: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx` (본체 재작성, Task 1 의 `BUTTON_CHILD_HOST_TAGS`/`findFirstIconChild` export 보존)

**Interfaces:**

- Consumes:
  - `findFirstIconChild` (Task 1)
  - `useCanonicalPropertyChildren(elementId: string): PanelNode[]` — `apps/builder/src/builder/panels/properties/hooks/useCanonicalPropertyRead.ts:72`. parent_id 기준 비삭제 자식.
  - `useCanonicalPropertyElement(elementId): PanelNode | undefined` — 동 파일. 게이트용.
  - `PropertyIconPicker` — `apps/builder/src/builder/components/property/PropertyIconPicker.tsx`. props `{ label: string; value?: string; onChange: (iconName: string) => void; onClear?: () => void }`. 빈 value 시 "None" 표시 내장.
  - `PropertySection` — `apps/builder/src/builder/components` re-export. props `{ title: string; id?: string; children }`.
  - store actions via `useStore`: `addElement: (element: Element) => void`, `updateElementProps: (elementId, props) => Promise<void>`, `removeElement: (elementId, options?) => Promise<void>`, `currentPageId: string | null`.
  - `getDefaultProps("Icon")` — `apps/builder/src/types/builder/unified.types.ts`. Icon 기본 props(variant/size/strokeWidth/iconFontFamily + **random iconName**). random iconName 은 사용자 선택값으로 override 한다.
  - `generateCustomId(type, pageElements)` — `apps/builder/src/builder/utils/idGeneration.ts:27`. customId 생성.
  - `withFrameElementMirrorId(element, layoutId)` — `apps/builder/src/builder/adapters/canonical/frameMirror.ts`. canonical mirror id 부여 (FrameSlotSection.handleInsertDefault 와 동일 사용. layoutId 없으면 `null`).
  - `getActiveCanonicalDocument()` + `visitCanonicalDocumentElements(doc, visitor)` — pageElements 수집(generateCustomId 인자용).
- Produces: 재작성된 `ButtonChildSection` (default-less named export 유지). 외부 계약(PropertiesPanel 의 `elementId` prop) 불변.

- [ ] **Step 1: 컴포넌트 본체 재작성**

`ButtonChildSection.tsx` 전체를 아래로 교체 (Task 1 에서 추가한 `findFirstIconChild` 와 `BUTTON_CHILD_HOST_TAGS` 는 그대로 포함):

```tsx
import { memo, useCallback } from "react";
import { PropertySection } from "../../components";
import { PropertyIconPicker } from "../../components/property/PropertyIconPicker";
import { useStore } from "../../stores";
import { getActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import {
  useCanonicalPropertyElement,
  useCanonicalPropertyChildren,
} from "./hooks/useCanonicalPropertyRead";
import { getDefaultProps } from "../../../types/builder/unified.types";
import { generateCustomId } from "../../utils/idGeneration";
import { withFrameElementMirrorId } from "../../adapters/canonical/frameMirror";
import type { Element } from "../../../types/builder/unified.types";

/**
 * Icon 셀렉트 host 태그 (leaf 버튼만). ToggleButtonGroup 은 자식이 ToggleButton
 *   (leaf 버튼)이라 Icon 자식 직접 대상 아님 → 제외. ADR-142: Button=RAC leaf,
 *   아이콘은 자식 element(RSP composite) — binding iconName 복원 0.
 */
export const BUTTON_CHILD_HOST_TAGS: ReadonlySet<string> = new Set([
  "Button",
  "ToggleButton",
]);

/**
 * Button 자식 목록에서 첫 비삭제 Icon element 를 찾는다. 셀렉트 표시값(현재 iconName)
 *   + none/생성/수정 분기 판정의 단일 소스. 자식 없으면 undefined → 셀렉트 "None".
 */
export function findFirstIconChild<
  T extends { id: string; type: string; deleted?: boolean },
>(children: ReadonlyArray<T>): T | undefined {
  return children.find((child) => child.type === "Icon" && !child.deleted);
}

/**
 * Button/ToggleButton 선택 시 Content 영역에 "Icon" 셀렉트(기본 None)를 노출한다.
 *   셀렉트 표시값 = Button 자식 중 첫 Icon element 의 iconName(없으면 None).
 *   - None → 아이콘: 자식 Icon element 생성(미리 만든 id + addElement 직접 호출,
 *     selection 변경 없음) + 선택 iconName 으로 override.
 *   - 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 updateElementProps.
 *   - 아이콘 → None(clear): 자식 Icon element removeElement.
 *   ADR-142 정합: Button.binding 무수정, iconName prop 복원 0. DOM=<Button><Icon/>text</Button>.
 */
export const ButtonChildSection = memo(function ButtonChildSection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const children = useCanonicalPropertyChildren(elementId);
  const addElement = useStore((state) => state.addElement);
  const updateElementProps = useStore((state) => state.updateElementProps);
  const removeElement = useStore((state) => state.removeElement);
  const currentPageId = useStore((state) => state.currentPageId);

  const existingIcon = findFirstIconChild(children);
  const currentIconName =
    (existingIcon?.props as { iconName?: string } | undefined)?.iconName ??
    undefined;

  const handleSelectIcon = useCallback(
    (iconName: string) => {
      if (!iconName) return;

      // 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정.
      if (existingIcon) {
        void updateElementProps(existingIcon.id, { iconName });
        return;
      }

      // None → 아이콘: 자식 Icon element 생성. handleAddElement 대신 직접 addElement —
      //   handleAddElement 는 생성 직후 setSelectedElement 로 Button 선택을 풀어
      //   셀렉트가 사라진다. id 를 미리 만들어 selection 변경 없이 생성.
      const doc = getActiveCanonicalDocument();
      if (!doc || !currentPageId) return;

      const pageElements: Element[] = [];
      visitCanonicalDocumentElements(doc, (el) => {
        pageElements.push(el);
      });

      const iconElement: Element = withFrameElementMirrorId(
        {
          id: crypto.randomUUID(),
          type: "Icon",
          customId: generateCustomId("Icon", pageElements),
          // getDefaultProps("Icon") 의 random iconName 을 사용자 선택값으로 override.
          props: { ...getDefaultProps("Icon"), iconName },
          page_id: currentPageId,
          parent_id: elementId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Element,
        null,
      );

      addElement(iconElement);
    },
    [existingIcon, updateElementProps, currentPageId, elementId, addElement],
  );

  const handleClearIcon = useCallback(() => {
    if (!existingIcon) return;
    void removeElement(existingIcon.id);
  }, [existingIcon, removeElement]);

  if (!element || !BUTTON_CHILD_HOST_TAGS.has(element.type)) return null;

  return (
    <PropertySection title="Content" id="button-icon">
      <PropertyIconPicker
        label="Icon"
        value={currentIconName}
        onChange={handleSelectIcon}
        onClear={handleClearIcon}
      />
    </PropertySection>
  );
});
```

- [ ] **Step 2: 타입 체크**

Run: `pnpm type-check`
Expected: PASS — baseline 위반 수 증가 없음 (신규 위반 0). 만약 `withFrameElementMirrorId` 또는 `getDefaultProps` import 경로 에러가 나면, 실제 export 경로를 grep 으로 재확인 후 import 정정 (`grep -rn "export function withFrameElementMirrorId" apps/builder/src`, `grep -rn "export function getDefaultProps" apps/builder/src/types`).

- [ ] **Step 3: 기존 테스트 통과 확인**

Run: `pnpm --filter @composition/builder exec vitest run src/builder/panels/properties/ButtonChildSection.test.tsx`
Expected: PASS — Task 1 의 6 tests 그대로 통과 (게이트 + findFirstIconChild). 재작성으로 깨지지 않음.

- [ ] **Step 4: 커밋**

```bash
git add apps/builder/src/builder/panels/properties/ButtonChildSection.tsx
git commit -m "feat(button): Content Icon 셀렉트 — 자식 Icon element CRUD (v1 Add Icon 버튼 교체)

PropertyIconPicker 기반 4-way 동기화(읽기/생성/수정/삭제). None 기본값.
생성은 addElement 직접 호출(selection 유지), Button.binding 무수정 — ADR-142 정합.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Live 검증 + CHANGELOG

빌더 실동작으로 4-way 동기화를 exercise 하고(test/type-check 단독 종결 금지 게이트), CHANGELOG 에 v2 엔트리 반영.

**Files:**

- Modify: `docs/CHANGELOG.md`

**Interfaces:**

- Consumes: 빌더 dev 서버(`pnpm dev`), Chrome MCP.
- Produces: 없음 (검증 + 문서).

- [ ] **Step 1: dev 서버 기동 확인**

Run: `pnpm dev` (이미 떠 있으면 재사용)
Expected: 빌더가 localhost 에서 로드.

- [ ] **Step 2: Live exercise (Chrome MCP) — 4-way 동기화 전수**

빌더에서 다음을 순서대로 확인하고 각 결과를 기록:

1. **None 기본값**: text-only Button 추가 → 선택 → Content section 에 "Icon" 셀렉트가 "None" 으로 표시.
2. **None → 아이콘 (생성)**: 셀렉트 클릭 → 아이콘 하나 선택 → (a) Button 안에 Icon 자식 element 생성(레이어 트리 확인), (b) Preview/Skia 에 아이콘 렌더 + Button color 상속, (c) **Button 선택이 유지되어 셀렉트가 사라지지 않음**, (d) 셀렉트 표시값이 선택 아이콘으로 갱신.
3. **아이콘 → 다른 아이콘 (수정)**: 다시 셀렉트 → 다른 아이콘 선택 → 자식 Icon element 가 **새로 생기지 않고**(레이어 트리에 Icon 1개 유지) iconName 만 변경. Preview/Skia 갱신.
4. **아이콘 → None (삭제)**: 셀렉트의 clear(X) → 자식 Icon element 삭제(레이어 트리에서 Icon 사라짐), 셀렉트 "None" 복귀, Preview/Skia 에서 아이콘 사라짐.
5. **게이트**: 비-button(Text) 선택 시 "Icon" 셀렉트 섹션 미표시.
6. 검증용으로 추가한 요소 정리(삭제).

Expected: 6개 항목 모두 PASS. 실패 시 해당 분기 디버깅 후 Task 2 로 회귀.

- [ ] **Step 3: CHANGELOG v2 엔트리 추가**

`docs/CHANGELOG.md` 최상단 엔트리로 추가 (날짜 2026-06-26, 서브섹션 순서 Bug Fixes → Features 준수):

```markdown
## [Button Content Icon 셀렉트 — 자식 element 백킹] - 2026-06-26

### Features

- **Button/ToggleButton 프로퍼티 Content section 에 "Icon" 셀렉트 추가** (기본값 None):
  - Button 선택 시 Content 영역에 `PropertyIconPicker` 기반 Icon 셀렉트 노출
  - None → 아이콘: 자식 Icon element 생성(selection 유지) + 선택 iconName 적용
  - 아이콘 → 다른 아이콘: 기존 자식 Icon 의 iconName 만 수정(중복 생성 없음)
  - 아이콘 → None: 자식 Icon element 삭제
  - **Why**: 직전 v1 "Children section + Add Icon 버튼" 은 Content 와 분리돼 발견성이 낮고 생성만 가능(읽기/수정/삭제 불가)했다. Content 통합 셀렉트로 4-way 동기화 제공
  - **ADR-142 정합**: `Button.binding` 무수정, `iconName` prop 복원 0. 아이콘은 Button 의 자식 Icon element 로만 표현 (DOM `<Button><Icon/>text</Button>`, RAC/RSP 공식 composite 모델)
  - 위치: `apps/builder/src/builder/panels/properties/ButtonChildSection.tsx`
```

- [ ] **Step 4: 커밋**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): Button Content Icon 셀렉트 (자식 element 백킹)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (설계 doc v2 §결정 대비):

- "Content section Text 항목 아래 Icon 셀렉트, 기본 none" → Task 2 (`PropertyIconPicker` value/onChange/onClear). ✓
- "자식 Icon element CRUD (binding 무수정)" → Task 2 4-way 핸들러. ✓
- "중복 가드(이미 있으면 수정만)" → Task 2 `existingIcon` 분기. ✓
- "게이트 Button/ToggleButton" → Task 1 set 보존 + Task 2 게이트. ✓
- "v1 forward-fix 교체(revert 아님)" → Task 2 본체 교체, 새 커밋. ✓
- "live behavior 게이트" → Task 3 6항목 exercise. ✓

**2. Placeholder scan**: "handle edge cases"/"TBD"/"similar to" 없음. 모든 코드 블록 완전체. Step 2 의 import 경로 fallback 은 "에러 시 grep 으로 재확인"이라는 구체 명령(placeholder 아님). ✓

**3. Type consistency**: `findFirstIconChild` 시그니처 Task 1 정의 ↔ Task 2 사용 일치. `BUTTON_CHILD_HOST_TAGS` 동일. `updateElementProps(id, { iconName })` / `removeElement(id)` / `addElement(element)` store 시그니처 일치 (조사 보고서 확인값). `getDefaultProps("Icon")` 반환 IconElementProps spread + iconName override 타입 정합. ✓

## Execution Handoff

Plan complete. 사용자가 이미 "Subagent-Driven 으로 진행" 을 선택한 흐름의 연속이므로 동일 방식으로 실행.
