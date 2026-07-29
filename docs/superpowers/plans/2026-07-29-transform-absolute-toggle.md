# Transform Absolute Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform의 기존 position action을 `LayoutFreeform` 아이콘의
`position: absolute` 토글로 연결한다.

**Architecture:** `useTransformValues`가 canonical style context에서 `position`
tier를 읽고, `TransformSection`이 기존 `SwatchIconToggleButton`으로 상태를
표시한다. 쓰기는 기존 `updateStyleImmediate`를 사용해 active breakpoint,
history, persistence, layout invalidation 경로를 보존한다.

**Tech Stack:** React 19, TypeScript, React Aria Components, Zustand, Vitest,
Testing Library, Lucide React

## Global Constraints

- `Box Shadow`의 `Inset shadow`와 동일한 `SwatchIconToggleButton` 패턴을 사용한다.
- 활성화는 `position: "absolute"`, 비활성화는 `position: ""`이다.
- flex/inline-flex 자식의 활성화는 mutation 직전 scene x/y를 parent-local
  `left`/`top` px로 캡처해 `position`과 batch 저장한다.
- 비활성화는 `left`와 `top`을 변경하지 않는다.
- `fixed`, `relative`, `right`, `bottom`, 부모 style 변경은 범위 밖이다.
- 사용자가 요청하지 않았으므로 commit이나 push를 수행하지 않는다.

---

### Task 1: Transform position read contract와 토글 회귀 테스트

**Files:**

- Modify: `apps/builder/src/builder/panels/styles/sections/TransformSection.test.tsx`
- Modify: `apps/builder/src/builder/panels/styles/hooks/useTransformValues.ts`

**Interfaces:**

- Consumes: `useElementStyleContext(id).style.position`
- Produces: `TransformValuesBundle.position: TransformTier`

- [x] **Step 1: 비활성 토글의 failing test 작성**

```tsx
it("enables absolute positioning from the position action", () => {
  const updateSelectedStyle = vi.fn();
  useStore.setState({ updateSelectedStyle } as never);

  render(<TransformSection />);

  const toggle = screen.getByRole("button", { name: "Absolute position" });
  expect(toggle.getAttribute("aria-pressed")).toBe("false");
  toggle.click();
  expect(updateSelectedStyle).toHaveBeenCalledWith("position", "absolute");
});
```

- [x] **Step 2: 활성 토글의 failing test 작성**

```tsx
it("disables absolute positioning without clearing offsets", () => {
  const updateSelectedStyle = vi.fn();
  setTestElements([
    {
      id: "button-1",
      type: "Button",
      parent_id: "frame-1",
      props: {
        style: {
          width: "200px",
          height: "100px",
          position: "absolute",
          left: "24px",
          top: "12px",
        },
      },
    } as Element,
    {
      id: "frame-1",
      type: "Frame",
      parent_id: null,
      props: { style: { display: "flex", flexDirection: "row" } },
    } as Element,
  ]);
  useStore.setState({ updateSelectedStyle } as never);

  render(<TransformSection />);

  const toggle = screen.getByRole("button", { name: "Absolute position" });
  expect(toggle.getAttribute("aria-pressed")).toBe("true");
  toggle.click();
  expect(updateSelectedStyle).toHaveBeenCalledWith("position", "");
  expect(updateSelectedStyle).not.toHaveBeenCalledWith("left", "");
  expect(updateSelectedStyle).not.toHaveBeenCalledWith("top", "");
});
```

- [x] **Step 3: focused test를 실행해 RED 확인**

Run:

```bash
pnpm exec vitest run apps/builder/src/builder/panels/styles/sections/TransformSection.test.tsx
```

Expected: `Absolute position` 버튼이 없어 두 테스트가 실패한다.

- [x] **Step 4: `useTransformValues`에 position tier 추가**

```ts
export interface TransformValuesBundle {
  // existing tiers
  position: TransformTier;
  isBody: boolean;
}

return {
  // existing tiers
  position: tier("position"),
  isBody,
};
```

### Task 2: Absolute ToggleButton 구현

**Files:**

- Create: `apps/builder/src/builder/components/icons/LayoutFreeform.tsx`
- Modify: `apps/builder/src/builder/components/icons/index.ts`
- Modify: `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`
- Modify: `apps/builder/src/builder/stores/utils/responsiveWriteRouting.ts`
- Modify: `apps/builder/src/builder/stores/responsiveWriteRouting.test.ts`
- Modify: `packages/shared/src/types/responsive.types.ts`

**Interfaces:**

- Consumes: `bundle.position.inline`, `bundle.position.specDefault`
- Produces: React Aria `SwatchIconToggleButton` with
  `onChange(isSelected: boolean): void`

- [x] **Step 1: position 값을 Transform style adapter에 추가**

```ts
position: toStr(
  bundle.position.inline,
  bundle.position.specDefault,
  "static",
),
```

- [x] **Step 2: 기존 action을 absolute toggle로 교체**

```tsx
<SwatchIconToggleButton
  aria-label="Absolute position"
  isSelected={styleValues.position === "absolute"}
  onChange={(isSelected) =>
    updateStyleImmediate("position", isSelected ? "absolute" : "")
  }
>
  <LayoutFreeform
    color={iconProps.color}
    size={iconProps.size}
    strokeWidth={iconProps.strokeWidth}
  />
</SwatchIconToggleButton>
```

- [x] **Step 3: 설치본에 없는 LayoutFreeform을 공식 path로 로컬 구현**

