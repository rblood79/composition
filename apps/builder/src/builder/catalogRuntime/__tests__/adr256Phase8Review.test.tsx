// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { act } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  detachInstances,
  groupNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogPreviewInteractions } from "../../../../../../packages/shared/src/catalog/runtime/catalogPreviewInteractions";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 8 판독 (Round 18) — Disclosure 노드 트리의 편집 4건:
 * H1 그룹 안 다른 요소 아래의 Disclosure 가 그룹 상태를 따르지 않음 (RAC 의 그룹 context 는 어느
 * 깊이든 닿는다) · M1 Heading 을 frame 으로 감싸면 Canvas trigger 모양과 DOM chevron 회전이 빠짐 ·
 * M2 trigger 의 작성 `isDisabled` · 글자를 DOM 이 버림 · M3 바꾼 Icon 을 DOM 만 돌림.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
const node = (
  id: string,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as NodeEntry;

/** The selector of the Disclosure sheet's turned chevron (the generated CSS). */
const TURN = (() => {
  const css = readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../../../packages/shared/src/components/styles/generated/Disclosure.css",
    ),
    "utf8",
  );
  const match = /([^{}]+)\{\s*rotate:\s*90deg;/.exec(css);
  if (!match) throw new Error("DISCLOSURE_TURN_RULE_REQUIRED");
  return match[1]!.trim();
})();

const cleanups: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

/** A palette Disclosure · DisclosureGroup on the page, detached (its parts are the author's). */
async function open(
  type: "disclosure" | "disclosuregroup" | "tree",
  props: Record<string, unknown> = {},
) {
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr256-p8-review" as EntryId<"project">,
      name: "Phase 8 review",
    }),
    await buildCodeCatalogLibrary(),
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr256-p8-review-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(PLACED, `lib:definition:origin-component-${type}`, {
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ) as never,
        }),
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  workspace.execute(detachInstances({ ids: [PLACED], newId: workspace.newId }));
  const root = workspace.root;
  const all = (name: string) =>
    [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === name,
    );
  const placed = () =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === PLACED,
    )!;
  const edit = (target: string, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: target as NodeId }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  /** The node in a new layout frame (Group selection — the frame takes its place). */
  const frame = (id: string) =>
    workspace.execute(
      groupNodes({
        ids: [id as NodeId],
        group: node(
          workspace.newId("node") as string,
          "lib:definition:type-frame",
        ),
        newId: workspace.newId,
      }),
    );
  /** The DOM — with the Preview's runtime (its expansion is runtime state, ADR-250) when asked. */
  const mount = async (preview = false) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const runtime = preview
      ? new CatalogPreviewInteractions({
          graph: () => graph,
          root: () => workspace.root,
          subscribe: () => () => {},
          navigate: () => {},
          showToast: () => {},
        })
      : undefined;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => {
      reactRoot.render(renderCatalogDom(root, placed().id, { runtime }));
    });
    cleanups.push(async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
    });
    return host;
  };
  /** Whether each section's panel shows on the Canvas, by its Disclosure's title. */
  const panels = () =>
    Object.fromEntries(
      all("DisclosurePanel").map((panel) => [
        String(root.canvasInputs.get(panel.parentId!)!.props.title),
        !panel.hidden,
      ]),
    );
  return { workspace, root, all, placed, edit, frame, mount, panels };
}

