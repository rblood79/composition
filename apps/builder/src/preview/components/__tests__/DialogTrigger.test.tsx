import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { RenderContext, ResolvedNode } from "@composition/shared";
import { getCatalogCutoverTypes } from "@composition/shared";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const node: ResolvedNode = {
  id: "trigger",
  type: "DialogTrigger",
  props: {},
  children: [
    { id: "open", type: "Button", props: { children: "Open Dialog" } },
    {
      id: "dialog",
      type: "Dialog",
      props: { isDismissable: true },
      children: [
        {
          id: "close",
          type: "Button",
          props: { children: "Close", slot: "close" },
        },
      ],
    },
  ],
};
const ctx = {} as RenderContext;
afterEach(cleanup);

describe("Dialog canonical trigger", () => {
  it("버튼으로 열고 close 슬롯으로 닫으며 문서 초기 상태를 수정하지 않는다", async () => {
    render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={getCatalogCutoverTypes()}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const button = screen.getByRole("button", { name: "Open Dialog" });
    button.focus();
    fireEvent.click(button);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(node.props).toEqual({});
  });
  it("초기 open 문서도 Escape로 닫을 수 있다", async () => {
    render(
      <CanonicalNodeRenderer
        node={{ ...node, props: { isOpen: true } }}
        renderContext={ctx}
        cutoverPrimitives={getCatalogCutoverTypes()}
      />,
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
