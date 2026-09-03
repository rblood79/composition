import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { injectPreviewBaseStyles } from "@/preview/baseStyles";
import { Checkbox } from "@composition/shared/components/Checkbox";
import { Radio } from "@composition/shared/components/Radio";
import { RadioGroup } from "@composition/shared/components/RadioGroup";
import { Slider } from "@composition/shared/components/Slider";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { Meter } from "@composition/shared/components/Meter";
import { ProgressBar } from "@composition/shared/components/ProgressBar";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Breadcrumb } from "@composition/shared/components/Breadcrumb";
import { Calendar } from "@composition/shared/components/Calendar";
import { Disclosure } from "@composition/shared/components/Disclosure";
import { TextField } from "@composition/shared/components/TextField";
import { TextArea } from "@composition/shared/components/TextArea";
import { getElementForTag } from "@composition/specs";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { useStore } from "@/builder/stores";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";
import { getPaletteItems } from "@/builder/panels/components/paletteItems";
import {
  allPaletteCreationTrees,
  layoutTree,
  type LayoutRun,
  type ProductionTree,
} from "./adr923ProductionTrees";
import { computedDisplayOf, mountProductionRoot } from "./adr923PreviewLeg";

vi.mock("@/builder/factories/utils/elementCreation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/builder/factories/utils/elementCreation")
    >();
  return { ...actual, addElementsToStore: () => [] };
});

/**
 * ADR-923 Phase 5 — **HC2 판정표 (G4 후반)**: Phase 0 §A 가 남긴 "Canvas 전용 display override" 33 rule
 * (Q4 후보 13 · DOM 충돌 3 · DOM 선언 없음 17) 을 production 형태로 캡처해 outer display 가 DOM 과 같은지
 * 판정한다. Canvas 값 = 팔레트 생성 트리 (`adr923ProductionTrees`) 안의 해당 type 노드가 wasm 경계에
 * 보내는 `display` (팔레트에 없는 sub-part 는 그 부모의 production 트리에서, 어디에도 없으면 standalone
 * `getDefaultProps` leaf). DOM 값 = Phase 0 §A 파일 사실 (candidates) / live computed (DOM 충돌 3 —
 * 실 번들 CSS 로 shared 컴포넌트 렌더) / Preview 태그 (`getElementForTag`) 의 UA 기본값 (선언 없음 17).
 * 판정은 `HC2` 표로 고정 — 미판정 0 이 게이트다. 상세: evidence/923-phase5-cutover.md §HC2.
 */

const CANDIDATES = [
  "Button",
  "ToggleButton",
  "Menu",
  "FileTrigger",
  "Skeleton",
  "ColorPicker",
  "ColorSlider",
  "ColorSwatchPicker",
  "GridList",
  "Label",
  "Slot",
  "Tag",
  "TagList",
] as const;
const DOM_CONFLICTS = ["Checkbox", "Radio", "SliderOutput"] as const;
/**
 * Phase 5 후속 HC2 전환 — DOM 을 preview 실경로 (`rendererMap`) 로 재는 type. 전환 commit 마다 한 항목씩
 * 들어오며, 여기 든 type 은 아래 `renders` (shared 컴포넌트 직접 마운트) 에서 빠진다.
 */
const PREVIEW_LEG_TYPES: readonly string[] = [
  "Skeleton",
  "Avatar",
  "StatusLight",
  "TailSwatch",
  "Slot",
];
const UNDECLARED = [
  "Avatar",
  "Breadcrumb",
  "CalendarHeader",
  "DisclosureHeader",
  "FieldError",
  "IllustratedMessage",
  "MeterTrack",
  "MeterValue",
  "ProgressBarTrack",
  "ProgressBarValue",
  "ProgressCircle",
  "StatusLight",
  "TableHeader",
  "TableBody",
  "TailSwatch",
  "TextArea",
  "Tree",
] as const;
const ALL = [...CANDIDATES, ...DOM_CONFLICTS, ...UNDECLARED];

