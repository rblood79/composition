/* eslint-disable no-console */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  calculateFullTreeLayout,
  resetPersistentTree,
} from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import { PersistentLayoutTree } from "@/builder/workspace/canvas/layout/engines/persistentLayoutTree";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import { useStore } from "@/builder/stores";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";
import { getComponentRulesTable } from "@composition/shared";
import {
  allPaletteCreationTrees,
  paletteCreationFacets,
  type ProductionTree,
} from "./adr923ProductionTrees";

// production 진입점 `ComponentFactory.createComplexComponent` 는 트리를 만든 뒤 store 에 기록한다
//   (`addElementsToStore` → canonical mutation runner, bridge 필요). 기록 단계만 no-op — 트리 형태는
//   무변경 (adr923ProductionTrees 계약).
vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 4 — **DC-6 overflow cap 인벤토리** (Phase 3 round 9 후속 ②, 동작 무변경).
 *
 * `enrichWithIntrinsicSize` 는 `style.overflow !== "visible"` 이면 주입 intrinsic 높이/폭을
 * availableHeight/Width 로 cap 한다 (utils `isOverflowClipped`, 게이트 `needsHeight = !rawHeight`
 * 라 height 미지정 요소 전부가 대상). 이것은 엔진 flex §4.5 automatic minimum 의 TS 중복이면서
 * block 문맥에도 걸고 clip 을 hidden 과 같이 취급한다 — Phase 5 cutover 제거 목록. 이 Phase 는
 * **Q4 소비 경로 캡처만** 한다: 팔레트가 만드는 실제 트리를 production 진입점 `calculateFullTreeLayout`
 * 으로 돌려, wasm 경계로 직렬화되는 batch (`PersistentLayoutTree.buildFull(batch)` — `buildTreeBatch`
 * JSON 은 이 배열의 `{style, children}` 사영이라 elementId 를 잃으므로 한 단계 앞에서 잡는다) 에서
 * **overflow 를 받는 노드의 주입 높이/폭이 availableHeight/Width 에 따라 달라지는가** (= cap 이 실제로
 * 걸리는가) 를 availH/availW 8 ↔ 100000 run 으로 잰다.
 *
 * ## 입력 (round 29 r29m1 수리 — production 생성 SSOT 파생)
 * - **팔레트 전수 × creation facet** (`adr923ProductionTrees`): reusableOrigin 5 는 origin seed +
 *   `type:"ref"` instance → `resolveCanonicalRefTree` materialize (Card/InlineAlert/Form/Toolbar/
 *   IconButton — 종전에는 leaf 로 만들어 origin 트리가 통째로 빠졌다), complex 는
 *   `ComponentFactory.createComplexComponent` (종전 수동 CREATORS 44 에 없던 ToggleButtonGroup ·
 *   Table · TableView · Calendar · RangeCalendar 가 complex 제외 조건 때문에 leaf 에도 못 들어갔다),
 *   none 은 `getDefaultProps`. facet 집합 자체를 `EXPECTED_FACETS` 로 고정 — 팔레트/facet 변경 = RED.
 * - **sub-part standalone** (참고 arm): catalog rule 중 팔레트도 아니고 팔레트 트리 안에도 나타나지
 *   않는 type 을 `getDefaultProps` leaf 로 (사용자가 팔레트로 만들 수 없는 형태 — AI/import 같은
 *   열린 writer 만 도달). 키에 `subpart` 접두사.
 * - **사용자 inline** 5: Inspector Appearance > Overflow 가 쓰는 `style.overflow`.
 *
 * 결과는 아래 EXPECTED 에 ratchet 으로 고정한다 (새 도달 = RED, 감소는 수리 결과로만). 키는
 * `${arm} ${type} > ${node} overflow:${v} H… W…` — arm 이 바뀌면 키가 바뀐다 (손실 없는 키).
 */

interface CaseTree {
  name: string;
  root: Element;
  elements: Element[];
}

