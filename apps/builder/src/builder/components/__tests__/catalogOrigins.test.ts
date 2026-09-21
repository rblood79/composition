/**
 * ADR-228 G1 — catalog 파생 generic origin seed.
 *
 * - E(57) = PALETTE_ORDER − X(9) 가 shared `PALETTE_REUSABLE_ORIGIN_TYPES`(52) + 손 seed 5 와 일치.
 * - origin R 전수 존재 · reusableId 규약 · 재hydration 멱등 (Δ0) · 기존 origin 사용자 값 보존.
 * - factory 동치: complex origin 의 subtree 가 live 생성 경로 (`createElementsFromDefinition`) 와
 *   type 순서 · props 가 같고, leaf origin 의 props 가 팔레트 else 분기 합성과 같다.
 * - entry 원복 RED: 목록에서 type 을 빼면 origin 이 시드되지 않는다 (게이트가 반응하는 행).
 */
import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  PALETTE_REUSABLE_ORIGIN_TYPES,
  catalogReusableOriginId,
  getCatalogEntry,
  getReusableEntries,
  getReusableEntry,
} from "@composition/shared";
import { getPaletteItems } from "../../panels/components/paletteItems";
import { ComponentFactory } from "../../factories/ComponentFactory";
import { COMPLEX_COMPONENT_TAGS } from "../../factories/constants";
import { composeCreationProps } from "../../factories/creationStyleDefaults";
import { createElementsFromDefinition } from "../../factories/utils/elementCreation";
import { getDefaultProps } from "../../../types/builder/unified.types";
import { applyCanonicalDocumentMigrations } from "../../../adapters/canonical/canonicalDocumentMigrations";
import {
  CATALOG_ORIGIN_METADATA_TYPE,
  TEMPLATE_ORIGIN_REUSABLE_TYPES,
  buildCatalogOrigin,
  ensureCatalogOrigins,
  getCatalogOriginTypes,
  repairCatalogOrigin,
} from "../catalogOrigins";
import {
  getReusableOriginEnsurers,
  ensureReusableCompositeOrigins,
} from "../reusableCompositeOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/** 사용자 결정 ② + 148 Phase 3 판정 — 내용/레이아웃 primitive 8 + IllustratedMessage. */
const EXCLUDED_X = [
  "Text",
  "Icon",
  "Separator",
  "Skeleton",
  "Image",
  "frame",
  "Section",
  "Slot",
  "IllustratedMessage",
];
const HAND_SEEDED = ["Toolbar", "Form", "IconButton", "InlineAlert", "Card"];

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: {
          type: "legacy-page",
          pageId: "page-home",
          slug: "/",
          parent_id: null,
        },
        children: [
          {
            id: "page-home-body",
            type: "body" as CanonicalNode["type"],
            props: {},
          },
        ],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findById(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

function flattenTypesAndProps(
  node: CanonicalNode,
): Array<{ type: string; props: unknown }> {
  const out: Array<{ type: string; props: unknown }> = [];
  const walk = (n: CanonicalNode): void => {
    out.push({ type: n.type, props: n.props ?? {} });
    for (const child of n.children ?? []) walk(child);
  };
  for (const child of node.children ?? []) walk(child);
  return out;
}

describe("ADR-228 G0 — 집합 E/V/R", () => {
  const paletteTypes = [
    ...new Set(getPaletteItems().map((i) => i.componentType ?? i.type)),
  ];

  it("P = 66 · X = 9 · E = 57 = 손 seed 5 + catalog 파생 52", () => {
    expect(paletteTypes).toHaveLength(66);
    const eligible = paletteTypes.filter((t) => !EXCLUDED_X.includes(t));
    expect(eligible).toHaveLength(57);
    expect([...eligible].sort()).toEqual(
      [...HAND_SEEDED, ...PALETTE_REUSABLE_ORIGIN_TYPES].sort(),
    );
    expect(PALETTE_REUSABLE_ORIGIN_TYPES).toHaveLength(52);
  });

  it("X 의 type 은 reusable entry 가 없고 E 의 type 은 전부 있다 (제외 정책 = 등록 경계)", () => {
    for (const type of EXCLUDED_X) {
      expect(getReusableEntry(type), type).toBeUndefined();
    }
    for (const type of paletteTypes.filter((t) => !EXCLUDED_X.includes(t))) {
      expect(getReusableEntry(type), type).toBeDefined();
    }
  });

  it("V — Chart creationVariants 7 이 reusable entry 에 보존되고 팔레트가 그대로 펼친다", () => {
    const chart = getReusableEntry("Chart");
    expect(chart?.panel.creationVariants?.length).toBe(7);
    const chartItems = getPaletteItems().filter(
      (i) => i.componentType === "Chart",
    );
    expect(chartItems).toHaveLength(7);
    for (const item of chartItems) {
      expect(item.initialProps?.chartType).toBeTruthy();
    }
    expect(getPaletteItems()).toHaveLength(72);
  });

  it("R — reusableId 규약 · 동명 primitive placeable:false · panel 메타 동일", () => {
    for (const type of PALETTE_REUSABLE_ORIGIN_TYPES) {
      const reusable = getReusableEntry(type)!;
      const primitive = getCatalogEntry(type)!;
      expect(reusable.reusableId).toBe(`component-${type.toLowerCase()}`);
      expect(primitive.panel.placeable, type).toBe(false);
      expect(reusable.panel.placeable, type).toBe(true);
      const { placeable: _a, ...reusablePanel } = reusable.panel;
      const { placeable: _b, ...primitivePanel } = primitive.panel;
      expect(reusablePanel, type).toEqual(primitivePanel);
    }
    // 기존 template origin 재사용 — id 가 자연히 일치한다.
    expect(catalogReusableOriginId("ListBox")).toBe("component-listbox");
    expect(catalogReusableOriginId("GridList")).toBe("component-gridlist");
  });

  it("template origin 재사용 집합 ⟺ factory definition 이 ref 인 type + item template 보유자 (정적 집합 실측 일치)", () => {
    const refDefinitionTypes = PALETTE_REUSABLE_ORIGIN_TYPES.filter((type) => {
      if (!COMPLEX_COMPONENT_TAGS.has(type)) return false;
      const creator = ComponentFactory.getDefinitionCreator(type);
      if (!creator) return false;
      return (
        creator({
          parentElement: null,
          pageId: "",
          elements: [],
          doc: makeDocument(),
        }).parent.type === "ref"
      );
    });
    // ADR-229 Phase 1: TagGroup 은 definition 이 plain 이지만 chip item template origin 의 slot
    //   보유자 (origin 의 TagList 자식) 라 손 ensurer 가 generic 과 같은 트리를 시드한다.
    expect([...refDefinitionTypes, "TagGroup"].sort()).toEqual(
      [...TEMPLATE_ORIGIN_REUSABLE_TYPES].sort(),
    );
    expect(getCatalogOriginTypes()).toHaveLength(49);
  });

  it("entry 마다 ensurer 가 있고 generic 50 은 한 함수를 공유한다", () => {
    for (const entry of getReusableEntries()) {
      expect(getReusableOriginEnsurers()[entry.reusableId], entry.type).toBeTypeOf(
        "function",
      );
    }
    const generic = new Set(
      getCatalogOriginTypes().map(
        (t) => getReusableOriginEnsurers()[catalogReusableOriginId(t)],
      ),
    );
    expect(generic.size).toBe(1);
  });
});

describe("ADR-228 G1 — origin seed · 멱등 · 보존", () => {
  it("ensureReusableCompositeOrigins 가 R 57 전부를 Components body 에 시드한다", () => {
    const doc = ensureReusableCompositeOrigins(makeDocument());
    const body = findById(doc.children, COMPONENTS_SYSTEM_BODY_ID)!;
    const rootIds = new Set((body.children ?? []).map((n) => n.id));
    for (const entry of getReusableEntries()) {
      expect(rootIds.has(entry.reusableId), entry.type).toBe(true);
      const origin = findById(doc.children, entry.reusableId)!;
      expect(origin.reusable, entry.type).toBe(true);
      expect(origin.metadata?.systemOwned, entry.type).toBe(true);
    }
    // 사용자 페이지는 건드리지 않는다.
    expect(findById(doc.children, "page-home-body")?.children).toBeUndefined();
  });

  it("origin root type 은 palette type 이고 id 에 `/` 가 없다 (descendants 경로 구분자)", () => {
    for (const type of getCatalogOriginTypes()) {
      const origin = buildCatalogOrigin(type);
      expect(origin.type).toBe(type);
      expect(origin.metadata?.type).toBe(CATALOG_ORIGIN_METADATA_TYPE);
      expect(origin.metadata?.componentFamily).toBe(type);
      const walk = (n: CanonicalNode): void => {
        expect(n.id.includes("/"), n.id).toBe(false);
        for (const c of n.children ?? []) walk(c);
      };
      walk(origin);
    }
  });

  it("재hydration 멱등 — 두 번째 ensure 는 같은 참조 · 직렬화 Δ0", () => {
    const once = ensureReusableCompositeOrigins(makeDocument());
    const twice = ensureReusableCompositeOrigins(once);
    // 참조 동일성은 `ensureComponentsSystemPage` 의 repair 가 매번 새 노드를 내는 기존 동작
    //   (ADR-228 이전부터) 때문에 보장되지 않는다 — 직렬화 Δ0 가 멱등의 정의다.
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(JSON.stringify(twice).length).toBe(JSON.stringify(once).length);
  });

  it("기존 origin 의 사용자 편집 (root props · children · responsive · 위치) 을 보존하고 부재 키만 채운다", () => {
    const seeded = ensureCatalogOrigins(makeDocument());
    const buttonId = catalogReusableOriginId("Button");
    const selectId = catalogReusableOriginId("Select");
    const edited: CompositionDocument = {
      ...seeded,
      children: (function edit(nodes: CanonicalNode[]): CanonicalNode[] {
        return nodes.map((n) => {
          if (n.id === buttonId) {
            const { size: _size, ...rest } = n.props ?? {};
            return {
              ...n,
              props: { ...rest, variant: "accent", children: "Buy now" },
              responsive: { styles: { tablet: { width: "100%" } } } as never,
            };
          }
          if (n.id === selectId) {
            return { ...n, children: [] }; // 사용자가 자식을 전부 지움
          }
          return n.children ? { ...n, children: edit(n.children) } : n;
        });
      })(seeded.children),
    };
    const repaired = ensureCatalogOrigins(edited);
    const button = findById(repaired.children, buttonId)!;
    expect(button.props?.variant).toBe("accent");
    expect(button.props?.children).toBe("Buy now");
    expect(button.props?.size).toBe("md"); // 부재 키 보강 (코드 정본 기본값)
    expect(button.responsive).toEqual({
      styles: { tablet: { width: "100%" } },
    });
    expect(findById(repaired.children, selectId)?.children).toEqual([]);
    // 위치 (body 안 순서) 보존 — Components body 의 root 순서가 같다.
    const order = (doc: CompositionDocument) =>
      findById(doc.children, COMPONENTS_SYSTEM_BODY_ID)!.children!.map(
        (n) => n.id,
      );
    expect(order(repaired)).toEqual(order(seeded));
  });

  it("사용자가 origin 순서를 바꾸거나 frame 에 넣어도 재hydration 이 되돌리지 않는다 — 누락만 보충 (codex round 3 h2)", () => {
    const seeded = ensureReusableCompositeOrigins(makeDocument());
    const bodyOf = (doc: CompositionDocument) =>
      findById(doc.children, COMPONENTS_SYSTEM_BODY_ID)!;
    const seededOrder = bodyOf(seeded).children!.map((n) => n.id);
    // ① 역순 재정렬 + ② 첫 origin 을 사용자 frame 안으로 이동 + ③ origin 하나 제거 (누락)
    const reversed = [...bodyOf(seeded).children!].reverse();
    const [moved, ...rest] = reversed;
    const removedId = rest[rest.length - 1]!.id;
    const kept = rest.slice(0, -1);
    const rewriteBody = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
      nodes.map((n) =>
        n.id === COMPONENTS_SYSTEM_BODY_ID
          ? {
              ...n,
              children: [
                { id: "user-frame", type: "frame", children: [moved!] },
                ...kept,
              ] as CanonicalNode[],
            }
          : n.children
            ? { ...n, children: rewriteBody(n.children) }
            : n,
      );
    const edited: CompositionDocument = {
      ...seeded,
      children: rewriteBody(seeded.children),
    };
    const repaired = ensureReusableCompositeOrigins(edited);
    const repairedBody = bodyOf(repaired);
    // 순서·위치 보존: user-frame 이 맨 앞, 그 안에 moved, 나머지는 역순 그대로
    expect(repairedBody.children![0]!.id).toBe("user-frame");
    expect(repairedBody.children![0]!.children!.map((n) => n.id)).toEqual([
      moved!.id,
    ]);
    expect(
      repairedBody.children!.slice(1, kept.length + 1).map((n) => n.id),
    ).toEqual(kept.map((n) => n.id));
    // 누락 origin 하나만 맨 뒤에 보충
    expect(
      repairedBody.children!.slice(kept.length + 1).map((n) => n.id),
    ).toEqual([removedId]);
    // 집합은 seed 와 같다 (root 수 · id 집합)
    const ids = (nodes: readonly CanonicalNode[]): string[] =>
      nodes.flatMap((n) => [n.id, ...ids(n.children ?? [])]);
    expect(
      new Set(
        ids(repairedBody.children!).filter((id) => seededOrder.includes(id)),
      ),
    ).toEqual(new Set(seededOrder));
    // 멱등
    expect(ensureReusableCompositeOrigins(repaired)).toEqual(repaired);
  });

  it("repairCatalogOrigin — metadata 는 코드 정본 (systemOwned · componentFamily) 을 확정한다", () => {
    const base = buildCatalogOrigin("Badge");
    const repaired = repairCatalogOrigin(
      { ...base, metadata: { type: "user-touched", systemOwned: false } },
      base,
    );
    expect(repaired.metadata?.systemOwned).toBe(true);
    expect(repaired.metadata?.componentFamily).toBe("Badge");
    expect(repaired.metadata?.type).toBe("user-touched");
  });
});

function commonVariantProps(type: string): Record<string, unknown> | undefined {
  const variants = getReusableEntry(type)?.panel.creationVariants;
  if (!variants?.length) return undefined;
  const common: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(variants[0].initialProps)) {
    if (
      variants.every(
        (v) => JSON.stringify(v.initialProps[key]) === JSON.stringify(value),
      )
    )
      common[key] = value;
  }
  return common;
}

