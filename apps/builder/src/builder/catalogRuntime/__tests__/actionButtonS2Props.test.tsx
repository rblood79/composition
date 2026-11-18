// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「ActionButton S2 전환 — 프로퍼티 누락 추가」) S2 `ActionButtonProps` (RAC
 * `ButtonProps`) form · focus props reach the DOM button: `name` · `value` · `form` · `formAction` ·
 * `formMethod` · `formEncType` · `formTarget` · `formNoValidate` · `excludeFromTabOrder` — accepted by
 * the binding, hidden from the panel (developer HTML attributes, 2026-11-11 사용자 결정).
 * (2026-11-18, 사용자 §7-4 「ActionButton 처럼 숨김 추가」) 일반 Button 도 같은 10 개를 받는다 — S2
 * `ButtonProps` 도 RAC `ButtonProps` 를 상속한다. LinkButton (S2 `LinkButtonProps` 는 RAC `LinkProps`)
 * 은 받지 않는다.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { actionButtonBinding } from "../../../../../../packages/shared/src/catalog/bindings/ActionButton.binding";
import { buttonBinding } from "../../../../../../packages/shared/src/catalog/bindings/Button.binding";
import { linkButtonBinding } from "../../../../../../packages/shared/src/catalog/bindings/LinkButton.binding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:action" as NodeId;
const FORM_FOCUS = [
  "name",
  "value",
  "form",
  "formAction",
  "formMethod",
  "formEncType",
  "formTarget",
  "formNoValidate",
  "excludeFromTabOrder",
  "preventFocusOnPress",
] as const;
const ADDED = [
  ...FORM_FOCUS,
  // (2026-11-14 사용자 「Type · Auto focus 숨겨」 — S2 문서 예제 조작 칸에 없다.)
  "type",
  "autoFocus",
] as const;

async function open(type: "ActionButton" | "Button" = "ActionButton") {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:action-button-s2" as const,
        name: "ActionButton S2",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `action-button-s2-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, type),
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
  const button = () => {
    const record = [...root.canvasInputs.values()].find(
      (item) => root.typeOf(item) === type,
    )!;
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, record.id));
    return { record, el: host.querySelector("button")! };
  };
  return { workspace, button };
}

describe("ActionButton S2 form · focus props", () => {
  it("the binding accepts them, hidden from the panel", () => {
    for (const key of ADDED)
      expect(actionButtonBinding.props.accepts[key], key).toMatchObject({
        editorHidden: true,
      });
  });

  it("Button accepts the same form · focus props, hidden; LinkButton does not", () => {
    for (const key of FORM_FOCUS) {
      expect(buttonBinding.props.accepts[key], key).toMatchObject({
        editorHidden: true,
      });
      expect(linkButtonBinding.props.accepts[key], key).toBeUndefined();
    }
  });

  it.each(["ActionButton", "Button"] as const)(
    "%s: authored values reach the DOM button",
    async (type) => {
      const { workspace, button } = await open(type);
      try {
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(button().record.id)!.target],
            props: {
              type: { kind: "set", value: "submit" },
              name: { kind: "set", value: "intent" },
              value: { kind: "set", value: "save" },
              form: { kind: "set", value: "signup" },
              formAction: { kind: "set", value: "/save" },
              formMethod: { kind: "set", value: "post" },
              formEncType: { kind: "set", value: "multipart/form-data" },
              formTarget: { kind: "set", value: "_blank" },
              formNoValidate: { kind: "set", value: true },
              excludeFromTabOrder: { kind: "set", value: true },
            },
          }),
        );
        const { el } = button();
        expect({
          name: el.getAttribute("name"),
          value: el.getAttribute("value"),
          form: el.getAttribute("form"),
          formAction: el.getAttribute("formaction"),
          formMethod: el.getAttribute("formmethod"),
          formEncType: el.getAttribute("formenctype"),
          formTarget: el.getAttribute("formtarget"),
          formNoValidate: el.hasAttribute("formnovalidate"),
          tabIndex: el.getAttribute("tabindex"),
        }).toEqual({
          name: "intent",
          value: "save",
          form: "signup",
          formAction: "/save",
          formMethod: "post",
          formEncType: "multipart/form-data",
          formTarget: "_blank",
          formNoValidate: true,
          tabIndex: "-1",
        });
      } finally {
        workspace.dispose();
      }
    },
  );
});
