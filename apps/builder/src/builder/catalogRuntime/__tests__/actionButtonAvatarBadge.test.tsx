// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「ActionButton 에 Avatar · Badge 추가 — Badge 에 value」) S2
 * `<ActionButton><Avatar src/><Text/><NotificationBadge value/></ActionButton>`: the ActionButton origin's
 * `avatar` · `badge` fill an Avatar (one line tall) and a count Badge (its `value` — over 99 `99+`, one
 * digit a square, more a pill) placed over the icon's top-right corner (a words-only button's top-right
 * corner) — the same box in the Canvas and the DOM. Unfilled, neither is there.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
import {
  catalogActionBadgeHeight,
  catalogActionBadgeLayout,
} from "../../../../../../packages/shared/src/catalog/rule/actionBadge";
import { resolveToken } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { renderCatalogDom } from "../domBinding";
import { catalogAuthoredVisual } from "../libraryVisual";
import { catalogRulePaint } from "../rulePaint";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:action" as NodeId;
const AVATAR = "https://example.com/avatar.png";

async function open(props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:action-avatar-badge" as const,
        name: "ActionButton avatar badge",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `action-avatar-badge-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, "ActionButton"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const button = () =>
    [...root.canvasInputs.values()].find(
      (item) => root.typeOf(item) === "ActionButton",
    )!;
  if (Object.keys(props).length)
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(button().id)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ) as never,
      }),
    );
  const read = () => {
    const record = button();
    const child = (type: string) =>
      record.children
        .map((id) => root.canvasInputs.get(id)!)
        .find((item) => root.typeOf(item) === type)!;
    const avatar = child("Avatar");
    const badge = child("Badge");
    const icon = child("Icon");
    const geometry = root.getGeometry([record.id, avatar.id, badge.id]);
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, record.id));
    const paint = catalogRulePaint({
      node: badge,
      rule: COMPONENT_RULES_TABLE.Badge,
      type: "Badge",
      authoredVisual: catalogAuthoredVisual(root, badge),
    }).paint;
    return {
      record,
      avatar,
      badge,
      icon,
      badgePaint: {
        bg: resolveToken(paint.backgroundColor as never, "light"),
        color: resolveToken(paint.color as never, "light"),
      },
      box: geometry.get(record.id)!,
      avatarBox: geometry.get(avatar.id),
      badgeBox: geometry.get(badge.id),
      dom: host.querySelector(".react-aria-ActionButton") as HTMLElement,
    };
  };
  return { workspace, read };
}

describe("ActionButton Avatar · Badge (S2)", () => {
  it("draws neither until the origin's avatar · badge are filled", async () => {
    const { workspace, read } = await open({});
    try {
      const { avatar, badge, dom } = read();
      expect(avatar.hidden).toBe(true);
      expect(badge.hidden).toBe(true);
      expect(dom.querySelector(".react-aria-Avatar")).toBeNull();
      expect(dom.querySelector(".react-aria-Badge")).toBeNull();
    } finally {
      workspace.dispose();
    }
  });

  it("a words-only button's count sits on its top-right corner — Canvas and DOM alike", async () => {
    const { workspace, read } = await open({ badge: 12 });
    try {
      const { record, badge, box, badgeBox, dom } = read();
      expect(badge.hidden).toBeFalsy();
      expect(record.derivedProps?._actionIconOnly).toBe(false);
      const place = catalogActionBadgeLayout("M", "textOnly");
      const height = catalogActionBadgeHeight("M");
      expect(badgeBox!.height).toBeCloseTo(height, 1);
      // (A two-digit count is a pill: S2 `edge-to-text` on each side — the test env measures no text.)
      expect(badge.visual.paddingX).toBeCloseTo((height * 3) / 8, 2);
      expect(badgeBox!.x).toBeCloseTo(
        box.width + Number.parseFloat(place.marginLeft!),
        1,
      );
      expect(badgeBox!.y).toBeCloseTo(-height / 2, 1);
      const el = dom.querySelector(".react-aria-Badge") as HTMLElement;
      expect(el.textContent).toBe("12");
      expect(el.getAttribute("data-notification")).toBe("double");
      expect({
        position: el.style.position,
        top: el.style.top,
        left: el.style.left,
        marginTop: el.style.marginTop,
        marginLeft: el.style.marginLeft,
      }).toEqual({
        position: "absolute",
        top: place.insetTop,
        left: place.insetLeft,
        marginTop: place.marginTop,
        marginLeft: place.marginLeft,
      });
    } finally {
      workspace.dispose();
    }
  });

  it("an avatar with words: one line tall, the one-digit count a square over its corner", async () => {
    const { workspace, read } = await open({ avatar: AVATAR, badge: 3 });
    try {
      const { avatar, avatarBox, badgeBox, dom } = read();
      expect(avatar.hidden).toBeFalsy();
      // (S2 `size: '1lh'` — the M label's 18px line.)
      expect(avatarBox!.height).toBeCloseTo(18, 0);
      expect(avatarBox!.width).toBeCloseTo(18, 0);
      const height = catalogActionBadgeHeight("M");
      // (One digit: a square — no side padding, its minimum width its height.)
      expect(badgeBox!.width).toBeCloseTo(height, 1);
      expect(read().badge.visual.paddingX).toBe(0);
      const place = catalogActionBadgeLayout("M", "default");
      expect(badgeBox!.x).toBeCloseTo(
        Number.parseFloat(place.insetLeft!) +
          Number.parseFloat(place.marginLeft!),
        1,
      );
      expect(badgeBox!.y).toBeCloseTo(
        Number.parseFloat(place.insetTop!) +
          Number.parseFloat(place.marginTop!),
        1,
      );
      expect(
        dom.querySelector('[data-catalog-id$="__avatar"] img')?.getAttribute("src"),
      ).toBe(AVATAR);
      const el = dom.querySelector(".react-aria-Badge") as HTMLElement;
      expect(el.textContent).toBe("3");
      expect(el.getAttribute("data-notification")).toBe("single");
    } finally {
      workspace.dispose();
    }
  });

  it("an avatar alone is an icon-only button; a count over 99 reads 99+", async () => {
    const { workspace, read } = await open({
      avatar: AVATAR,
      badge: 120,
      label: "",
    });
    try {
      const { record, dom } = read();
      expect(record.derivedProps?._actionIconOnly).toBe(true);
      expect(dom.getAttribute("data-icon-only")).toBe("true");
      expect(dom.querySelector(".react-aria-Badge")?.textContent).toBe("99+");
    } finally {
      workspace.dispose();
    }
  });

  // (2026-11-14, 사용자 「S2 와 같게」 — S2 ActionButton · NotificationBadge 소스 그대로.)
  it("an avatar takes the icon's place — S2 `<Icon /> or <Avatar />`", async () => {
    const { workspace, read } = await open({ avatar: AVATAR, icon: "copy" });
    try {
      const { icon, avatar, dom } = read();
      expect(avatar.hidden).toBeFalsy();
      expect(icon.hidden).toBe(true);
      expect(dom.querySelector('[data-catalog-id$="__icon"]')).toBeNull();
    } finally {
      workspace.dispose();
    }
  });

  it("a disabled button shows no count — S2 NotificationBadge `display: none`", async () => {
    const { workspace, read } = await open({ badge: 3, isDisabled: true });
    try {
      const { badge, dom } = read();
      expect(badge.hidden).toBe(true);
      expect(dom.querySelector(".react-aria-Badge")).toBeNull();
    } finally {
      workspace.dispose();
    }
  });

  it("a static-color button's count is that color with its contrast text — Canvas and DOM", async () => {
    const { workspace, read } = await open({ badge: 3, staticColor: "white" });
    try {
      const { badgePaint, dom } = read();
      expect(badgePaint).toEqual({ bg: "#ffffff", color: "#000000" });
      expect(
        dom.querySelector(".react-aria-Badge")?.getAttribute("data-static-color"),
      ).toBe("white");
    } finally {
      workspace.dispose();
    }
  });
});
