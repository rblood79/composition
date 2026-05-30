import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
  ResolvedNode,
} from "@composition/shared";

import { resolveCanonicalDocument } from "../../../resolvers/canonical/index";
import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * ADR-142 M1 #8 — G2 검증 fixture (canonicalPreviewRefSlot).
 *
 * resolver.test 가 resolve **계약**(ref→master / descendants A·B·C / slot)을 검증한다면,
 * 본 fixture 는 resolve 된 tree 가 **DOM 으로 렌더**되는지(F1~F4) 검증한다 — generic
 * 렌더러(CanonicalNodeRenderer) DOM backend 의 reusable/ref/descendants/slot 커버.
 *
 * 렌더 경로: frame/Text 는 rendererMap 미등록 → generic fallback(자식을 CanonicalNodeRenderer
 * 로 직접 재귀)이므로 stub renderContext 로 충분(rendererMap path 만 실 ctx 필요).
 * Text 내용은 `props.children`(generic fallback 이 렌더하는 prop).
 */
const ctx = {} as unknown as RenderContext;

function makeDoc(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children };
}
function makeReusable(
  id: string,
  type: CanonicalNode["type"],
  children?: CanonicalNode[],
): CanonicalNode {
  const node: CanonicalNode = { id, type, reusable: true };
  if (children !== undefined) node.children = children;
  return node;
}
function makeRef(id: string, ref: string, extras?: Partial<RefNode>): RefNode {
  return { id, type: "ref", ref, ...extras } as RefNode;
}
function makeFrame(id: string, extras?: Partial<FrameNode>): FrameNode {
  return { id, type: "frame", ...extras } as FrameNode;
}
function makeText(id: string, text: string): CanonicalNode {
  return { id, type: "Text", props: { children: text } };
}

function renderResolved(doc: CompositionDocument, nodeId: string) {
  const resolved = resolveCanonicalDocument(doc);
  const node = resolved.find((n) => n.id === nodeId) as
    | ResolvedNode
    | undefined;
  expect(node, `resolved node "${nodeId}" 가 출력에 존재`).toBeDefined();
  return render(
    <CanonicalNodeRenderer node={node as ResolvedNode} renderContext={ctx} />,
  );
}

describe("CanonicalNodeRenderer — G2: resolved tree → DOM (ADR-142 M1 #8)", () => {
  it("F1: reusable origin frame + Text 자식이 DOM 으로 렌더된다", () => {
    const master = makeReusable("card", "frame", [makeText("t1", "Origin")]);
    const { container } = renderResolved(makeDoc([master]), "card");
    expect(
      container.querySelector('[data-canonical-id="card"]'),
    ).not.toBeNull();
    expect(container.textContent).toContain("Origin");
  });

  it("F2: ref 가 master 구조로 resolve 되어 렌더된다 (자식 펼침)", () => {
    const master = makeReusable("card", "frame", [makeText("t1", "Shared")]);
    const ref = makeRef("i1", "card");
    const { container } = renderResolved(makeDoc([master, ref]), "i1");
    expect(container.querySelector('[data-canonical-id="i1"]')).not.toBeNull();
    expect(container.textContent).toContain("Shared");
  });

  it("F2-A: descendants mode A — override(style) 가 자식 렌더에 머지된다", () => {
    // mode A = scalar prop 머지. children 키는 mode C(배열 교체)이므로 text 변경엔 못 씀 →
    // render-visible scalar(style)로 검증. generic fallback 이 props.style 을 그대로 전달.
    const master = makeReusable("btn", "frame", [makeText("label", "Keep")]);
    const ref = makeRef("i1", "btn", {
      descendants: {
        label: { style: { marginTop: 10 } } as Record<string, unknown>,
      },
    });
    const { container } = renderResolved(makeDoc([master, ref]), "i1");
    const label = container.querySelector(
      '[data-canonical-id="label"]',
    ) as HTMLElement | null;
    expect(label).not.toBeNull();
    expect(label?.style.marginTop).toBe("10px");
    expect(container.textContent).toContain("Keep"); // 기존 children 보존
  });

  it("F3: slot fill(mode C) — slot frame children 이 교체되어 렌더된다", () => {
    const slotFrame = makeFrame("main-slot", { slot: ["card"], children: [] });
    const master = makeReusable("layout", "frame", [slotFrame]);
    const ref = makeRef("page-1", "layout", {
      descendants: {
        "main-slot": { children: [makeText("c1", "Filled")] } as {
          children: CanonicalNode[];
        },
      },
    });
    const { container } = renderResolved(makeDoc([master, ref]), "page-1");
    expect(container.textContent).toContain("Filled");
  });

  it("F4: fallback children 보존 — frame 의 다중 children 이 모두 렌더된다", () => {
    const frame = makeFrame("f1", {
      children: [makeText("a", "AAA"), makeText("b", "BBB")],
    });
    const { container } = renderResolved(makeDoc([frame]), "f1");
    expect(container.textContent).toContain("AAA");
    expect(container.textContent).toContain("BBB");
  });
});
