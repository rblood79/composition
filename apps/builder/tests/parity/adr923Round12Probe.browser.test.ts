import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CompositionEngineLayout } from "@/builder/workspace/canvas/wasm-bindings/compositionEngine";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { enrichWithIntrinsicSize } from "@/builder/workspace/canvas/layout/engines/utils";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import {
  type Bounds,
  type CaseNode,
  diffCase,
  domLeg,
  engineLeg,
  pipelineLeg,
} from "./harness";

interface ProbeCase {
  name: string;
  nodes: CaseNode[];
  availW?: number;
  availH?: number;
}

interface ProbeResult {
  dom: Bounds[];
  engine: Bounds[];
  pipeline: Bounds[] | string;
  engineDiff: string[];
  pipelineDiff: string[] | string;
}

const RESULTS: Record<string, unknown> = {};

const marginCase = (
  name: string,
  parentStyle: Record<string, string | number | string[]>,
  rootStyle: Record<string, string | number | string[]> = {},
): ProbeCase => ({
  name,
  nodes: [
    {
      label: "c",
      style: { display: "block", height: "20px", marginBottom: "20px" },
    },
    {
      label: "p",
      style: { display: "block", marginBottom: "15px", ...parentStyle },
      children: [0],
    },
    { label: "b", style: { display: "block", height: "10px" } },
    {
      label: "root",
      style: {
        display: "block",
        width: "300px",
        fontSize: "0px",
        ...rootStyle,
      },
      children: [1, 2],
    },
  ],
  availW: 300,
  availH: -1,
});

const textZero = (
  name: string,
  textStyle: Record<string, string | number | string[]>,
  text: string,
  rootStyle: Record<string, string | number | string[]> = {},
): ProbeCase => ({
  name,
  nodes: [
    {
      label: "a",
      style: { display: "block", height: "10px", marginBottom: "10px" },
    },
    {
      label: "t",
      elementType: "Text",
      text,
      style: {
        height: "0px",
        marginTop: "20px",
        marginBottom: "30px",
        fontSize: "16px",
        ...textStyle,
      },
    },
    {
      label: "b",
      style: { display: "block", height: "10px", marginTop: "5px" },
    },
    {
      label: "root",
      style: { display: "block", width: "300px", ...rootStyle },
      children: [0, 1, 2],
    },
  ],
  availW: 300,
  availH: -1,
});

const CASES: ProbeCase[] = [
  {
    name: "round11-original-min-height-10-fixture",
    nodes: [
      {
        label: "a",
        style: { display: "block", height: "10px", marginBottom: "10px" },
      },
      {
        label: "empty",
        style: { display: "block", marginTop: "20px", marginBottom: "30px" },
      },
      {
        label: "wrap",
        style: { display: "block", minHeight: "10px" },
        children: [1],
      },
      {
        label: "b",
        style: { display: "block", height: "10px", marginTop: "5px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px" },
        children: [0, 2, 3],
      },
    ],
  },
  marginCase("min-nonbinding-5", { minHeight: "5px" }),
  marginCase("min-nonbinding-10", { minHeight: "10px" }),
  marginCase("min-nonbinding-19", { minHeight: "19px" }),
  marginCase("min-equal-flow-20", { minHeight: "20px" }),
  marginCase("min-equal-flow-plus-margin-40", { minHeight: "40px" }),
  marginCase("min-percent-definite", { minHeight: "50%" }, { height: "200px" }),
  marginCase("min-percent-indefinite", { minHeight: "50%" }),
  marginCase("min-padding-content-equality", {
    minHeight: "30px",
    paddingTop: "10px",
    paddingBottom: "0px",
  }),
  marginCase("overflow-hidden-bfc", {
    overflow: "hidden",
    overflowX: "hidden",
    overflowY: "hidden",
  }),
  marginCase("min-and-max-simultaneous", {
    minHeight: "30px",
    maxHeight: "10px",
  }),
  {
    name: "nested-min-binding",
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      { label: "inner", style: { display: "block" }, children: [0] },
      {
        label: "p",
        style: { display: "block", minHeight: "30px", marginBottom: "15px" },
        children: [1],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", fontSize: "0px" },
        children: [2, 3],
      },
    ],
  },
  textZero("white-space-inherited-pre", {}, " ", { whiteSpace: "pre" }),
  textZero("white-space-inherited-break-spaces", {}, " ", {
    whiteSpace: "break-spaces",
  }),
  textZero("white-space-break-spaces", { whiteSpace: "break-spaces" }, " "),
  textZero("white-space-pre-line-tab", { whiteSpace: "pre-line" }, "\t"),
  textZero("white-space-u3000", {}, "\u3000"),
  textZero("white-space-nbsp-plus-space", {}, "\u00a0 "),
  textZero("white-space-uppercase-pre", { whiteSpace: "PRE" }, " "),
  {
    name: "width-scalar-flex-whitespace",
    nodes: [
      {
        label: "t",
        elementType: "Text",
        text: " ",
        style: { display: "block", height: "10px", fontSize: "16px" },
      },
      {
        label: "root",
        style: { display: "flex", width: "100px" },
        children: [0],
      },
    ],
    availW: 100,
  },
  {
    name: "height-zero-absolute-bottom",
    nodes: [
      {
        label: "abs",
        style: {
          position: "absolute",
          bottom: "0px",
          height: "10px",
          width: "10px",
        },
      },
      { label: "flow", style: { display: "block", height: "20px" } },
      {
        label: "p",
        style: {
          display: "block",
          position: "relative",
          height: "0px",
          width: "100px",
        },
        children: [0, 1],
      },
      {
        label: "root",
        style: { display: "block", width: "300px" },
        children: [2],
      },
    ],
  },
  {
    name: "root-height-zero-min-height-10",
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "root",
        style: {
          display: "block",
          width: "300px",
          height: "0px",
          minHeight: "10px",
        },
        children: [0],
      },
    ],
  },
  {
    name: "uncovered-root-margin",
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginTop: "30px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", marginTop: "10px" },
        children: [0],
      },
    ],
  },
  {
    name: "uncovered-percentage-height-bottom",
    nodes: [
      {
        label: "c",
        style: { display: "block", height: "20px", marginBottom: "20px" },
      },
      {
        label: "p",
        style: { display: "block", height: "50%", marginBottom: "15px" },
        children: [0],
      },
      { label: "b", style: { display: "block", height: "10px" } },
      {
        label: "root",
        style: { display: "block", width: "300px", height: "100px" },
        children: [1, 2],
      },
    ],
  },
  {
    name: "uncovered-inline-block-transition",
    nodes: [
      {
        label: "a",
        style: { display: "inline-block", width: "40px", height: "20px" },
      },
      {
        label: "b",
        style: {
          display: "block",
          width: "60px",
          height: "30px",
          marginTop: "10px",
        },
      },
      {
        label: "c",
        style: { display: "inline-block", width: "40px", height: "20px" },
      },
      {
        label: "root",
        style: { display: "block", width: "300px", fontSize: "0px" },
        children: [0, 1, 2],
      },
    ],
  },
];