function leafTree(type: string, prefix: string): CaseTree {
  let props: Record<string, unknown> = {};
  try {
    props = { ...(getDefaultProps(type) as Record<string, unknown>) };
  } catch {
    props = {};
  }
  const root = {
    id: `${prefix}-${type}`,
    type,
    props,
    parent_id: null,
  } as unknown as Element;
  return { name: `${prefix} ${type}`, root, elements: [root] };
}

/** 사용자 inline 경로 (Inspector Appearance > Overflow 가 `style.overflow` 를 쓴다) */
function inlineOverflowTree(overflow: string): CaseTree {
  const root = {
    id: `inline-${overflow}`,
    type: "div",
    props: { style: { overflow, width: 200 } },
    parent_id: null,
  } as unknown as Element;
  const text = {
    id: `inline-${overflow}-text`,
    type: "Text",
    props: {
      children:
        "overflow cap 인벤토리 — 긴 문장이 여러 줄로 감겨 높이가 availableHeight 를 넘는다. ".repeat(
          4,
        ),
    },
    parent_id: root.id,
  } as unknown as Element;
  return {
    name: `inline div overflow:${overflow}`,
    root,
    elements: [root, text],
  };
}

/** 사용자 inline 경로 — INTRINSIC_MEASURE_TAGS leaf (needsWidth) 에 overflow 를 주면 폭 cap 도 열린다 */
function inlineOverflowLeafTree(overflow: string): CaseTree {
  const root = {
    id: `inline-leaf-${overflow}`,
    type: "Button",
    props: {
      children: "긴 라벨을 가진 버튼 — intrinsic 폭이 availableWidth 를 넘는다",
      style: { overflow },
    },
    parent_id: null,
  } as unknown as Element;
  return {
    name: `inline Button overflow:${overflow}`,
    root,
    elements: [root],
  };
}

let seq = 0;
function runTree(
  tree: CaseTree,
  availW: number,
  availH: number,
): Map<string, { type: string; style: Record<string, unknown> }> {
  const pageId = `adr923-dc6-${seq++}`;
  const elementsMap = new Map<string, CanvasLayoutNode>();
  const childrenMap = new Map<string, string[]>();
  for (const el of tree.elements) {
    elementsMap.set(el.id, {
      ...el,
      page_id: el.id === tree.root.id ? pageId : null,
    } as unknown as CanvasLayoutNode);
    childrenMap.set(el.id, []);
  }
  for (const el of tree.elements) {
    if (el.parent_id && childrenMap.has(el.parent_id)) {
      childrenMap.get(el.parent_id)!.push(el.id);
    }
  }
  const getChild = (id: string): CanvasLayoutNode[] =>
    (childrenMap.get(id) ?? []).map((cid) => elementsMap.get(cid)!);
  const spy = vi.spyOn(PersistentLayoutTree.prototype, "buildFull");
  resetPersistentTree(pageId);
  try {
    const map = calculateFullTreeLayout(
      tree.root.id,
      elementsMap,
      childrenMap,
      availW,
      availH,
      getChild,
    );
    if (!map) throw new Error(`${tree.name}: calculateFullTreeLayout null`);
    const batch = spy.mock.calls.at(-1)?.[1];
    if (!batch) throw new Error(`${tree.name}: buildFull 미호출`);
    const out = new Map<
      string,
      { type: string; style: Record<string, unknown> }
    >();
    for (const n of batch) {
      out.set(n.elementId, {
        type: elementsMap.get(n.elementId)?.type ?? n.elementId,
        style: n.style,
      });
    }
    return out;
  } finally {
    spy.mockRestore();
    resetPersistentTree(pageId);
  }
}

interface Row {
  tree: string;
  node: string;
  overflow: string;
  heightCapped: boolean;
  widthCapped: boolean;
  low: [unknown, unknown];
  high: [unknown, unknown];
}

/** batch 치수는 `"21px"` 같은 px 문자열 (engineStyleToRecord) — 숫자로 푼다. */
function px(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^-?\d+(\.\d+)?px$/.test(v))
    return parseFloat(v);
  return undefined;
}

