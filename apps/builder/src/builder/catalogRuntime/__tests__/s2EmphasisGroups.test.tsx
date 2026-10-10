// @vitest-environment jsdom
/**
 * S2 강조 축 전환 2 (2026-10-10 — 조사 §4.2 B): CheckboxGroup · RadioGroup · Form 의
 * `isEmphasized`. 그룹 값이 안의 toggle 을 이긴다 (S2 CheckboxContext — resolver
 * `applyOwnerEmphasis`), Form 은 자기 값을 안 적은 field 에 채운다 (`CATALOG_FORM_CONTEXT_KEYS`).
 * Radio 의 variant (accent · neutral · negative) 와 Form 의 outlined 은 S2 에 없어 삭제 —
 * 옛 문서는 로드 시 1회 전환 (`migrateCatalogEntriesS2`).
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { migrateCatalogEntriesS2 } from "../../../../../../packages/shared/src/catalog/document/s2PropAlignment";
import type {
  CatalogEntry,
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;
const CHILD = "project:node:child" as NodeId;

async function open(
  type: string,
  props: Record<string, unknown>,
  child?: { type: string; props: Record<string, unknown> },
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:emphasis-groups" as const,
        name: "Emphasis groups",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `emphasis-groups-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const writes = (values: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: child ? [CHILD] : [],
          props: writes(props),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
        ...(child
          ? [
              {
                kind: "node",
                id: CHILD,
                definitionId: catalogPaletteDefinitionId(library, child.type),
                children: [],
                props: writes(child.props),
                visual: {},
                sizing: {},
                descendantOverrides: [],
              } as NodeEntry,
            ]
          : []),
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return { workspace, library, root: workspace.root };
}

const recordsOf = (root: ReturnType<typeof Object>, type: string) =>
  [
    ...(
      root as never as { canvasInputs: Map<string, never> }
    ).canvasInputs.values(),
  ].filter(
    (r) =>
      (root as never as { typeOf: (r: never) => string }).typeOf(r) === type,
  ) as { id: string; props: Record<string, unknown> }[];

describe("S2 CheckboxGroup · RadioGroup · Form isEmphasized", () => {
  it("the Design panel offers Emphasized on the groups and the Form; the Radio carries it hidden", async () => {
    const library = await buildCodeCatalogLibrary();
    for (const type of ["CheckboxGroup", "RadioGroup", "Form"]) {
      const contracts = catalogSemanticContracts(
        catalogPaletteDefinitionId(library, type) as Parameters<
          typeof catalogSemanticContracts
        >[0],
        type,
      );
      expect(contracts.isEmphasized, type).toMatchObject({ kind: "boolean" });
      expect(contracts.isEmphasized.editorHidden, type).not.toBe(true);
      expect(contracts.variant, type).toBeUndefined();
    }
    const radio = catalogSemanticContracts(
      catalogPaletteDefinitionId(library, "Radio") as Parameters<
        typeof catalogSemanticContracts
      >[0],
      "Radio",
    );
    expect(radio.isEmphasized).toMatchObject({ editorHidden: true });
    expect(radio.variant).toMatchObject({ editorHidden: true });
  });

  it("an emphasized CheckboxGroup reaches every Checkbox in it (the group wins over the toggle's own)", async () => {
    const { root } = await open("CheckboxGroup", { isEmphasized: true });
    const boxes = recordsOf(root, "Checkbox");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.props.isEmphasized).toBe(true);
      expect(box.props.variant).toBe("emphasized");
    }
    // Off: a checkbox's own isEmphasized inside the group is replaced by the group's (S2 ctx).
    const plain = await open("CheckboxGroup", {}, undefined);
    for (const box of recordsOf(plain.root, "Checkbox"))
      expect(box.props.variant).toBe("default");
  });

  it("an emphasized RadioGroup turns its Radios' rings accent (data-emphasized in the DOM)", async () => {
    const { root } = await open("RadioGroup", { isEmphasized: true });
    const radios = recordsOf(root, "Radio");
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) expect(radio.props.variant).toBe("emphasized");
    const owner = [...root.domInputs.values()].find(
      (item) => item.sourceId === OWNER,
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
    expect(html).toContain('data-emphasized="true"');
    expect(html).not.toContain("data-radio-variant");
  });

  it("a Form's isEmphasized fills a field that did not set its own (S2 useFormProps)", async () => {
    const { root } = await open(
      "Form",
      { isEmphasized: true },
      { type: "Checkbox", props: { isSelected: true } },
    );
    const box = recordsOf(root, "Checkbox").find((r) =>
      r.id.includes("child"),
    )!;
    expect(box.props.isEmphasized).toBe(true);
    expect(box.props.variant).toBe("emphasized");
    // An authored false stays — the Form fills only unset keys.
    const authored = await open(
      "Form",
      { isEmphasized: true },
      { type: "Checkbox", props: { isEmphasized: false } },
    );
    const kept = recordsOf(authored.root, "Checkbox").find((r) =>
      r.id.includes("child"),
    )!;
    expect(kept.props.variant).toBe("default");
  });

  it("load migration: group accent → isEmphasized, Radio · Form variants dropped", async () => {
    const library = (await open("Form", {})).library as CatalogLibrary;
    const defOf = (type: string) => catalogPaletteDefinitionId(library, type);
    const entry = (id: string, type: string, variant: string) =>
      ({
        kind: "node",
        id: id as NodeId,
        definitionId: defOf(type),
        children: [],
        props: { variant: { kind: "set", value: variant } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      }) as NodeEntry;
    const entries: Record<string, CatalogEntry> = {
      a: entry("a", "CheckboxGroup", "accent"),
      b: entry("b", "RadioGroup", "default"),
      c: entry("c", "Radio", "negative"),
      d: entry("d", "Form", "outlined"),
    };
    expect(migrateCatalogEntriesS2(entries, library)).toBe(true);
    expect((entries.a as NodeEntry).props).toEqual({
      isEmphasized: { kind: "set", value: true },
    });
    expect((entries.b as NodeEntry).props).toEqual({});
    expect((entries.c as NodeEntry).props).toEqual({});
    expect((entries.d as NodeEntry).props).toEqual({});
  });
});
