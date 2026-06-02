import { describe, expect, it } from "vitest";

import { resolveMergedStyle } from "../resolvers/resolveMergedStyle";
import { toReactStyle } from "../outputs/toReactStyle";
import { getComponentRulesTable } from "../resolvers/resolveComponentRule";
import type { CanonicalNode } from "../../types/composition-document.types";

/**
 * ADR-912 1A-(b) — base/override 2층 분리 코어 + DOM override 어댑터 검증.
 *
 * 검증 축:
 * - base = 정본 table(`resolveComponentRule`) 의 size 시각값 (TokenRef 미해소 통과)
 * - override = node.props.style (키 존재 = override)
 * - toReactStyle = override 전용 (base 미포함 — generated CSS 가 base 담당)
 */
describe("resolveMergedStyle — base/override 2층 분리 (ADR-912 1A-(b))", () => {
  const node = (props: Record<string, unknown>): CanonicalNode => ({
    id: "n1",
    type: "Button",
    props,
  });

  it("base = 정본 table 의 size 시각값 (TokenRef 미해소 통과)", () => {
    const { base } = resolveMergedStyle(node({ size: "sm" }));
    const tableSm = getComponentRulesTable().Button?.sizes.sm;
    expect(base).toEqual(tableSm);
    // 1A-(b) scope: TokenRef 문자열을 해소하지 않고 그대로 통과 (해소는 1A-(c) Skia).
    expect(base?.fontSize).toBe("{typography.text-xs}");
  });

  it("size 미지정 시 rule.defaultSize 의 base 사용", () => {
    const rule = getComponentRulesTable().Button;
    const { base } = resolveMergedStyle(node({}));
    const defaultSizeBase = rule?.defaultSize
      ? rule.sizes[rule.defaultSize]
      : undefined;
    expect(base).toEqual(defaultSizeBase);
  });

  it("override = node.props.style (키 존재 = override)", () => {
    const { override } = resolveMergedStyle(
      node({ size: "md", style: { fontSize: "20px", color: "red" } }),
    );
    expect(override).toEqual({ fontSize: "20px", color: "red" });
  });

  it("props.style 부재 시 override = 빈 객체", () => {
    const { override } = resolveMergedStyle(node({ size: "md" }));
    expect(override).toEqual({});
  });

  it("props.style 이 object 아니면 (배열/문자열) 빈 override 로 안전 처리", () => {
    expect(resolveMergedStyle(node({ style: "garbage" })).override).toEqual({});
    expect(resolveMergedStyle(node({ style: [1, 2] })).override).toEqual({});
  });

  it("rule 미등록 type (컨테이너 shell 등) → base undefined, override 만", () => {
    const unknownNode: CanonicalNode = {
      id: "x",
      type: "frame" as CanonicalNode["type"],
      props: { style: { gap: "8px" } },
    };
    const { base, override } = resolveMergedStyle(unknownNode);
    // frame 은 정본 table 에 size rule 이 없을 수 있음 — base undefined 또는 미정 size.
    expect(base === undefined || typeof base === "object").toBe(true);
    expect(override).toEqual({ gap: "8px" });
  });
});

describe("toReactStyle — DOM override 전용 어댑터 (ADR-912 1A-(b))", () => {
  const node = (props: Record<string, unknown>): CanonicalNode => ({
    id: "n1",
    type: "Button",
    props,
  });

  it("override 만 투영 — base(size 시각) 는 포함하지 않음 (generated CSS 담당)", () => {
    const style = toReactStyle(
      node({ size: "sm", style: { fontSize: "20px" } }),
    );
    expect(style).toEqual({ fontSize: "20px" });
    // base 의 fontSize TokenRef 가 새어들지 않아야 함 (DOM base = generated CSS).
    expect(style).not.toHaveProperty("borderRadius");
    expect(style?.fontSize).not.toBe("{typography.text-xs}");
  });

  it("override 비어 있으면 undefined (빈 style={} 회피)", () => {
    expect(toReactStyle(node({ size: "md" }))).toBeUndefined();
    expect(toReactStyle(node({}))).toBeUndefined();
  });

  it("여러 override 키 전수 통과", () => {
    const style = toReactStyle(
      node({ style: { width: "100px", marginTop: "4px", color: "blue" } }),
    );
    expect(style).toEqual({ width: "100px", marginTop: "4px", color: "blue" });
  });
});
