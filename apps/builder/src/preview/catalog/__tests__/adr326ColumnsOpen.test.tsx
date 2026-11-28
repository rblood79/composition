import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-326 Phase 2 (G2 — breakdown §4.3 · §4.6) — a `columns` Cascader's open content drawn from its
 * nodes in a running Preview: the Popover node opens with the field's contexts (`trigger:
 * "Cascader"`), the list box node is the RAC Menu (its record's catalog id · `react-aria-CascaderList`),
 * each row is its item record's (catalog id · `react-aria-CascaderItem` · the written style) with the
 * record's label Text. The expected values are written out from the origin's sample items (Electronics ·
 * Clothing · Books — Books is `__item-3`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});
// (The open content is a lazy chunk — its first import outlasts a few frames.)
beforeAll(async () => {
  await import("../../../../../../packages/shared/src/catalog/runtime/cascaderMenu.components");
});

const PAINT = "rgb(255, 228, 196)";

async function place() {
  const h = await openAdr280Preview(["Cascader"]);
  const [target] = h.ids as [NodeId];
  const user = userEvent.setup();
  const field = () => h.element(target)!;
  const trigger = () => field().querySelector("button")!;
  const menu = () => document.querySelector<HTMLElement>('[role="menu"]');
  const rows = () => [
    ...document.querySelectorAll<HTMLElement>(
      '[role="menu"] [role^="menuitem"]',
    ),
  ];
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 50)));
  const openIt = async () => {
    await user.click(trigger());
    await vi.waitFor(() => expect(menu()).toBeTruthy());
    await settle();
  };
  return { ...h, target, user, field, trigger, menu, rows, settle, openIt };
}

describe("ADR-326 G2 — columns 의 열린 내용 = 원본 노드 (Preview)", () => {
  it("Popover 노드 · 목록 = CascaderList record · 행 = 항목 record (class · catalog id · 쓴 배경)", async () => {
    const h = await place();
    // (The Builder writes Books' background — the row takes its record's written style.)
    const books = [...h.workspace.root.domInputs.values()].find(
      (record) =>
        h.workspace.root.typeOf(record) === "CascaderItem" &&
        record.props.id === "books",
    )!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(books.id)!.target],
        visual: { backgroundColor: { kind: "set", value: PAINT } },
      } as never),
    );
    h.flush();
    await h.openIt();
    const popover = h.menu()!.closest(".react-aria-Popover")!;
    expect(popover.getAttribute("data-trigger")).toBe("Cascader");
    expect(popover.getAttribute("data-catalog-id")).toMatch(/__popover$/);
    expect(h.menu()!.className).toBe("react-aria-CascaderList");
    expect(h.menu()!.getAttribute("data-catalog-id")).toMatch(/__list$/);
    expect(h.rows().map((row) => row.textContent)).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    for (const row of h.rows()) {
      expect(row.classList.contains("react-aria-CascaderItem")).toBe(true);
      expect(row.getAttribute("data-catalog-id")).toMatch(/__item-\d$/);
      // (The label is the item record's Text node — RAC's label slot.)
      const label = row
        .querySelector('.react-aria-Text[slot="label"]')
        ?.getAttribute("data-catalog-id");
      expect(label).toBeTruthy();
      expect(label).not.toBe(row.getAttribute("data-catalog-id"));
    }
    const painted = h.rows().filter((row) => row.style.backgroundColor);
    expect(painted.map((row) => row.textContent)).toEqual(["Books"]);
    expect(painted[0]!.style.backgroundColor).toBe(PAINT);
    // (A leaf draws no chevron; a branch's is its record's Icon.)
    expect(
      h.rows().map((row) => !!row.querySelector('[slot="descriptor"]')),
    ).toEqual([true, true, false]);
    h.view.unmount();
  });

  it("검색어는 열린 동안만 — 닫고 다시 열면 빈 검색 칸 · 단계 목록", async () => {
    const h = await place();
    await h.openIt();
    const search = () =>
      document.querySelector<HTMLInputElement>(
        ".react-aria-SearchField input",
      )!;
    expect(search().getAttribute("aria-label")).toBe("Search");
    await h.user.keyboard("lap");
    await h.settle();
    expect(search().value).toBe("lap");
    expect(h.rows().map((row) => row.textContent)).toEqual([
      "LaptopsElectronics / Computers / Laptops",
    ]);
    // (A result picked closes the field — RAC SearchField's Esc would clear the text first.)
    await h.user.keyboard("{ArrowDown}{Enter}");
    await h.settle();
    expect(
      h.field().querySelector(".react-aria-SelectValue")!.textContent,
    ).toBe("Electronics / Computers / Laptops");
    expect(h.menu()).toBeNull();
    await h.openIt();
    expect(search().value).toBe("");
    expect(h.rows().map((row) => row.textContent)).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    h.view.unmount();
  });

  it("항목의 글자색은 라벨 · chevron 이 상속한다 (Text 의 기본 색을 인라인으로 두지 않음)", async () => {
    const h = await place();
    const books = [...h.workspace.root.domInputs.values()].find(
      (record) =>
        h.workspace.root.typeOf(record) === "CascaderItem" &&
        record.props.id === "books",
    )!;
    h.workspace.execute(
      setFields({
        targets: [h.workspace.itemOfRecord(books.id)!.target],
        visual: { color: { kind: "set", value: "#ffffff" } },
      } as never),
    );
    h.flush();
    await h.openIt();
    for (const row of h.rows()) {
      for (const part of row.querySelectorAll<HTMLElement>(
        '.react-aria-Text[slot="label"], .react-aria-Icon[slot="descriptor"]',
      ))
        expect(["", "inherit"]).toContain(part.style.color);
    }
    const painted = h.rows().find((row) => row.textContent === "Books")!;
    expect(painted.style.color).toBe("rgb(255, 255, 255)");
    h.view.unmount();
  });

  it("필드의 size 가 목록 · 행 · 라벨 글자에 닿는다 (XL)", async () => {
    const h = await place();
    h.declare(h.target, { size: "XL" });
    h.flush();
    await h.openIt();
    expect(h.menu()!.getAttribute("data-size")).toBe("XL");
    expect(h.rows().map((row) => row.getAttribute("data-size"))).toEqual([
      "XL",
      "XL",
      "XL",
    ]);
    const label = h
      .rows()[0]!
      .querySelector<HTMLElement>('.react-aria-Text[slot="label"]')!;
    expect(label.style.fontSize).not.toBe("var(--catalog-token-text-sm)");
    h.view.unmount();
  });

  it("항목 원본에 쓴 Hover 배경이 행의 상태 값으로 간다", async () => {
    const h = await place();
    const books = [...h.workspace.root.domInputs.values()].find(
      (record) =>
        h.workspace.root.typeOf(record) === "CascaderItem" &&
        record.props.id === "books",
    )!;
    h.workspace.execute(
      setLibraryDefault({
        definitionId: books.definitionId as never,
        scope: "stateRules",
        state: "hover",
        key: "backgroundColor",
        write: { kind: "set", value: "#abcdef" },
        newId: h.workspace.newId,
      }),
    );
    h.flush();
    await h.openIt();
    for (const row of h.rows()) {
      expect(row.getAttribute("data-catalog-hover")).toBe("background-color");
      expect(
        row.style.getPropertyValue("--catalog-hover-background-color"),
      ).toBe("#abcdef");
    }
    h.view.unmount();
  });

  // (Stop 판독 2026-11-28 — the row is its item record drawn by the catalog renderer, §4.3 개정.)
  it("실행 중 숨김 (Hide 동작의 style) 이 그 행에 간다", async () => {
    const h = await place();
    const books = [...h.workspace.root.domInputs.values()].find(
      (record) =>
        h.workspace.root.typeOf(record) === "CascaderItem" &&
        record.props.id === "books",
    )!;
    await act(async () =>
      h.runtime.setRuntimeProps!(books.id, { style: { display: "none" } }),
    );
    await h.openIt();
    expect(h.rows().map((row) => [row.textContent, row.style.display])).toEqual(
      [
        ["Electronics", ""],
        ["Clothing", ""],
        ["Books", "none"],
      ],
    );
    h.view.unmount();
  });

  it("행의 부품은 문서 순서 그대로 — chevron 뒤에 넣은 아이콘은 chevron 뒤에", async () => {
    const h = await place();
    const root = h.workspace.root;
    const electronics = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "CascaderItem" &&
        record.props.id === "electronics",
    )!;
    const added = "project:node:added-icon" as NodeId;
    h.workspace.execute(
      insertNodes({
        parent: h.workspace.itemOfRecord(electronics.id)!.target,
        // (After the chevron: check · label · chevron — Phase 4 판독 1's check mark first.)
        index: 3,
        entries: [
          {
            kind: "node",
            id: added,
            definitionId: catalogPaletteDefinitionId(
              h.workspace.runtime.graph.library,
              "Icon",
            ),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [added],
        newId: h.workspace.newId,
      } as never),
    );
    h.flush();
    await h.openIt();
    const row = h
      .rows()
      .find((item) => item.textContent!.startsWith("Electronics"))!;
    expect(
      [...row.children].map((part) =>
        part.getAttribute("data-catalog-id")?.endsWith(`::${added}`)
          ? "added"
          : part.getAttribute("slot"),
      ),
    ).toEqual(["selection", "label", "descriptor", "added"]);
    h.view.unmount();
  });

  it("첫 단계의 잎을 고른 뒤 다시 열면 Esc 가 닫는다 (선택을 지우는 데 쓰이지 않음)", async () => {
    const h = await place();
    await h.openIt();
    await h.user.click(h.rows().find((row) => row.textContent === "Books")!);
    await h.settle();
    expect(h.menu()).toBeNull();
    expect(
      h.field().querySelector(".react-aria-SelectValue")!.textContent,
    ).toBe("Books");
    await h.openIt();
    await h.user.keyboard("{Escape}");
    await h.settle();
    expect(h.menu()).toBeNull();
    expect(document.activeElement).toBe(h.trigger());
    h.view.unmount();
  });
});
