import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";
import { FillType } from "../../../types/builder/fill.types";

import type { RenderContext } from "../../types/index";
import { getRuntimeStore } from "../../store/runtimeStore";
import {
  CanonicalNodeRenderer,
  resolvePresentationLayoutProps,
  resolvePresentationPaintProps,
} from "../CanonicalNodeRenderer";

/**
 * Background(fills) canonical Preview 회귀 테스트 (2026-07-15).
 *
 * canonical 전환 때 CanonicalNodeRenderer 가 `fills: []` 하드코딩으로
 * (1) canonical node 의 fills 를 버리고, (2) truthy 빈 배열이
 * adaptStyleWithFills 의 delete 분기를 타서 사용자 style.background* 까지
 * 능동 소거하던 결함의 재발 차단. fills 는 canonical 1차 필드에서 운반된다.
 */

const ctx = {} as unknown as RenderContext;

// canonical page shell 계열이 아닌 일반 컨테이너로 generic div 경로를 태운다.
const FRAME_TYPE = "frame" as ResolvedNode["type"];

afterEach(() => {
  cleanup();
  getRuntimeStore().setState({ editorPresentationOverrides: {} });
});

function renderNode(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={new Set()}
    />,
  );
}

describe("CanonicalNodeRenderer — canonical fills 배경 렌더", () => {
  it("canonical node.fills 의 color fill 을 backgroundColor 로 렌더한다", () => {
    const node: ResolvedNode = {
      id: "frame-fill",
      type: FRAME_TYPE,
      props: { style: { display: "block" } },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#112233FF",
        },
      ],
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-fill']",
    ) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });

  it("fills 미보유 node 의 style.backgroundColor 를 보존한다 (빈 배열 소거 회귀)", () => {
    const node: ResolvedNode = {
      id: "frame-style-bg",
      type: FRAME_TYPE,
      props: { style: { display: "block", backgroundColor: "#ABCDEF" } },
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-style-bg']",
    ) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("fills 가 style.backgroundColor 보다 우선한다", () => {
    const node: ResolvedNode = {
      id: "frame-priority",
      type: FRAME_TYPE,
      props: { style: { display: "block", backgroundColor: "#000000" } },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#FF0000FF",
        },
      ],
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-priority']",
    ) as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("catalog cutover primitive도 canonical fills를 inline style로 전달한다", () => {
    const node: ResolvedNode = {
      id: "button-fill",
      type: "Button",
      props: { children: "Button", variant: "primary" },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#8C3A3AFF",
        },
      ],
    } as ResolvedNode;

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    const el = container.querySelector(
      "[data-canonical-id='button-fill']",
    ) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe("rgb(140, 58, 58)");
  });

  it("traversal render key의 editor presentation fill을 canonical보다 우선한다", () => {
    const node: ResolvedNode = {
      id: "frame-fill",
      type: FRAME_TYPE,
      props: { style: { display: "block" } },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#112233FF",
        },
      ],
    };
    getRuntimeStore().setState({
      editorPresentationOverrides: {
        "page-1/frame-fill": {
          sessionId: "session-1",
          revision: 1,
          mutations: [
            {
              type: "fills.replace",
              target: { kind: "canonical-node", nodeId: "frame-fill" },
              fills: [
                {
                  id: "fill-1",
                  type: FillType.Color,
                  enabled: true,
                  opacity: 1,
                  blendMode: "normal",
                  color: "#CC4422FF",
                },
              ],
            },
          ],
        },
      },
    });

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        parentPath="page-1"
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );
    const el = container.querySelector(
      "[data-canonical-id='frame-fill']",
    ) as HTMLElement;
    expect(el.style.backgroundColor).toBe("rgb(204, 68, 34)");
  });

  it("Skia와 같은 absolute 숫자형 layout allowlist만 Preview에 반영한다", () => {
    const base = {
      style: { position: "absolute", left: 10, top: 20 },
    };
    expect(
      resolvePresentationLayoutProps(base, [
        {
          patch: { x: 40, y: 50 },
          target: { kind: "canonical-node", nodeId: "frame-layout" },
          type: "geometry.patch",
        },
      ]),
    ).toEqual({ style: { position: "absolute", left: 40, top: 50 } });
    expect(
      resolvePresentationLayoutProps(base, [
        {
          patch: { width: 200 },
          target: { kind: "canonical-node", nodeId: "frame-layout" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      style: { position: "absolute", left: 10, top: 20, width: 200 },
    });
    expect(
      resolvePresentationLayoutProps(
        base,
        [
          {
            patch: { width: 200 },
            target: { kind: "canonical-node", nodeId: "frame-layout" },
            type: "style.patch",
          },
        ],
        true,
      ),
    ).toBe(base);
    expect(
      resolvePresentationLayoutProps(base, [
        {
          patch: { padding: 12 },
          target: { kind: "canonical-node", nodeId: "frame-layout" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      style: { position: "absolute", left: 10, top: 20, padding: 12 },
    });

    expect(
      resolvePresentationLayoutProps(
        { style: { position: "static", display: "flex" } },
        [
          {
            patch: { gap: 16, paddingTop: 12 },
            target: { kind: "canonical-node", nodeId: "flow-layout" },
            type: "style.patch",
          },
        ],
      ),
    ).toEqual({
      style: { position: "static", display: "flex", gap: 16, paddingTop: 12 },
    });
  });

  it("borderColor style patch는 Preview style만 바꾸고 나머지 style을 보존한다", () => {
    const base = {
      style: { borderColor: "#111111", borderWidth: "1px", display: "block" },
    };
    expect(
      resolvePresentationPaintProps(base, [
        {
          patch: { borderColor: "#ABCDEF" },
          target: { kind: "canonical-node", nodeId: "frame-border" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      style: {
        borderColor: "#ABCDEF",
        borderWidth: "1px",
        display: "block",
      },
    });
  });

  it("opacity style patch는 Preview paint만 바꾸고 geometry/style 나머지를 보존한다", () => {
    const base = {
      style: {
        opacity: 0.5,
        width: "120px",
        backgroundColor: "#112233",
      },
    };
    const next = resolvePresentationPaintProps(base, [
      {
        patch: { opacity: "0.25" },
        target: { kind: "canonical-node", nodeId: "opacity-1" },
        type: "style.patch",
      },
    ]);
    expect(next).toEqual({
      style: {
        opacity: "0.25",
        width: "120px",
        backgroundColor: "#112233",
      },
    });
  });

  it("text color style patch는 Preview color만 바꾸고 geometry style을 보존한다", () => {
    const base = {
      props: { children: "Hello" },
      style: { color: "#111111", fontSize: "16px", width: "120px" },
    } as never;

    expect(
      resolvePresentationPaintProps(base, [
        {
          patch: { color: "#ABCDEF" },
          target: { kind: "canonical-node", nodeId: "text-1" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      props: { children: "Hello" },
      style: { color: "#ABCDEF", fontSize: "16px", width: "120px" },
    });
  });

  it("boxShadow style patch는 Preview style만 바꾸고 geometry를 보존한다", () => {
    const base = {
      style: {
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        borderRadius: "8px",
        width: "120px",
      },
    };
    expect(
      resolvePresentationPaintProps(base, [
        {
          patch: { boxShadow: "inset 0 4px 10px 1px rgba(0,0,0,0.3)" },
          target: { kind: "canonical-node", nodeId: "frame-shadow" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      style: {
        boxShadow: "inset 0 4px 10px 1px rgba(0,0,0,0.3)",
        borderRadius: "8px",
        width: "120px",
      },
    });
  });

  it("typed boxShadow presentation은 semantic CSS로 직렬화하고 geometry를 보존한다", () => {
    const base = {
      style: {
        boxShadow: "0 2px 8px 0 rgba(0,0,0,0.2), inset 0 1px 4px 0 #00000033",
        borderRadius: "8px",
        width: "120px",
      },
    };
    expect(
      resolvePresentationPaintProps(base, [
        {
          patch: {
            boxShadow: {
              layers: [
                {
                  offsetX: 4,
                  offsetY: -2,
                  blur: 12,
                  spread: 1,
                  color: "rgba(255, 0, 0, 0.5)",
                  inset: false,
                },
                {
                  offsetX: 0,
                  offsetY: 1,
                  blur: 4,
                  spread: 0,
                  color: "#00000033",
                  inset: true,
                },
              ],
            },
          },
          target: { kind: "canonical-node", nodeId: "frame-shadow-typed" },
          type: "style.patch",
        },
      ]),
    ).toEqual({
      style: {
        boxShadow:
          "4px -2px 12px 1px rgba(255, 0, 0, 0.5), inset 0px 1px 4px 0px #00000033",
        borderRadius: "8px",
        width: "120px",
      },
    });
  });

  it("typed boxShadow topology 변경은 Preview에서도 fail-closed한다", () => {
    const base = {
      style: { boxShadow: "0 2px 8px 0 rgba(0,0,0,0.2)" },
    };
    expect(
      resolvePresentationPaintProps(base, [
        {
          patch: {
            boxShadow: {
              layers: [
                {
                  offsetX: 0,
                  offsetY: 2,
                  blur: 8,
                  spread: 0,
                  color: "#00000080",
                  inset: false,
                },
                {
                  offsetX: 0,
                  offsetY: 1,
                  blur: 4,
                  spread: 0,
                  color: "#00000040",
                  inset: false,
                },
              ],
            },
          },
          target: { kind: "canonical-node", nodeId: "frame-shadow-topology" },
          type: "style.patch",
        },
      ]),
    ).toBe(base);
  });
});
