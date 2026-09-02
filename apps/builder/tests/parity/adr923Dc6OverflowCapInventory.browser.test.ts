import { beforeAll, describe, expect, it, vi } from "vitest";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import {
  calculateFullTreeLayout,
  resetPersistentTree,
} from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import { PersistentTaffyTree } from "@/builder/workspace/canvas/layout/engines/persistentTaffyTree";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import { useStore } from "@/builder/stores";
import { createElementsFromDefinition } from "@/builder/factories/utils/elementCreation";
import { COMPLEX_COMPONENT_TAGS } from "@/builder/factories/constants";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";
import type {
  ComponentDefinition,
  ComponentCreationContext,
} from "@/builder/factories/types";
import { getComponentRulesTable } from "@composition/shared";
import {
  createTabsDefinition,
  createTreeDefinition,
} from "@/builder/factories/definitions/LayoutComponents";
import {
  createTextFieldDefinition,
  createTextAreaDefinition,
  createNumberFieldDefinition,
  createSearchFieldDefinition,
  createSliderDefinition,
  createToastDefinition,
} from "@/builder/factories/definitions/FormComponents";
import {
  createCardViewDefinition,
  createIllustratedMessageDefinition,
  createImageDefinition,
  createProgressBarDefinition,
  createMeterDefinition,
  createProgressCircleDefinition,
  createStatusLightDefinition,
  createAvatarGroupDefinition,
  createButtonGroupDefinition,
} from "@/builder/factories/definitions/DisplayComponents";
import {
  createFrameLayoutDefinition,
  createCheckboxDefinition,
  createRadioDefinition,
  createSwitchDefinition,
  createCheckboxGroupDefinition,
  createRadioGroupDefinition,
  createTagGroupDefinition,
  createBreadcrumbsDefinition,
} from "@/builder/factories/definitions/GroupComponents";
import {
  createSelectDefinition,
  createComboBoxDefinition,
  createListBoxDefinition,
  createGridListDefinition,
} from "@/builder/factories/definitions/SelectionComponents";
import {
  createDialogDefinition,
  createPopoverDefinition,
  createTooltipDefinition,
} from "@/builder/factories/definitions/OverlayComponents";
import {
  createDateFieldDefinition,
  createTimeFieldDefinition,
  createDatePickerDefinition,
  createDateRangePickerDefinition,
  createColorFieldDefinition,
  createColorPickerDefinition,
  createColorSwatchPickerDefinition,
} from "@/builder/factories/definitions/DateColorComponents";
import {
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
  createMenuDefinition,
  createNavDefinition,
  createPaginationDefinition,
} from "@/builder/factories/definitions/NavigationComponents";

/**
 * ADR-923 Phase 4 — **DC-6 overflow cap 인벤토리** (Phase 3 round 9 후속 ②, 동작 무변경).
 *
 * `enrichWithIntrinsicSize` 는 `style.overflow !== "visible"` 이면 주입 intrinsic 높이/폭을
 * availableHeight/Width 로 cap 한다 (utils `isOverflowClipped`, 게이트 `needsHeight = !rawHeight`
 * 라 height 미지정 요소 전부가 대상). 이것은 엔진 flex §4.5 automatic minimum 의 TS 중복이면서
 * block 문맥에도 걸고 clip 을 hidden 과 같이 취급한다 — Phase 5 cutover 제거 목록. 이 Phase 는
 * **Q4 소비 경로 캡처만** 한다: 팔레트가 만드는 실제 트리 (factory definition + 기본 props +
 * `applyImplicitStyles`) 를 production 진입점 `calculateFullTreeLayout` 으로 돌려, wasm 경계로
 * 직렬화되는 batch (`PersistentTaffyTree.buildFull(batch)` — `buildTreeBatch` JSON 은 이 배열의
 * `{style, children}` 사영이라 elementId 를 잃으므로 한 단계 앞에서 잡는다) 에서 **overflow 를
 * 받는 노드의 주입 높이/폭이 availableHeight/Width 에 따라 달라지는가** (= cap 이 실제로 걸리는가)
 * 를 availH 24 ↔ 100000 두 run 으로 잰다.
 *
 * 결과는 아래 EXPECTED 에 ratchet 으로 고정한다 (새 도달 = RED, 감소는 수리 결과로만).
 */
type Creator = (ctx: ComponentCreationContext) => ComponentDefinition;

const CREATORS: Record<string, Creator> = {
  Tabs: createTabsDefinition,
  Tree: createTreeDefinition,
  TextField: createTextFieldDefinition,
  TextArea: createTextAreaDefinition,
  NumberField: createNumberFieldDefinition,
  SearchField: createSearchFieldDefinition,
  Slider: createSliderDefinition,
  Toast: createToastDefinition,
  CardView: createCardViewDefinition,
  IllustratedMessage: createIllustratedMessageDefinition,
  Image: createImageDefinition,
  ProgressBar: createProgressBarDefinition,
  Meter: createMeterDefinition,
  ProgressCircle: createProgressCircleDefinition,
  StatusLight: createStatusLightDefinition,
  AvatarGroup: createAvatarGroupDefinition,
  ButtonGroup: createButtonGroupDefinition,
  frame: createFrameLayoutDefinition,
  Checkbox: createCheckboxDefinition,
  Radio: createRadioDefinition,
  Switch: createSwitchDefinition,
  CheckboxGroup: createCheckboxGroupDefinition,
  RadioGroup: createRadioGroupDefinition,
  TagGroup: createTagGroupDefinition,
  Breadcrumbs: createBreadcrumbsDefinition,
  Select: createSelectDefinition,
  ComboBox: createComboBoxDefinition,
  ListBox: createListBoxDefinition,
  GridList: createGridListDefinition,
  Dialog: createDialogDefinition,
  Popover: createPopoverDefinition,
  Tooltip: createTooltipDefinition,
  DateField: createDateFieldDefinition,
  TimeField: createTimeFieldDefinition,
  DatePicker: createDatePickerDefinition,
  DateRangePicker: createDateRangePickerDefinition,
  ColorField: createColorFieldDefinition,
  ColorPicker: createColorPickerDefinition,
  ColorSwatchPicker: createColorSwatchPickerDefinition,
  Disclosure: createDisclosureDefinition,
  DisclosureGroup: createDisclosureGroupDefinition,
  Menu: createMenuDefinition,
  Nav: createNavDefinition,
  Pagination: createPaginationDefinition,
};

