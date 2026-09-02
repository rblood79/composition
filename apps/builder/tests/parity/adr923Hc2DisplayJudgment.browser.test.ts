import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import bundleCss from "@composition/shared/components/styles/index.css?inline";
import { Checkbox } from "@composition/shared/components/Checkbox";
import { Radio } from "@composition/shared/components/Radio";
import { RadioGroup } from "@composition/shared/components/RadioGroup";
import { Slider } from "@composition/shared/components/Slider";
import { Avatar } from "@composition/shared/components/Avatar";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { StatusLight } from "@composition/shared/components/StatusLight";
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

  // live computed (실 번들 CSS) — DOM 충돌 3 + 선언 없음 17 중 렌더 가능한 것. 컴포넌트마다 root 를
  //   따로 만들고 에러 경계로 감싸 하나가 죽어도 나머지를 잰다. Table(TableHeader/TableBody) · TailSwatch ·
  //   Tree 는 props 부담/ColorSlider 의존으로 소스 태그 사실 (§A-4 · 컴포넌트 D1 주석) 로 판정한다.
  const style = document.createElement("style");
  style.id = "adr923-hc2-bundle";
  style.textContent = bundleCss;
  document.head.appendChild(style);
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
      types: [["Avatar", (m) => m.firstElementChild as HTMLElement | null]],
      node: React.createElement(Avatar, { initials: "AB" }),
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
        ["StatusLight", (m) => m.firstElementChild as HTMLElement | null],
      ],
      node: React.createElement(StatusLight, { children: "On" }),
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
    canvas: "inline-flex",
    dom: "block (Skeleton.css:65 live; generated inline-flex 는 dead)",
    verdict: "전환필요(후속)",
    box: ".react-aria-Skeleton — catalog structure inline-flex ↔ live CSS block (outer 다름, palette 항목)",
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
    dom: "inline-flex (generated/Slot.css archetype base — Slot.spec 에 display 없음)",
    verdict: "전환필요(후속)",
    box: ".react-aria-Slot — 잔존 spec: spec containerStyles 에 display 명시 등재가 필요 (CSSGenerator archetype 기본값과 Canvas 기본값이 갈림)",
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
    canvas: "inline-flex",
    dom: "div:flex (live)",
    verdict: "전환필요(후속)",
    box: "Avatar root div — catalog structure inline-flex ↔ live flex (outer 다름, palette 항목)",
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
    dom: "span:block (live, isInvalid 일 때; 유효하면 렌더 없음)",
    verdict: "일치",
    box: ".react-aria-FieldError — 오류 없음 = 양쪽 없음; 오류 상태 투영은 별도",
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
    dom: "div:flex (live)",
    verdict: "전환필요(후속)",
    box: "StatusLight root div — catalog structure inline-flex ↔ live flex (outer 다름, palette 항목)",
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
    canvas: "inline-flex",
    dom: "div (UA block — Tailwind 래퍼, generated CSS dead; 소스)",
    verdict: "전환필요(후속)",
    box: "TailSwatch root — catalog structure inline-flex ↔ DOM block (palette 항목, live 미측정: ColorSlider 의존)",
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
    expect(counts["전환(Phase 5)"]).toBe(2);
    expect(counts["전환필요(후속)"]).toBe(5);
  });
});
