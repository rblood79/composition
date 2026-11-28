import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "react-aria-components/Button";
import { Input } from "react-aria-components/Input";
import { SearchField } from "react-aria-components/SearchField";
import { CatalogPopover } from "../../../../../../packages/shared/src/catalog/runtime/CatalogPopover";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cascaderTable } from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import {
  CatalogCascaderField,
  CatalogCascaderListHost,
  CatalogCascaderValue,
  type CascaderMode,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader.components";
import {
  correctCascaderSelection,
  type CatalogCascaderLevels,
  type CatalogCascaderLevelState,
} from "../../../../../../packages/shared/src/catalog/runtime/cascaderLevels";

/**
 * ADR-322 G6 (사용자 결정 4 · breakdown §4.3) — a Cascader whose levels load one by one, its field
 * against a stand-in of the session's access: a branch not loaded yet is a branch (not a value), its
 * level opened asks it once and shows 「Loading…」 (disabled), a failure shows 「Retry」 which asks
 * again; a key the server sent on two levels clears the value and is reported. The expected texts
 * are written out here.
 */
afterEach(() => {
  vi.restoreAllMocks();
});
// (The open contents are lazy chunks — their first import outlasts a few frames.)
beforeAll(async () => {
  await import("../../../../../../packages/shared/src/catalog/runtime/cascaderMenu.components");
});

const settle = () => act(async () => new Promise((r) => setTimeout(r, 600)));

function levelsOf(states: Map<string, CatalogCascaderLevelState>) {
  const listeners = new Set<() => void>();
  let version = 0;
  const load = vi.fn((key: string) => {
    states.set(key, "loading");
  });
  const levels: CatalogCascaderLevels & { conflicts: Set<string> } = {
    branchKeys: new Set(["11", "26"]),
    stateOf: (key) => states.get(key),
    load,
    conflicts: new Set(),
    correctSelection: correctCascaderSelection,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    version: () => version,
  };
  const notify = () =>
    act(() => {
      version += 1;
      listeners.forEach((listener) => listener());
    });
  return { levels, load, notify };
}

function field(
  mode: CascaderMode,
  levels: CatalogCascaderLevels,
  keys: string[] = [],
  onChange = vi.fn(),
  // (By default the first level only: 서울 · 부산 are branches whose level is not loaded, 세종 a leaf.)
  start: Parameters<typeof cascaderTable>[0] = [
    { key: "11", name: "서울", hasChildItems: true },
    { key: "26", name: "부산", hasChildItems: true },
    { key: "36", name: "세종" },
  ],
) {
  const element = (items: Parameters<typeof cascaderTable>[0] = start) =>
    createElement(
      CatalogCascaderField,
      {
        label: "Region",
        placeholder: "Choose",
        description: "",
        errorMessage: "",
        table: cascaderTable(items),
        mode,
        display: {},
        keys,
        levels,
        onChange,
        root: {},
      },
      createElement(
        Button,
        {},
        createElement(CatalogCascaderValue, {
          text: "Choose",
          placeholder: true,
          style: {},
          catalogId: "value",
        }),
      ),
      // (ADR-326 — the open content is its nodes: the Popover > the search field + the list box
      //  body, as the catalog renderer draws them.)
      createElement(CatalogPopover, {
        children: createElement(
          Fragment,
          null,
          createElement(SearchField, {}, createElement(Input)),
          createElement(CatalogCascaderListHost, {
            base: {
              className: "react-aria-CascaderList",
              "data-size": "M",
            },
            // (These items carry no record — a row is its name.)
            renderRow: () => createElement(Fragment),
          }),
        ),
      }),
    );
  const view = render(element());
  /** The session's level arrives — the field draws the table that holds it. */
  const arrive = (items: Parameters<typeof cascaderTable>[0]) =>
    act(() => view.rerender(element(items)));
  return Object.assign(view, { arrive });
}

describe("ADR-322 G6 — levels loaded one by one (the field's side)", () => {
  it("first markup includes the native validation control even without a form name", () => {
    const markup = renderToString(
      createElement(CatalogCascaderField, {
        label: "Region",
        placeholder: "Choose",
        description: "",
        errorMessage: "",
        isRequired: true,
        mode: "columns",
        table: cascaderTable([]),
        display: {},
        keys: [],
        root: {},
      }),
    );
    const doc = new DOMParser().parseFromString(markup, "text/html");
    const input = doc.querySelector<HTMLInputElement>("input[required]");
    expect(input?.value).toBe("");
    expect(input?.hasAttribute("name")).toBe(false);
    expect(input?.validity.valueMissing).toBe(true);
  });

  it("a branch not loaded is a branch: not a value — a start key of it is refused", () => {
    const table = cascaderTable([
      { key: "11", name: "서울", hasChildItems: true },
    ]);
    expect(table.byPathId.get("11")).toMatchObject({
      hasChildren: true,
      pickable: false,
    });
  });

  it("columns: opening a branch's submenu asks its level once; 「Loading…」 is disabled, a failure's 「Retry」 asks again", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const states = new Map<string, CatalogCascaderLevelState>();
    const { levels, load, notify } = levelsOf(states);
    const view = field("columns", levels);
    const user = userEvent.setup();
    const button = view.container.querySelector("button")!;
    button.focus();
    await user.keyboard("{Enter}");
    await settle();
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith("11");
    const status = () =>
      [...document.querySelectorAll('[role="menu"]')]
        .at(-1)!
        .querySelector('[role^="menuitem"]') as HTMLElement;
    expect(status().textContent).toBe("Loading…");
    expect(status().getAttribute("aria-disabled")).toBe("true");
    states.set("11", "error");
    notify();
    await settle();
    expect(status().textContent).toBe("Couldn't load — Retry");
    expect(status().getAttribute("aria-disabled")).toBeNull();
    await user.click(status());
    await settle();
    expect(load).toHaveBeenCalledTimes(2);
    view.unmount();
  });

  it("drill: entering a branch asks its level; the status row is 「Loading…」", async () => {
    const states = new Map<string, CatalogCascaderLevelState>();
    const { levels, load } = levelsOf(states);
    const view = field("drill", levels);
    const user = userEvent.setup();
    view.container.querySelector("button")!.focus();
    await user.keyboard("{Enter}");
    await settle();
    // (The search field takes focus on open — always there, 2026-11-28; Tab goes into the list.)
    await user.keyboard("{Tab}");
    await user.keyboard("{Enter}");
    await settle();
    expect(load).toHaveBeenCalledWith("11");
    expect(
      [...document.querySelectorAll('[role="grid"] [role="row"]')].map(
        (row) => row.textContent,
      ),
    ).toEqual(["Loading…"]);
    view.unmount();
  });

  it("tree: expanding a branch asks its level; its row is 「Loading…」", async () => {
    const states = new Map<string, CatalogCascaderLevelState>();
    const { levels, load } = levelsOf(states);
    const view = field("tree", levels);
    const user = userEvent.setup();
    view.container.querySelector("button")!.focus();
    await user.keyboard("{Enter}");
    await settle();
    (
      document.querySelector('[role="treegrid"] [role="row"]') as HTMLElement
    ).focus();
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(load).toHaveBeenCalledWith("11");
    expect(
      [...document.querySelectorAll('[role="treegrid"] [role="row"]')].map(
        (row) => row.textContent,
      ),
    ).toEqual(["서울", "Loading…", "부산", "세종"]);
    view.unmount();
  });

  // (ADR-326 Phase 3 판독 1 수리 — a level arriving past 50 items keeps the focused row.)
  it("tree: a branch's level arriving with 48 rows (51 items in all) keeps focus on the branch row", async () => {
    const states = new Map<string, CatalogCascaderLevelState>();
    const { levels, notify } = levelsOf(states);
    const view = field("tree", levels);
    const user = userEvent.setup();
    view.container.querySelector("button")!.focus();
    await user.keyboard("{Enter}");
    await settle();
    (
      document.querySelector('[role="treegrid"] [role="row"]') as HTMLElement
    ).focus();
    await user.keyboard("{ArrowRight}");
    await settle();
    states.set("11", "loaded");
    await view.arrive([
      {
        key: "11",
        name: "서울",
        children: Array.from({ length: 48 }, (_, i) => ({
          key: `11-${i}`,
          name: `구 ${i}`,
        })),
      },
      { key: "26", name: "부산", hasChildItems: true },
      { key: "36", name: "세종" },
    ]);
    notify();
    await settle();
    expect(document.activeElement?.getAttribute("role")).toBe("row");
    expect(document.activeElement?.textContent).toBe("서울");
    view.unmount();
  });

  // (ADR-326 Phase 3 수리 검증 — the virtualizer's choice is a level's own: a small level's
  //  choice does not carry into a big one entered from it.)
  it("drill: entering a 1,000-row level from a 1-row level draws it in the virtualizer", async () => {
    const states = new Map<string, CatalogCascaderLevelState>([
      ["11", "loaded"],
    ]);
    const { levels } = levelsOf(states);
    const view = field("drill", levels, [], vi.fn(), [
      {
        key: "11",
        name: "서울",
        children: Array.from({ length: 1000 }, (_, i) => ({
          key: `11-${i}`,
          name: `구 ${i}`,
        })),
      },
    ]);
    const user = userEvent.setup();
    view.container.querySelector("button")!.focus();
    await user.keyboard("{Enter}");
    await settle();
    await user.keyboard("{Tab}");
    await user.keyboard("{Enter}");
    await settle();
    // (jsdom has no viewport — the virtualizer draws every row, each in its positioned box.)
    const row = document.querySelector('[role="grid"] [role="row"]');
    expect(row?.textContent).toBe("구 0");
    expect((row?.parentElement as HTMLElement | null)?.style.position).toBe(
      "absolute",
    );
    view.unmount();
  });

  it("a key the server sent on two levels clears the value and is reported", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const states = new Map<string, CatalogCascaderLevelState>();
    const { levels } = levelsOf(states);
    levels.conflicts.add("36");
    const onChange = vi.fn();
    const view = field("columns", levels, ["36"], onChange);
    await settle();
    expect(onChange).toHaveBeenCalledWith(null);
    expect(
      warn.mock.calls.some((call) =>
        String(call[0]).includes("서버 계약 위반"),
      ),
    ).toBe(true);
    view.unmount();
  });
});