interface Capture {
  type: string;
  form: string; // "palette" | "subpart:<owner>" | "standalone"
  canvas: string; // wasm 경계 display
  domTag: string;
  uaDisplay: string;
  live?: string;
}

function outerOf(display: string): string {
  const d = display.trim().toLowerCase();
  if (d === "none" || d === "contents") return d;
  if (d.startsWith("inline")) return "inline";
  if (d.startsWith("table")) return d === "table" ? "block" : d;
  return "block";
}

let trees: ProductionTree[];
const runs = new Map<string, LayoutRun>();
const captures: Capture[] = [];
let liveRoots: Root[] = [];
let host: HTMLElement | undefined;
const live: Record<string, string> = {};

/**
 * r31m1 — FieldError 는 **같은 production 상태 짝** 으로 잰다. Canvas 의 FieldError 자식은 factory inline
 * `display:none` (`FormComponents.ts` TextField 정의) 이고, Phase 5 후속 (2026-09-03) 전에는 Canvas 어디에도
 * `isInvalid` 를 읽는 코드가 없었다 (지금은 propagationRegistry 가 parent `isInvalid` → style.display 를
 * 투영한다); DOM 은 RAC `FieldError` 가 validation invalid 일 때만 `<span>` 을 렌더한다. 상태를 갈라 잰 값을
 * 한 행에 두면 판정이 비어 있다 — 기본 (isInvalid:false · errorMessage "") 과 invalid (isInvalid:true +
 * errorMessage) 두 상태를 양쪽에서 각각 캡처하고, 표의 FieldError 행은 invalid 상태 짝을 근거로 판정한다.
 */
interface StatePair {
  canvas: string;
  dom: string;
}
const fieldErrorStates: Record<"default" | "invalid", StatePair> = {
  default: { canvas: "(미캡처)", dom: "(미캡처)" },
  invalid: { canvas: "(미캡처)", dom: "(미캡처)" },
};

function runOf(tree: ProductionTree): LayoutRun {
  let r = runs.get(tree.name);
  if (!r) {
    r = layoutTree(tree.root.id, tree.elements, 400, -1, "hc2");
    runs.set(tree.name, r);
  }
  return r;
}

function uaDisplayOf(tag: string): string {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  const d = getComputedStyle(el).display;
  el.remove();
  return d;
}

function standalone(type: string): ProductionTree {
  const el = {
    id: `hc2-standalone-${type}`,
    type,
    props: getDefaultProps(type),
    parent_id: null,
  } as unknown as Element;
  return {
    name: `standalone ${type}`,
    arm: "palette:none",
    type,
    root: el,
    elements: [el],
  };
}

