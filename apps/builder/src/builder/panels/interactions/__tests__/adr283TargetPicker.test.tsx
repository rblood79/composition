/**
 * ADR-283 G2 — the capability target picker (Decision 4): groups 「This page」 · 「Inside
 * components」 with path labels, search, short ids for repeated names, hover → `onHover`, the
 * Canvas hover marking its row, and a 300-option list opening within 100 ms (virtualized past 50).
 */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import type { NodeId } from "../../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTargetOption } from "../../../catalogRuntime/interactions";
import {
  CatalogTargetPicker,
  catalogTargetLabels,
} from "../catalog/CatalogTargetPicker";

afterEach(cleanup);

const page = (
  id: string,
  type: string,
  name?: string,
): CatalogTargetOption => ({
  key: JSON.stringify({ nodeId: id }),
  ref: { nodeId: id as NodeId },
  edit: { kind: "node", id: id as NodeId },
  type,
  ...(name ? { name } : {}),
  path: [],
  group: "page",
  shortId: id.slice(-4),
});
const inside = (instance: string, leaf: string): CatalogTargetOption => {
  const ref = {
    address: {
      instances: [instance as NodeId],
      templatePath: ["project:node:card", leaf] as never,
    },
  };
  return {
    key: JSON.stringify(ref),
    ref,
    edit: {
      kind: "descendant",
      ownerId: instance as NodeId,
      address: ref.address,
    },
    type: "Button",
    name: "Save",
    path: ["OrderCard", "Save"],
    group: "component",
    shortId: leaf.slice(-4),
  };
};

function open(
  options: CatalogTargetOption[],
  extra: Partial<Parameters<typeof CatalogTargetPicker>[0]> = {},
) {
  const onPick = vi.fn();
  const onHover = vi.fn();
  render(
    <I18nProvider initialLocale="en-US">
      <CatalogTargetPicker
        label="Target"
        value={undefined}
        options={() => options}
        onPick={onPick}
        onHover={onHover}
        {...extra}
      />
    </I18nProvider>,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Target" })).getAllByRole(
      "button",
    )[0]!,
  );
  return { onPick, onHover };
}

describe("ADR-283 G2 — target picker", () => {
  it("labels: the instance chain, else name (type); without a DOM id a repeated label or no name takes the short id", () => {
    const labels = catalogTargetLabels([
      page("project:node:aaaa1111", "Button", "Go"),
      page("project:node:bbbb2222", "Button", "Go"),
      page("project:node:cccc3333", "Text"),
      inside("project:node:i1", "project:node:save"),
    ]);
    expect([...labels.values()]).toEqual([
      "Go (Button) · 1111",
      "Go (Button) · 2222",
      "Text · 3333",
      "OrderCard ▸ Save",
    ]);
  });

  it("labels: `#` is the DOM id (Accessibility ID) — a page node's own, a place's on its instance", () => {
    const labels = catalogTargetLabels([
      { ...page("project:node:aaaa1111", "Button", "Go"), htmlId: "button_1" },
      { ...page("project:node:bbbb2222", "Button", "Go"), htmlId: "button_2" },
      { ...page("project:node:cccc3333", "Text"), htmlId: "text_1" },
      {
        ...inside("project:node:i1", "project:node:save"),
        htmlId: "ordercard_1",
      },
      {
        ...inside("project:node:i2", "project:node:save"),
        htmlId: "ordercard_2",
      },
    ]);
    expect([...labels.values()]).toEqual([
      "Go (Button) #button_1",
      "Go (Button) #button_2",
      "Text #text_1",
      "OrderCard #ordercard_1 ▸ Save",
      "OrderCard #ordercard_2 ▸ Save",
    ]);
  });

  it("groups, search, pick · hover", () => {
    const options = [
      page("project:node:aaaa1111", "Button", "Go"),
      inside("project:node:i1", "project:node:save"),
    ];
    const { onPick, onHover } = open(options);
    const list = screen.getByRole("listbox", { name: "Target" });
    expect(within(list).getByText("This page")).toBeTruthy();
    expect(within(list).getByText("Inside components")).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Search targets" });
    fireEvent.change(search, { target: { value: "Save" } });
    expect(within(list).queryByText("Go (Button)")).toBeNull();
    const row = within(list).getByRole("option", { name: "OrderCard ▸ Save" });
    fireEvent.pointerEnter(row);
    fireEvent.mouseEnter(row);
    fireEvent.click(row);
    expect(onPick).toHaveBeenCalledWith(options[1]);
    expect(onHover).toHaveBeenCalled();
  });

  it("the Canvas hover marks its row; no target reads 「No target」", () => {
    const options = [inside("project:node:i1", "project:node:save")];
    open(options, { canvasHoverKey: options[0]!.key });
    expect(
      screen
        .getByRole("option", { name: "OrderCard ▸ Save" })
        .getAttribute("data-canvas-hover"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Target: No target", hidden: true }),
    ).toBeTruthy();
  });

  it("300 options: the list is virtualized (the open time is measured live — jsdom has no layout)", () => {
    const options = Array.from({ length: 300 }, (_, index) =>
      page(
        `project:node:n${String(index).padStart(6, "0")}`,
        "Button",
        `Item ${index}`,
      ),
    );
    open(options);
    const list = screen.getByRole("listbox", { name: "Target" });
    expect(list.getAttribute("data-virtualized")).toBe("true");
  });
});
