import { appendFileSync } from "node:fs";

import { describe, it, vi } from "vitest";

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import { createInitialProjectDocument } from "../../../dashboard/createInitialProjectDocument";
import {
  buildCanonicalSceneModel,
  resetSceneRefResolutionReuse,
} from "../../workspace/canvas/scene/canonicalSceneModel";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";

/**
 * ADR-239 G5 분해 bench (240 교훈 — 브라우저 p95 (표본 7) 는 사실상 최댓값). 같은 파일을 239 전 worktree 에 복사해 두 빌드에서
 * `buildCanonicalSceneModel` 을 잰다. `ADR239_BENCH=1` 일 때만 돈다 (일반 스위트에서는 skip).
 * fixture = G5 브라우저 하니스와 같은 모양: Tree 20 × 항목 30 (최상위 10 × 자식 1 × 손자 1) plain · Menu 20 × 행 10 (행 4 개가
 * 하위 메뉴 2 단계, 정적 `items`) → hydration 파이프라인 (`ensureReusableCompositeOrigins` — 239 는 이관, 전 빌드는 그대로).
 * 조작: owner padding · 펼침 토글 · origin padding (새 문서 객체 — 해석 재사용 밖) · 같은 문서 재빌드.
 */
const RUN = process.env.ADR239_BENCH === "1";
const SAMPLES = 60;

function fixture(part: "tree" | "menu"): CompositionDocument {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const seed = createInitialProjectDocument(
    { id: "page-1", title: "P", slug: "/" },
    { id: "body-1", type: "body" },
  ) as CompositionDocument;
  const added: CanonicalNode[] = [];
  if (part === "tree") {
    for (let i = 0; i < 20; i += 1) {
      const tid = `g5-tree-${i}`;
      added.push({
        id: tid,
        type: "Tree",
        props: {
          "aria-label": `Tree ${i}`,
          selectionMode: "single",
          expandedKeys: [],
        },
        children: Array.from({ length: 10 }, (_, k) => {
          const a = `${tid}-a${k}`;
          return {
            id: a,
            type: "TreeItem",
            props: { children: `Item ${i}.${k}` },
            children: [
              {
                id: `${a}-b`,
                type: "TreeItem",
                props: { children: `Item ${i}.${k}.1` },
                children: [
                  {
                    id: `${a}-b-c`,
                    type: "TreeItem",
                    props: { children: `Item ${i}.${k}.1.1` },
                  },
                ],
              },
            ],
          };
        }),
      } as unknown as CanonicalNode);
    }
  } else {
    const rows = (i: number) =>
      Array.from({ length: 10 }, (_, k) =>
        k % 3 === 0
          ? {
              id: `k${k}`,
              label: `Item ${i}-${k}`,
              children: [
                {
                  id: `k${k}-s`,
                  label: `Sub ${i}-${k}`,
                  children: [{ id: `k${k}-ss`, label: `Leaf ${i}-${k}` }],
                },
                { id: `k${k}-t`, label: `Sub2 ${i}-${k}` },
              ],
            }
          : { id: `k${k}`, label: `Item ${i}-${k}` },
      );
    for (let i = 0; i < 20; i += 1) {
      added.push({
        id: `g5-menu-${i}`,
        type: "Menu",
        props: { label: `Menu ${i}`, items: rows(i) },
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

type Kind = "ownerEdit" | "expand" | "originEdit";

function patchNode(
  doc: CompositionDocument,
  id: string,
  patch: (props: Record<string, unknown>) => Record<string, unknown>,
): CompositionDocument {
  // 대상 경로만 새 객체 (store 편집과 같은 구조 공유 — 다른 subtree 는 같은 객체라 해석 재사용 대상).
  const visit = (nodes: CanonicalNode[]): CanonicalNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.id === id) {
        changed = true;
        return {
          ...node,
          props: patch((node.props ?? {}) as Record<string, unknown>),
        };
      }
      if (!node.children) return node;
      const children = visit(node.children);
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : nodes;
  };
  const children = visit(doc.children);
  return children === doc.children ? doc : { ...doc, children };
}

function hasNode(doc: CompositionDocument, id: string): boolean {
  const walk = (nodes: readonly CanonicalNode[]): boolean =>
    nodes.some((n) => n.id === id || walk(n.children ?? []));
  return walk(doc.children);
}

function edit(
  doc: CompositionDocument,
  part: "tree" | "menu",
  kind: Kind,
  i: number,
): CompositionDocument {
  const owner = part === "tree" ? "g5-tree-0" : "g5-menu-0";
  const padding = (props: Record<string, unknown>) => ({
    ...props,
    style: {
      ...((props.style as Record<string, unknown>) ?? {}),
      paddingTop: i % 2 ? 6 : 4,
    },
  });
  if (kind === "ownerEdit") return patchNode(doc, owner, padding);
  if (kind === "expand") {
    const parents: string[] = [];
    for (let k = 0; k < 10; k += 1) {
      parents.push(`g5-tree-0-a${k}`, `g5-tree-0-a${k}/g5-tree-0-a${k}-b`);
    }
    return patchNode(doc, owner, (props) => ({
      ...props,
      expandedKeys: i % 2 ? parents : [],
    }));
  }
  const origin =
    part === "tree"
      ? hasNode(doc, "component-tree-item-default")
        ? "component-tree-item-default"
        : "component-tree"
      : "component-menu-item-default";
  return patchNode(doc, origin, padding);
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return Number(
    s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!.toFixed(3),
  );
};

describe.skipIf(!RUN)("ADR-239 G5 scene.build bench", () => {
  const cases: Array<["tree" | "menu", Kind]> = [
    ["tree", "ownerEdit"],
    ["tree", "expand"],
    ["tree", "originEdit"],
    ["menu", "ownerEdit"],
    ["menu", "originEdit"],
  ];
  for (const [part, kind] of cases) {
    it(`bench ${part} ${kind}`, () => {
      let doc = fixture(part);
      const collectionWindows = new Map();
      for (let i = 0; i < 10; i += 1) {
        doc = edit(doc, part, kind, i);
        buildCanonicalSceneModel(doc, { collectionWindows });
      }
      const editMs: number[] = [];
      let sceneNodes = 0;
      for (let i = 0; i < SAMPLES; i += 1) {
        doc = edit(doc, part, kind, i);
        const t0 = performance.now();
        const model = buildCanonicalSceneModel(doc, { collectionWindows });
        editMs.push(performance.now() - t0);
        sceneNodes = model.sceneNodes.length;
      }
      const sameMs: number[] = [];
      for (let i = 0; i < SAMPLES; i += 1) {
        const t0 = performance.now();
        buildCanonicalSceneModel(doc, { collectionWindows });
        sameMs.push(performance.now() - t0);
      }
      resetSceneRefResolutionReuse();
      appendFileSync(
        process.env.ADR239_BENCH_OUT ?? "/dev/stdout",
        `[adr239 bench] ${part} ${kind} nodes=${sceneNodes} edit p50=${pct(editMs, 50)} p95=${pct(editMs, 95)} · same p50=${pct(sameMs, 50)} p95=${pct(sameMs, 95)}\n`,
      );
    }, 120_000);
  }
});