beforeAll(async () => {
  await initCompositionEngineWasm();
  useStore.setState({ elements: [], elementsMap: new Map() });
  trees = await allPaletteCreationTrees("hc2");
  const palette = new Set(getPaletteItems().map((p) => p.type));

  for (const type of ALL) {
    let form = "standalone";
    let node: Element | undefined;
    let owner: ProductionTree | undefined;
    if (palette.has(type)) {
      owner = trees.find((t) => t.type === type && t.root.type === type);
      if (owner) {
        node = owner.root;
        form = "palette";
      }
    }
    if (!node) {
      for (const t of trees) {
        const hit = t.elements.find((el) => el.type === type);
        if (hit) {
          owner = t;
          node = hit;
          form = `subpart:${t.type}`;
          break;
        }
      }
    }
    if (!node || !owner) {
      owner = standalone(type);
      node = owner.root;
    }
    const run = runOf(owner);
    const b = run.batch.get(node.id);
    const tag = String(
      getElementForTag(type, node.props as Record<string, unknown>) ?? "div",
    );
    captures.push({
      type,
      form,
      canvas: b ? String(b.style.display ?? "(없음)") : "(batch 없음)",
      domTag: tag,
      uaDisplay: uaDisplayOf(tag),
    });
  }

  // r31m1 — FieldError Canvas 상태 짝: 같은 팔레트 TextField 트리에서 parent 를 invalid 로 바꿔 (Inspector
  //   writer 가 쓰는 top-level props — `isInvalid` · `errorMessage`) 한 번 더 돌린다. 자식 FieldError 노드는
  //   손대지 않는다 — 상태만 다른 두 캡처.
  {
    const tf = trees.find(
      (t) => t.type === "TextField" && t.root.type === "TextField",
    );
    const fe = tf?.elements.find((el) => el.type === "FieldError");
    if (tf && fe) {
      const dflt = runOf(tf).batch.get(fe.id);
      fieldErrorStates.default.canvas = dflt
        ? String(dflt.style.display ?? "(없음)")
        : "(batch 없음)";
      const invalidEls = tf.elements.map((el) =>
        el.id === tf.root.id
          ? ({
              ...el,
              props: {
                ...el.props,
                isInvalid: true,
                errorMessage: "required",
              },
            } as Element)
          : el,
      );
      const inv = layoutTree(
        tf.root.id,
        invalidEls,
        400,
        -1,
        "hc2-invalid",
      ).batch.get(fe.id);
      fieldErrorStates.invalid.canvas = inv
        ? String(inv.style.display ?? "(없음)")
        : "(batch 없음)";
    }
  }

  // live computed (실 번들 CSS) — DOM 충돌 3 + 선언 없음 17 중 렌더 가능한 것. 컴포넌트마다 root 를
  //   따로 만들고 에러 경계로 감싸 하나가 죽어도 나머지를 잰다. Table(TableHeader/TableBody) · Tree 는 props
  //   부담으로 소스 태그 사실 (§A-4 · 컴포넌트 D1 주석) 로 판정한다. TailSwatch 는 Phase 5 후속 (2026-09-03) 부터
  //   preview 실경로 (`PREVIEW_LEG_TYPES`, rendererMap renderTailSwatch) 로 live 측정한다.
  const style = document.createElement("style");
  style.id = "adr923-hc2-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
  // Preview iframe 의 전역 reset (`* { box-sizing: border-box }` 등) — production 과 같은 문자열.
  injectPreviewBaseStyles(document);
  host = document.createElement("div");
  host.style.cssText = "position:absolute;top:0;left:0;width:400px;";
  document.body.appendChild(host);

  class Boundary extends React.Component<
    { children: React.ReactNode },
    { failed: boolean }
  > {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  const renders: Array<{
    types: Array<[string, (mount: HTMLElement) => HTMLElement | null]>;
    node: React.ReactNode;
  }> = [
    {
      types: [["Checkbox", (m) => m.querySelector(".react-aria-Checkbox")]],
      node: React.createElement(Checkbox, { children: "Check" }),
    },
    {
      types: [["Radio", (m) => m.querySelector(".react-aria-Radio")]],
      node: React.createElement(
        RadioGroup,
        { label: "Group" },
        React.createElement(Radio, { value: "a", children: "A" }),
      ),
    },
    {
      types: [
        ["SliderOutput", (m) => m.querySelector(".react-aria-SliderOutput")],
      ],
      node: React.createElement(Slider, {
        label: "Slide",
        defaultValue: 30,
        showValueLabel: true,
      }),
    },
    {
      types: [
        [
          "IllustratedMessage",
          (m) => m.firstElementChild as HTMLElement | null,
        ],
      ],
      node: React.createElement(IllustratedMessage, { title: "Empty" }),
    },
    {
      types: [
        ["ProgressCircle", (m) => m.firstElementChild as HTMLElement | null],
      ],
      node: React.createElement(ProgressCircle, {
        value: 50,
        "aria-label": "p",
      }),
    },
    {
      types: [
        ["MeterTrack", (m) => m.querySelector(".react-aria-Meter .bar")],
        ["MeterValue", (m) => m.querySelector(".react-aria-Meter .value")],
      ],
      node: React.createElement(Meter, { label: "Meter", value: 40 }),
    },
    {
      types: [
        [
          "ProgressBarTrack",
          (m) => m.querySelector(".react-aria-ProgressBar .bar"),
        ],
        [
          "ProgressBarValue",
          (m) => m.querySelector(".react-aria-ProgressBar .value"),
        ],
      ],
      node: React.createElement(ProgressBar, { label: "Progress", value: 40 }),
    },
    {
      types: [["Breadcrumb", (m) => m.querySelector(".react-aria-Breadcrumb")]],
      node: React.createElement(
        Breadcrumbs,
        null,
        React.createElement(Breadcrumb, { children: "Home" }),
      ),
    },
    {
      types: [
        [
          "CalendarHeader",
          (m) => m.querySelector(".react-aria-Calendar > header"),
        ],
      ],
      node: React.createElement(Calendar, { "aria-label": "cal" }),
    },
    {
      types: [
        [
          "DisclosureHeader",
          (m) =>
            m.querySelector(".react-aria-Disclosure .react-aria-Heading") ??
            m.querySelector(".react-aria-Disclosure h3"),
        ],
      ],
      node: React.createElement(Disclosure, {
        title: "More",
        children: "body",
      }),
    },
    {
      types: [["FieldError", (m) => m.querySelector(".react-aria-FieldError")]],
      node: React.createElement(TextField, {
        label: "Name",
        isInvalid: true,
        errorMessage: "required",
      }),
    },
    {
      // Canvas TextArea 노드 = 래퍼 (.react-aria-TextField). 안쪽 <textarea> 는 block (TextArea.css).
      types: [["TextArea", (m) => m.querySelector(".react-aria-TextField")]],
      node: React.createElement(TextArea, { label: "Memo" }),
    },
  ];
  const roots: Root[] = [];
  for (const r of renders) {
    const mount = document.createElement("div");
    mount.style.cssText = "width:400px;";
    host.appendChild(mount);
    const rt = createRoot(mount);
    roots.push(rt);
    await new Promise<void>((resolve) => {
      rt.render(React.createElement(Boundary, null, r.node));
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    for (const [type, pick] of r.types) {
      let el: HTMLElement | null = null;
      try {
        el = pick(mount);
      } catch {
        el = null;
      }
      live[type] = el
        ? `${el.tagName.toLowerCase()}:${getComputedStyle(el).display}`
        : "(없음)";
      const c = captures.find((x) => x.type === type)!;
      c.live = live[type];
    }
  }

  // Phase 5 후속 HC2 전환 (2026-09-03) — `전환필요(후속)` 5 의 DOM 은 **preview 실경로** 로 잰다: 팔레트 production
  //   트리 root 를 App.tsx 와 같은 순서 (`adaptElementStyle` → `rendererMap[type]`) 로 마운트 (`adr923PreviewLeg`).
  //   Avatar · StatusLight 는 shared 컴포넌트가 아니라 LayoutRenderers 가 자체 div 를 그린다 (renderAvatar flex ·
  //   renderStatusLight inline-flex) — shared `StatusLight.tsx` (flex) 는 production 표면 어디에도 없다 (publish 는
  //   `createHtmlElement("div")`). Canvas leg 와 같은 props 로 두 표면을 재는 것이 HC2 의 계약이다.
  for (const type of PREVIEW_LEG_TYPES) {
    const owner = trees.find((t) => t.type === type && t.root.type === type);
    if (!owner) throw new Error(`${type}: 팔레트 production 트리 없음`);
    const el = await mountProductionRoot(
      host,
      roots,
      owner.elements,
      type === "Slot" ? "layout" : "page",
    );
    live[type] = computedDisplayOf(el);
    const c = captures.find((x) => x.type === type)!;
    c.live = live[type];
  }

  // r31m1 — FieldError DOM 상태 짝: 기본 상태 (isInvalid 없음, errorMessage "" — factory 와 같음) 는 RAC 가
  //   FieldError 를 렌더하지 않는다. invalid 상태는 위 표 캡처 (`live.FieldError`) 그대로.
  {
    const mount = document.createElement("div");
    mount.style.cssText = "width:400px;";
    host.appendChild(mount);
    const rt = createRoot(mount);
    roots.push(rt);
    await new Promise<void>((resolve) => {
      rt.render(
        React.createElement(
          Boundary,
          null,
          React.createElement(TextField, { label: "Name", errorMessage: "" }),
        ),
      );
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    const el = mount.querySelector(
      ".react-aria-FieldError",
    ) as HTMLElement | null;
    fieldErrorStates.default.dom = el
      ? `${el.tagName.toLowerCase()}:${getComputedStyle(el).display}`
      : "(없음)";
    fieldErrorStates.invalid.dom = live.FieldError ?? "(없음)";
  }
  liveRoots = roots;
});

afterAll(async () => {
  for (const r of liveRoots) r.unmount();
  host?.remove();
  document.getElementById("adr923-hc2-bundle")?.remove();
  const { server } = await import("vitest/browser");
  await server.commands.writeFile(
    "tests/parity/.artifacts/adr923-hc2-capture.json",
    JSON.stringify({ measuredAt: new Date().toISOString(), captures }, null, 2),
  );
});

/**
 * HC2 판정표 — Canvas 값은 아래 캡처와 대조해 고정 (바뀌면 catalog/spec/implicit 변경). DOM 값은 live
 * (`tag:display`) / §A 파일 사실 / 소스 태그 사실. verdict:
 *   - `일치` outer·inner 같음 · `일치(outer)` outer 같고 inner 는 Canvas 합성 렌더 (대응 box 명시)
 *   - `전환(Phase 5)` 이번 commit 에서 catalog 를 DOM 값으로 (Button · ToggleButton)
 *   - `예외(투영)` Canvas 노드가 DOM 의 다른 box 를 투영 (대응 box 명시) · `예외(inert)` production
 *     형태에서 항상 flex/grid 자식이라 outer 가 양쪽 모두 blockify (대응 box 명시)
 *   - `전환필요(후속)` outer 가 실제로 갈리는 palette/spec 항목 — catalog/spec 값 판정이 별도 D3 commit
 *     (breakdown Phase 5 후속 항목, evidence §HC2). 미판정 0 이 이 게이트다.
 *   - `투영필요(후속)` display 값이 아니라 **parent 상태 prop → 자식 가시성** 투영이 없어 같은 상태에서
 *     상자 유무가 갈리는 항목 (FieldError — r31m1). 상태 짝 캡처 `fieldErrorStates` 가 근거, 수리는 별도
 *     commit (TagGroup 슬롯 자식 `isTagGroupSlotChildVisible` r21m1 과 동형).
 */
const HC2: Record<
  string,
  { canvas: string; dom: string; verdict: string; box: string }
> = {
  Button: {
    canvas: "inline-flex",
    dom: "inline-flex (Button.css:14)",
    verdict: "전환(Phase 5)",
    box: ".react-aria-Button",
  },
  ToggleButton: {
    canvas: "inline-flex",
    dom: "inline-flex (generated/ToggleButton.css:11)",
    verdict: "전환(Phase 5)",
    box: ".react-aria-ToggleButton",
  },
  Menu: {
    canvas: "inline-flex",
    dom: "flex (generated/Menu.css:11 — popover 목록)",
    verdict: "예외(투영)",
    box: "Canvas Menu 박스 = MenuTrigger 의 Button (inline-flex, ADR-151 B7); DOM Menu root 는 popover",
  },
  FileTrigger: {
    canvas: "inline-block",
    dom: "inline-flex (generated/FileTrigger.css:24 실효)",
    verdict: "일치(outer)",
    box: ".react-aria-FileTrigger — inner flow-root vs flex 는 자식 Button 1개라 배치 차이 없음",
  },
  Skeleton: {
    canvas: "block",
    dom: "div:block (live — rendererMap renderSkeleton → Skeleton.tsx .react-aria-Skeleton, Skeleton.css:65; generated inline-flex 는 dead)",
    verdict: "일치",
    box: ".react-aria-Skeleton — Phase 5 후속 전환 (2026-09-03): catalog structure inline-flex → block (DOM 실효값)",
  },
  ColorPicker: {
    canvas: "flex",
    dom: "flex (ColorPicker.css:6)",
    verdict: "일치",
    box: ".react-aria-ColorPicker",
  },
  ColorSlider: {
    canvas: "block",
    dom: "grid (ColorSlider.css:3)",
    verdict: "일치(outer)",
    box: ".react-aria-ColorSlider — Canvas 는 자식 없는 self-render leaf 라 inner 무관",
  },
  ColorSwatchPicker: {
    canvas: "flex",
    dom: "flex (ColorSwatchPicker.css:4)",
    verdict: "일치",
    box: ".react-aria-ColorSwatchPicker",
  },
  GridList: {
    canvas: "flex",
    dom: "grid (GridList.css:4)",
    verdict: "일치(outer)",
    box: ".react-aria-GridList — Canvas 는 implicitStyles gridlist 분기가 행을 자체 배치 (가상화), inner 는 투영",
  },
  Label: {
    canvas: "block",
    dom: "inline-flex (Label.css:27)",
    verdict: "예외(inert)",
    box: ".react-aria-Label — production 형태 전부 flex 부모 (TextField/ProgressBar …) 의 자식이라 양쪽 blockify",
  },
  Slot: {
    canvas: "block",
    dom: "div:block (live — rendererMap renderSlot → Slot.tsx .react-aria-Slot, frame 편집 모드 placeholder; generated/Slot.css 가 Slot.spec containerStyles display block 을 emit)",
    verdict: "일치",
    box: ".react-aria-Slot — Phase 5 후속 전환 (2026-09-03): 잔존 spec Slot.spec containerStyles 에 display block 명시 (종전 archetype default 기본값 inline-flex ↔ Canvas 기본 block). 부모 (frame body) 가 block 이라 값이 배치에 영향 — page 모드 `.preview-slot` (UA block) · Canvas block 과 같은 block 으로",
  },
  Tag: {
    canvas: "block",
    dom: "flex (TagGroup.css:61)",
    verdict: "일치(outer)",
    box: ".react-aria-Tag — Canvas 는 TagList self-render chip (standalone 만 열린 writer)",
  },
  TagList: {
    canvas: "flex",
    dom: "contents (TagGroup.css:32)",
    verdict: "예외(투영)",
    box: "DOM TagList 는 box 를 만들지 않는다 (contents) — 자식 Tag 가 TagGroup flex 에 직접 참여; Canvas TagList 는 chip 자체 렌더 컨테이너",
  },
  Checkbox: {
    canvas: "inline-flex",
    dom: "label:inline-flex (live — generated Checkbox.css 가 이김)",
    verdict: "일치",
    box: ".react-aria-Checkbox (충돌 해소: live 승자 inline-flex)",
  },
  Radio: {
    canvas: "inline-flex",
    dom: "label:flex (live — Radio.css:9 가 이김)",
    verdict: "예외(inert)",
    box: ".react-aria-Radio — production 형태는 RadioGroup(flex) 자식이라 양쪽 blockify; 충돌 승자 기록",
  },
  SliderOutput: {
    canvas: "inline-flex",
    dom: "output:flex (live)",
    verdict: "예외(inert)",
    box: ".react-aria-SliderOutput — Slider 컨테이너(grid/flex) 자식이라 양쪽 blockify",
  },
  Avatar: {
    canvas: "flex",
    dom: "div:flex (live — rendererMap renderAvatar 인라인 display flex, LayoutRenderers.tsx; shared Avatar.tsx:109 도 flex)",
    verdict: "일치",
    box: "Avatar root div — Phase 5 후속 전환 (2026-09-03): catalog structure inline-flex → flex (DOM 실효값)",
  },
  Breadcrumb: {
    canvas: "inline-flex",
    dom: "li:flex (live)",
    verdict: "예외(inert)",
    box: ".react-aria-Breadcrumb — Breadcrumbs(flex) 자식; Canvas 는 standalone 만 (Breadcrumbs 가 crumb 를 자체 렌더)",
  },
  CalendarHeader: {
    canvas: "flex",
    dom: "header:flex (live)",
    verdict: "일치",
    box: ".react-aria-Calendar > header",
  },
  DisclosureHeader: {
    canvas: "flex",
    dom: "h3:block (live)",
    verdict: "일치(outer)",
    box: ".react-aria-Disclosure .react-aria-Heading — Canvas 합성 leaf (chevron + text)",
  },
  FieldError: {
    canvas: "none",
    dom: "span:block (live, isInvalid+errorMessage) · 기본 상태는 (없음) — 같은 상태 짝은 fieldErrorStates",
    verdict: "일치(outer)",
    box: ".react-aria-FieldError — 기본 상태: Canvas display:none ↔ DOM 미렌더 = 양쪽 상자 없음 (일치). invalid 상태 (Phase 5 후속 2026-09-03): parent `isInvalid` → FieldError style.display block 투영 (propagationRegistry, 5 field 공통) ↔ DOM span:block (RAC 가 invalid 일 때만 렌더) = 일치. 글자·크기는 parent errorMessage + delegation hint 변수 — adr923FieldErrorStateProjection.browser.test 가 5 field × 4 상태 대조",
  },
  IllustratedMessage: {
    canvas: "flex",
    dom: "div:flex (live)",
    verdict: "일치",
    box: "IllustratedMessage root div",
  },
  MeterTrack: {
    canvas: "grid",
    dom: "div:block (live)",
    verdict: "일치(outer)",
    box: ".react-aria-Meter .bar — Canvas 합성 렌더",
  },
  MeterValue: {
    canvas: "grid",
    dom: "span:block (live)",
    verdict: "일치(outer)",
    box: ".react-aria-Meter .value",
  },
  ProgressBarTrack: {
    canvas: "grid",
    dom: "div:block (live)",
    verdict: "일치(outer)",
    box: ".react-aria-ProgressBar .bar",
  },
  ProgressBarValue: {
    canvas: "grid",
    dom: "span:block (live)",
    verdict: "일치(outer)",
    box: ".react-aria-ProgressBar .value",
  },
  ProgressCircle: {
    canvas: "grid",
    dom: "div:block (live)",
    verdict: "일치(outer)",
    box: "ProgressCircle root div — SVG self-render",
  },
  StatusLight: {
    canvas: "inline-flex",
    dom: 'div:inline-flex (live — rendererMap renderStatusLight 인라인 display inline-flex, LayoutRenderers.tsx; shared StatusLight.tsx:87 은 flex 이나 production 표면 미사용 — preview 는 rendererMap, publish 는 createHtmlElement("div"))',
    verdict: "일치",
    box: "StatusLight root div — Phase 5 후속 재측정 (2026-09-03): 종전 행의 'live flex' 는 shared StatusLight.tsx 직접 마운트 값 (production 미사용 표면). preview 실경로는 inline-flex = catalog (2026-07-13 sweep 이 CSS 388 ↔ Skia 75 폭 발산을 이 값으로 닫음) — catalog 변경 0",
  },
  TableHeader: {
    canvas: "flex",
    dom: "thead (table-header-group — 소스 태그)",
    verdict: "일치(outer)",
    box: "Canvas Table 은 flex 행 투영 (ADR-912)",
  },
  TableBody: {
    canvas: "flex",
    dom: "tbody (table-row-group — 소스 태그)",
    verdict: "일치(outer)",
    box: "Canvas Table 은 flex 행 투영 (ADR-912)",
  },
  TailSwatch: {
    canvas: "block",
    dom: "div:block (live — rendererMap renderTailSwatch 래퍼 div, FormRenderers.tsx; class 없음 → UA block, 안쪽 MyColorSwatches Tailwind class 는 preview 에 Tailwind 미로드; generated/TailSwatch.css 는 dead)",
    verdict: "일치",
    box: "TailSwatch root div — Phase 5 후속 전환 (2026-09-03): catalog structure inline-flex → block (DOM 실효값, live 실측)",
  },
  TextArea: {
    canvas: "flex",
    dom: "div:flex (live .react-aria-TextField 래퍼; 안쪽 textarea 는 block)",
    verdict: "일치",
    box: ".react-aria-TextField (TextArea 래퍼)",
  },
  Tree: {
    canvas: "flex",
    dom: "div (UA block — RAC Tree root, 소스)",
    verdict: "일치(outer)",
    box: ".react-aria-Tree — Canvas 는 행 투영",
  },
};

describe("ADR-923 Phase 5 — HC2 판정표 (Canvas 전용 display override 33 rule)", () => {
  it("캡처 — 33 rule 전부 production 형태의 경계 display · Preview 태그 UA 기본값 · DOM 충돌 3 의 live computed", () => {
    for (const c of captures) {
      console.log(
        `ADR923HC2 ${c.type} form=${c.form} canvas=${c.canvas} tag=${c.domTag} ua=${c.uaDisplay}${c.live ? ` live=${c.live}` : ""} outer(canvas)=${outerOf(c.canvas)}`,
      );
    }
    expect(captures).toHaveLength(33);
    expect(captures.filter((c) => c.canvas.startsWith("("))).toEqual([]);
  });

  it("판정표 — 33 rule 전부 판정 (미판정 0), Canvas 값은 캡처와 일치, live 값은 표와 일치", () => {
    expect(Object.keys(HC2).sort()).toEqual([...ALL].sort());
    for (const c of captures) {
      const row = HC2[c.type];
      expect(row.canvas, `${c.type} canvas`).toBe(c.canvas);
      expect(row.verdict, `${c.type} verdict`).not.toMatch(/미판정/);
      expect(row.box.length, `${c.type} box`).toBeGreaterThan(3);
      if (c.live !== undefined) {
        expect(row.dom, `${c.type} live`).toContain(c.live);
      }
    }
    const counts: Record<string, number> = {};
    for (const r of Object.values(HC2))
      counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
    console.log(`ADR923HC2 verdicts ${JSON.stringify(counts)}`);
    expect(counts).toEqual({
      "전환(Phase 5)": 2,
      일치: 11,
      "일치(outer)": 14,
      "예외(투영)": 2,
      "예외(inert)": 4,
    });
  });

  it("FieldError 상태 짝 (r31m1 → Phase 5 후속 투영) — 같은 production 상태에서 Canvas·DOM 을 잰다: 기본 = 양쪽 상자 없음 · invalid = 양쪽 block", () => {
    console.log(
      `ADR923HC2 FieldError states ${JSON.stringify(fieldErrorStates)}`,
    );
    expect(fieldErrorStates.default).toEqual({ canvas: "none", dom: "(없음)" });
    expect(fieldErrorStates.invalid).toEqual({
      canvas: "block",
      dom: "span:block",
    });
    expect(HC2.FieldError.verdict).toBe("일치(outer)");
  });
});
