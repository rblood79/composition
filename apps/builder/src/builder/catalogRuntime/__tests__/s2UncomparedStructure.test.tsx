// @vitest-environment jsdom
/**
 * S2 마이그레이션 체크리스트 §5 「구조 미대조 9종」 (2026-11-18) — 설치된 S2 1.8.2 와 대조해 남은 구조:
 * - ActionBar (`ActionBar.tsx`): DOM 순서 = 동작 묶음 (`div` > ActionButtonGroup `aria-label="Actions"`)
 *   먼저, 지우기 · 개수 묶음 뒤 — 화면은 지우기 · 개수가 왼쪽 (S2 `order`; 엔진에 `order` 가 없어 root
 *   `row-reverse`). 지우기 버튼 이름 · 묶음 이름은 S2 intl.
 * - SegmentedControl (`SegmentedControl.tsx`): 기본 선택 = 첫 항목 (비활성이어도), 글자 없는 항목은 Text 없음.
 * - Avatar (`Avatar.tsx`): `alt` 기본 `''` (장식).
 * - Image (`Image.tsx`): 늘 `div > img`.
 * - Link (`Link.tsx`): quiet 의 밑줄 없음은 단독 링크만 — 문단 안 링크는 밑줄 유지, hover · focus 에 다시 밑줄.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogAbsentByValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { catalogGroupSelection } from "../../../../../../packages/shared/src/catalog/runtime/groupSelection";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogTextDecoration } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GENERATED = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../../packages/shared/src/components/styles/generated",
);

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

const ID = "project:node:placed" as NodeId;

async function open(type: string, props: Record<string, unknown> = {}) {
  const library = await buildCodeCatalogLibrary();
  const measure = (text: string, font: { fontSize: number }) => ({
    width: (text.length * font.fontSize) / 2,
    height: font.fontSize * 1.5,
  });
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-uncompared" as const,
        name: "S2 uncompared",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-uncompared-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure as never,
    },
  );
  cleanups.push(() => workspace.dispose());
  const definitionId =
    type === "Image"
      ? "lib:definition:type-Image"
      : catalogPaletteDefinitionId(library, type);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: ID,
          definitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ID],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const ofType = (t: string) => records().filter((r) => root.typeOf(r) === t);
  const render = async (locale = "en-US") => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () =>
      reactRoot.render(
        createElement(I18nProvider, {
          locale,
          children: renderCatalogDom(root, ofType(type)[0]!.id),
        }),
      ),
    );
    cleanups.push(async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    });
    return host;
  };
  return { workspace, root, records, ofType, render };
}

describe("S2 §5 — ActionBar", () => {
  it("DOM: the actions come first (S2 order), named by S2's strings; the clear button after", async () => {
    const { render } = await open("ActionBar");
    const host = await render();
    const buttons = [...host.querySelectorAll("button")];
    expect(
      buttons.map((b) => b.textContent || b.getAttribute("aria-label")),
    ).toEqual(["Edit", "Delete", "Clear selection"]);
    const group = host.querySelector(".react-aria-ActionButtonGroup")!;
    expect(group.getAttribute("aria-label")).toBe("Actions");
    // S2: the group sits in its own `div` (order 1, margin-start auto).
    expect(group.parentElement).not.toBe(
      host.querySelector(".react-aria-ActionBar"),
    );
  });

  it("DOM: the names follow the locale (S2 intl ko-KR)", async () => {
    const { render } = await open("ActionBar");
    const host = await render("ko-KR");
    expect(
      host
        .querySelector(".react-aria-ActionButtonGroup")!
        .getAttribute("aria-label"),
    ).toBe("액션");
    expect(
      [...host.querySelectorAll("button")].at(-1)!.getAttribute("aria-label"),
    ).toBe("선택 항목 지우기");
  });

  it("Canvas: the clear · count group at the start edge, the actions at the end edge", async () => {
    const { root, ofType, records } = await open("ActionBar");
    const bar = ofType("ActionBar")[0]!;
    const group = ofType("ActionButtonGroup")[0]!;
    const clear = records().find((r) => r.props.slot === "clear")!;
    // (Geometry is parent-relative — sum the chain.)
    const abs = (id: string) => {
      let x = 0;
      for (
        let at = root.canvasInputs.get(id);
        at;
        at = root.canvasInputs.get(at.parentId)
      ) {
        if (at.id === bar.id) break;
        x += root.getGeometry([at.id]).get(at.id)!.x;
      }
      return x;
    };
    const barBox = root.getGeometry([bar.id]).get(bar.id)!;
    const groupBox = root.getGeometry([group.id]).get(group.id)!;
    expect(abs(clear.id)).toBeCloseTo(8, 0);
    expect(abs(group.id) + groupBox.width).toBeCloseTo(barBox.width - 8, 0);
  });
});

describe("S2 §5 — SegmentedControl", () => {
  it("the default selection is the first item, disabled or not (S2 DefaultSelectionTracker)", async () => {
    const { root, ofType, workspace, render } = await open("SegmentedControl");
    const items = ofType("SegmentedControlItem");
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(items[0]!.id)!.target],
        props: { isDisabled: { kind: "set", value: true } },
      }),
    );
    const owner = ofType("SegmentedControl")[0]!;
    const first = String(ofType("SegmentedControlItem")[0]!.props.id);
    // The one reading the Canvas · the DOM · the dispatcher share (ADR-308).
    expect(
      catalogGroupSelection(
        owner,
        (id) => root.canvasInputs.get(id),
        (node) => root.typeOf(node),
      ),
    ).toEqual([first]);
    const buttons = [...(await render()).querySelectorAll("button")];
    expect(buttons.map((b) => b.hasAttribute("data-selected"))).toEqual([
      true,
      false,
    ]);
  });

  it("an item without a label has no Text (S2 wraps only a string child)", async () => {
    const { ofType, workspace, records } = await open("SegmentedControl");
    const item = ofType("SegmentedControlItem")[0]!;
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(item.id)!.target],
        props: { label: { kind: "set", value: "" } },
      }),
    );
    const textIn = (itemId: string) =>
      records().find((r) => {
        if (r.bindingId !== "text") return false;
        for (let at = r; at; at = records().find((x) => x.id === at.parentId)!)
          if (at.parentId === itemId) return true;
        return false;
      })!;
    const [first, second] = ofType("SegmentedControlItem");
    expect(catalogAbsentByValue(textIn(first!.id))).toBe(true);
    expect(catalogAbsentByValue(textIn(second!.id))).toBe(false);
  });
});

describe("S2 §5 — Avatar · Image", () => {
  it("Avatar: an image without authored alt is decorative (S2 `alt = ''`)", async () => {
    const { render } = await open("Avatar", {
      src: "https://example.com/a.png",
    });
    const img = (await render()).querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("");
  });

  it("Image: a box around its img everywhere (S2 Image)", async () => {
    const { render } = await open("Image", {
      src: "https://example.com/p.png",
    });
    const box = (await render()).querySelector(".react-aria-Image")!;
    expect(box.tagName).toBe("DIV");
    expect(box.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/p.png",
    );
    expect((box as HTMLElement).style.overflow).toBe("hidden");
  });
});

describe("S2 §5 — Link quiet underline", () => {
  it("Canvas: only a standalone quiet Link rests without its underline", () => {
    expect(catalogTextDecoration({ isQuiet: true }, {}, "underline")).toBe(
      "underline",
    );
    expect(
      catalogTextDecoration(
        { isQuiet: true, isStandalone: true },
        {},
        "underline",
      ),
    ).toBeUndefined();
  });

  it("DOM: the generated sheet drops the underline under standalone + quiet, and brings it back on hover and keyboard focus", () => {
    const css = readFileSync(join(GENERATED, "Link.css"), "utf8");
    expect(css).toMatch(
      /:where\(\[data-standalone="true"\]\[data-quiet\]\)\s*\{[^}]*text-decoration:\s*none/,
    );
    expect(css).toMatch(
      /\[data-standalone="true"\]\[data-quiet\]\[data-focus-visible\][^{]*\{[^}]*text-decoration:\s*underline/,
    );
    expect(css).not.toMatch(
      /:where\(\[data-quiet\]\)\s*\{[^}]*text-decoration:\s*none/,
    );
  });
});