function inventory(tree: CaseTree): Row[] {
  // cap 은 `injectHeight > availableHeight` / `injectWidth > availableWidth` 일 때만 걸리므로
  //   available 을 leaf 치수보다 작게 (8) 준 run 과 사실상 무한(100000) run 을 대조한다.
  const lowH = runTree(tree, 400, 8);
  const lowW = runTree(tree, 8, 100000);
  const high = runTree(tree, 400, 100000);
  const rows: Row[] = [];
  for (const [id, { type, style }] of high) {
    const ov =
      (style.overflow as string | undefined) ??
      (style.overflowY as string | undefined) ??
      (style.overflowX as string | undefined);
    if (ov === undefined || ov === "visible") continue;
    const hL = lowH.get(id)?.style ?? {};
    const wL = lowW.get(id)?.style ?? {};
    const heightCapped =
      px(hL.height) !== undefined &&
      px(style.height) !== undefined &&
      px(hL.height) !== px(style.height);
    const widthCapped =
      px(wL.width) !== undefined &&
      px(style.width) !== undefined &&
      px(wL.width) !== px(style.width);
    rows.push({
      tree: tree.name,
      node: type,
      overflow: ov,
      heightCapped,
      widthCapped,
      low: [wL.width, hL.height],
      high: [style.width, style.height],
    });
  }
  return rows;
}

describe("ADR-923 Phase 4 — DC-6 overflow cap 인벤토리 (Q4 소비 경로 캡처)", () => {
  let paletteTrees: ProductionTree[] = [];

  beforeAll(async () => {
    await initCompositionEngineWasm();
    useStore.setState({ elements: [], elementsMap: new Map() } as never);
    paletteTrees = await allPaletteCreationTrees("adr923-dc6-palette");
  });

  it("입력 집합 = 팔레트 × creation facet (production SSOT) — 집합 자체를 고정", () => {
    const facets = paletteCreationFacets();
    console.log(`ADR923DC6FACETS ${JSON.stringify(facets)}`);
    expect(facets).toEqual(EXPECTED_FACETS);
    // 세 arm 전부 실제 형태로 존재한다 (ref 는 origin 자손이 materialize 됐는가로 판정)
    const byArm = new Map<string, ProductionTree[]>();
    for (const t of paletteTrees) {
      byArm.set(t.arm, [...(byArm.get(t.arm) ?? []), t]);
    }
    expect([...byArm.keys()].sort()).toEqual([
      "palette:complex",
      "palette:none",
      "palette:ref",
    ]);
    for (const t of byArm.get("palette:ref") ?? []) {
      expect(t.root.type, `${t.type} resolved root`).not.toBe("ref");
      expect(t.elements.length, `${t.type} origin 자손`).toBeGreaterThan(1);
    }
    for (const t of byArm.get("palette:complex") ?? []) {
      expect(t.root.type, `${t.type} factory root`).toBeTruthy();
    }
  });

  it("overflow 를 받아 wasm 경계에 도달하는 노드와 cap 실동작 (ratchet)", () => {
    const paletteTypes = new Set(paletteTrees.map((t) => t.type));
    const typesInPaletteTrees = new Set(
      paletteTrees.flatMap((t) => t.elements.map((el) => el.type)),
    );
    const subpartTypes = Object.keys(getComponentRulesTable()).filter(
      (k) =>
        !paletteTypes.has(k) && !typesInPaletteTrees.has(k) && k !== "body",
    );
    const trees: CaseTree[] = [
      ...paletteTrees,
      ...subpartTypes.map((t) => leafTree(t, "subpart")),
      inlineOverflowTree("hidden"),
      inlineOverflowTree("clip"),
      inlineOverflowTree("auto"),
      inlineOverflowLeafTree("hidden"),
      inlineOverflowLeafTree("clip"),
    ];
    const rows = trees.flatMap(inventory);
    // ratchet 키는 도달·cap 여부만 (치수는 폰트 측정 의존이라 로그로만 남긴다)
    const summary = rows.map(
      (r) =>
        `${r.tree} > ${r.node} overflow:${r.overflow} H${r.heightCapped ? "capped" : "="} W${r.widthCapped ? "capped" : "="}`,
    );
    console.log(
      `[ADR-923 DC-6 inventory] palette ${paletteTrees.length} · subpart ${subpartTypes.length} · inline 5\n` +
        rows
          .map(
            (r, i) =>
              `ADR923DC6ROW ${summary[i]} low(w@availW8,h@availH8)=${JSON.stringify(r.low)} high=${JSON.stringify(r.high)}`,
          )
          .join("\n"),
    );
    expect(paletteTrees.length).toBeGreaterThan(60);
    expect(summary).toEqual(EXPECTED);
  });
});

