import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * S2 Picker · ComboBox `loadingState` (`useAsyncList.loadingState`): a bound Picker shows its
 * spinner in the trigger before the chevron while `loading` (S2 `Picker` — `loadingState ===
 * 'loading' && !isOpen`); a bound ComboBox shows it in the field before the button once a load or
 * filter has run 500ms (S2 `showFieldSpinner` — `loading`, or `filtering` while open). Their lists
 * load the next page at the end (`ListBoxLoadMoreItem` — `onLoadMore`). Measurement: jsdom + a
 * `fetch` stub the test answers.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });

function pendingServer() {
  const answers: ((body: unknown) => void)[] = [];
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    return new Promise((resolve) => {
      answers.push((body) =>
        resolve(
          new Response(JSON.stringify(body), {
            headers: { "content-type": "application/json" },
          }),
        ),
      );
    });
  });
  return { answers, urls };
}

async function pickerPreview(
  type: "Select" | "ComboBox",
  endpoint: Record<string, unknown> = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type, "Button"]);
  const [picker, button] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
          ],
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          path: "/users",
          method: "GET",
          targetCollection: "Users",
          ...endpoint,
        },
      ],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: picker }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  const field = () => h.element(picker)!;
  /** The spinner in the trigger (Picker) · the field group (ComboBox), not in the list. */
  const fieldSpinner = () =>
    field().querySelector(
      type === "Select"
        ? 'button [role="progressbar"]'
        : '.react-aria-Group [role="progressbar"], [role="group"] [role="progressbar"]',
    );
  return { ...h, picker, button, field, fieldSpinner };
}

/**
 * Opens a picker the way its user does: a Select through a rule's `open` (its RAC `isOpen`), a
 * ComboBox from the keyboard (RAC lets no one control its open state).
 */
function openPicker(
  h: Awaited<ReturnType<typeof pickerPreview>>,
  type: "Select" | "ComboBox",
) {
  if (type === "Select") {
    h.rule(h.button, "onPress", {
      opcode: "capability",
      targetId: h.picker,
      capabilityId: "open",
    } as never);
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    return;
  }
  const input = h.field().querySelector("input")!;
  act(() => {
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyUp(input, { key: "ArrowDown" });
  });
}

describe("Picker · ComboBox loadingState — the field's spinner", () => {
  it("a bound Picker: the trigger shows the spinner before the chevron while loading, not after", async () => {
    const server = pendingServer();
    const h = await pickerPreview("Select");
    expect(h.fieldSpinner()).toBeNull();
    act(() => {
      void h.session.reload("users");
    });
    await settle();
    const spinner = h.fieldSpinner();
    expect(spinner).not.toBeNull();
    const trigger = h.field().querySelector("button")!;
    const parts = [...trigger.children];
    const at = parts.findIndex((part) => part.contains(spinner));
    expect(at).toBe(parts.length - 2);
    await act(async () => {
      server.answers[0]!([{ id: "u1", name: "Kim" }]);
    });
    await settle();
    expect(h.fieldSpinner()).toBeNull();
    h.view.unmount();
  });

  it("a bound ComboBox: the field shows the spinner once the load has run 500ms (S2), and drops it when it ends", async () => {
    const server = pendingServer();
    const h = await pickerPreview("ComboBox");
    act(() => {
      void h.session.reload("users");
    });
    await settle();
    expect(h.fieldSpinner()).toBeNull();
    await wait(550);
    const spinner = h.fieldSpinner();
    expect(spinner).not.toBeNull();
    // (Before the field's button.)
    const group = spinner!.closest('[role="group"]')!;
    const parts = [...group.children];
    expect(parts.findIndex((part) => part.contains(spinner))).toBe(
      parts.length - 2,
    );
    await act(async () => {
      server.answers[0]!([{ id: "u1", name: "Kim" }]);
    });
    await settle();
    expect(h.fieldSpinner()).toBeNull();
    h.view.unmount();
  });

  it("an unbound picker never shows one", async () => {
    pendingServer();
    const h = await openAdr280Preview(["Select", "ComboBox"]);
    await settle();
    expect(
      h.view.container.querySelectorAll('[role="progressbar"]'),
    ).toHaveLength(0);
    h.view.unmount();
  });
});

describe("Picker · ComboBox onLoadMore — the open list's end loads the next page", () => {
  for (const type of ["Select", "ComboBox"] as const)
    it(`${type}: opening it on a paging collection loads page 2 at the list's end`, async () => {
      vi.stubGlobal(
        "IntersectionObserver",
        class {
          constructor(
            private readonly callback: (
              entries: { isIntersecting: boolean; target: Element }[],
            ) => void,
          ) {}
          observe(target: Element) {
            queueMicrotask(() =>
              this.callback([{ isIntersecting: true, target }]),
            );
          }
          unobserve() {}
          disconnect() {}
          takeRecords() {
            return [];
          }
        },
      );
      const server = pendingServer();
      const h = await pickerPreview(type, {
        queryParams: [{ key: "page", value: "{{ cursor }}" }],
        responseMapping: { dataPath: "items", cursorPath: "next" },
      });
      await settle();
      await act(async () => {
        server.answers[0]!({
          items: [
            { id: "u1", name: "Kim" },
            { id: "u2", name: "Park" },
          ],
          next: "2",
        });
      });
      await settle();
      expect(server.urls).toEqual(["/users"]);
      openPicker(h, type);
      await settle();
      expect(
        [...document.querySelectorAll('[role="option"]')].filter((option) =>
          /Kim|Park/.test(option.textContent ?? ""),
        ),
      ).toHaveLength(2);
      expect(server.urls).toEqual(["/users", "/users?page=2"]);
      h.view.unmount();
    });
});

describe("a ComboBox's list opens in a running Preview", () => {
  it("its Popover is RAC ComboBox's — the Preview does not hold it closed (no one controls it)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["ComboBox"]);
    const input = h.element(h.ids[0] as NodeId)!.querySelector("input")!;
    act(() => {
      input.focus();
      fireEvent.keyDown(input, { key: "ArrowDown" });
      fireEvent.keyUp(input, { key: "ArrowDown" });
    });
    await settle();
    expect(input.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
    expect(
      document.querySelectorAll('[role="option"]').length,
    ).toBeGreaterThan(0);
    h.view.unmount();
  });
});
