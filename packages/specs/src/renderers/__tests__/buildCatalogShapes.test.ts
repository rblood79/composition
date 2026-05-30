import { describe, expect, it } from "vitest";

import { ButtonSpec } from "../../components/Button.spec";
import { buildCatalogShapes } from "../buildCatalogShapes";

/**
 * ADR-142 #5 increment (a) — generic shape-descriptor 생성기 parity.
 *
 * buildCatalogShapes 는 per-component render.shapes 를 대체하는 generic 생성기.
 * box+text leaf primitive 의 공통 경로(bg roundRect + border + text-only)에 대해
 * ButtonSpec.render.shapes 출력과 동일해야 한다(parity oracle).
 *
 * cutover leaf Button(#7 binding)은 icon/fillStyle 을 받지 않으므로
 * (아이콘 Button=reusable, fillStyle deferred) 공통 경로만 검증 대상.
 */
describe("buildCatalogShapes — ADR-142 #5 generic box+text shape 생성기", () => {
  const md = ButtonSpec.sizes.md;

  it("primary Button default — render.shapes 와 parity (bg+border+text)", () => {
    const props = { children: "OK" } as Record<string, unknown>;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = buildCatalogShapes(ButtonSpec, props, md, "default");
    expect(actual).toEqual(expected);
  });

  it("hover state — render.shapes 와 parity (state별 fill)", () => {
    const props = { children: "OK" } as Record<string, unknown>;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "hover",
    );
    const actual = buildCatalogShapes(ButtonSpec, props, md, "hover");
    expect(actual).toEqual(expected);
  });

  it("_hasChildren shell — text 없이 bg(+border)만 반환", () => {
    const props = { children: "OK", _hasChildren: true } as Record<
      string,
      unknown
    >;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = buildCatalogShapes(ButtonSpec, props, md, "default");
    expect(actual).toEqual(expected);
    expect(actual.some((s) => s.type === "text")).toBe(false);
  });

  it("variant 지정 (secondary) — render.shapes 와 parity", () => {
    const props = { children: "Go", variant: "secondary" } as Record<
      string,
      unknown
    >;
    const expected = ButtonSpec.render.shapes(
      props as Parameters<typeof ButtonSpec.render.shapes>[0],
      md,
      "default",
    );
    const actual = buildCatalogShapes(ButtonSpec, props, md, "default");
    expect(actual).toEqual(expected);
  });
});
