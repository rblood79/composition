import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { calculateContentWidth, enrichWithIntrinsicSize } from "../utils";

/**
 * 2026-09-24 사용자 신고 — "catalog 에 Disclosure 헤더부터 width size 들이 정상적이지가 않다 · Disclosure 전체 ·
 * DisclosureGroup 까지 영향". live 실측 (Skia vs Preview DOM): 그룹 안 Disclosure 24 vs 105 · shrink-to-fit
 * 부모 안 단독 Disclosure 128 vs 168.
 *
 * root cause 3 (layout 입력):
 * 1. DisclosureHeader (자식 없는 측정 leaf · `width:100%`) 는 `%` 폭이라 측정 스칼라를 못 받아, 부모 폭이
 *    미결정이면 엔진이 내용 폭을 padding 만으로 봤다.
 * 2. `calculateContentWidth` 의 헤더 분기가 좌우 paddingX 를 포함해 돌려줘 호출자 (box padding 가산) 와
 *    이중 합산 — 헤더 스칼라가 24 컸다.
 * 3. DisclosureContent (자식 없는 본문) 가 텍스트 폭 스칼라를 안 받아 본문 글자가 부모 폭에 기여하지 않았다.
 */

function node(
  type: string,
  props: Record<string, unknown>,
  id = `${type}-1`,
): CanvasLayoutNode {
  return { id, type, props, parent_id: "p" } as unknown as CanvasLayoutNode;
}

const styleOf = (n: CanvasLayoutNode) =>
  (n.props?.style ?? {}) as Record<string, unknown>;

describe("Disclosure intrinsic width — 헤더 · 본문 측정 스칼라", () => {
  const header = node("DisclosureHeader", {
    children: "Section 1",
    style: {
      display: "flex",
      flexDirection: "row",
      width: "100%",
      height: 36,
      paddingLeft: 12,
      paddingRight: 12,
    },
  });

  it("헤더 측정 분기는 content-box (chevron + gap + 글자) — padding 은 호출자 몫", () => {
    const content = calculateContentWidth(header);
    const withoutPadding = calculateContentWidth(
      node("DisclosureHeader", { children: "Section 1", style: {} }),
    );
    expect(content).toBe(withoutPadding);
    // chevron 18 + gap 6 + 글자 (> 0) — padding 24 를 넣지 않는다.
    expect(content).toBeGreaterThan(24);
    expect(content).toBeLessThan(100);
  });

  it("`width:100%` 헤더 — `%` 는 그대로 두고 content-box 스칼라만 싣는다 (width · minWidth 주입 없음)", () => {
    const enriched = enrichWithIntrinsicSize(
      header,
      400,
      0,
      undefined,
      [],
      () => [],
    );
    const style = styleOf(enriched);
    expect(style.width).toBe("100%");
    expect(style.minWidth).toBeUndefined();
    const content = calculateContentWidth(header);
    expect(style.contentMaxWidth).toBe(Math.ceil(content));
    expect(style.contentMinWidth).toBe(Math.ceil(content));
  });

  it("자식 없는 본문 — 텍스트 leaf 와 같은 스칼라 (max = 한 줄 · min = 최장 단어), width 주입 없음", () => {
    const content = node("DisclosureContent", {
      children: "Section content goes here.",
      style: {},
    });
    const style = styleOf(
      enrichWithIntrinsicSize(content, 400, 0, undefined, [], () => []),
    );
    expect(style.width).toBeUndefined();
    expect(typeof style.contentMaxWidth).toBe("number");
    expect(typeof style.contentMinWidth).toBe("number");
    expect(style.contentMaxWidth as number).toBeGreaterThan(
      style.contentMinWidth as number,
    );
  });

  it("자식이 있는 본문은 컨테이너 — 스칼라를 싣지 않는다 (엔진이 자식으로 잰다)", () => {
    const content = node("DisclosureContent", { style: {} }, "dc-parent");
    const child = node("Text", { children: "inner" }, "dc-child");
    const style = styleOf(
      enrichWithIntrinsicSize(content, 400, 0, undefined, [child], () => [
        child,
      ]),
    );
    expect(style.contentMaxWidth).toBeUndefined();
    expect(style.contentMinWidth).toBeUndefined();
  });
});