`apps/builder/src/builder/components/icons/LayoutFreeform.tsx`에 Lucide 공식
`layout-freeform.svg`의 세 `rect` path를 추가하고 icons barrel에서 export한다.

- [x] **Step 4: Transform reset/dirty와 responsive allowlist에 position 추가**

```ts
const TRANSFORM_PROPS = [
  "width",
  "height",
  "position",
  "top",
  "left",
  // existing properties
];
```

`packages/shared/src/types/responsive.types.ts`의
`SECTION_EDITABLE_RESPONSIVE_PROPS`에도 `position`을 추가하고, valueless
responsive toggle의 seed가 잘못된 `"auto"`가 되지 않도록
`ENUM_SEED_DEFAULTS.position`을 `"static"`으로 고정한다.

- [x] **Step 5: focused test를 실행해 GREEN 확인**

Run:

```bash
cd apps/builder
pnpm exec vitest run src/builder/panels/styles/sections/TransformSection.test.tsx src/builder/panels/styles/sections/responsiveEligible.static.test.ts
```

Expected: 10 tests 통과, console error/warning 없음.

### Task 3: 사용자 가시 변경 기록과 전체 검증

**Files:**

- Modify: `docs/CHANGELOG.md`

**Interfaces:**

- Consumes: 구현된 Transform absolute toggle
- Produces: 사용자 가시 변경 기록과 검증 근거

- [x] **Step 1: Changelog에 Absolute toggle 추가**

`2026-07-29` 항목에 Transform의 기존 position action을 `LayoutFreeform`
토글로 연결했다는 내용과 `Left`/`Top` 보존 계약을 기록한다.

- [x] **Step 2: 변경 파일 포맷과 diff 검증**

Run:

```bash
pnpm run codex:format
git diff --check
```

- [x] **Step 3: TypeScript와 보호 파일 검증**

Run:

```bash
pnpm run codex:typecheck
pnpm run codex:guard
```

- [x] **Step 4: cross-check**

기존 `fullTreeLayout.ts`, composition engine absolute placement,
`useDragBridge.ts`, Preview `toReactStyle` 소비 경로가 `position`, `left`, `top`
저장값을 그대로 소비하며 추가 렌더러 변경이 필요 없는지 확인한다.

- [x] **Step 5: 실제 Builder UI 계약 검증**

일반 요소를 선택해 `Absolute position`을 켜고 끄며 다음을 확인한다.

- 토글 selected state
- `Left`/`Top` 값 보존
- console error/warning 없음

### Task 4: Flex 자식의 Absolute 활성화 위치 보존

**Files:**

- Modify: `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`
- Modify: `apps/builder/src/builder/panels/styles/sections/TransformSection.test.tsx`
- Modify: `docs/CHANGELOG.md`

**Interfaces:**

- Consumes: `useStore.getState().selectedElementId`, selected element
  `parent_id`, `useParentDisplay(selectedId)`, `getSceneBounds(elementId)`
- Produces:
  `resolveAbsolutePositionActivationStyles(elementBounds, parentBounds)` and
  one `updateStylesImmediate({ position: "absolute", left, top })` commit

- [x] **Step 1: flex 자식의 현재 위치가 parent-local offset으로 batch 저장되는 failing test 작성**

```tsx
getSceneBoundsMock.mockImplementation((id) =>
  id === "button-1"
    ? { x: 160, y: 95, width: 200, height: 100 }
    : id === "frame-1"
      ? { x: 100, y: 50, width: 600, height: 400 }
      : undefined,
);

toggle.click();

expect(updateSelectedStyles).toHaveBeenCalledWith({
  position: "absolute",
  left: "60px",
  top: "45px",
});
```

- [x] **Step 2: focused test를 실행해 RED 확인**

Run:

```bash
cd apps/builder
pnpm exec vitest run src/builder/panels/styles/sections/TransformSection.test.tsx
```

Expected: 기존 구현이 `updateSelectedStyle("position", "absolute")`만 호출해 실패한다.

- [x] **Step 3: 현재 scene 좌표를 flex parent-local px로 변환해 batch commit**

```ts
const elementBounds = getSceneBounds(elementId);
const parentBounds = getSceneBounds(element.parent_id);
const activationStyles = resolveAbsolutePositionActivationStyles(
  elementBounds,
  parentBounds,
);
updateStylesImmediate(activationStyles);
```

`resolveAbsolutePositionActivationStyles`는 최대 소수점 셋째 자리까지 안정적으로
직렬화하며 `{ position: "absolute", left, top }`을 반환한다.

- [x] **Step 4: bounds 미확보 fallback과 비활성화 offset 보존 테스트 작성**

flex parent이지만 element 또는 parent bounds가 없으면
`updateSelectedStyle("position", "absolute")`만 호출한다. 비활성화는 기존대로
`updateSelectedStyle("position", "")`만 호출하고 `left`/`top`을 지우지 않는다.

- [x] **Step 5: focused test를 실행해 GREEN 확인**

Run:

```bash
cd apps/builder
pnpm exec vitest run src/builder/panels/styles/sections/TransformSection.test.tsx src/builder/workspace/canvas/hooks/useDragBridge.test.ts
```

Expected: 모든 테스트 통과.

- [x] **Step 6: 실제 Builder와 전체 gate 검증**

flex row의 자식을 Absolute로 전환해 전후 selection bounds의 x/y가 같은지 확인하고,
`Left`/`Top` 값과 Undo 복원, console error/warning을 함께 확인한다.

Run:

```bash
pnpm run codex:preflight
```
