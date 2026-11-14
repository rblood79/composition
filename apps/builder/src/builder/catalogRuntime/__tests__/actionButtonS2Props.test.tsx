// @vitest-environment jsdom
/**
 * (2026-11-14, 사용자 「ActionButton S2 전환 — 프로퍼티 누락 추가」) S2 `ActionButtonProps` (RAC
 * `ButtonProps`) form · focus props reach the DOM button: `name` · `value` · `form` · `formAction` ·
 * `formMethod` · `formEncType` · `formTarget` · `formNoValidate` · `excludeFromTabOrder` — accepted by
 * the binding, hidden from the panel (developer HTML attributes, 2026-11-11 사용자 결정).
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { actionButtonBinding } from "../../../../../../packages/shared/src/catalog/bindings/ActionButton.binding";
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
const ADDED = [
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
  // (2026-11-14 사용자 「Type · Auto focus 숨겨」 — S2 문서 예제 조작 칸에 없다.)
  "type",
  "autoFocus",
] as const;

async function open() {
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
  const button = () => {
    const record = [...root.canvasInputs.values()].find(
      (item) => root.typeOf(item) === "ActionButton",
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

  it("authored values reach the DOM button", async () => {
    const { workspace, button } = await open();
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
  });
});
