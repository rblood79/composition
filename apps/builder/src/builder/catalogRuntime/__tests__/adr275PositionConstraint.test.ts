import { describe, expect, it } from "vitest";
import {
  CATALOG_CENTER_ALIGN,
  catalogPositionLayoutWrites,
  catalogReadPositionConstraint,
  type CatalogAxisConstraint,
} from "../positionConstraint";

/**
 * ADR-275 Decision 2 · breakdown §2 — the constraint ↔ inset correspondence (hand oracle: a 400 ×
 * 300 containing block, a 100 × 50 box). The constraint is read from the insets; writing the box
 * at its drawn place keeps it, and reading the written layout gives the same constraint back.
 */
const CB = { width: 400, height: 300 };
const CENTER = CATALOG_CENTER_ALIGN;

/** The resolved layout after `writes` (set values over `layout`, removed · masked keys gone). */
function apply(
  layout: Record<string, string>,
  writes: ReturnType<typeof catalogPositionLayoutWrites>,
): Record<string, string> {
  const next = { ...layout };
  for (const [key, write] of Object.entries(writes)) {
    if (write?.kind === "set") next[key] = write.value;
    else delete next[key];
  }
  return next;
}

describe("ADR-275 position constraint — read", () => {
  it.each<
    [Record<string, string>, CatalogAxisConstraint, CatalogAxisConstraint]
  >([
    [{}, "start", "start"],
    [{ insetLeft: "24px", insetTop: "8px" }, "start", "start"],
    [{ insetRight: "24px", insetBottom: "8px" }, "end", "end"],
    [{ insetLeft: "24px", insetRight: "24px" }, "both", "start"],
    [
      {
        insetLeft: "20px",
        insetRight: "-20px",
        justifySelf: CENTER,
        insetTop: "0px",
        insetBottom: "0px",
        alignSelf: CENTER,
      },
      "center",
      "center",
    ],
    // Not opposite insets, or no self alignment: Left+Right (an axis reads one constraint).
    [
      { insetLeft: "20px", insetRight: "10px", justifySelf: CENTER },
      "both",
      "start",
    ],
    [
      { insetLeft: "10%", insetRight: "-10%", justifySelf: CENTER },
      "center",
      "start",
    ],
    [{ insetLeft: "auto", insetRight: "8px" }, "end", "start"],
  ])("%o → %s / %s", (layout, x, y) => {
    expect(catalogReadPositionConstraint(layout)).toEqual({ x, y });
  });
});

