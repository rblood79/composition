import { describe, expect, it } from "vitest";
import type { Element } from "../../../../../../types/core/store.types";
import { applyImplicitStyles } from "../implicitStyles";

/**
 * ADR-923 Phase 5 후속 착수 3 (2026-09-03): reusable frame (layout) 모드의 Slot placeholder 높이.
 *
 * DOM `.react-aria-Slot` 은 generated Slot.css (잔존 spec `Slot.spec.ts` sizes) 가 `height: 60px`
 * (sm 40 · lg 80) 를 준다. Canvas 는 Slot 이 자식 없는 컨테이너라 content 0 — spec sizes.height 가
 * layout 에 주입되지 않아 placeholder 가 보이지 않았다 (HC2 rect 실측 DOM 400×60 vs Canvas 400×0).
 * `minHeight` 로 주입한다 — 레이아웃 템플릿 Slot 인라인 (`minHeight: 60` · content slot `flex: 1`) 과
 * 같은 계약이라 flex 로 늘어나는 slot 을 고정 높이로 누르지 않는다. page 모드의 Slot 은
 * `_slotChrome: "hidden"` (resolvePageWithFrame) 이고 DOM 은 `.preview-slot` (content 높이) 라
 * 주입하지 않는다.
 */
function makeSlot(props: Record<string, unknown>): Element {
  return {
    id: "slot-1",
    type: "Slot",
    props: { name: "content", ...props },
    childrenIds: [],
  } as Element;
}

function styleOf(props: Record<string, unknown>): Record<string, unknown> {
  const slot = makeSlot(props);
  const { effectiveParent } = applyImplicitStyles(
    slot,
    [],
    () => [],
    new Map([[slot.id, slot]]),
  );
  return (effectiveParent.props?.style ?? {}) as Record<string, unknown>;
}

describe("Slot applyImplicitStyles — layout 모드 placeholder 높이 (spec sizes.height)", () => {
  it("chrome 보이는 Slot (layout 모드) → minHeight 60 (md 기본), height 는 안 넣는다", () => {
    const st = styleOf({});
    expect(st.minHeight).toBe(60);
    expect(st.height).toBeUndefined();
  });

  it("size sm → 40 · lg → 80", () => {
    expect(styleOf({ size: "sm" }).minHeight).toBe(40);
    expect(styleOf({ size: "lg" }).minHeight).toBe(80);
  });

  it("page 모드 (_slotChrome hidden) → 미주입 (DOM .preview-slot 은 content 높이)", () => {
    expect(styleOf({ _slotChrome: "hidden" }).minHeight).toBeUndefined();
  });

  it("사용자 명시 height / minHeight 우선 — 템플릿 content slot (flex 1 · minHeight 60) 은 그대로", () => {
    expect(styleOf({ style: { height: 120 } }).minHeight).toBeUndefined();
    const tpl = styleOf({ style: { flex: 1, minHeight: 60 } });
    expect(tpl.minHeight).toBe(60);
    expect(tpl.height).toBeUndefined();
    expect(tpl.flex).toBe(1);
  });
});
