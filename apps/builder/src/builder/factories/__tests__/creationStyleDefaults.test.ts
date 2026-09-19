import { describe, expect, it } from "vitest";
import { composeCreationProps } from "../creationStyleDefaults";
import { getDefaultProps } from "../../../types/builder/unified.types";

/**
 * ADR-027 후속 5 — 새 Text 는 `whiteSpace: pre-wrap` (줄바꿈 보존, 패널 "Auto"). catalog 파생엔 style 이
 * 없어야 하므로 (derivation 게이트) 생성 경로가 합성한다.
 */
describe("composeCreationProps", () => {
  it("Text: catalog 파생 + whiteSpace pre-wrap", () => {
    const props = composeCreationProps("Text", getDefaultProps("Text"));
    expect(props.children).toBe("Text");
    expect(props.style).toEqual({ whiteSpace: "pre-wrap" });
    expect("style" in getDefaultProps("Text")).toBe(false);
  });

  it("initialProps.style 이 생성 style 을 이긴다 (하니스 · import 가 nowrap 을 지정)", () => {
    const props = composeCreationProps("Text", getDefaultProps("Text"), {
      children: "x",
      style: { whiteSpace: "nowrap", width: "320px" },
    });
    expect(props.children).toBe("x");
    expect(props.style).toEqual({ whiteSpace: "nowrap", width: "320px" });
  });

  it("생성 style 이 없는 타입은 종전 합성 그대로", () => {
    const d = getDefaultProps("Badge");
    expect(composeCreationProps("Badge", d, { children: "N" })).toEqual({
      ...d,
      children: "N",
    });
  });
});

describe("useElementCreator 가 composeCreationProps 를 쓴다 (static)", () => {
  it("단순 leaf 생성 분기", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const src = await readFile(
      resolve(__dirname, "../../hooks/useElementCreator.ts"),
      "utf8",
    );
    expect(src).toMatch(
      /props: composeCreationProps\(\s*type,\s*getDefaultProps\(type\),\s*initialProps,?\s*\)/,
    );
    expect(src).not.toContain(
      "props: { ...getDefaultProps(type), ...initialProps }",
    );
  });
});