describe("ADR-228 G1 — factory 동치 (origin = live 생성 경로가 만드는 것)", () => {
  const complexTypes = getCatalogOriginTypes().filter((t) =>
    COMPLEX_COMPONENT_TAGS.has(t),
  );
  const leafTypes = getCatalogOriginTypes().filter(
    (t) => !COMPLEX_COMPONENT_TAGS.has(t),
  );

  it("complex 38 — subtree 의 type 순서 · props 가 createElementsFromDefinition 결과와 같다", () => {
    // ADR-229 Phase 1: TagGroup (complex) 은 손 ensurer 로 이동 — 39 → 38.
    expect(complexTypes).toHaveLength(38);
    for (const type of complexTypes) {
      const creator = ComponentFactory.getDefinitionCreator(type)!;
      const definition = creator({
        parentElement: null,
        pageId: "",
        elements: [],
        doc: makeDocument(),
      });
      const { parent, children } = createElementsFromDefinition(definition, {
        pageId: null,
        layoutId: null,
      });
      const origin = buildCatalogOrigin(type);
      // root props: 비결정 값 (items 의 randomUUID) 을 제외하고 키 집합 + 결정 값 대조
      // 비결정 값 — factory 가 crypto.randomUUID() 로 만드는 item id · selectedKey · itemId
      //   페어링은 실행마다 다르다. UUID 모양의 문자열 값 전부를 자리표시자로 치환한다.
      const UUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const stripIds = (value: unknown): unknown =>
        JSON.parse(
          JSON.stringify(value, (_key, v) =>
            typeof v === "string" && UUID.test(v) ? "<uuid>" : v,
          ),
        );
      expect(stripIds(origin.props), type).toEqual(stripIds(parent.props));
      // 자식: DFS 순서의 type 과 props (전파 적용 후) — id/customId/parent_id 는 다르다.
      const liveChildren = children.map((c) => ({
        type: c.type,
        props: stripIds(c.props),
      }));
      const originChildren = flattenTypesAndProps(origin).map((c) => ({
        type: c.type,
        props: stripIds(c.props),
      }));
      expect(originChildren, type).toEqual(liveChildren);
    }
  });

  it("leaf 11 — root props 가 팔레트 else 분기 합성 (composeCreationProps ∘ getDefaultProps) 과 같다", () => {
    expect(leafTypes).toHaveLength(11);
    for (const type of leafTypes) {
      const origin = buildCatalogOrigin(type);
      expect(origin.children, type).toBeUndefined();
      // 팔레트가 만드는 plain 노드는 다음 로드의 형태 migration 을 거친 뒤가 유효값이다
      //   (ProgressCircle 의 stale inline 32 가 strip 된다) — origin 은 그 정규화 뒤 모양.
      const live = applyCanonicalDocumentMigrations({
        version: "composition-1.0",
        children: [
          {
            id: "live",
            type: type as CanonicalNode["type"],
            props: composeCreationProps(
              type,
              getDefaultProps(type),
              // 진입점이 여럿이면 (Chart) 공통 initialProps 를 origin 이 소유한다 (§3.2).
              commonVariantProps(type),
            ),
          },
        ],
      }).children[0]!;
      expect(origin.props, type).toEqual(live.props);
    }
  });

  it("Chart origin 은 진입점 initialProps (chartType) 를 굽지 않는다 — instance override 소유", () => {
    const origin = buildCatalogOrigin("Chart");
    const variants = getReusableEntry("Chart")!.panel.creationVariants!;
    const chartTypes = new Set(variants.map((v) => v.initialProps.chartType));
    expect(chartTypes.size).toBe(7);
    // origin 의 chartType 은 catalog 기본값 하나 — 7 진입점 중 어느 하나로 고정된 값이 아니다.
    expect(origin.props?.chartType).toBe(getDefaultProps("Chart").chartType);
    // 공통 initialProps (전 진입점 동일 값) 는 origin 이 소유한다.
    for (const [key, value] of Object.entries(commonVariantProps("Chart")!)) {
      expect(origin.props?.[key], key).toEqual(value);
    }
  });
});

