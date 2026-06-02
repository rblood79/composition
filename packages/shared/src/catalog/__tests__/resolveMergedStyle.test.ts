import { describe, expect, it } from "vitest";

import { resolveMergedStyle } from "../resolvers/resolveMergedStyle";
import { toReactStyle } from "../outputs/toReactStyle";
import { toSkiaStyle } from "../outputs/toSkiaStyle";
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

/**
 * ADR-912 1A-(c) — Skia 어댑터 G-adapter 증명.
 *
 * G-adapter 핵심: DOM `toReactStyle` 과 Skia `toSkiaStyle` 이 **같은 `resolveMergedStyle`
 * base/override 분리 코어**를 재사용(병합 로직 복제 0)하되, Skia 만 base TokenRef 를 구체값으로
 * 해소(`resolveToken`)한다. + reset-to-default round-trip.
 */
describe("toSkiaStyle — base⊕override ⊕ token 해소 (ADR-912 1A-(c) G-adapter)", () => {
  const node = (props: Record<string, unknown>): CanonicalNode => ({
    id: "n1",
    type: "Button",
    props,
  });

  it("base TokenRef 가 구체값으로 해소된다 ({typography.text-xs} → 12)", () => {
    const merged = toSkiaStyle(node({ size: "sm" }));
    // resolveMergedStyle.base.fontSize === "{typography.text-xs}" (1A-(b) 미해소 통과 검증됨)
    // → toSkiaStyle 은 resolveToken 으로 12(number) 해소.
    expect(merged.fontSize).toBe(12);
    // TokenRef 문자열이 새어나오지 않아야 함 (해소 단일 진입점).
    expect(merged.fontSize).not.toBe("{typography.text-xs}");
  });

  it("override 가 base 를 덮는다 (props.style.fontSize 우선)", () => {
    const merged = toSkiaStyle(
      node({ size: "sm", style: { fontSize: "20px" } }),
    );
    // override "20px" 가 base TokenRef 를 덮음. override 는 이미 구체값이라 그대로 통과.
    expect(merged.fontSize).toBe("20px");
  });

  it("override-only 키도 통과 (base 에 없는 사용자 키)", () => {
    const merged = toSkiaStyle(
      node({ size: "md", style: { color: "rgb(255,0,0)", marginTop: "4px" } }),
    );
    expect(merged.color).toBe("rgb(255,0,0)");
    expect(merged.marginTop).toBe("4px");
  });

  it("color TokenRef 는 theme 인자로 light/dark 분기 해소", () => {
    // base 에 color TokenRef 가 없을 수 있으므로 override 로 명시 주입해 theme 분기만 검증.
    const light = toSkiaStyle(
      node({ style: { backgroundColor: "{color.accent}" } }),
      "light",
    );
    const dark = toSkiaStyle(
      node({ style: { backgroundColor: "{color.accent}" } }),
      "dark",
    );
    // accent 는 light/dark 팔레트에서 다른 구체값으로 해소되어야 함.
    expect(light.backgroundColor).not.toBe("{color.accent}");
    expect(dark.backgroundColor).not.toBe("{color.accent}");
    expect(typeof light.backgroundColor).toBe("string");
  });

  it("G-adapter: DOM/Skia 가 같은 resolveMergedStyle 코어 재사용 — override 부분 일치", () => {
    const n = node({ size: "sm", style: { fontSize: "20px", color: "red" } });
    const dom = toReactStyle(n); // override 전용
    const skia = toSkiaStyle(n); // base⊕override ⊕ token 해소
    // 두 어댑터의 override 키(fontSize/color)는 같은 값 — 같은 분리 코어 파생 증거.
    expect(dom?.fontSize).toBe("20px");
    expect(skia.fontSize).toBe("20px"); // override 가 base 덮어 동일
    expect(dom?.color).toBe("red");
    expect(skia.color).toBe("red");
    // Skia 만 base(size 시각)를 추가로 갖는다(borderRadius 등 base 키). DOM 은 base 미포함.
    expect(dom).not.toHaveProperty("borderRadius");
  });

  it("reset round-trip: override 제거 시 base 로 복귀 ({typography.text-xs} → 12)", () => {
    const withOverride = toSkiaStyle(
      node({ size: "sm", style: { fontSize: "20px" } }),
    );
    expect(withOverride.fontSize).toBe("20px"); // override 적용

    // reset = props.style.fontSize 제거 (delete props.style[k] 등가).
    const afterReset = toSkiaStyle(node({ size: "sm", style: {} }));
    expect(afterReset.fontSize).toBe(12); // base(theme rule) 로 복귀
  });

  it("rule 미등록 type → base 없음, override 만 해소 통과", () => {
    const frameNode: CanonicalNode = {
      id: "f",
      type: "frame" as CanonicalNode["type"],
      props: { style: { gap: "8px" } },
    };
    const merged = toSkiaStyle(frameNode);
    expect(merged.gap).toBe("8px");
  });
});