describe("ADR-275 position constraint — write (breakdown §2)", () => {
  const write = (
    layout: Record<string, string>,
    box: { x: number; y: number; width?: number; height?: number },
    breakpoint?: "desktop" | "tablet",
  ) =>
    catalogPositionLayoutWrites({
      layout,
      constraint: catalogReadPositionConstraint(layout),
      box: { width: 100, height: 50, ...box },
      cb: CB,
      breakpoint,
    });

  it("Left 24 · Right 24 · Left+Right · Center 0 · Center +20 · Left 10 %", () => {
    expect(
      write({ insetLeft: "0px", insetTop: "0px" }, { x: 24, y: 8 }),
    ).toEqual({
      insetLeft: { kind: "set", value: "24px" },
      insetTop: { kind: "set", value: "8px" },
    });
    expect(
      write({ insetRight: "0px", insetBottom: "0px" }, { x: 276, y: 242 }),
    ).toEqual({
      insetRight: { kind: "set", value: "24px" },
      insetBottom: { kind: "set", value: "8px" },
    });
    expect(
      write(
        { insetLeft: "0px", insetRight: "0px", insetTop: "0px" },
        { x: 24, y: 0, width: 352 },
      ),
    ).toMatchObject({
      insetLeft: { kind: "set", value: "24px" },
      insetRight: { kind: "set", value: "24px" },
    });
    const center = {
      insetLeft: "0px",
      insetRight: "0px",
      justifySelf: CENTER,
      insetTop: "0px",
      insetBottom: "0px",
      alignSelf: CENTER,
    };
    expect(write(center, { x: 150, y: 125 })).toEqual({
      insetLeft: { kind: "set", value: "0px" },
      insetRight: { kind: "set", value: "0px" },
      justifySelf: { kind: "set", value: CENTER },
      insetTop: { kind: "set", value: "0px" },
      insetBottom: { kind: "set", value: "0px" },
      alignSelf: { kind: "set", value: CENTER },
    });
    expect(write(center, { x: 170, y: 105 })).toMatchObject({
      insetLeft: { kind: "set", value: "20px" },
      insetRight: { kind: "set", value: "-20px" },
      insetTop: { kind: "set", value: "-20px" },
      insetBottom: { kind: "set", value: "20px" },
    });
    // A `%` side keeps its unit (of the containing block).
    expect(
      write({ insetLeft: "5%", insetTop: "0px" }, { x: 40, y: 0 }),
    ).toMatchObject({
      insetLeft: { kind: "set", value: "10%" },
    });
  });

  it("a px margin is outside the inset (CSS: border-box x = inset + margin)", () => {
    expect(
      write(
        { insetLeft: "0px", insetTop: "0px", marginLeft: "6px" },
        { x: 30, y: 0 },
      ),
    ).toMatchObject({ insetLeft: { kind: "set", value: "24px" } });
  });

  it("the overflowing Center (사용자 결정 4): a box wider than its containing block keeps its offset", () => {
    expect(
      write(
        {
          insetLeft: "0px",
          insetRight: "0px",
          justifySelf: CENTER,
          insetTop: "0px",
        },
        { x: -50, y: 0, width: 500 },
      ),
    ).toMatchObject({
      insetLeft: { kind: "set", value: "0px" },
      insetRight: { kind: "set", value: "0px" },
    });
  });

  it("a dropped side is cleared: removed on desktop, masked on a breakpoint layer", () => {
    // A Right box whose Left also shows (from a lower layer) is written Right only.
    const layout = { insetRight: "10px", insetTop: "0px" };
    expect(write(layout, { x: 290, y: 0 })).toEqual({
      insetRight: { kind: "set", value: "10px" },
      insetTop: { kind: "set", value: "0px" },
    });
    const centered = {
      insetLeft: "0px",
      insetRight: "0px",
      justifySelf: CENTER,
      insetTop: "0px",
    };
    const leftOnly = catalogPositionLayoutWrites({
      layout: centered,
      constraint: { x: "start", y: "start" },
      box: { x: 24, y: 0, width: 100, height: 50 },
      cb: CB,
      breakpoint: "tablet",
    });
    expect(leftOnly).toMatchObject({
      insetLeft: { kind: "set", value: "24px" },
      insetRight: { kind: "mask" },
      justifySelf: { kind: "mask" },
    });
  });

  it.each<[CatalogAxisConstraint, string]>([
    ["start", "px"],
    ["end", "px"],
    ["both", "px"],
    ["center", "px"],
    ["start", "%"],
    ["end", "%"],
    ["both", "%"],
    ["center", "%"],
  ])(
    "round trip — %s in %s on both axes keeps its constraint and box",
    (kind, unit) => {
      const zero = `0${unit}`;
      const axis = (start: string, end: string, self: string) =>
        kind === "start"
          ? { [start]: zero }
          : kind === "end"
            ? { [end]: zero }
            : kind === "both"
              ? { [start]: zero, [end]: zero }
              : { [start]: zero, [end]: `-0${unit}`, [self]: CENTER };
      const layout = {
        ...axis("insetLeft", "insetRight", "justifySelf"),
        ...axis("insetTop", "insetBottom", "alignSelf"),
      };
      const constraint = catalogReadPositionConstraint(layout);
      expect(constraint).toEqual({ x: kind, y: kind });
      const box = {
        x: 80,
        y: 60,
        width: kind === "both" ? 240 : 100,
        height: kind === "both" ? 180 : 50,
      };
      const written = apply(
        layout,
        catalogPositionLayoutWrites({ layout, constraint, box, cb: CB }),
      );
      expect(catalogReadPositionConstraint(written)).toEqual(constraint);
      // Each written side resolves back to the box (CSS: start = inset, end = cb − inset − size).
      const px = (value: string, size: number) =>
        value.endsWith("%")
          ? (parseFloat(value) / 100) * size
          : parseFloat(value);
      if (kind === "start" || kind === "both")
        expect(px(written.insetLeft, CB.width)).toBeCloseTo(80, 1);
      if (kind === "end" || kind === "both")
        expect(
          CB.width - px(written.insetRight, CB.width) - box.width,
        ).toBeCloseTo(80, 1);
      if (kind === "center")
        expect(
          (CB.width - box.width) / 2 + px(written.insetLeft, CB.width),
        ).toBeCloseTo(80, 1);
    },
  );
});