/** 팔레트 type → creation facet (production SSOT 파생값의 고정 — 팔레트 추가/facet 변경 = RED). */
const EXPECTED_FACETS: Record<string, "reusableOrigin" | "complex" | "none"> = {
  Text: "none",
  Icon: "none",
  Separator: "none",
  Badge: "none",
  ProgressBar: "complex",
  Skeleton: "none",
  Avatar: "none",
  AvatarGroup: "complex",
  StatusLight: "none",
  InlineAlert: "reusableOrigin",
  ProgressCircle: "none",
  Image: "none",
  IllustratedMessage: "complex",
  Card: "reusableOrigin",
  frame: "none",
  Tabs: "complex",
  Breadcrumbs: "complex",
  Link: "none",
  Nav: "complex",
  Pagination: "complex",
  DisclosureGroup: "complex",
  Disclosure: "complex",
  CardView: "complex",
  Slot: "none",
  Button: "none",
  IconButton: "reusableOrigin",
  ToggleButton: "none",
  ToggleButtonGroup: "complex",
  Toolbar: "reusableOrigin",
  ButtonGroup: "complex",
  Menu: "complex",
  TextField: "complex",
  TextArea: "complex",
  NumberField: "complex",
  SearchField: "complex",
  ColorField: "complex",
  Checkbox: "complex",
  CheckboxGroup: "complex",
  RadioGroup: "complex",
  Select: "complex",
  ComboBox: "complex",
  Switch: "complex",
  Slider: "complex",
  Meter: "complex",
  // TailSwatch 는 2026-09-04 팔레트에서 제거 (ComponentFactory creator 부재 — 사용자 판정).
  DropZone: "none",
  FileTrigger: "none",
  Form: "reusableOrigin",
  Table: "complex",
  ListBox: "complex",
  GridList: "complex",
  Tree: "complex",
  TagGroup: "complex",
  Section: "none",
  TableView: "complex",
  Calendar: "complex",
  DatePicker: "complex",
  DateRangePicker: "complex",
  DateField: "complex",
  TimeField: "complex",
  RangeCalendar: "complex",
  Dialog: "complex",
  Modal: "none",
  Popover: "complex",
  Tooltip: "complex",
};

