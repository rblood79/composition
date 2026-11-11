// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { resolveCapabilities } from "../../../../../../packages/shared/src/interactions/capabilityRegistry";
import { catalogOwnerDecidedProps } from "../../../../../../packages/shared/src/catalog/runtime/ownerDecidedProps";
import { catalogSemanticContracts } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-11-11 속성 감사 (사용자 결정 4 건): props that read wrong where they sat, or that a no-code
 * author does not edit, are not offered in the Design panel.
 *
 * 1. page root — Disabled · Read Only · Required are passed down and written by a rule's Do, not
 *    the page's own state (no Behavior section).
 * 2. frame — Disabled · Read Only lock a section; Required is not offered.
 * 4-B. an overlay body inside its trigger — Open · Initially open are the trigger's.
 * 4-C. developer HTML · ARIA attributes — accepted (an old document's value still reaches the DOM),
 *    not offered.
 * (3 — Home — is `phase4ePageSettings` · `phase4ePropertySections`; 4-A — display-only Disabled —
 * is `unusedPropRemoval`.)
 */
const visible = (type: string) =>
  Object.entries(
    catalogSemanticContracts(
      `lib:definition:type-${type}` as DefinitionId,
      type,
    ),
  )
    .filter(([, contract]) => !contract.editorHidden)
    .map(([key]) => key);

describe("property audit 2026-11-11 — what the Design panel offers", () => {
  it("a page root offers no inherited flag; its Do stay", () => {
    expect(visible("body")).toEqual([]);
    const accepts = getPrimitiveBinding("body")!.props.accepts;
    for (const key of ["isDisabled", "isReadOnly", "isRequired"])
      expect(accepts[key]?.editorHidden, key).toBe(true);
    const capabilities = Object.keys(resolveCapabilities("body"));
    for (const id of [
      "disableAll",
      "enableAll",
      "toggleDisabledAll",
      "readOnlyAll",
      "editableAll",
      "requiredAll",
      "optionalAll",
    ])
      expect(capabilities, id).toContain(id);
  });

  it("a frame offers Disabled · Read Only, not Required; its Do stay", () => {
    const keys = visible("frame");
    expect(keys).toContain("isDisabled");
    expect(keys).toContain("isReadOnly");
    expect(keys).not.toContain("isRequired");
    expect(Object.keys(resolveCapabilities("frame"))).toContain("requiredAll");
  });

  it("developer HTML · ARIA attributes are accepted but not offered", () => {
    const hidden: Record<string, readonly string[]> = {
      Link: [
        "aria-current",
        "download",
        "hrefLang",
        "ping",
        "referrerPolicy",
        "aria-labelledby",
        "aria-describedby",
        "aria-details",
      ],
      LinkButton: [
        "aria-current",
        "download",
        "hrefLang",
        "ping",
        "referrerPolicy",
      ],
      TextField: [
        "autoComplete",
        "autoCorrect",
        "inputMode",
        "enterKeyHint",
        "spellCheck",
      ],
      TextArea: [
        "autoComplete",
        "autoCorrect",
        "inputMode",
        "enterKeyHint",
        "spellCheck",
      ],
      SearchField: [
        "autoComplete",
        "autoCorrect",
        "inputMode",
        "enterKeyHint",
        "spellCheck",
      ],
      Form: ["action", "method", "encType", "target"],
      Autocomplete: ["disableAutoFocusFirst", "disableVirtualFocus"],
      SelectBoxGroup: [
        "escapeKeyBehavior",
        "aria-labelledby",
        "aria-describedby",
        "aria-details",
      ],
      RangeSlider: [
        "form",
        "aria-labelledby",
        "aria-describedby",
        "aria-details",
      ],
      Slider: ["aria-labelledby", "aria-describedby", "aria-details"],
      SegmentedControl: ["aria-labelledby", "aria-describedby", "aria-details"],
      SegmentedControlItem: [
        "aria-labelledby",
        "aria-describedby",
        "aria-details",
      ],
    };
    const offered: string[] = [];
    const missing: string[] = [];
    for (const [type, keys] of Object.entries(hidden)) {
      const accepts = getPrimitiveBinding(type)!.props.accepts;
      for (const key of keys) {
        if (!(key in accepts)) missing.push(`${type}.${key}`);
        else if (!accepts[key]!.editorHidden) offered.push(`${type}.${key}`);
      }
    }
    expect(missing).toEqual([]);
    expect(offered).toEqual([]);
    // (What an author does edit stays: the link's address, the field's name and validation.)
    expect(visible("Link")).toEqual(
      expect.arrayContaining(["href", "target", "rel"]),
    );
    expect(visible("TextField")).toEqual(
      expect.arrayContaining(["name", "placeholder", "maxLength", "pattern"]),
    );
    expect(visible("Form")).toEqual(
      expect.arrayContaining([
        "isRequired",
        "isDisabled",
        "validationBehavior",
      ]),
    );
  });

  it("an overlay body in its trigger does not offer Open · Initially open; the trigger does", async () => {
    const BODY = "project:node:home-body" as NodeId;
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:property-audit" as EntryId<"project">,
          name: "Property audit",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `property-audit-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    const origins = ["popover", "tooltip", "dialog", "sheet", "select", "menu"];
    origins.forEach((origin, index) => {
      const id = `project:node:audit-${index}` as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              kind: "node",
              id,
              definitionId:
                `lib:definition:origin-component-${origin}` as DefinitionId,
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId: workspace.newId,
        }),
      );
    });
    const root = workspace.root;
    const decided = new Map<string, string>();
    for (const record of root.domInputs.values()) {
      const type = root.typeOf(record);
      if (!["Popover", "Tooltip", "Modal", "SheetOverlay"].includes(type))
        continue;
      const result = catalogOwnerDecidedProps(root, record);
      const open = ["isOpen", "defaultOpen"].every((key) =>
        result?.keys.has(key),
      );
      decided.set(`${type} in ${result?.owner ?? "-"}`, String(open));
    }
    expect(Object.fromEntries(decided)).toEqual({
      "Popover in DialogTrigger": "true",
      "Tooltip in TooltipTrigger": "true",
      "Modal in DialogTrigger": "true",
      "SheetOverlay in SheetTrigger": "true",
      "Popover in Select": "true",
      "Popover in MenuTrigger": "true",
    });
    // The trigger keeps both.
    for (const type of ["DialogTrigger", "TooltipTrigger", "SheetTrigger"]) {
      const accepts = getPrimitiveBinding(type)!.props.accepts;
      expect(accepts.isOpen?.editorHidden, type).not.toBe(true);
      expect(accepts.defaultOpen?.editorHidden, type).not.toBe(true);
    }
  });
});
