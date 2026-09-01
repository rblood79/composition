import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getComponentRulesTable,
  getPrimitiveBinding,
  resolveBindingPropDefault,
} from "@composition/shared";

import type { CompositionDocument } from "@composition/shared";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  buildCanvasSceneGraph,
  type CanvasSceneNode,
} from "../../../scene/canvasSceneNode";
import { resolveVirtualizedCollectionWindows } from "../../../scene/collectionVirtualization";
import { buildSpecNodeData } from "../../../skia/buildSpecNodeData";
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
const node = (
  type: string,
  props: Record<string, unknown>,
  id = `${type}-r22`,
  parent_id?: string,
): CanvasLayoutNode =>
  ({ id, type, props, parent_id }) as unknown as CanvasLayoutNode;

/**
 * ADR-923 r23m1 — fixture 축. 기본값을 **자식·데이터가 있을 때만** 소비하는 경로가 있다
 * (GridList `selectionMode` → 카드 선택 체크박스 높이 `utils.ts` `resolveCardSelectionExtra`
 * 는 item 이 하나라도 있어야 실행된다). 빈 단일 노드만 재면 그런 기본값 변이가 게이트를
 * 통과한다 — round 22 게이트가 실제로 GridList `selectionMode` single → multiple 을 놓쳤다.
 */
const FIXTURES: ReadonlyArray<{
  name: string;
  props?: Record<string, unknown>;
  children?: ReadonlyArray<{ type: string; props: Record<string, unknown> }>;
}> = [
  { name: "bare" },
  {
    name: "children",
    children: [
      { type: "Text", props: { children: "A" } },
      { type: "Text", props: { children: "B" } },
    ],
  },
  {
    name: "items",
    props: {
      items: [
        { id: "i1", label: "A", description: "d1" },
        { id: "i2", label: "B" },
      ],
    },
  },
];

/** layout 4 표면 (컨테이너 주입 · 내용 폭/높이 · intrinsic 크기) 을 한 문자열로 접는다. */
function layoutFingerprint(
  el: CanvasLayoutNode,
  children: CanvasLayoutNode[],
): string {
  const byId = new Map<string, CanvasLayoutNode>([
    [el.id, el],
    ...children.map((c) => [c.id, c] as const),
  ]);
  const getChildren = (id: string) => (id === el.id ? children : []);
  const implicit = applyImplicitStyles(el, children, getChildren, byId, 400);
  const enriched = enrichWithIntrinsicSize(
    el,
    400,
    0,
    undefined,
    children,
    getChildren,
  );
  return JSON.stringify({
    parent: implicit.effectiveParent.props?.style ?? {},
    filtered: implicit.filteredChildren.length,
    w: calculateContentWidth(el, children, getChildren),
    h: calculateContentHeight(el, 400, children, getChildren),
    enriched: enriched.props?.style ?? {},
  });
}

/**
 * ADR-923 r24m1 — **활성화 축**. 어떤 기본값은 *다른* prop 이 비기본값일 때만 소비된다:
 * GridList `selectionStyle` 은 `selectionMode` 가 `multiple` 일 때만 카드 높이에 닿는다
 * (`checkboxModes: ["multiple"]`). 그런데 "전부 부재 ↔ 전부 명시" 대조는 명시 쪽이 **모든**
 * 기본값을 한꺼번에 덮어써서 selectionMode 도 기본값으로 고정해 버리므로, 그 조합을 표현하지
 * 못한다 — 실제로 `selectionStyle` 기본값을 checkbox → highlight 로 바꾸는 mutation 이 round 23
 * 게이트를 그대로 통과했다.
 *
 * 그래서 각 타입마다 **비기본값 하나를 고정한 baseline** 을 더 만든다 (enum 은 non-default
 * option 전부, size/variant 는 catalog 표의 non-default 첫 값). baseline 위에서 다시
 * "부재 ↔ 명시" 를 비교하면 활성화된 경로의 기본값도 대조에 들어온다.
 */
