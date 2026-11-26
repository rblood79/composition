/**
 * ADR-318 G4 — the Handle's pill and grip: the Canvas shapes (`catalogResizableHandleShapes`) and the
 * DOM rule (`RESIZABLE_CHROME_SELECTORS` — the pill's scale per state) give each state the same box,
 * written out from reui (rest 4 × 24 · hover 4 × 40 · pressed 6 × 48, grip 12 × 16).
 */
import { describe, expect, it } from "vitest";
import { RESIZABLE_CHROME_SELECTORS } from "../../../../../../packages/shared/src/catalog/document/resizableChrome";
import { catalogResizableHandleShapes } from "../ruleShapes";

const handle = (
  props: Record<string, unknown>,
  axis: "row" | "column",
  state?: "hover" | "pressed",
) =>
  catalogResizableHandleShapes({
    type: "ResizableHandle",
    node: {
      props,
      derivedProps: { _resizableHandleAxis: axis },
    } as never,
    rect:
      axis === "row" ? { width: 1, height: 200 } : { width: 300, height: 1 },
    theme: "light",
    ...(state ? { state } : {}),
  }) as {
    type: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    iconName?: string;
  }[];

describe("ADR-318 G4 — pill · grip shapes", () => {
  it("a line Handle draws no chrome", () => {
    expect(handle({}, "row")).toEqual([]);
    expect(handle({ variant: "line" }, "row")).toEqual([]);
  });
  it.each([
    [undefined, 4, 24],
    ["hover", 4, 40],
    ["pressed", 6, 48],
  ] as const)(
    "pill %s (a row Group's vertical line): %d × %d on the middle",
    (state, w, h) => {
      const [pill] = handle({ variant: "pill" }, "row", state);
      expect(pill).toMatchObject({ type: "roundRect", width: w, height: h });
      expect(pill!.x).toBeCloseTo((1 - w) / 2);
      expect(pill!.y).toBeCloseTo((200 - h) / 2);
    },
  );
  it("a column Group's pill lies across (24 × 4)", () => {
    const [pill] = handle({ variant: "pill" }, "column");
    expect(pill).toMatchObject({ width: 24, height: 4 });
  });
  it("withHandle: a 12 × 16 grip box and its glyph, turned with the line", () => {
    const shapes = handle({ withHandle: true }, "row");
    expect(shapes[0]).toMatchObject({
      type: "roundRect",
      width: 12,
      height: 16,
    });
    expect(shapes[1]).toMatchObject({
      type: "icon_font",
      iconName: "grip-vertical",
    });
    const across = handle({ withHandle: true }, "column");
    expect(across[0]).toMatchObject({ width: 16, height: 12 });
    expect(across[1]).toMatchObject({ iconName: "grip-horizontal" });
  });
  it("the DOM pill's scale per state = the Canvas sizes over the 6 × 48 box", () => {
    const transform = (selector: string) =>
      (
        RESIZABLE_CHROME_SELECTORS[selector] as {
          styles: Record<string, string>;
        }
      ).styles.transform;
    expect(
      transform(
        '&[data-orientation="horizontal"][data-variant="pill"]::before',
      ),
    ).toBe(`translate(-50%, -50%) scale(${4 / 6}, ${24 / 48})`);
    expect(
      transform(
        '&[data-orientation="horizontal"][data-variant="pill"]:not([aria-disabled="true"]):hover::before',
      ),
    ).toBe(`translate(-50%, -50%) scale(${4 / 6}, ${40 / 48})`);
    expect(
      transform(
        '&[data-orientation="horizontal"][data-variant="pill"][data-resizing]:not([aria-disabled="true"])::before',
      ),
    ).toBe("translate(-50%, -50%) scale(1, 1)");
    expect(
      transform('&[data-orientation="vertical"][data-variant="pill"]::before'),
    ).toBe(`translate(-50%, -50%) scale(${24 / 48}, ${4 / 6})`);
  });
});