describe("ADR-228 G1 — entry 원복 RED (게이트가 반응하는 행)", () => {
  it("목록에서 뺀 type 은 origin 이 시드되지 않는다", () => {
    // 같은 ensure 경로를 목록 하나 줄인 입력으로 돌린다 — 결과에 그 origin 이 없어야 한다.
    const without = getCatalogOriginTypes().filter((t) => t !== "Badge");
    const doc = ensureCatalogOrigins(makeDocument());
    const stripped: CompositionDocument = {
      ...doc,
      children: (function strip(nodes: CanonicalNode[]): CanonicalNode[] {
        return nodes
          .filter((n) => n.id !== catalogReusableOriginId("Badge"))
          .map((n) => (n.children ? { ...n, children: strip(n.children) } : n));
      })(doc.children),
    };
    const ids = new Set(
      findById(stripped.children, COMPONENTS_SYSTEM_BODY_ID)!.children!.map(
        (n) => n.id,
      ),
    );
    expect(ids.has(catalogReusableOriginId("Badge"))).toBe(false);
    expect(without.every((t) => ids.has(catalogReusableOriginId(t)))).toBe(
      true,
    );
    // 원복 = 다시 ensure 하면 돌아온다 (BC: 롤백은 entry 원복이며 origin 은 남아도 무해).
    const restored = ensureCatalogOrigins(stripped);
    expect(
      findById(restored.children, catalogReusableOriginId("Badge")),
    ).toBeDefined();
  });
});

