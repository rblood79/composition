import { describe, expect, it } from "vitest";
import { resolveResponsiveLayoutNode } from "./resolveResponsive";
import type { CanvasLayoutNode } from "./layoutNode";

function node(
  props: Record<string, unknown>,
  responsive?: CanvasLayoutNode["responsive"],
): CanvasLayoutNode {
  return { id: "n1", type: "Frame", props, responsive };
}

describe("resolveResponsiveLayoutNode (ADR-154)", () => {
  it("desktop 은 원본 identity 반환 (무변경)", () => {
    const n = node(
      { style: { flexDirection: "row" } },
      { styles: { flexDirection: { tablet: "column" } } },
    );
    expect(resolveResponsiveLayoutNode(n, "desktop")).toBe(n);
  });

  it("responsive 없으면 원본 identity 반환", () => {
    const n = node({ style: { flexDirection: "row" } });
    expect(resolveResponsiveLayoutNode(n, "tablet")).toBe(n);
  });

  it("override 없는 breakpoint 는 원본 identity 반환", () => {
    const n = node(
      { style: { flexDirection: "row" } },
      { styles: { flexDirection: { mobile: "column" } } },
    );
    // tablet override 부재 + cascade 는 desktop(=base row) → 변화 없음
    expect(resolveResponsiveLayoutNode(n, "tablet")).toBe(n);
  });

  it("tablet 직접 override 를 base 에 merge (새 노드)", () => {
    const n = node(
      { style: { flexDirection: "row", color: "red" } },
      { styles: { flexDirection: { tablet: "column" } } },
    );
    const out = resolveResponsiveLayoutNode(n, "tablet");
    expect(out).not.toBe(n);
    expect((out.props.style as Record<string, unknown>).flexDirection).toBe(
      "column",
    );
    // 비-override 필드는 보존
    expect((out.props.style as Record<string, unknown>).color).toBe("red");
    // 원본 불변 (non-mutating)
    expect((n.props.style as Record<string, unknown>).flexDirection).toBe(
      "row",
    );
  });

  it("mobile 은 tablet→desktop cascade fallback", () => {
    const n = node(
      { style: { flexDirection: "row" } },
      { styles: { flexDirection: { tablet: "column" } } },
    );
    // mobile 값 없음 → tablet(column) fallback
    const out = resolveResponsiveLayoutNode(n, "mobile");
    expect((out.props.style as Record<string, unknown>).flexDirection).toBe(
      "column",
    );
  });

  it("gap shorthand override → rowGap/columnGap longhand 분배 (ADR-909)", () => {
    const n = node(
      { style: { rowGap: 8, columnGap: 8 } },
      { styles: { gap: { tablet: 16 } } },
    );
    const out = resolveResponsiveLayoutNode(n, "tablet");
    const style = out.props.style as Record<string, unknown>;
    expect(style.rowGap).toBe(16);
    expect(style.columnGap).toBe(16);
    expect(style.gap).toBeUndefined();
  });

  it("padding shorthand override → 4-way longhand 분배", () => {
    const n = node({ style: {} }, { styles: { padding: { tablet: 24 } } });
    const out = resolveResponsiveLayoutNode(n, "tablet");
    const style = out.props.style as Record<string, unknown>;
    expect(style.paddingTop).toBe(24);
    expect(style.paddingRight).toBe(24);
    expect(style.paddingBottom).toBe(24);
    expect(style.paddingLeft).toBe(24);
    expect(style.padding).toBeUndefined();
  });

  it("visibility false → display:none (cascade)", () => {
    const n = node(
      { style: { display: "flex" } },
      { visibility: { mobile: false } },
    );
    const out = resolveResponsiveLayoutNode(n, "mobile");
    expect((out.props.style as Record<string, unknown>).display).toBe("none");
  });

  it("visibility true 는 display 무변경", () => {
    const n = node(
      { style: { display: "flex" } },
      { visibility: { mobile: true } },
    );
    // 유일 override 가 no-op → 원본 identity
    expect(resolveResponsiveLayoutNode(n, "mobile")).toBe(n);
  });
});
