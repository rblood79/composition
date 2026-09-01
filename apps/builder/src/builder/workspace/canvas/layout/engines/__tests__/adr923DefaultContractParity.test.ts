import { describe, expect, it } from "vitest";
import {
  getComponentRulesTable,
  getPrimitiveBinding,
  resolveBindingPropDefault,
} from "@composition/shared";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";
import {
  calculateContentHeight,
  calculateContentWidth,
  enrichWithIntrinsicSize,
} from "../utils";

/**
 * ADR-923 Phase 3 r22m1 — **prop 부재 기본값 계약**. `toRacProps` 는 props 에 키가 없으면
 * `binding.props.accepts[key].default` 를 채워 컴포넌트에 넘기고, generated CSS 의 base 규칙은
 * catalog `defaultSize` / `defaultVariant` 값으로 emit 된다. 그러므로 **prop 이 없는 요소의
 * Preview 결과 = 그 기본값을 명시한 요소의 결과** 이며, layout 이 자기 리터럴 fallback 을 따로
 * 들고 있으면 prop 없는 입력에서만 두 표면이 갈린다.
 *
 * 실제로 갈려 있던 3건:
 *   - Table: binding `height:400`/`heightMode:"fixed"` (r21 에 추가) vs layout 리터럴 300
 *     → 같은 canonical 입력이 DOM 402 / layout 302. factory 는 항상 `height:400` 을 기록해
 *       생성 경로가 가렸고, canonical/import 입력만 prop 부재를 표현한다.
 *   - Badge: catalog `defaultSize:"sm"` vs layout `DEFAULT_SIZE_BY_TAG.badge = "md"`.
 *   - Select: catalog `defaultSize:"md"` vs layout 표 `"sm"`.
 *
 * 아래 두 전수 대조가 새 기본값 축을 자동으로 감시한다 (binding 에 default 를 추가하거나
 * catalog defaultSize 를 바꾸면 layout 이 따라오지 않는 즉시 RED).
 */
const node = (type: string, props: Record<string, unknown>): CanvasLayoutNode =>
  ({ id: `${type}-r22`, type, props }) as unknown as CanvasLayoutNode;

/** layout 4 표면 (컨테이너 주입 · 내용 폭/높이 · intrinsic 크기) 을 한 문자열로 접는다. */
function layoutFingerprint(el: CanvasLayoutNode): string {
  const byId = new Map<string, CanvasLayoutNode>([[el.id, el]]);
  const implicit = applyImplicitStyles(el, [], () => [], byId, 400);
  const enriched = enrichWithIntrinsicSize(el, 400, 0, undefined, [], () => []);
  return JSON.stringify({
    parent: implicit.effectiveParent.props?.style ?? {},
    filtered: implicit.filteredChildren.length,
    w: calculateContentWidth(el),
    h: calculateContentHeight(el, 400, [], () => []),
    enriched: enriched.props?.style ?? {},
  });
}

function diffTypes(
  defaultsOf: (type: string) => Record<string, unknown>,
): string[] {
  const diffs: string[] = [];
  for (const type of Object.keys(getComponentRulesTable())) {
    const defaults = defaultsOf(type);
    if (Object.keys(defaults).length === 0) continue;
    const absent = layoutFingerprint(node(type, {}));
    const explicit = layoutFingerprint(node(type, { ...defaults }));
    if (absent !== explicit) {
      diffs.push(
        `${type} — 부재 ${absent} / 명시(${JSON.stringify(defaults)}) ${explicit}`,
      );
    }
  }
  return diffs;
}

describe("ADR-923 r22m1 — prop 부재 = binding/catalog 기본값 명시 (전수)", () => {
  it("binding accepts default 를 명시해도 layout 결과가 같다", () => {
    expect(
      diffTypes((type) => {
        const accepts = getPrimitiveBinding(type)?.props.accepts ?? {};
        const out: Record<string, unknown> = {};
        for (const [key, contract] of Object.entries(accepts)) {
          if (contract.default !== undefined) out[key] = contract.default;
        }
        return out;
      }),
    ).toEqual([]);
  });

  it("catalog defaultSize / defaultVariant 를 명시해도 layout 결과가 같다", () => {
    expect(
      diffTypes((type) => {
        const rule = getComponentRulesTable()[type];
        const out: Record<string, unknown> = {};
        if (rule?.defaultSize) out.size = rule.defaultSize;
        if (rule?.defaultVariant) out.variant = rule.defaultVariant;
        return out;
      }),
    ).toEqual([]);
  });
});

describe("ADR-923 r22m1 — 갈려 있던 3 타입 고정", () => {
  it("Table: prop 없음 → binding default 400 + border 2 = 402 (종전 302)", () => {
    expect(resolveBindingPropDefault("Table", "height")).toBe(400);
    expect(resolveBindingPropDefault("table", "heightMode")).toBe("fixed");
    const el = node("Table", {});
    const style = applyImplicitStyles(
      el,
      [],
      () => [],
      new Map([[el.id, el]]),
      400,
    ).effectiveParent.props?.style as Record<string, unknown>;
    expect(style.height).toBe(402);
    expect(style.minHeight).toBe(402);
  });

  it("Table: 사용자 height 는 그대로, heightMode auto 는 미주입", () => {
    const fixed200 = node("Table", { height: 200 });
    const s1 = applyImplicitStyles(
      fixed200,
      [],
      () => [],
      new Map([[fixed200.id, fixed200]]),
      400,
    ).effectiveParent.props?.style as Record<string, unknown>;
    expect(s1.height).toBe(202);

    const auto = node("Table", { heightMode: "auto" });
    const s2 = applyImplicitStyles(
      auto,
      [],
      () => [],
      new Map([[auto.id, auto]]),
      400,
    ).effectiveParent.props?.style as Record<string, unknown>;
    expect(s2.height).toBeUndefined();
  });

  it("Badge: prop 없음 → catalog defaultSize sm (종전 md)", () => {
    const bySize = (props: Record<string, unknown>) => {
      const out = enrichWithIntrinsicSize(
        node("Badge", props),
        400,
        0,
        undefined,
        [],
        () => [],
      );
      return out.props?.style as Record<string, unknown>;
    };
    expect(getComponentRulesTable().Badge?.defaultSize).toBe("sm");
    expect(bySize({})).toEqual(bySize({ size: "sm" }));
    expect(bySize({}).height).not.toBe(bySize({ size: "md" }).height);
  });

  it("Select: prop 없음 → catalog defaultSize md (종전 sm)", () => {
    expect(getComponentRulesTable().Select?.defaultSize).toBe("md");
    const w = (props: Record<string, unknown>) =>
      calculateContentWidth(node("Select", { children: "Option", ...props }));
    expect(w({})).toBe(w({ size: "md" }));
  });
});