describe("ADR-228 G4 — 문서 증가량 (Δnode · Δbyte) 실측 기록", () => {
  function countNodes(nodes: readonly CanonicalNode[]): number {
    let n = 0;
    for (const node of nodes) n += 1 + countNodes(node.children ?? []);
    return n;
  }
  it("generic origin 49 = root 49 + descendants 133 (ADR-228 G0 50/135 − TagGroup 1/2, ADR-229 Phase 1) · Δbyte 는 예상 ±20%", () => {
    const base = makeDocument();
    // hand seed 5 + template origin 만 시드한 문서를 기준으로 generic 만의 증가를 잰다.
    const withoutGeneric = ensureReusableCompositeOrigins({
      ...base,
    });
    const genericIds = new Set(
      getCatalogOriginTypes().map(catalogReusableOriginId),
    );
    const stripGeneric = (nodes: CanonicalNode[]): CanonicalNode[] =>
      nodes
        .filter((n) => !genericIds.has(n.id))
        .map((n) =>
          n.children ? { ...n, children: stripGeneric(n.children) } : n,
        );
    const before: CompositionDocument = {
      ...withoutGeneric,
      children: stripGeneric(withoutGeneric.children),
    };
    const after = ensureCatalogOrigins(before);
    const deltaNodes = countNodes(after.children) - countNodes(before.children);
    const deltaBytes =
      JSON.stringify(after).length - JSON.stringify(before).length;
    const roots = getCatalogOriginTypes().length;
    expect(roots).toBe(49);
    expect(deltaNodes - roots).toBe(133);
    // G0 예상 ~28 KB 는 definition 직렬화 합 — 실측 37,952 B (id · name · metadata 가 더해진다,
    //   2026-09-21). 범위 밖이면 seed 모양이 바뀐 것이니 inventory (breakdown §8.5) 를 갱신할 것.
    expect(deltaBytes).toBeGreaterThan(30_000);
    expect(deltaBytes).toBeLessThan(45_000);
    console.log(
      `[ADR-228 G4] Δnode ${deltaNodes} (root ${roots} + desc ${deltaNodes - roots}) · Δbyte ${deltaBytes}`,
    );
  });
});