function runCase(c: ProbeCase): ProbeResult {
  const availW = c.availW ?? 300;
  const availH = c.availH ?? -1;
  const dom = domLeg(c.nodes, availW);
  const engine = engineLeg(c.nodes, availW, availH);
  let pipeline: Bounds[] | string;
  let pipelineDiff: string[] | string;
  try {
    pipeline = pipelineLeg(c.nodes, availW, availH);
    pipelineDiff = diffCase(c.nodes, dom, pipeline);
  } catch (error) {
    pipeline = String(error);
    pipelineDiff = String(error);
  }
  return {
    dom,
    engine,
    pipeline,
    engineDiff: diffCase(c.nodes, dom, engine),
    pipelineDiff,
  };
}

describe("ADR-923 round 12 diagnostic probes", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
  });

  afterAll(async () => {
    const { server } = await import("vitest/browser");
    await server.commands.writeFile(
      "tests/parity/.artifacts/adr923-round12-probe.json",
      JSON.stringify(RESULTS, null, 2),
    );
  });

  it("records Chrome, engine, and pipeline boundaries", () => {
    const spy = vi.spyOn(CompositionEngineLayout.prototype, "buildTreeBatch");
    for (const c of CASES) RESULTS[c.name] = runCase(c);
    RESULTS.buildTreeBatchCalls = spy.mock.calls.map(([json]) =>
      JSON.parse(json),
    );
    spy.mockRestore();
    expect(Object.keys(RESULTS).length).toBeGreaterThan(CASES.length);
  });

  it("records String(children) line-box signals", () => {
    const samples: Record<string, unknown> = {
      numberZero: 0,
      twoSpacesArray: [" ", " "],
      emptyArray: [],
      objectChild: { type: "span", props: { children: "" } },
    };
    const output: Record<string, unknown> = {};
    for (const [name, children] of Object.entries(samples)) {
      const element = {
        id: name,
        type: "Text",
        page_id: null,
        props: {
          children,
          style: {
            display: "block",
            width: "100px",
            height: "0px",
            fontSize: "16px",
          },
        },
      } as unknown as CanvasLayoutNode;
      const enriched = enrichWithIntrinsicSize(element, 300, -1);
      output[name] = (
        enriched.props?.style as Record<string, unknown> | undefined
      )?.leafBaseline;
    }
    RESULTS.stringChildrenSignals = output;
    expect(Object.keys(output)).toHaveLength(4);
  });
});
