import { describe, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import {
  buildCanonicalSceneModel,
  resetSceneRefResolutionReuse,
} from "../../workspace/canvas/scene/canonicalSceneModel";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";

/**
 * ADR-241 G4 분해 bench (240 교훈 — 브라우저 p95 (표본 7) 는 사실상 최댓값). 같은 파일을 241 전 worktree 에 복사해 두 빌드에서
 * `buildCanonicalSceneModel` 을 잰다. `ADR241_BENCH=1` 일 때만 돈다 (일반 스위트에서는 skip).
 * fixture = G4 브라우저 하니스와 같은 모양: 데이터 Table (500 행 × 8 열 — Column 요소 + legacy `props.columns`) · TableView 10 × (20 행
 * × 5 열) plain → hydration 파이프라인 (`ensureReusableCompositeOrigins` — 241 은 이관, 전 빌드는 그대로).
 * 조작: 문서 편집 (열 0 폭 · 새 문서 객체) 으로 해석 재사용 없이 · 같은 문서 재빌드 (재사용 경로).
 */
const RUN = process.env.ADR241_BENCH === "1";
const SAMPLES = 60;

function fixture(part: "all" | "table" | "tableview"): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const seed = createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
  const keys = ["id", "name", "email", "role", "team", "city", "phone", "note"];
  const data = Array.from({ length: 500 }, (_, i) =>
    Object.fromEntries(
      keys.map((k) => [k, k === "id" ? i + 1 : `${k} ${i + 1}`]),
    ),
  );
  const added: CanonicalNode[] = [];
  if (part !== "tableview") {
    added.push({
      id: "g4-table",
      type: "Table",
      props: {
        size: "sm",
        height: 400,
        columns: keys.map((k) => ({ id: k, label: k, width: 150 })),
        dataBinding: { type: "collection", source: "static", config: { data } },
      },
      children: [
        {
          id: "g4-th",
          type: "TableHeader",
          props: {},
          children: keys.map((k) => ({
            id: `g4-col-${k}`,
            type: "Column",
            props: { key: k, children: k, width: 150 },
          })),
        },
        { id: "g4-tb", type: "TableBody", props: {} },
      ],
    } as unknown as CanonicalNode);
  }
  if (part !== "table") {
    for (let t = 0; t < 10; t += 1) {
      const tv = `g4-tv-${t}`;
      added.push({
        id: tv,
        type: "TableView",
        props: {},
        children: [
          {
            id: `${tv}-th`,
            type: "TableHeader",
            props: {},
            children: Array.from({ length: 5 }, (_, c) => ({
              id: `${tv}-col-${c}`,
              type: "Column",
              props: { children: `C${c}` },
            })),
          },
          {
            id: `${tv}-tb`,
            type: "TableBody",
            props: {},
            children: Array.from({ length: 20 }, (_, r) => ({
              id: `${tv}-r${r}`,
              type: "Row",
              props: {},
              children: Array.from({ length: 5 }, (_, c) => ({
                id: `${tv}-r${r}-c${c}`,
                type: "Cell",
                props: { children: `r${r}c${c}` },
              })),
            })),
          },
        ],
      } as unknown as CanonicalNode);
    }
  }
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) =>
      node.id === "body-1"
        ? { ...node, children: [...(node.children ?? []), ...added] }
        : node.children
          ? { ...node, children: visit(node.children) }
          : node,
    );
  return ensureReusableCompositeOrigins({
    ...seed,
    children: visit(seed.children),
  });
}

/** 열 0 폭 편집 — 새 문서 객체 (해석 재사용 대상 밖) */
function edit(doc: CompositionDocument, i: number): CompositionDocument {
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === "g4-col-id" || node.id === "g4-tv-0-col-0") {
        return { ...node, props: { ...node.props, width: 150 + (i % 2) } };
      }
      return node.children ? { ...node, children: visit(node.children) } : node;
    });
  return { ...doc, children: visit(doc.children) };
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return Number(
    s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!.toFixed(3),
  );
};

describe.skipIf(!RUN)("ADR-241 G4 scene.build bench", () => {
  for (const part of ["all", "table", "tableview"] as const) {
    it(`bench ${part}`, () => {
      let doc = fixture(part);
      const collectionWindows = new Map();
      for (let i = 0; i < 10; i += 1) {
        doc = edit(doc, i);
        buildCanonicalSceneModel(doc, { collectionWindows });
      }
      const editMs: number[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        doc = edit(doc, i);
        const t0 = performance.now();
        buildCanonicalSceneModel(doc, { collectionWindows });
        editMs.push(performance.now() - t0);
      }
      const sameMs: number[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        const t0 = performance.now();
        buildCanonicalSceneModel(doc, { collectionWindows });
        sameMs.push(performance.now() - t0);
      }
      resetSceneRefResolutionReuse();
      console.log(
        `[adr241 bench] ${part} edit p50=${pct(editMs, 50)} p95=${pct(editMs, 95)} · same p50=${pct(sameMs, 50)} p95=${pct(sameMs, 95)}`,
      );
    }, 120_000);
  }
});
