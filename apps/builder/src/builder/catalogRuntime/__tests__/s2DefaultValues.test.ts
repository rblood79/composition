/**
 * (2026-11-18, 사용자 §7-5 「전부 S2 로」) 놓은 원본의 기본값 = 설치된 S2 1.8.2 의 기본값 — Badge
 * `variant` neutral (`Badge.tsx`), InlineAlert `variant` neutral (`InlineAlert.tsx`), ButtonGroup
 * `align` start (`ButtonGroup.tsx`), Tree `selectionStyle` checkbox (`TreeView.tsx`), DatePicker ·
 * DateRangePicker `hideTimeZone` false (RAC 기본), Meter · ProgressBar `value` 0. Dialog 의
 * ButtonGroup 은 S2 Dialog 가 `align: 'end'` 를 주므로 end 그대로다.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getPrimitiveBinding } from "../../../../../../packages/shared/src/catalog/bindings";
import { catalogCheckboxSelection } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const S2_DEFAULTS: ReadonlyArray<readonly [string, string, unknown]> = [
  ["Badge", "variant", "neutral"],
  ["InlineAlert", "variant", "neutral"],
  ["ButtonGroup", "align", "start"],
  ["Tree", "selectionStyle", "checkbox"],
  ["DatePicker", "hideTimeZone", false],
  ["DateRangePicker", "hideTimeZone", false],
  ["Meter", "value", 0],
  ["ProgressBar", "value", 0],
];

async function place(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-defaults" as const,
        name: "S2 defaults",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-defaults-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const id = "project:node:placed" as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id,
          definitionId: catalogPaletteDefinitionId(library, type),
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
  const root = workspace.root;
  const record = [...root.canvasInputs.values()].find(
    (item) => root.typeOf(item) === type,
  )!;
  return { workspace, root, record };
}

describe("S2 기본값 (§7-5)", () => {
  it.each(S2_DEFAULTS)("%s.%s = S2 기본값", async (type, key, value) => {
    const { workspace, record } = await place(type);
    try {
      expect(record.props[key] ?? defaultOf(type, key)).toEqual(value);
    } finally {
      workspace.dispose();
    }
  });

  it("a placed Tree with a selection mode selects with checkboxes (S2 default)", async () => {
    const { workspace, record } = await place("Tree");
    try {
      expect(
        catalogCheckboxSelection({
          ...record,
          props: { ...record.props, selectionMode: "multiple" },
        }),
      ).toBe(true);
    } finally {
      workspace.dispose();
    }
  });
});

/** What a renderer falls back to when the record has no value: the binding default. */
function defaultOf(type: string, key: string): unknown {
  return getPrimitiveBinding(type)?.props.accepts[key]?.default;
}