/**
 * **Phase 5 (2026-09-02) — DC-6 cap 삭제 후 ratchet**: 아래 19 행의 도달 집합은 그대로이고 cap 실동작은
 * 8 → **0** (SelectValue 4 · ListBox/GridList 2 · inline Button 2 전부 `H= W=`). 제거의 Chrome 회귀
 * 게이트는 `adr923Dc6ChromeGate.browser.test.ts` (block 문맥 auto-height + overflow 는 cap 없음 /
 * flex 문맥 scroll container 는 엔진 §4.5 automatic minimum 0). 아래 Phase 4 기록은 제거 전 사실.
 *
 * 캡처 결과 (2026-09-02, round 29 r29m1 수리 후 재캡처 — DC-6 코드 무변경, Phase 5 제거 전):
 * - 입력: 팔레트 65 (ref 5 · complex 41 · none 19) + sub-part standalone 21 + 사용자 inline 5.
 * - overflow ≠ visible 로 wasm 경계에 도달하는 노드 **19** (팔레트 14 + inline 5).
 * - **cap 이 실제로 걸리는 노드 8** — SelectValue 4 (Select · ComboBox · NumberField · SearchField 의
 *   trigger 값 텍스트: implicit `overflow:hidden` 주입 + height 미지정 → 높이 cap) + **ListBox ·
 *   GridList 2** (production 형태 = factory 의 `type:"ref"` parent 를 origin 에 해석한 컨테이너 —
 *   overflow auto/hidden + height 미지정 + 정적 items 의 sample 행 높이 164 주입 → 높이 cap. 종전
 *   수동 목록에서는 ref 가 해석되지 않아 ListBox 는 `> ref H=` 로 보였고 GridList 는 행 자체가 없었다
 *   (ListBox factory ref parent 만 raw `overflow:"auto"` 를 지니고, GridList 의 `overflow:hidden` 은
 *   implicitStyles gridlist 분기가 해석된 타입에만 주입 — round 29 판독이 연 발견, round 30 재실측) +
 *   사용자가 INTRINSIC_MEASURE_TAGS leaf(Button) 에 inline overflow 를 준 경우 (높이 + 폭 cap) 2.
 * - 나머지 11 은 height 명시 (CardView 의 Card 160) 이거나 auto-height 컨테이너 (주입 높이가 엔진
 *   결과로 대체돼 cap 이 살아남지 않음 — Card origin · Tree · Dialog · DisclosureGroup · inline div).
 * - 종전 수동 목록이 놓친 형태 (ToggleButtonGroup · Table · TableView · Calendar · RangeCalendar
 *   complex 5 · Form · Toolbar · InlineAlert · IconButton ref 4) 는 overflow 도달 노드 0.
 * Phase 5 제거 시 Chrome 케이스: block 문맥 auto-height + overflow hidden/clip 은 cap 되지 않는다 /
 * flex 문맥은 엔진 §4.5 가 담당 — SelectValue 4 + ListBox/GridList 2 + Button inline 이 그 회귀
 * 게이트의 대상이다. ListBox/GridList 는 production 서브트리를 main-axis 크기가 제한된 flex 부모의
 * item 으로 두고 ListBox overflow:auto · GridList overflow:hidden 이 automatic minimum 0 으로
 * 소비되는지 확인한다 (round 30 r30l3 — `is_scroll_container` (tree.rs) 는 §4.5 의 입력이지 대안이
 * 아니다; 여기의 availableHeight=8 대조는 TS cap 존재만 확인하고 §4.5 소비를 증명하지 않는다).
 */
const EXPECTED: string[] = [
  "palette:ref Card > CardPreview overflow:hidden H= W=",
  "palette:ref Card > Card overflow:hidden H= W=",
  "palette:complex DisclosureGroup > DisclosureGroup overflow:hidden H= W=",
  "palette:complex CardView > Card overflow:hidden H= W=",
  "palette:complex CardView > Card overflow:hidden H= W=",
  "palette:complex CardView > Card overflow:hidden H= W=",
  "palette:complex NumberField > SelectValue overflow:hidden H= W=",
  "palette:complex SearchField > SelectValue overflow:hidden H= W=",
  "palette:complex Select > SelectValue overflow:hidden H= W=",
  "palette:complex ComboBox > SelectValue overflow:hidden H= W=",
  "palette:complex ListBox > ListBox overflow:auto H= W=",
  "palette:complex GridList > GridList overflow:hidden H= W=",
  "palette:complex Tree > Tree overflow:auto H= W=",
  "palette:complex Dialog > Dialog overflow:auto H= W=",
  "inline div overflow:hidden > div overflow:hidden H= W=",
  "inline div overflow:clip > div overflow:clip H= W=",
  "inline div overflow:auto > div overflow:auto H= W=",
  "inline Button overflow:hidden > Button overflow:hidden H= W=",
  "inline Button overflow:clip > Button overflow:clip H= W=",
];