async function press(button: HTMLElement) {
  await act(async () => {
    for (const type of ["pointerdown", "pointerup"])
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    button.click();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}
const expanded = (host: HTMLElement) =>
  [...host.querySelectorAll(".react-aria-Disclosure")].map((section) =>
    section.hasAttribute("data-expanded"),
  );

describe("ADR-256 Phase 8 판독 H1 — a Disclosure below another element in a group follows the group", () => {
  const section = (all: (name: string) => Array<{ sourceId?: string; props: Record<string, unknown> }>, title: string) =>
    all("Disclosure").find((record) => record.props.title === title)!.sourceId!;

  it("Canvas and DOM agree: the framed Disclosure is expanded, and the Preview trigger collapses it", async () => {
    const { all, frame, mount, panels } = await open("disclosuregroup");
    frame(section(all, "Section 2"));
    expect(panels()).toEqual({ "Section 1": true, "Section 2": true });
    const host = await mount(true);
    expect(expanded(host)).toEqual([true, true]);
    await press(
      host.querySelectorAll<HTMLElement>('button[slot="trigger"]')[1]!,
    );
    expect(expanded(host)).toEqual([true, false]);
  });

  it("allowsMultipleExpanded false counts the framed Disclosure (Canvas and DOM)", async () => {
    const { all, frame, edit, placed, mount, panels } =
      await open("disclosuregroup");
    frame(section(all, "Section 1"));
    edit(placed().sourceId!, { allowsMultipleExpanded: false });
    expect(panels()).toEqual({ "Section 1": true, "Section 2": false });
    const host = await mount();
    expect(expanded(host)).toEqual([true, false]);
  });

  it("the framed second section is the group's too: single expansion collapses it (Canvas and DOM)", async () => {
    const { all, frame, edit, placed, mount, panels } =
      await open("disclosuregroup");
    frame(section(all, "Section 2"));
    edit(placed().sourceId!, { allowsMultipleExpanded: false });
    expect(panels()).toEqual({ "Section 1": true, "Section 2": false });
    const host = await mount();
    expect(expanded(host)).toEqual([true, false]);
  });
});

describe("ADR-256 Phase 8 판독 M1 — a frame around the Heading keeps the Disclosure's sheet", () => {
  it("the Canvas trigger keeps its part-rule box and font; the DOM chevron still turns", async () => {
    const { all, frame, mount } = await open("disclosure", { size: "L" });
    const trigger = () => all("Button")[0]!;
    const before = { ...trigger().visual };
    frame(all("Heading")[0]!.sourceId!);
    expect(trigger().visual).toEqual(before);
    expect(all("Heading")[0]!.visual).toBeDefined();
    const host = await mount();
    expect(host.querySelector("svg")!.matches(TURN)).toBe(true);
  });
});

describe("ADR-256 Phase 8 판독 M2 — the trigger Button's authored props reach the DOM", () => {
  it("isDisabled disables the trigger; its text shows", async () => {
    const { all, edit, mount } = await open("disclosure");
    edit(all("Button")[0]!.sourceId!, { isDisabled: true, children: "Extra" });
    const host = await mount(true);
    const button = host.querySelector<HTMLButtonElement>(
      'button[slot="trigger"]',
    )!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Extra");
    await press(button);
    expect(expanded(host)).toEqual([true]);
  });
});

describe("ADR-256 Phase 8 판독 M3 — only the chevron turns (Canvas and DOM)", () => {
  it("a replaced Icon keeps its glyph on both consumers; chevron-right turns on both", async () => {
    const { all, edit, mount } = await open("disclosure");
    const icon = () => all("Icon")[0]!;
    expect(icon().derivedProps?.iconName).toBe("chevron-down");
    let host = await mount();
    expect(host.querySelector("svg")!.matches(TURN)).toBe(true);
    edit(icon().sourceId!, { iconName: "arrow-up" });
    expect(icon().derivedProps?.iconName).toBeUndefined();
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    host = await mount();
    expect(host.querySelector("svg")!.matches(TURN)).toBe(false);
  });
});

describe("ADR-256 Phase 8 판독 후속 — Round 18 범위 밖 · Round 19 LOW", () => {
  it("Tree: only the chevron-right glyph turns (Tree.css) — a replaced Icon keeps its glyph name on the DOM", async () => {
    const css = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../../../packages/shared/src/components/styles/Tree.css",
      ),
      "utf8",
    );
    const turn = /&\[data-expanded\]([^{}]+)\{\s*rotate:\s*90deg;/.exec(css);
    expect(turn?.[1]).toContain('.react-aria-Icon[data-icon="chevron-right"]');
    const { workspace, all, mount } = await open("tree");
    const chevron = all("Icon").find(
      (record) => record.props.iconName === "chevron-right",
    )!;
    let host = await mount();
    const glyphs = () =>
      [...host.querySelectorAll('button[slot="chevron"] .react-aria-Icon')].map(
        (icon) => icon.getAttribute("data-icon"),
      );
    expect(glyphs()).toContain("chevron-right");
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(chevron.id)!.target],
        props: { iconName: set("arrow-up") } as never,
      }),
    );
    for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
    host = await mount();
    expect(glyphs()).toContain("arrow-up");
  });

  it("a Disclosure put into an empty frame of the group after the DOM mounted joins the group", async () => {
    const { workspace, all, placed, mount } = await open("disclosuregroup");
    const box = workspace.newId("node") as string;
    workspace.execute(
      insertNodes({
        parent: workspace.positionOfRecord(placed().id)!.target,
        entries: [node(box, "lib:definition:type-frame")],
        rootIds: [box as NodeId],
        newId: workspace.newId,
      }),
    );
    const host = await mount(true);
    expect(expanded(host)).toEqual([true, true]);
    const frameRecord = all("frame").find((record) => record.sourceId === box)!;
    const added = workspace.newId("node") as string;
    await act(async () => {
      workspace.execute(
        insertNodes({
          parent: workspace.positionOfRecord(frameRecord.id)!.target,
          entries: [
            node(added, "lib:definition:origin-component-disclosure", {
              props: { title: set("Section 3") } as never,
            }),
          ],
          rootIds: [added as NodeId],
          newId: workspace.newId,
        }),
      );
    });
    expect(expanded(host)).toEqual([true, true, true]);
    await press(host.querySelectorAll<HTMLElement>('button[slot="trigger"]')[2]!);
    expect(expanded(host)).toEqual([true, true, false]);
  });
});