function activationBaselines(type: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [{}];
  const accepts = getPrimitiveBinding(type)?.props.accepts ?? {};
  for (const [key, contract] of Object.entries(accepts)) {
    const options = (
      contract as { options?: ReadonlyArray<{ value: string }> }
    ).options;
    if (options) {
      for (const opt of options) {
        if (opt.value !== contract.default) out.push({ [key]: opt.value });
      }
    } else if (contract.kind === "boolean") {
      out.push({ [key]: true });
    }
  }
  const rule = getComponentRulesTable()[type];
  const otherSize = Object.keys(rule?.sizes ?? {}).find(
    (k) => k !== rule?.defaultSize,
  );
  if (otherSize) out.push({ size: otherSize });
  const otherVariant = Object.keys(rule?.variants ?? {}).find(
    (k) => k !== rule?.defaultVariant,
  );
  if (otherVariant) out.push({ variant: otherVariant });
  return out;
}

function diffTypes(
  defaultsOf: (type: string) => Record<string, unknown>,
): string[] {
  const diffs: string[] = [];
  for (const type of Object.keys(getComponentRulesTable())) {
    const defaults = defaultsOf(type);
    if (Object.keys(defaults).length === 0) continue;
    for (const fixture of FIXTURES) {
      const kids = (props: Record<string, unknown>) => {
        const owner = node(type, props, `${type}-owner`);
        const children = (fixture.children ?? []).map((c, i) =>
          node(c.type, c.props, `${type}-child-${i}`, owner.id),
        );
        return layoutFingerprint(owner, children);
      };
      for (const baseline of activationBaselines(type)) {
        const absent = kids({ ...fixture.props, ...baseline });
        const explicit = kids({ ...fixture.props, ...defaults, ...baseline });
        if (absent !== explicit) {
          const at = Object.keys(baseline).length
            ? ` @${JSON.stringify(baseline)}`
            : "";
          diffs.push(
            `${type} [${fixture.name}]${at} — 부재 ${absent} / 명시(${JSON.stringify(defaults)}) ${explicit}`,
          );
        }
      }
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

/**
 * ADR-923 r23m1 sweep — `defaultSelectionMode` 는 네 소비처 (layout 카드 높이 · scene 카드 ·
 * virtualization stride · Skia Tree 체크박스) 가 각자 리터럴로 들고 있었다. cutover 경로의
 * Preview 는 `toRacProps` 가 채운 binding default 를 받으므로 (렌더러 destructure 기본값에
 * 도달하지 않는다) 기본값 원천은 catalog binding 하나여야 한다 — GridList 는 binding `single`
 * 인데 세 자리가 `none` 을 들고 있었다 (둘 다 `checkboxModes: ["multiple"]` 밖이라 시각 결과는
 * 같았지만 binding 쪽만 바뀌면 조용히 갈린다).
 *
 * layout 소비처는 위 전수 동치가 [items] fixture 로 감시한다. scene/virtualization/Skia 는
 * 실행 경로가 달라 여기서는 **리터럴 부재**만 정적으로 고정한다 (값 자체는 shared
 * `defaultContractLookup` 계약 테스트).
 */
describe("ADR-923 r23m1 — defaultSelectionMode 리터럴 0 (catalog binding 경유)", () => {
  const FILES = [
    "src/builder/workspace/canvas/layout/engines/utils.ts",
    "src/builder/workspace/canvas/scene/collectionVirtualization.ts",
    "src/builder/workspace/canvas/scene/canvasSceneNode.ts",
    "src/builder/workspace/canvas/skia/buildSpecNodeData.ts",
  ];

  it.each(FILES)("%s — selectionMode/selectionStyle 기본값이 binding 경유", (rel) => {
    const source = readFileSync(resolve(process.cwd(), rel), "utf8");
    expect(source).toMatch(
      /defaultSelectionMode:\s*resolveBindingSelectionMode\(/,
    );
    expect(source).not.toMatch(/defaultSelectionMode:\s*"/);
    // r24m1 — style 축도 같은 원천. `selectionStyle: props.x,` 로 되돌아가면 리터럴
    //   `fallback` 이 다시 기본값 원천이 된다.
    expect(source).toMatch(/\?\?\s*resolveBindingSelectionStyle\(/);
  });
});

/**
 * ADR-923 r24m2 — 위 정적 게이트는 **문자열만** 본다. 실제로
 * `resolveBindingSelectionMode("NotAComponent", "multiple")` 처럼 잘못 결선해도 정적 4 + 기존
 * scene 테스트가 전부 통과했다 (판독 실험). layout 밖 세 소비처는 실행 경로가 달라 layout 전수
 * 동치가 닿지 않으므로, **각자의 production 진입점을 실행**해서 같은 계약(부재 = binding 기본값
 * 명시)을 확인한다. 각 게이트에는 신호가 실제로 움직이는 **대조군**을 함께 둔다 — 대조군이
 * 없으면 "언제나 false == false" 로 통과하는 빈 게이트가 된다.
 */
const SELECTION_DEFAULTS = {
  selectionMode: resolveBindingPropDefault("GridList", "selectionMode"),
  selectionStyle: resolveBindingPropDefault("GridList", "selectionStyle"),
};

function gridListDoc(props: Record<string, unknown>): CompositionDocument {
  const items = Array.from({ length: 6 }, (_, i) => ({
    id: `g${i}`,
    label: `Card ${i}`,
  }));
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "body-1",
            type: "Body",
            props: {},
            children: [
              {
                id: "gridlist-1",
                type: "GridList",
                props: {
                  items,
                  layout: "stack",
                  style: { height: 300, overflowY: "scroll" },
                  ...props,
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as CompositionDocument;
}

describe("ADR-923 r24m2 — layout 밖 소비처의 기능 게이트", () => {
  const sceneCheckboxes = (props: Record<string, unknown>): boolean[] => {
    const graph = buildCanvasSceneGraph(gridListDoc(props));
    return graph.nodes
      .filter((n) => n.projection?.kind === "gridlist-row")
      .map(
        (n) =>
          (n.props as Record<string, unknown>)._showSelectionCheckbox === true,
      );
  };

  it("scene(buildCanvasSceneGraph): 카드 체크박스 신호가 부재 = 기본값 명시", () => {
    const absent = sceneCheckboxes({});
    expect(absent.length).toBeGreaterThan(0);
    expect(absent).toEqual(sceneCheckboxes(SELECTION_DEFAULTS));
    // 대조군 — 신호가 실제로 움직인다.
    expect(sceneCheckboxes({ selectionMode: "multiple" })).toEqual(
      absent.map(() => true),
    );
    expect(absent).toEqual(absent.map(() => false));
  });

  const stride = (props: Record<string, unknown>): number | undefined =>
    resolveVirtualizedCollectionWindows({
      doc: gridListDoc(props),
      collections: [],
      scrollTops: new Map(),
    }).get("gridlist-1")?.rowHeight;

  it("virtualization(resolveVirtualizedCollectionWindows): 행 stride 가 부재 = 기본값 명시", () => {
    const absent = stride({});
    expect(absent).toBeGreaterThan(0);
    expect(absent).toBe(stride(SELECTION_DEFAULTS));
    // 대조군 — 체크박스가 서면 stride 가 box(20) + gap(2) 만큼 커진다.
    expect(stride({ selectionMode: "multiple" })).toBe((absent ?? 0) + 22);
  });

  const treeItemSkia = (treeProps: Record<string, unknown>): string => {
    const tree = {
      id: "tree-1",
      type: "Tree",
      parent_id: null,
      page_id: "page-1",
      props: treeProps,
    } as unknown as CanvasSceneNode;
    const item = {
      id: "treeitem-1",
      type: "TreeItem",
      parent_id: "tree-1",
      page_id: "page-1",
      props: { children: "Item" },
    } as unknown as CanvasSceneNode;
    const node = buildSpecNodeData({
      element: item,
      layout: { x: 0, y: 0, width: 240, height: 32 } as never,
      theme: "light",
      elementsMap: new Map([
        [tree.id, tree],
        [item.id, item],
      ]),
    });
    return JSON.stringify(node);
  };

  it("Skia(buildSpecNodeData): TreeItem 렌더 결과가 부재 = 기본값 명시", () => {
    const treeDefaults = {
      selectionMode: resolveBindingPropDefault("Tree", "selectionMode"),
      selectionStyle: resolveBindingPropDefault("Tree", "selectionStyle"),
    };
    const absent = treeItemSkia({});
    expect(absent).toBe(treeItemSkia(treeDefaults));
    // 대조군 — checkbox 스타일이면 결과가 달라진다(행 앞 체크박스 슬롯).
    expect(treeItemSkia({ selectionStyle: "checkbox" })).not.toBe(absent);
  });
});
