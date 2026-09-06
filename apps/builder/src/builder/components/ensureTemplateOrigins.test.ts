import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import {
  ensureFormTemplateOrigins,
  FORM_ORIGIN_ID,
} from "./form/formTemplateOrigins";
import {
  ensureCardTemplateOrigins,
  CARD_ORIGIN_ID,
} from "./card/cardTemplateOrigins";
import {
  ensureToolbarTemplateOrigins,
  TOOLBAR_ORIGIN_ID,
} from "./toolbar/toolbarTemplateOrigins";
import {
  ensureListBoxTemplateOrigins,
  LISTBOX_ORIGIN_ID,
} from "./listbox/listBoxTemplateOrigins";
import {
  ensureGridListTemplateOrigins,
  GRIDLIST_ORIGIN_ID,
} from "./gridlist/gridListTemplateOrigins";
import {
  ensureMenuTemplateOrigins,
  MENU_ITEM_DEFAULT_ORIGIN_ID,
} from "./menu/menuTemplateOrigins";
import {
  ensureIconButtonTemplateOrigins,
  ICONBUTTON_ORIGIN_ID,
} from "./iconbutton/iconButtonTemplateOrigins";
import {
  ensureInlineAlertTemplateOrigins,
  INLINE_ALERT_ORIGIN_ID,
} from "./inlinealert/inlineAlertTemplateOrigins";

const families = [
  { name: "Form", ensure: ensureFormTemplateOrigins, id: FORM_ORIGIN_ID },
  { name: "Card", ensure: ensureCardTemplateOrigins, id: CARD_ORIGIN_ID },
  {
    name: "Toolbar",
    ensure: ensureToolbarTemplateOrigins,
    id: TOOLBAR_ORIGIN_ID,
  },
  {
    name: "ListBox",
    ensure: ensureListBoxTemplateOrigins,
    id: LISTBOX_ORIGIN_ID,
  },
  {
    name: "GridList",
    ensure: ensureGridListTemplateOrigins,
    id: GRIDLIST_ORIGIN_ID,
  },
  {
    name: "Menu",
    ensure: ensureMenuTemplateOrigins,
    id: MENU_ITEM_DEFAULT_ORIGIN_ID,
  },
  {
    name: "IconButton",
    ensure: ensureIconButtonTemplateOrigins,
    id: ICONBUTTON_ORIGIN_ID,
  },
  {
    name: "InlineAlert",
    ensure: ensureInlineAlertTemplateOrigins,
    id: INLINE_ALERT_ORIGIN_ID,
  },
];

function flatten(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

function find(nodes: readonly CanonicalNode[], id: string): CanonicalNode {
  const node = flatten(nodes).find((candidate) => candidate.id === id);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}

describe.each(families)("$name origin 공통 처리 계약", ({ ensure, id }) => {
  it("중복/다른 위치의 origin을 body로 복구하고 사용자 편집과 멱등 결과를 보존한다", () => {
    const seeded = ensure({ version: "composition-1.0", children: [] });
    const body = find(seeded.children, COMPONENTS_SYSTEM_BODY_ID);
    const origin = find(body.children ?? [], id);
    body.children = body.children?.filter((node) => node.id !== id);
    const edited: CanonicalNode = {
      ...origin,
      props: { ...origin.props, userMarker: "preserved" },
      responsive: { visibility: { mobile: false } },
      metadata: {
        ...origin.metadata,
        type: origin.metadata?.type ?? "test-origin",
        userMarker: "preserved",
      },
    };
    const input: CompositionDocument = {
      ...seeded,
      children: [
        { ...origin, props: { userMarker: "earlier-duplicate" } },
        ...seeded.children,
        { id: "other-container", type: "frame" as const, children: [edited] },
      ],
    };
    const before = structuredClone(input);
    const repaired = ensure(input);
    const matches = flatten(repaired.children).filter((node) => node.id === id);
    expect(matches).toHaveLength(1);
    const repairedOrigin = matches[0];
    expect(
      find(repaired.children, COMPONENTS_SYSTEM_BODY_ID).children,
    ).toContain(repairedOrigin);
    expect(repairedOrigin.props?.userMarker).toBe("preserved");
    expect(repairedOrigin.metadata?.userMarker).toBe("preserved");
    expect(repairedOrigin.responsive).toEqual(edited.responsive);
    expect(repairedOrigin.children).toEqual(edited.children);
    expect(input).toEqual(before);
    // system page repair는 기존에도 새 참조를 만든다. 멱등성은 문서 내용 기준이다.
    expect(ensure(repaired)).toEqual(repaired);
  });
});
