# ADR-067 Phase 1 — Transform Pilot Implementation Plan

> Historical execution record. The completed ADR's current guidance is maintained in the repository rules and skills.

**Goal:** Transform 섹션과 4개 보조 selector(widthSizeMode/heightSizeMode/parentDisplay/parentFlexDirection/selfAlignmentKeys)를 Jotai atom 의존 없이 Zustand 직접 구독 + Spec 직접 lookup 기반으로 전환해, `computeSyntheticStyle` 호출을 이 섹션에서 완전히 제거한다.

**Architecture:** 3-tier read path (inline / effective / specDefault)를 개별 primitive Zustand selector + `useSyncExternalStore(onLayoutPublished, getSharedLayoutMap)` + `resolveSpecPreset(type, size)` 조합으로 구현. `useShallow` 금지(프로젝트 로컬 ESLint 룰)이므로 object-returning selector 대신 각 값을 개별 hook으로 읽고 `useMemo`로 조립한다. Jotai bridge(`selectedElementAtom`, `buildSelectedElement`)는 Phase 1 범위에서 그대로 유지(다른 섹션이 계속 사용) — TransformSection에서의 **참조만** 제거.

**Tech Stack:** React 19, Zustand 5, Vitest 4, TAG_SPEC_MAP(`apps/builder/src/builder/workspace/canvas/sprites/tagSpecMap.ts`), `getSharedLayoutMap`/`onLayoutPublished`(`apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`).

---

## File Structure

**Create (신규 — 모두 `apps/builder/src/builder/panels/styles/` 아래)**:

- `utils/specPresetResolver.ts` — `resolveSpecPreset(type, size)` + 메모리 캐시
- `utils/specPresetResolver.test.ts` — 단위 테스트
- `hooks/useLayoutValue.ts` — `useSyncExternalStore` 기반 layoutMap 구독
- `hooks/useLayoutValue.test.ts` — 단위 테스트
- `hooks/useTransformValue.ts` — 3-tier 단일 prop hook
- `hooks/useTransformValue.test.tsx` — RTL 테스트
- `hooks/useTransformValues.ts` — Transform 10개 prop 집약 hook (aggregate)
- `hooks/useTransformAuxiliary.ts` — `useWidthSizeMode`/`useHeightSizeMode`/`useParentDisplay`/`useParentFlexDirection`/`useSelfAlignmentKeys`
- `hooks/useTransformAuxiliary.test.tsx` — RTL 테스트

**Modify**:

- `sections/TransformSection.tsx` — 기존 `useTransformValuesJotai` + 4개 `useAtomValue` 제거, 신규 hooks로 교체

**Delete (Phase 1 끝에서)**:

- `hooks/useTransformValuesJotai.ts`

**Note**: `atoms/styleAtoms.ts`의 `widthSizeModeAtom` / `heightSizeModeAtom` / `parentDisplayAtom` / `parentFlexDirectionAtom` / `selfAlignmentKeysAtom`는 **다른 섹션에서 쓰지 않으면** 함께 삭제. 이 plan의 Task 8에서 사용처를 확인 후 결정.

---

## Task 1: `resolveSpecPreset` 유틸리티 (TDD)

**Files:**

- Create: `apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts`
- Test: `apps/builder/src/builder/panels/styles/utils/specPresetResolver.test.ts`

**배경**: `computeSyntheticStyle`이 반환하는 **CSS 문자열**(예: `"120px"`)을 대체해, Spec에서 **숫자 그대로**(예: `120`) 반환하는 얇은 adapter. Transform 섹션이 필요로 하는 프리셋 값은 `width`/`height`/`minWidth`/`maxWidth`/`minHeight`/`maxHeight`/`aspectRatio`.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// specPresetResolver.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { resolveSpecPreset, clearSpecPresetCache } from "./specPresetResolver";