interface CaseTree {
  name: string;
  root: Element;
  elements: Element[];
}

function factoryTree(type: string): CaseTree {
  useStore.setState({ elements: [], elementsMap: new Map() } as never);
  const def = CREATORS[type]({
    parentElement: null,
    pageId: null,
    elements: [],
  } as unknown as ComponentCreationContext);
  const { parent, children } = createElementsFromDefinition(def, {
    pageId: null,
    layoutId: null,
  });
  return { name: type, root: parent, elements: [parent, ...children] };
}

function leafTree(type: string): CaseTree {
  let props: Record<string, unknown> = {};
  try {
    props = { ...(getDefaultProps(type) as Record<string, unknown>) };
  } catch {
    props = {};
  }
  const root = {
    id: `leaf-${type}`,
    type,
    props,
    parent_id: null,
  } as unknown as Element;
  return { name: type, root, elements: [root] };
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
    name: `div overflow:${overflow} (inline)`,
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
    name: `Button overflow:${overflow} (inline)`,
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
  const spy = vi.spyOn(PersistentTaffyTree.prototype, "buildFull");
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

/** batch 치수는 `"21px"` 같은 px 문자열 (taffyStyleToRecord) — 숫자로 푼다. */
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

const LEAF_TYPES = Object.keys(getComponentRulesTable()).filter(
  (k) => !(k in CREATORS) && !COMPLEX_COMPONENT_TAGS.has(k) && k !== "body",
);

describe("ADR-923 Phase 4 — DC-6 overflow cap 인벤토리 (Q4 소비 경로 캡처)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  it("overflow 를 받아 wasm 경계에 도달하는 노드와 cap 실동작 (ratchet)", () => {
    const trees: CaseTree[] = [
      ...Object.keys(CREATORS).map(factoryTree),
      ...LEAF_TYPES.map(leafTree),
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
      "[ADR-923 DC-6 inventory]\n" +
        rows
          .map(
            (r, i) =>
              `${summary[i]} low(w@availW8,h@availH8)=${JSON.stringify(r.low)} high=${JSON.stringify(r.high)}`,
          )
          .join("\n"),
    );
    expect(trees.length).toBeGreaterThan(100);
    expect(summary).toEqual(EXPECTED);
  });
});

/**
 * 캡처 결과 (2026-09-02, base `ee4bd0b9d` + Phase 4 준비 코드 — DC-6 코드 무변경):
 * - overflow ≠ visible 로 wasm 경계에 도달하는 노드 18 (factory/implicit 16 + 사용자 inline 2 종류)
 * - **cap 이 실제로 걸리는 노드 6** — SelectValue (Select · ComboBox · NumberField · SearchField 의
 *   trigger 값 텍스트: implicit `overflow:hidden` 주입 + height 미지정 → 높이 cap) 4 + 사용자가
 *   INTRINSIC_MEASURE_TAGS leaf(Button) 에 inline overflow 를 준 경우 (높이 + 폭 cap) 2.
 * - 나머지 12 는 height 명시 (Card 160/45) 이거나 auto-height 컨테이너 (주입 높이가 엔진 결과로
 *   대체돼 cap 이 살아남지 않음 — Tree/ListBox/Dialog/DisclosureGroup/CardPreview/inline div).
 * Phase 5 제거 시 Chrome 케이스: block 문맥 auto-height + overflow hidden/clip 은 cap 되지 않는다 /
 * flex 문맥은 엔진 §4.5 가 담당 — SelectValue 4 + Button inline 이 그 회귀 게이트의 대상이다.
 */
const EXPECTED: string[] = [
  "Tree > Tree overflow:auto H= W=",
  "NumberField > SelectValue overflow:hidden Hcapped W=",
  "SearchField > SelectValue overflow:hidden Hcapped W=",
  "CardView > Card overflow:hidden H= W=",
  "CardView > Card overflow:hidden H= W=",
  "CardView > Card overflow:hidden H= W=",
  "Select > SelectValue overflow:hidden Hcapped W=",
  "ComboBox > SelectValue overflow:hidden Hcapped W=",
  "ListBox > ref overflow:auto H= W=",
  "Dialog > Dialog overflow:auto H= W=",
  "DisclosureGroup > DisclosureGroup overflow:hidden H= W=",
  "Card > Card overflow:hidden H= W=",
  "CardPreview > CardPreview overflow:hidden H= W=",
  "div overflow:hidden (inline) > div overflow:hidden H= W=",
  "div overflow:clip (inline) > div overflow:clip H= W=",
  "div overflow:auto (inline) > div overflow:auto H= W=",
  "Button overflow:hidden (inline) > Button overflow:hidden Hcapped Wcapped",
  "Button overflow:clip (inline) > Button overflow:clip Hcapped Wcapped",
];
