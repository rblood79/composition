/**
 * ADR-158 Phase 3 — 실행 override 가 catalog generic 경로의 렌더까지 도달하는가.
 *
 * **Why (2026-08-16 라이브 실측, 같은 형태로 두 번)**: dispatcher 는 `ok` 를
 * 돌려주는데 화면이 그대로였다. 이 경로의 소비자들이 병합 결과가 아니라 **원본
 * `node`** 를 읽고 있었기 때문이다 —
 *
 *   - `toRacProps(node, …)` → Modal 의 `isOpen` patch 무반응
 *   - `toReactStyle(node)`  → 공통 show/hide/toggle 무반응
 *
 * 소비처마다 따로 같은 실수를 하기 쉬운 자리라, 병합된 `renderNode` 를 한 번
 * 만들어 전부 그것을 읽게 했다. 두 축을 각각 못 박아 셋째 소비자가 붙을 때
 * 조용히 새지 않게 한다.
 */
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import { getRuntimeStore } from "../../store";
import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const ctx = {} as unknown as RenderContext;

afterEach(() => {
  getRuntimeStore().getState().clearInteractionOverrides();
});

function patch(id: string, props: Record<string, unknown>) {
  getRuntimeStore().getState().patchInteractionOverride(id, props);
}

describe("실행 override → catalog generic 렌더", () => {
  it("style.display override 가 인라인 style 로 반영된다 (hide)", () => {
    patch("badge-1", { style: { display: "none" } });

    const node: ResolvedNode = {
      id: "badge-1",
      type: "Badge",
      props: { children: "TARGET" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Badge"])}
      />,
    );

    const el = container.querySelector<HTMLElement>("[data-canonical-id]");
    expect(el?.style.display).toBe("none");
  });

  it("요소가 갖고 있던 나머지 style 은 남는다 (얕은 병합)", () => {
    patch("badge-2", { style: { display: "none" } });

    const { container } = render(
      <CanonicalNodeRenderer
        node={{
          id: "badge-2",
          type: "Badge",
          props: { children: "T", style: { color: "rgb(255, 0, 0)" } },
        }}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Badge"])}
      />,
    );

    const el = container.querySelector<HTMLElement>("[data-canonical-id]");
    expect(el?.style.display).toBe("none");
    expect(el?.style.color).toBe("rgb(255, 0, 0)");
  });

  it("prop override 가 RAC 컴포넌트까지 도달한다 (Modal.isOpen)", () => {
    patch("modal-1", { isOpen: true });

    // 자식이 있어야 열린 상태를 눈으로 확인할 수 있다.
    render(
      <CanonicalNodeRenderer
        node={{
          id: "modal-1",
          type: "Modal",
          props: {},
          children: [
            { id: "in-modal", type: "Button", props: { children: "OK" } },
          ],
        }}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Modal", "Button"])}
      />,
    );

    // Modal 은 portal 이라 container 밖(document.body)에 렌더된다.
    expect(document.querySelector(".react-aria-Modal")).not.toBeNull();
  });

  it("override 가 없으면 원본 노드 참조를 그대로 쓴다", () => {
    const { container } = render(
      <CanonicalNodeRenderer
        node={{ id: "badge-3", type: "Badge", props: { children: "T" } }}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Badge"])}
      />,
    );
    const el = container.querySelector<HTMLElement>("[data-canonical-id]");
    expect(el?.style.display).toBe("");
    expect(el?.textContent).toBe("T");
  });
});
