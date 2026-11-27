import { act, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Button } from "react-aria-components/Button";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cascaderTable } from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import {
  CatalogCascaderField,
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
  await import(
    "../../../../../../packages/shared/src/catalog/runtime/cascaderMenu.components"
  );
  await import(
    "../../../../../../packages/shared/src/catalog/runtime/cascaderPanel.components"
  );
});

const settle = () =>
  act(async () => new Promise((r) => setTimeout(r, 600)));

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
) {
  // (The first level only: 서울 · 부산 are branches whose level is not loaded, 세종 a leaf.)
  const table = cascaderTable([
    { key: "11", name: "서울", hasChildItems: true },
    { key: "26", name: "부산", hasChildItems: true },
    { key: "36", name: "세종" },
  ]);
  return render(
    createElement(
      CatalogCascaderField,
      {
        label: "Region",
        placeholder: "Choose",
        description: "",
        errorMessage: "",
        table,
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
    ),
  );
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