describe("resolveSpecPreset", () => {
  beforeEach(() => clearSpecPresetCache());

  it("returns numeric width/height for Button size=md", () => {
    const preset = resolveSpecPreset("Button", "md");
    expect(typeof preset.width === "number" || preset.width === undefined).toBe(
      true,
    );
    expect(
      typeof preset.height === "number" || preset.height === undefined,
    ).toBe(true);
    // Button 스펙은 height에 고정값이 있음 (size md 기준 32)
    expect(preset.height).toBeGreaterThan(0);
  });

  it("returns {} for unknown tag", () => {
    expect(resolveSpecPreset("UnknownTag", "md")).toEqual({});
  });

  it("returns {} for null element type", () => {
    expect(resolveSpecPreset(undefined, undefined)).toEqual({});
  });

  it("caches by (type, size) — same input returns same reference", () => {
    const a = resolveSpecPreset("Button", "md");
    const b = resolveSpecPreset("Button", "md");
    expect(a).toBe(b);
  });

  it("different size returns different cached entry", () => {
    const md = resolveSpecPreset("Button", "md");
    const lg = resolveSpecPreset("Button", "lg");
    expect(md).not.toBe(lg);
  });

  // L2 (리뷰 지적): flat-spec fallback — sizes 객체 없는 spec 안전 처리
  it("returns {} gracefully when spec has no sizes object (flat-spec fallback)", () => {
    // 일부 spec(ToggleButton/TagGroup 등)은 flat 구조일 수 있음
    // resolveSpecPreset은 sizes[size] 미존재 시 빈 객체 반환해야 한다
    const preset = resolveSpecPreset("ToggleButton", "md");
    // 존재하지 않거나 sizes 미보유 시에도 throw 없이 객체 반환
    expect(preset).toEqual(expect.any(Object));
  });

  it("returns {} when sizes exists but target size key is absent", () => {
    // 예: size="xxl"처럼 해당 컴포넌트에 정의 안 된 size 요청
    const preset = resolveSpecPreset("Button", "xxl");
    expect(preset).toEqual({});
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/utils/specPresetResolver.test.ts
```

Expected: FAIL — "Cannot find module './specPresetResolver'"

- [ ] **Step 3: 최소 구현**

```ts
// specPresetResolver.ts
import { TAG_SPEC_MAP } from "../../../workspace/canvas/sprites/tagSpecMap";

export interface TransformSpecPreset {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  aspectRatio?: number;
}

type CacheKey = string; // `${type}:${size}`
const cache = new Map<CacheKey, TransformSpecPreset>();

export function resolveSpecPreset(
  type: string | undefined,
  size: string | undefined,
): TransformSpecPreset {
  if (!type) return {};
  const key = `${type}:${size ?? "md"}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const spec = TAG_SPEC_MAP[type];
  const preset: TransformSpecPreset = extractTransformPreset(
    spec,
    size ?? "md",
  );
  cache.set(key, preset);
  return preset;
}

export function clearSpecPresetCache(): void {
  cache.clear();
}

function extractTransformPreset(
  spec: unknown,
  size: string,
): TransformSpecPreset {
  // Spec 구조: spec.sizes[size] 또는 spec.dimensions
  // 숫자로만 반환 (CSS 문자열 변환 금지)
  const anySpec = spec as
    | { sizes?: Record<string, Record<string, unknown>> }
    | undefined;
  const sizeEntry = anySpec?.sizes?.[size];
  if (!sizeEntry) return {};
  const preset: TransformSpecPreset = {};
  const numericKeys = [
    "width",
    "height",
    "minWidth",
    "minHeight",
    "maxWidth",
    "maxHeight",
    "aspectRatio",
  ] as const;
  for (const k of numericKeys) {
    const v = sizeEntry[k];
    if (typeof v === "number") preset[k] = v;
  }
  return preset;
}
```

- [ ] **Step 4: 실행 → 통과 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/utils/specPresetResolver.test.ts
```

Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/utils/specPresetResolver.ts apps/builder/src/builder/panels/styles/utils/specPresetResolver.test.ts
git commit -m "feat(styles): add resolveSpecPreset — Spec-direct lookup replacing computeSyntheticStyle"
```

---

## Task 2: `useLayoutValue` 훅 (TDD)

**Files:**

- Create: `apps/builder/src/builder/panels/styles/hooks/useLayoutValue.ts`
- Test: `apps/builder/src/builder/panels/styles/hooks/useLayoutValue.test.ts`

**배경**: `layoutMap`은 Zustand store가 아니라 **module-level singleton** (`getSharedLayoutMap` + `onLayoutPublished`). React 18 `useSyncExternalStore`로 id·key 단위 granular 구독.

- [ ] **Step 1: 실패 테스트 작성**

```ts
// useLayoutValue.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayoutValue } from "./useLayoutValue";
import * as layout from "../../../workspace/canvas/layout/engines/fullTreeLayout";

describe("useLayoutValue", () => {
  let listeners: Array<() => void> = [];
  let currentMap: Map<
    string,
    { width: number; height: number; x: number; y: number }
  > | null = null;

  beforeEach(() => {
    listeners = [];
    currentMap = new Map([["el-1", { width: 120, height: 32, x: 10, y: 20 }]]);
    vi.spyOn(layout, "getSharedLayoutMap").mockImplementation(
      () => currentMap as any,
    );
    vi.spyOn(layout, "onLayoutPublished").mockImplementation(
      (cb: () => void) => {
        listeners.push(cb);
        return () => {
          listeners = listeners.filter((l) => l !== cb);
        };
      },
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns width for existing id", () => {
    const { result } = renderHook(() => useLayoutValue("el-1", "width"));
    expect(result.current).toBe(120);
  });

  it("returns undefined for unknown id", () => {
    const { result } = renderHook(() => useLayoutValue("el-unknown", "width"));
    expect(result.current).toBeUndefined();
  });

  it("updates when layout is re-published", () => {
    const { result } = renderHook(() => useLayoutValue("el-1", "width"));
    expect(result.current).toBe(120);
    act(() => {
      currentMap = new Map([
        ["el-1", { width: 200, height: 32, x: 10, y: 20 }],
      ]);
      listeners.forEach((l) => l());
    });
    expect(result.current).toBe(200);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useLayoutValue("el-1", "width"));
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useLayoutValue.test.ts
```

Expected: FAIL — "Cannot find module './useLayoutValue'"

- [ ] **Step 3: 최소 구현**

```ts
// useLayoutValue.ts
import { useSyncExternalStore, useCallback } from "react";
import {
  getSharedLayoutMap,
  onLayoutPublished,
} from "../../../workspace/canvas/layout/engines/fullTreeLayout";

type LayoutKey = "width" | "height" | "x" | "y";

export function useLayoutValue(
  id: string | null | undefined,
  key: LayoutKey,
): number | undefined {
  const getSnapshot = useCallback(() => {
    if (!id) return undefined;
    const map = getSharedLayoutMap();
    return map?.get(id)?.[key];
  }, [id, key]);
  return useSyncExternalStore(onLayoutPublished, getSnapshot, getSnapshot);
}
```

- [ ] **Step 4: 실행 → 통과 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useLayoutValue.test.ts
```

Expected: PASS (4 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/hooks/useLayoutValue.ts apps/builder/src/builder/panels/styles/hooks/useLayoutValue.test.ts
git commit -m "feat(styles): add useLayoutValue — useSyncExternalStore over layoutMap singleton"
```

---

## Task 3: `useTransformValue` 훅 (3-tier, TDD)

**Files:**

- Create: `apps/builder/src/builder/panels/styles/hooks/useTransformValue.ts`
- Test: `apps/builder/src/builder/panels/styles/hooks/useTransformValue.test.tsx`

**배경**: 단일 prop에 대해 `{ inline, effective, specDefault }` 반환. 각 tier는 개별 primitive selector로 구독 (ESLint `useShallow` 금지 회피).

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// useTransformValue.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTransformValue } from "./useTransformValue";
import { useStore } from "../../../stores/elements";
import * as layout from "../../../workspace/canvas/layout/engines/fullTreeLayout";
import * as preset from "../utils/specPresetResolver";

describe("useTransformValue (width)", () => {
  beforeEach(() => {
    useStore.setState({
      elementsMap: new Map([
        [
          "el-1",
          {
            id: "el-1",
            type: "Button",
            properties: { size: "md", style: { width: "180px" } },
          } as any,
        ],
      ]),
    });
    vi.spyOn(layout, "getSharedLayoutMap").mockReturnValue(
      new Map([["el-1", { width: 120, height: 32, x: 0, y: 0 }]]) as any,
    );
    vi.spyOn(layout, "onLayoutPublished").mockReturnValue(() => {});
    vi.spyOn(preset, "resolveSpecPreset").mockReturnValue({
      width: 100,
      height: 32,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("returns 3-tier object for existing element", () => {
    const { result } = renderHook(() => useTransformValue("el-1", "width"));
    expect(result.current).toEqual({
      inline: "180px",
      effective: 120,
      specDefault: 100,
    });
  });

  it("returns undefined fields for unknown id", () => {
    const { result } = renderHook(() => useTransformValue("unknown", "width"));
    expect(result.current).toEqual({
      inline: undefined,
      effective: undefined,
      specDefault: undefined,
    });
  });

  it("returns null when id is null", () => {
    const { result } = renderHook(() => useTransformValue(null, "width"));
    expect(result.current).toBeNull();
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useTransformValue.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 최소 구현**

```ts
// useTransformValue.ts
import { useMemo } from "react";
import { useStore } from "../../../stores/elements";
import { useLayoutValue } from "./useLayoutValue";
import {
  resolveSpecPreset,
  type TransformSpecPreset,
} from "../utils/specPresetResolver";

export type TransformProp =
  | "width"
  | "height"
  | "top"
  | "left"
  | "minWidth"
  | "maxWidth"
  | "minHeight"
  | "maxHeight"
  | "aspectRatio";

export interface TransformTier {
  inline: string | number | undefined;
  effective: number | undefined;
  specDefault: number | undefined;
}

const LAYOUT_KEY_MAP: Partial<
  Record<TransformProp, "width" | "height" | "x" | "y">
> = {
  width: "width",
  height: "height",
  top: "y",
  left: "x",
};

export function useTransformValue(
  id: string | null,
  prop: TransformProp,
): TransformTier | null {
  // inline (Zustand primitive selector)
  const inline = useStore((s) => {
    if (!id) return undefined;
    const el = s.elementsMap.get(id);
    const style = el?.properties?.style as Record<string, unknown> | undefined;
    return style?.[prop] as string | number | undefined;
  });

  // effective (external store via useLayoutValue)
  const layoutKey = LAYOUT_KEY_MAP[prop];
  const effective = useLayoutValue(id, (layoutKey ?? "width") as any);

  // Spec resolution: primitive selectors for type + size
  const type = useStore((s) => (id ? s.elementsMap.get(id)?.type : undefined));
  const size = useStore((s) => {
    if (!id) return undefined;
    return s.elementsMap.get(id)?.properties?.size as string | undefined;
  });
  const specDefault = useMemo(() => {
    const p: TransformSpecPreset = resolveSpecPreset(type, size);
    return p[prop];
  }, [type, size, prop]);

  return useMemo(() => {
    if (!id) return null;
    return {
      inline,
      effective: layoutKey ? effective : undefined, // min/max/aspect는 layout 결과 없음
      specDefault,
    };
  }, [id, inline, effective, layoutKey, specDefault]);
}
```

- [ ] **Step 4: 실행 → 통과 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useTransformValue.test.tsx
```

Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/hooks/useTransformValue.ts apps/builder/src/builder/panels/styles/hooks/useTransformValue.test.tsx
git commit -m "feat(styles): add useTransformValue — 3-tier read path (inline/effective/specDefault)"
```

---

## Task 4: `useTransformValues` 집약 훅

**Files:**

- Create: `apps/builder/src/builder/panels/styles/hooks/useTransformValues.ts`

**배경**: TransformSection이 10개 prop을 한 번에 소비 (width/height/top/left/min/max + aspectRatio + isBody). `useTransformValue`를 각 prop마다 호출해 `useMemo`로 묶는다. ESLint `useShallow` 금지이므로 object selector 불가 — 개별 hook 조합이 유일한 경로.

- [ ] **Step 1: 구현**

```ts
// useTransformValues.ts
import { useMemo } from "react";
import { useStore } from "../../../stores/elements";
import { useTransformValue, type TransformTier } from "./useTransformValue";

export interface TransformValuesBundle {
  width: TransformTier;
  height: TransformTier;
  top: TransformTier;
  left: TransformTier;
  minWidth: TransformTier;
  maxWidth: TransformTier;
  minHeight: TransformTier;
  maxHeight: TransformTier;
  aspectRatio: TransformTier;
  isBody: boolean;
}

export function useTransformValues(
  id: string | null,
): TransformValuesBundle | null {
  const width = useTransformValue(id, "width");
  const height = useTransformValue(id, "height");
  const top = useTransformValue(id, "top");
  const left = useTransformValue(id, "left");
  const minWidth = useTransformValue(id, "minWidth");
  const maxWidth = useTransformValue(id, "maxWidth");
  const minHeight = useTransformValue(id, "minHeight");
  const maxHeight = useTransformValue(id, "maxHeight");
  const aspectRatio = useTransformValue(id, "aspectRatio");
  const isBody = useStore((s) => {
    if (!id) return false;
    return s.elementsMap.get(id)?.type?.toLowerCase() === "body";
  });

  return useMemo(() => {
    if (!id || !width || !height) return null;
    return {
      width,
      height,
      top: top!,
      left: left!,
      minWidth: minWidth!,
      maxWidth: maxWidth!,
      minHeight: minHeight!,
      maxHeight: maxHeight!,
      aspectRatio: aspectRatio!,
      isBody,
    };
  }, [
    id,
    width,
    height,
    top,
    left,
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    aspectRatio,
    isBody,
  ]);
}
```

- [ ] **Step 2: 타입 체크**

```bash
pnpm type-check
```

Expected: PASS (no errors in new files)

- [ ] **Step 3: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/hooks/useTransformValues.ts
git commit -m "feat(styles): add useTransformValues — Transform 10-prop aggregate"
```

---

## Task 5: 보조 selector 훅 (TDD)

**Files:**

- Create: `apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.ts`
- Test: `apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx`

**배경**: TransformSection이 쓰는 `widthSizeMode` / `heightSizeMode` / `parentDisplay` / `parentFlexDirection` / `selfAlignmentKeys` 5개 atom을 Zustand primitive selector 조합으로 재구현. `inferSizeMode` 유틸은 기존 `styleAtoms.ts`의 import 경로를 재사용.

- [ ] **Step 1: 실패 테스트 작성**

```tsx
// useTransformAuxiliary.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useWidthSizeMode,
  useHeightSizeMode,
  useParentDisplay,
  useParentFlexDirection,
  useSelfAlignmentKeys,
} from "./useTransformAuxiliary";
import { useStore } from "../../../stores/elements";

describe("useTransformAuxiliary", () => {
  beforeEach(() => {
    useStore.setState({
      elementsMap: new Map([
        [
          "el-1",
          {
            id: "el-1",
            type: "Button",
            parentId: "p-1",
            properties: {
              style: {
                width: "180px",
                alignSelf: "center",
                justifySelf: "center",
              },
            },
          } as any,
        ],
        [
          "p-1",
          {
            id: "p-1",
            type: "Frame",
            properties: { style: { display: "flex", flexDirection: "row" } },
          } as any,
        ],
      ]),
    });
  });

  it("useParentDisplay returns parent display", () => {
    const { result } = renderHook(() => useParentDisplay("el-1"));
    expect(result.current).toBe("flex");
  });

  it("useParentFlexDirection returns parent flex-direction", () => {
    const { result } = renderHook(() => useParentFlexDirection("el-1"));
    expect(result.current).toBe("row");
  });

  it("useParentDisplay returns 'block' when no parent", () => {
    const { result } = renderHook(() => useParentDisplay("p-1"));
    expect(result.current).toBe("block");
  });

  it("useWidthSizeMode infers from style + parent context", () => {
    const { result } = renderHook(() => useWidthSizeMode("el-1"));
    // 180px 명시 값 → "fixed"
    expect(result.current).toBe("fixed");
  });

  it("useSelfAlignmentKeys returns ['centerCenter'] for center/center", () => {
    const { result } = renderHook(() => useSelfAlignmentKeys("el-1"));
    expect(result.current).toEqual(["centerCenter"]);
  });

  it("useSelfAlignmentKeys returns [] for block parent", () => {
    useStore.setState((s: any) => {
      const map = new Map(s.elementsMap);
      map.set("p-1", {
        ...map.get("p-1"),
        properties: { style: { display: "block" } },
      });
      return { elementsMap: map };
    });
    const { result } = renderHook(() => useSelfAlignmentKeys("el-1"));
    expect(result.current).toEqual([]);
  });
});
```

- [ ] **Step 2: 실행 → 실패 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx
```

Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// useTransformAuxiliary.ts
import { useMemo } from "react";
import { useStore } from "../../../stores/elements";
import { inferSizeMode, type SizeMode } from "../../../stores/utils/sizeMode";

function useParentId(id: string | null): string | null {
  return useStore((s) =>
    id ? (s.elementsMap.get(id)?.parentId ?? null) : null,
  );
}

export function useParentDisplay(id: string | null): string {
  const parentId = useParentId(id);
  return useStore((s) => {
    if (!parentId) return "block";
    const p = s.elementsMap.get(parentId);
    const style = p?.properties?.style as Record<string, unknown> | undefined;
    return (style?.display as string) ?? "block";
  });
}

export function useParentFlexDirection(id: string | null): string {
  const parentId = useParentId(id);
  return useStore((s) => {
    if (!parentId) return "row";
    const p = s.elementsMap.get(parentId);
    const style = p?.properties?.style as Record<string, unknown> | undefined;
    return (style?.flexDirection as string) ?? "row";
  });
}

function useSizeMode(id: string | null, axis: "width" | "height"): SizeMode {
  const style = useStore((s) => {
    if (!id) return null;
    return (
      (s.elementsMap.get(id)?.properties?.style as Record<
        string,
        unknown
      > | null) ?? null
    );
  });
  const parentDisplay = useParentDisplay(id);
  const parentFlexDirection = useParentFlexDirection(id);
  return useMemo(
    () =>
      style
        ? inferSizeMode(style, axis, parentDisplay, parentFlexDirection)
        : "fit",
    [style, axis, parentDisplay, parentFlexDirection],
  );
}

export function useWidthSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "width");
}
export function useHeightSizeMode(id: string | null): SizeMode {
  return useSizeMode(id, "height");
}

const V_MAP: Record<string, string> = {
  "flex-start": "Top",
  start: "Top",
  center: "Center",
  "flex-end": "Bottom",
  end: "Bottom",
  stretch: "",
};
const H_MAP: Record<string, string> = {
  "flex-start": "left",
  start: "left",
  center: "center",
  "flex-end": "right",
  end: "right",
  stretch: "",
};

export function useSelfAlignmentKeys(id: string | null): string[] {
  const parentDisplay = useParentDisplay(id);
  const alignSelf = useStore((s) => {
    if (!id) return "";
    const style = s.elementsMap.get(id)?.properties?.style as
      | Record<string, unknown>
      | undefined;
    return String(style?.alignSelf ?? "");
  });
  const justifySelf = useStore((s) => {
    if (!id) return "";
    const style = s.elementsMap.get(id)?.properties?.style as
      | Record<string, unknown>
      | undefined;
    return String(style?.justifySelf ?? "");
  });
  return useMemo(() => {
    const isFlexOrGrid =
      parentDisplay === "flex" ||
      parentDisplay === "inline-flex" ||
      parentDisplay === "grid" ||
      parentDisplay === "inline-grid";
    if (!isFlexOrGrid) return [];
    const v = V_MAP[alignSelf] ?? "";
    const h = H_MAP[justifySelf] ?? "";
    if (!v && !h) return [];
    return [`${h}${v}`];
  }, [parentDisplay, alignSelf, justifySelf]);
}
```

- [ ] **Step 4: 실행 → 통과 확인**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx
```

Expected: PASS (6 passed)

- [ ] **Step 5: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.ts apps/builder/src/builder/panels/styles/hooks/useTransformAuxiliary.test.tsx
git commit -m "feat(styles): add useTransformAuxiliary — Zustand-based replacement for 5 atoms"
```

---

## Task 6: TransformSection 전환 (no Jotai)

**Files:**

- Modify: `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx`

**배경**: 기존 `useTransformValuesJotai()` + 5개 `useAtomValue(...)` 호출을 새 hooks로 교체. 인터페이스 유지(기존 `styleValues.*`, `widthMode`, `parentDisplay`, `parentFlexDirection`, `selfAlignmentKeys` 변수 이름을 그대로 사용해 렌더 로직 변경 최소화). `styleValues`의 기존 타입(문자열)과 새 `TransformTier`의 차이를 **로컬 어댑터**로 흡수 (이 Phase에서는 input value = inline 문자열 유지, placeholder hint는 후속 태스크에서).

- [ ] **Step 1: import 블록 교체**

변경 전(발췌 — `sections/TransformSection.tsx:36-45`):

```ts
import { useTransformValuesJotai } from "../hooks/useTransformValuesJotai";
import {
  widthSizeModeAtom,
  heightSizeModeAtom,
  parentDisplayAtom,
  parentFlexDirectionAtom,
  selfAlignmentKeysAtom,
} from "../atoms/styleAtoms";
import { useAtomValue } from "jotai";
```

변경 후:

```ts
import { useTransformValues } from "../hooks/useTransformValues";
import {
  useWidthSizeMode,
  useHeightSizeMode,
  useParentDisplay,
  useParentFlexDirection,
  useSelfAlignmentKeys,
} from "../hooks/useTransformAuxiliary";
import { useStore } from "../../../stores/elements";
// jotai 및 styleAtoms import 제거
```

- [ ] **Step 2: hook 호출부 교체** (`sections/TransformSection.tsx:138-154`)

변경 전:

```ts
const styleValues = useTransformValuesJotai();
// ...
const widthMode = useAtomValue(widthSizeModeAtom);
const heightMode = useAtomValue(heightSizeModeAtom);
const parentDisplay = useAtomValue(parentDisplayAtom);
const parentFlexDirection = useAtomValue(parentFlexDirectionAtom);
const selfAlignmentKeys = useAtomValue(selfAlignmentKeysAtom);
```

변경 후:

```ts
const selectedId = useStore((s) => s.selectedElementId);
const bundle = useTransformValues(selectedId);

// 기존 styleValues 인터페이스 어댑터 (문자열 값)
const styleValues = useMemo(() => {
  if (!bundle) return null;
  const toStr = (v: string | number | undefined, fallback = ""): string =>
    v === undefined || v === null ? fallback : String(v);
  return {
    width: toStr(bundle.width.inline, "auto"),
    height: toStr(bundle.height.inline, "auto"),
    top: toStr(bundle.top.inline, "auto"),
    left: toStr(bundle.left.inline, "auto"),
    minWidth: toStr(bundle.minWidth.inline),
    maxWidth: toStr(bundle.maxWidth.inline),
    minHeight: toStr(bundle.minHeight.inline),
    maxHeight: toStr(bundle.maxHeight.inline),
    aspectRatio: toStr(bundle.aspectRatio.inline),
    isBody: bundle.isBody,
  };
}, [bundle]);

const widthMode = useWidthSizeMode(selectedId);
const heightMode = useHeightSizeMode(selectedId);
const parentDisplay = useParentDisplay(selectedId);
const parentFlexDirection = useParentFlexDirection(selectedId);
const selfAlignmentKeys = useSelfAlignmentKeys(selectedId);
```

- [ ] **Step 3: `useMemo`/`useState` import 확인** (파일 상단에 `import { memo, useCallback, useMemo, useState } from "react";`가 있는지 확인, 없으면 추가)

- [ ] **Step 4: 타입 체크**

```bash
pnpm type-check
```

Expected: PASS (TransformSection.tsx 관련 에러 0)

- [ ] **Step 5: 런타임 검증 (수동)**

```bash
pnpm dev
```

- 빌더에서 Button 요소 추가 → 선택 → Transform 섹션이 기존과 동일하게 표시되는지 확인
- width/height 편집 → 값이 반영되는지 확인
- size mode 전환 (fit/fixed/fill) 동작 확인
- flex 부모 안 자식 선택 → self-alignment 9-grid 동작 확인

- [ ] **Step 6: 커밋**

```bash
git add apps/builder/src/builder/panels/styles/sections/TransformSection.tsx
git commit -m "refactor(styles): TransformSection — replace Jotai atoms with Zustand hooks"
```

---

## Task 7: `useTransformValuesJotai` 삭제 + computeSyntheticStyle 호출 검증

**Files:**

- Delete: `apps/builder/src/builder/panels/styles/hooks/useTransformValuesJotai.ts`
- Verify: no Transform-section call site of `computeSyntheticStyle`

- [ ] **Step 1: 사용처 최종 확인**

```bash
grep -rn "useTransformValuesJotai" /Users/admin/work/composition/apps/builder/src/
```

Expected: 출력 0줄 (Task 6에서 교체 완료)

- [ ] **Step 2: 파일 삭제**

```bash
rm /Users/admin/work/composition/apps/builder/src/builder/panels/styles/hooks/useTransformValuesJotai.ts
```

- [ ] **Step 3: transformValuesAtom 사용처 확인 — 다른 곳에서 안 쓰면 함께 제거**

```bash
grep -rn "transformValuesAtom" /Users/admin/work/composition/apps/builder/src/
```

- 출력이 `styleAtoms.ts`의 **정의 라인 1개뿐**이면 — 해당 export 제거 (Step 4)
- 다른 파일에서 사용 중이면 — 제거하지 말고 이 태스크에서 스킵 (Phase 6에서 최종 정리)

- [ ] **Step 4 (조건부): styleAtoms.ts에서 Transform 전용 atoms 제거**

Task 7 Step 3에서 확인한 **사용처가 정의만인** atom들을 `atoms/styleAtoms.ts`에서 제거:

- `transformValuesAtom`
- `widthSizeModeAtom`, `heightSizeModeAtom`
- `parentDisplayAtom`, `parentFlexDirectionAtom`
- `selfAlignmentKeysAtom`

각 atom 정의 블록(예: L297-332 `transformValuesAtom`)을 블록 단위로 삭제.

- [ ] **Step 5: `computeSyntheticStyle` 호출 경로 검증**

Transform 섹션 렌더 중 `computeSyntheticStyle`이 호출되지 않는지 Chrome DevTools로 확인:

```bash
pnpm dev
```

- Chrome DevTools → Sources → `services/computedStyleService.ts` → `computeSyntheticStyle` 함수 상단에 breakpoint 설정
- 빌더에서 Button 요소 선택 → Transform 섹션만 열어둔 상태
- breakpoint 히트 횟수 **0** 확인
- 다른 섹션(Layout/Appearance 등) 열면 히트 — 정상 (Phase 2+에서 제거 예정)

결과를 다음에 기록:

```bash
mkdir -p docs/adr/evidence
cat > docs/adr/evidence/067-phase1-csy-calls.md <<'EOF'
# ADR-067 Phase 1 — computeSyntheticStyle Call Count

Date: 2026-04-15
Scenario: Button 요소 선택, Transform 섹션만 열림 (다른 섹션 접힘)
Method: Chrome DevTools breakpoint on `computeSyntheticStyle`

| Action | Count |
|---|---|
| 요소 선택 | 0 |
| width 편집 (입력 → blur) | 0 |
| size mode 전환 (fit → fixed) | 0 |

결과: Transform 섹션에서 `computeSyntheticStyle` 호출 완전 제거됨 (G1 (a) 통과).
EOF
```

- [ ] **Step 6: 타입 체크 + 테스트**

```bash
pnpm type-check && pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/
```

Expected: PASS

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor(styles): remove Transform-only Jotai atoms + useTransformValuesJotai

- useTransformValuesJotai.ts 삭제
- transformValuesAtom/widthSizeModeAtom/heightSizeModeAtom/parentDisplayAtom/parentFlexDirectionAtom/selfAlignmentKeysAtom 제거 (Transform 전용)
- G1 (a) 통과: computeSyntheticStyle 호출 0회 (Transform 섹션)

측정: docs/adr/evidence/067-phase1-csy-calls.md"
```

---

## Task 8: G1 (b)(c) 측정 — paint latency + FPS

**Files:**

- Create: `docs/adr/evidence/067-phase1-paint-latency.md`

**배경**: G1 지표 (b) **Transform value resolve 전용 시간** (bridge 비용 제외, React Profiler 기반) + (c) Canvas FPS 60 유지 (drag/resize 중). end-to-end paint latency의 30–40% 개선은 **G3(Phase 6 종결 시점)에서 최종 평가**하므로 본 Task에서 측정하지 않음. Phase 1 단독으로는 bridge가 아직 남아있어 end-to-end 측정 시 bridge 비용이 지배하기 때문.

- [ ] **Step 1: G1 (b) 측정 — Transform value resolve 시간만**

절차:

1. `pnpm dev`로 현 브랜치(Phase 1 적용) 실행
2. React DevTools Profiler 탭에서 Record 시작
3. 빌더에서 100-element 페이지에서 Button 요소 선택 → Transform 섹션 렌더 → 선택 해제 반복 30회
4. 각 사이클에서 **`TransformSectionContent` 컴포넌트의 Actual duration** 수집 (React Profiler의 flamegraph → commit별 component render time)
5. 30 samples의 median / p95 계산

결과를 문서에 기록:

```markdown
## G1 (b) — Transform Value Resolve (React Profiler)

| Sample | TransformSectionContent render (ms) |
| ------ | ----------------------------------- |
| 1–30   | ...                                 |

- median: X ms (통과 조건: ≤ 4ms)
- p95: Y ms (통과 조건: ≤ 8ms)
```

- [ ] **Step 2: G1 (c) FPS 측정 — drag/resize 중 60fps 유지**

절차:

1. `pnpm dev` 유지
2. Chrome DevTools → Rendering → **FPS meter** 체크
3. 요소 하나 선택 → 캔버스에서 **1초 이상 연속 drag** (또는 resize handle로 연속 resize)
4. drag 중 FPS meter가 **60fps에 지속적으로 붙어있는지** 시각 확인 (스크린샷 첨부)

결과:

```markdown
## G1 (c) — Canvas FPS during drag/resize

- scenario: 100-element 페이지, Button 선택 후 1초 연속 drag
- 측정: Chrome DevTools Rendering FPS meter
- 결과: 평균 ~60fps / 최소 ~58fps (스크린샷 첨부)
- 통과: PASS / FAIL
```

- [ ] **Step 3: G1 판정 요약**

```markdown
## G1 종합 판정

- (a) `computeSyntheticStyle` 호출 0회 (Task 7 Step 5 기록 참조): **PASS / FAIL**
- (b) Transform value resolve median ≤ 4ms, p95 ≤ 8ms: **PASS / FAIL**
- (c) drag/resize 중 60fps 유지: **PASS / FAIL**

> end-to-end paint latency 30–40% 개선은 G3(Phase 6 종결)에서 평가. 본 Task 범위 밖.

**최종 판정 (G1): PASS / FAIL**
```

- [ ] **Step 4: 실패 시 대안**

G1 (b) 또는 (c)가 실패하면:

1. `useTransformValue` 내부 `useMemo` 의존성 배열 재검토 (불필요한 재평가 제거)
2. 보조 hook들이 parent element에 대해 중복 selector 호출하는지 확인 → `useParentId` 한 번만 호출 후 전달하는 구조로 재조정
3. `resolveSpecPreset`이 hot path에서 반복 호출되는지 profiling — 필요 시 `useMemo(() => resolveSpecPreset(type, size), [type, size])`가 실제로 키 안정적인지 확인

수정 후 Step 2–3 재측정.

- [ ] **Step 5: 커밋**

```bash
git add docs/adr/evidence/067-phase1-paint-latency.md
git commit -m "measure(adr067): Phase 1 G1 metrics — paint latency + FPS"
```

---

## Task 9: 최종 검증 + ADR-067 Status 업데이트

**Files:**

- (이 시점까지 모든 코드 변경 완료)

- [ ] **Step 1: 전체 type-check**

```bash
pnpm type-check
```

Expected: PASS

- [ ] **Step 2: 관련 테스트 전체 실행**

```bash
pnpm --filter @composition/builder test apps/builder/src/builder/panels/styles/
```

Expected: PASS (Task 1/2/3/5 테스트 모두 통과)

- [ ] **Step 3: Storybook smoke (있는 경우)**

```bash
pnpm storybook
```

- Transform 섹션이 포함된 스토리(PropertyPanel 등) 정상 렌더 확인

- [ ] **Step 4: Preview/Publish 시각 회귀 확인**

```bash
pnpm dev
```

- Preview iframe에서 Button, Frame, Flex 컨테이너 렌더 결과가 Phase 1 이전과 동일한지 시각 비교
- Spec을 거치지 않는 쓰기 경로(`updateElementProps`)가 변경되지 않았으므로 회귀 없어야 함

- [ ] **Step 5: ADR-067 Status 업데이트 (있으면)**

`/new-adr` skill로 ADR-067이 이미 생성되어 있으면 Status를 `Proposed` → `Phase 1 Implemented`로 갱신, `docs/adr/README.md`의 진행 상태도 갱신. 아직 ADR-067이 없으면 이 Task는 스킵하고 별도 세션에서 `/new-adr`로 생성.

- [ ] **Step 6: 메모리 업데이트**

```bash
cat >> /Users/admin/.claude/projects/-Users-admin-work-composition/memory/MEMORY.md <<'EOF'

## Skia-native Style Panel 전환

- [ADR-067 Phase 1 완료](../../completed/067-style-panel-skia-native-read-path.md) — Transform 섹션 Zustand 직접 전환. computeSyntheticStyle 호출 0회 달성, Jotai Transform atoms 제거 (2026-04-15)
EOF
```

별도 메모리 파일 작성:

```bash
cat > /Users/admin/.claude/projects/-Users-admin-work-composition/memory/adr067-phase1-transform-pilot.md <<'EOF'
---
name: ADR-067 Phase 1 — Transform Pilot
description: 스타일 패널 Skia-native read path 전환 — Transform 섹션 Zustand 직접 전환 완료
type: project
---

## 결정 / 사실

Transform 섹션과 보조 selector 5종(widthSizeMode/heightSizeMode/parentDisplay/parentFlexDirection/selfAlignmentKeys)을 Jotai atom에서 Zustand primitive selector + useSyncExternalStore(layoutMap) + resolveSpecPreset으로 전환.

**Why:** ESLint 룰이 useStore(useShallow())를 금지하므로 object selector 대신 개별 primitive selector + useMemo 조합 사용. computeSyntheticStyle의 CSS 흉내 레이어를 Spec 직접 lookup으로 대체.

**How to apply:** Phase 2(Layout/Spacing), Phase 3(Typography), Phase 4(Appearance + propagation), Phase 5(Fill), Phase 6(ComponentState + bridge 제거) 진행 시 동일 패턴 복제. 모든 섹션 hook은 primitive selector + useMemo 조립 필수.

## 참조

- 측정: `docs/adr/evidence/067-phase1-*.md`
EOF
```

- [ ] **Step 7: 최종 커밋**

```bash
git add /Users/admin/.claude/projects/-Users-admin-work-composition/memory/
git commit -m "memory(adr067): Phase 1 transform pilot complete"
```

---

## Success Criteria (Phase 1)

- [ ] Task 1–5 모든 단위 테스트 통과
- [ ] Task 6의 수동 검증(size mode 전환, self-alignment 9-grid)이 기존과 동등 동작
- [ ] Task 7 Step 5에서 `computeSyntheticStyle` 호출 **0회** 기록 확인 (G1 (a))
- [ ] Task 8에서 G1 (b) median 30–40% 개선 또는 ≤ 8ms + p95 회귀 없음
- [ ] Task 8에서 G1 (c) Canvas FPS 60 유지 시각 확인
- [ ] Task 9 Step 1–4 모든 검증 통과
- [ ] Preview/Publish 렌더 회귀 0

## Non-goals (이 plan 범위 밖)

- Layout/Typography/Spacing/Appearance/Fill/ComponentState 섹션 이관 (Phase 2–5)
- `useZustandJotaiBridge` / `buildSelectedElement` / `selectedElementAtom` 제거 (Phase 6)
- `package.json`에서 `jotai` dependency 제거 (Phase 6)
- Placeholder hint UI (effective/specDefault로 placeholder 표시) — 후속 UX 개선 작업으로 분리

## Dependencies / Preconditions

- ADR-067이 승인되어 있음
- 프로젝트 로컬 ESLint 룰이 `useStore(useShallow(...))`를 금지함을 숙지 (`apps/builder/eslint-local-rules/index.js:55-80`)
- `getSharedLayoutMap` / `onLayoutPublished` API가 안정적 (ADR-100 Phase 6 완료 이후)

---

# Phase 2: Layout + Spacing 섹션 이관

**Base**: Phase 1 완료 (HEAD `437a4adb`). Transform 패턴 복제.

**대상**: `apps/builder/src/builder/panels/styles/sections/LayoutSection.tsx` (Spacing 통합됨 — Layout 6 props + Spacing 10 props = 16 props)

**제거 atoms** (`atoms/styleAtoms.ts`):

- `layoutValuesAtom` (16 props 집약)
- `flexDirectionKeysAtom` / `flexAlignmentKeysAtom` / `justifyContentSpacingKeysAtom` / `flexWrapKeysAtom`
- 개별 `paddingTopAtom` ~ `marginLeftAtom` (8개) — LayoutSection 외 미사용 확인 후 제거
- `useLayoutValuesJotai.ts` 삭제

**신규 훅**:

- `useLayoutValues()` — 6 layout + 10 spacing 집약 (3-tier: inline / effective / specDefault)
- `useLayoutAuxiliary()` — 4 derived key arrays (flexDirection, flexAlignment, justifyContentSpacing, flexWrap)

## **Phase 1 계획 수정사항 적용 (필수)**

1. **Element 스키마**: `el.tag` / `el.props` / `el.parent_id` (NOT `type`/`properties`/`parentId`)
2. **useStore 경로**: `from "../../../stores"` (composed). `stores/elements` 사용 금지

## Task 분할

### Task 1: `specPresetResolver` Layout preset 확장

- `LayoutSpecPreset` 인터페이스 추가 (gap, paddingTop/Right/Bottom/Left, marginTop/Right/Bottom/Left — number)
- `resolveLayoutSpecPreset(type, size)` 함수 추가 (기존 Transform resolver와 동일 패턴, 별도 캐시)
- 단위 테스트: 실존 spec 1개 (gap 있음) + flat spec fallback + missing type → {}

### Task 2: `useLayoutValues` 훅

- 16 props × 3-tier 집약, primitive selector + useSyncExternalStore + resolveLayoutSpecPreset
- 리턴: `{ [prop]: { inline, effective, specDefault } }` 구조 (Phase 1 `useTransformValues`와 동형)
- 테스트: inline 우선 / layout fallback / specDefault fallback

### Task 3: `useLayoutAuxiliary` 훅

- `useFlexDirectionKeys` / `useFlexAlignmentKeys` / `useJustifyContentSpacingKeys` / `useFlexWrapKeys`
- primitive selector로 display/flexDirection/justifyContent/alignItems 구독 후 useMemo 조립
- 테스트: display=block → ["block"], flex row center-left → ["leftCenter"] 등

### Task 4: LayoutSection 전환

- `useLayoutValuesJotai()` + 4 `useAtomValue` 제거
- `useLayoutValues()` + `useLayoutAuxiliary()` 사용
- 기존 string 인터페이스 유지용 adapter `styleValues` useMemo (Phase 1 패턴 그대로)
- 수동 검증: display 토글 / alignment 9-grid / padding/margin 값 표시

### Task 5: Jotai atoms 제거

- `layoutValuesAtom` + 4 keys atoms 삭제
- 개별 padding*/margin* atoms 사용처 grep → 없으면 삭제
- `useLayoutValuesJotai.ts` 삭제 + `hooks/index.ts`(있다면) export 정리

### Task 6: G1 (a)(b) 측정

- Layout 섹션만 펼친 상태 (`localStorage.styles-panel-collapse` transform+others collapsed)
- (a) `computeSyntheticStyle` 호출 0회 (계측 후 revert)
- (b) resolve 시간 median ≤ 4ms / p95 ≤ 8ms (30 samples 권장, 분포 안정 시 12+ OK)

### Task 7: 문서화

- `docs/adr/evidence/067-phase2-g1-metrics.md` 작성
- ADR-067 Status에 "Phase 2 Implemented — YYYY-MM-DD" 추가
- memory `adr067-phase2-layout-spacing.md` 신규 + `next-session-prompt.md` Phase 3용 갱신
