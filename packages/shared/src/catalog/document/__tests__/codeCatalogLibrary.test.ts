import { resolveToken, type TokenRef } from "@composition/rendering";
import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../../generated/componentRulesTable";
import { componentCatalog } from "../../componentCatalog";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
  CODE_CATALOG_SUPPORTED_TYPES,
} from "../codeCatalogLibrary";
import { createG1Fixture } from "../fixture";
import {
  REUSABLE_ORIGIN_DEFINITIONS,
  REUSABLE_ORIGIN_TEMPLATES,
} from "../generated/reusableOriginLibrary";
import { CatalogGraph } from "../graph";
import type { CatalogEntry, NodeEntry } from "../types";

const sourceValue = (value: string | number | undefined) => {
  if (typeof value !== "string" || !/^\{.+\}$/.test(value))
    throw new Error(`EXPECTED_SOURCE_TOKEN:${String(value)}`);
  return resolveToken(value as TokenRef);
};

describe("ADR-248 Phase 3 source-derived immutable code library", () => {
  it("resolves IconButton whole-value icon and label references from typed instance defaults and writes", async () => {
    const library = await buildCodeCatalogLibrary();
    const definition = library.definitions.get(
      "lib:definition:origin-component-iconbutton",
    )!;
    expect(definition.accepts).toMatchObject({
      icon: "string",
      label: "string",
    });
    expect(definition.defaults).toMatchObject({
      icon: "star",
      label: "Button",
    });
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const node: NodeEntry = {
      kind: "node",
      id: "project:node:iconButton",
      definitionId: definition.id,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [node.id] },
          [node.id]: node,
        },
      },
      library,
    );
    const leaf = (id: string) => {
      const walk = (
        root: ReturnType<typeof resolveCatalogNode>,
      ): ReturnType<typeof resolveCatalogNode> | undefined =>
        root.sourceId === id ? root : root.children.map(walk).find(Boolean);
      return walk(resolveCatalogNode(graph, node.id));
    };
    expect(
      leaf("lib:template:component-iconbutton__icon")?.props.iconName,
    ).toBe("star");
    expect(
      leaf("lib:template:component-iconbutton__label")?.props.children,
    ).toBe("Button");
    applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "IconButton edit" },
      ops: [
        {
          kind: "patchNodeProp",
          id: node.id,
          key: "icon",
          write: { kind: "set", value: "heart" },
        },
        {
          kind: "patchNodeProp",
          id: node.id,
          key: "label",
          write: { kind: "set", value: "Like" },
        },
      ],
    });
    expect(
      leaf("lib:template:component-iconbutton__icon")?.props.iconName,
    ).toBe("heart");
    expect(
      leaf("lib:template:component-iconbutton__label")?.props.children,
    ).toBe("Like");
    applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "IconButton mask" },
      ops: [
        {
          kind: "patchNodeProp",
          id: node.id,
          key: "icon",
          write: { kind: "mask" },
        },
      ],
    });
    // Old contract (`resolveTemplateBindingValues`): a removed instance value binds the schema default.
    expect(
      leaf("lib:template:component-iconbutton__icon")?.props.iconName,
    ).toBe("star");
    applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "IconButton root passthrough" },
      ops: [
        {
          kind: "patchNodeProp",
          id: node.id,
          key: "variant",
          write: { kind: "set", value: "secondary" },
        },
      ],
    });
    // Instance root value: an accepted key the template root also accepts reaches the root.
    expect(leaf("lib:template:component-iconbutton")?.props.variant).toBe(
      "secondary",
    );
  });

  it("keeps placeholders without a bound value and never binds inner composites from outer props", async () => {
    const library = await buildCodeCatalogLibrary();
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const node: NodeEntry = {
      kind: "node",
      id: "project:node:listbox",
      definitionId: "lib:definition:origin-component-listbox",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [node.id] },
          [node.id]: node,
        },
      },
      library,
    );
    const texts: unknown[] = [];
    const walk = (resolved: ReturnType<typeof resolveCatalogNode>) => {
      if (
        resolved.sourceId ===
        "lib:template:component-listbox-item-default__label"
      )
        texts.push(resolved.props.children);
      resolved.children.forEach(walk);
    };
    walk(resolveCatalogNode(graph, node.id));
    // ListBox items carry their labels as instance root values (old origin `props.label`).
    expect(new Set(texts)).toEqual(new Set(["Inbox", "Starred", "Archive"]));
    // The item origin declares no edit schema: alone, `{label}` is a row-data binding left in place.
    const item: NodeEntry = {
      ...node,
      id: "project:node:item",
      definitionId: "lib:definition:origin-component-listbox-item-default",
    };
    const itemGraph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [item.id] },
          [item.id]: item,
        },
      },
      library,
    );
    texts.length = 0;
    walk(resolveCatalogNode(itemGraph, item.id));
    expect(texts).toEqual(["{label}"]);
  });

  it("derives certified text leaf bindings and visual values from source", async () => {
    const library = await buildCodeCatalogLibrary();
    const repeated = await buildCodeCatalogLibrary();
    expect(library.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(repeated.revision).toBe(library.revision);
    expect(library.contractVersion).toBe(3);
    for (const type of CODE_CATALOG_SUPPORTED_TYPES) {
      const registration = componentCatalog.find(
        (entry) => entry.type === type && entry.kind === "primitive",
      );
      expect(registration?.kind).toBe("primitive");
      const definition = library.definitions.get(
        catalogTypeDefinitionId(type),
      )!;
      const source = COMPONENT_RULES_TABLE[type];
      expect(definition.bindingId).toBe(type.toLowerCase());
      expect(definition.defaults.size).toBe(source.defaultSize);
      expect(definition.visual.fontWeight).toBe(
        source.variants.default.textWeight,
      );
      expect(definition.propChoices?.size).toEqual(Object.keys(source.sizes));
      expect(definition.propVisualRules?.size?.md?.lineHeight).toBe(
        Number(sourceValue(source.sizes.md.lineHeight)) /
          Number(sourceValue(source.sizes.md.fontSize)),
      );
      expect(Object.isFrozen(definition)).toBe(true);
    }
    expect(library.definitions.has("lib:definition:button")).toBe(false);
    // Other registered types: registration contract + their D3 rule (`ruleDefinition.ts`).
    const typeDefinitions = [...library.definitions.values()].filter(
      (definition) => definition.id.startsWith("lib:definition:type-"),
    );
    expect(typeDefinitions.length).toBeGreaterThan(100);
    for (const definition of typeDefinitions) {
      expect(definition.bindingId).toBe(definition.name.toLowerCase());
      const rule = (
        COMPONENT_RULES_TABLE as Record<
          string,
          (typeof COMPONENT_RULES_TABLE)[keyof typeof COMPONENT_RULES_TABLE]
        >
      )[definition.name];
      if (!definition.ruleId) continue;
      expect(definition.ruleId).toBe(definition.name);
      expect(library.rules.get(definition.ruleId)).toEqual(rule);
      for (const [prop, keys] of [
        ["variant", Object.keys(rule.variants)],
        ["size", Object.keys(rule.sizes)],
      ] as const)
        if (definition.propChoices?.[prop])
          expect(definition.propChoices[prop]).toEqual(keys);
    }
    const button = library.definitions.get("lib:definition:type-Button")!;
    const buttonSource = COMPONENT_RULES_TABLE.Button;
    expect(button.bindingId).toBe("button");
    expect(button.defaults).toMatchObject({
      variant: buttonSource.defaultVariant,
      size: buttonSource.defaultSize,
      fillStyle: "fill",
    });
    expect(button.propChoices?.variant).toEqual(
      Object.keys(buttonSource.variants),
    );
    expect(button.propVisualRules?.size?.md?.fontSize).toEqual(
      expect.objectContaining({ kind: "token" }),
    );
    expect(button.conditionalRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          when: { variant: "primary", fillStyle: "outline" },
        }),
      ]),
    );
    for (const type of ["Icon", "SelectIcon"] as const) {
      const glyph = library.definitions.get(catalogTypeDefinitionId(type))!;
      expect(glyph.bindingId).toBe(type.toLowerCase());
      expect(glyph.propVisualRules?.size?.md?.iconSize).toBe(
        COMPONENT_RULES_TABLE[type].sizes.md.iconSize,
      );
      expect(glyph.visual.color).toEqual(
        expect.objectContaining({ kind: "token" }),
      );
    }
    const trigger = library.definitions.get(
      "lib:definition:type-SelectTrigger",
    )!;
    expect(trigger.defaults).toEqual({ variant: "default", size: "md" });
    expect(trigger.layout).toEqual({ display: "flex", flexDirection: "row" });
    // The rule's `sizes[*].height` is read by no stylesheet (no generated CSS, no DOM element with
    // the class — `manualBoxRules` `omit`): the wrapper is as tall as its content.
    expect(trigger.propVisualRules?.size?.md).not.toHaveProperty("height");
    expect(trigger.propVisualRules?.size?.md).toMatchObject({
      paddingX: COMPONENT_RULES_TABLE.SelectTrigger.sizes.md.paddingX,
      paddingY: COMPONENT_RULES_TABLE.SelectTrigger.sizes.md.paddingY,
      borderWidth: sourceValue(
        COMPONENT_RULES_TABLE.SelectTrigger.sizes.md.borderWidth,
      ),
    });
    const selectValue = library.definitions.get(
      "lib:definition:type-SelectValue",
    )!;
    expect(selectValue.defaults.size).toBe(
      COMPONENT_RULES_TABLE.SelectValue.defaultSize,
    );
    // Same as the trigger: the value is the owner's input/span, sized by its line box.
    expect(selectValue.propVisualRules?.size?.md).not.toHaveProperty("height");
    for (const definition of REUSABLE_ORIGIN_DEFINITIONS)
      expect(library.definitions.get(definition.id)?.mode).toBe("composite");
    expect(library.definitions.size).toBe(
      2 + typeDefinitions.length + REUSABLE_ORIGIN_DEFINITIONS.length,
    );
    expect(library.templates.size).toBe(REUSABLE_ORIGIN_TEMPLATES.length);
    expect((await buildCodeCatalogLibrary("dark")).revision).not.toBe(
      library.revision,
    );
  });

  it("runs public insert/edit transactions through source definitions and resolver", async () => {
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const library = await buildCodeCatalogLibrary();
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [] },
        },
      },
      library,
    );
    const text: NodeEntry = {
      kind: "node",
      id: "project:node:sourceText",
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "Source Text" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const heading: NodeEntry = {
      ...text,
      id: "project:node:sourceHeading",
      definitionId: "lib:definition:heading",
      props: {
        children: { kind: "set", value: "Source Heading" },
        size: { kind: "set", value: "lg" },
      },
    };
    const inserted = applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "public insert" },
      ops: [
        { kind: "put", entry: text },
        { kind: "put", entry: heading },
        { kind: "put", entry: { ...page, children: [text.id, heading.id] } },
      ],
    });
    expect(inserted.changedIds).toEqual(
      new Set([text.id, heading.id, page.id]),
    );
    const textResolved = resolveCatalogNode(graph, text.id);
    const headingResolved = resolveCatalogNode(graph, heading.id);
    expect(textResolved.props.children).toBe("Source Text");
    expect(textResolved.visual).toMatchObject({
      color: sourceValue(
        COMPONENT_RULES_TABLE.Text.variants.default.colors?.text,
      ),
      fontSize: sourceValue(COMPONENT_RULES_TABLE.Text.sizes.md.fontSize),
      fontWeight: COMPONENT_RULES_TABLE.Text.variants.default.textWeight,
    });
    expect(headingResolved.visual).toMatchObject({
      fontSize: sourceValue(COMPONENT_RULES_TABLE.Heading.sizes.lg.fontSize),
      fontWeight: COMPONENT_RULES_TABLE.Heading.variants.default.textWeight,
    });
    const edited = applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "public text edit" },
      ops: [
        {
          kind: "patchNodeProp",
          id: text.id,
          key: "children",
          write: { kind: "set", value: "Edited" },
        },
      ],
    });
    expect(edited.changedIds).toEqual(new Set([text.id]));
    expect(resolveCatalogNode(graph, text.id).props.children).toBe("Edited");
    expect(resolveCatalogNode(graph, heading.id).props.children).toBe(
      "Source Heading",
    );
  });

  it("resolves Button outline and glyph size from their registered rules", async () => {
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const buttonId = "project:node:ruleButton" as const;
    const glyphId = "project:node:ruleGlyph" as const;
    const node = (
      id: NodeEntry["id"],
      definitionId: NodeEntry["definitionId"],
      props: NodeEntry["props"],
    ): NodeEntry => ({
      kind: "node",
      id,
      definitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [buttonId, glyphId] },
          [buttonId]: node(buttonId, "lib:definition:type-Button", {
            variant: { kind: "set", value: "accent" },
            size: { kind: "set", value: "lg" },
            fillStyle: { kind: "set", value: "outline" },
            children: { kind: "set", value: "Save" },
          }),
          [glyphId]: node(glyphId, "lib:definition:type-SelectIcon", {
            size: { kind: "set", value: "xs" },
          }),
        },
      },
      await buildCodeCatalogLibrary(),
    );
    expect(resolveCatalogNode(graph, buttonId).visual).toMatchObject({
      fill: "transparent",
      color: sourceValue(
        COMPONENT_RULES_TABLE.Button.variants.accent.colors?.outlineText,
      ),
      borderColor: sourceValue(
        COMPONENT_RULES_TABLE.Button.variants.accent.colors?.outlineBorder,
      ),
      fontSize: sourceValue(COMPONENT_RULES_TABLE.Button.sizes.lg.fontSize),
      paddingX: COMPONENT_RULES_TABLE.Button.sizes.lg.paddingX,
    });
    expect(resolveCatalogNode(graph, glyphId).visual).toMatchObject({
      iconSize: COMPONENT_RULES_TABLE.SelectIcon.sizes.xs.iconSize,
      color: sourceValue(
        COMPONENT_RULES_TABLE.SelectIcon.variants.default.colors?.text,
      ),
    });
  });

  it("keeps an instance-authored prop over the template's display state", async () => {
    const { document } = createG1Fixture();
    const project = document.entries[document.projectId];
    const page = document.entries["project:page:main"] as Extract<
      CatalogEntry,
      { kind: "page" }
    >;
    const radioId = "project:node:radio" as const;
    const groupId = "project:node:radioGroup" as const;
    const node = (
      id: NodeEntry["id"],
      definitionId: NodeEntry["definitionId"],
      props: NodeEntry["props"],
      descendantOverrides: NodeEntry["descendantOverrides"] = [],
    ): NodeEntry => ({
      kind: "node",
      id,
      definitionId,
      children: [],
      props,
      visual: {},
      sizing: {},
      descendantOverrides,
    });
    const graph = new CatalogGraph(
      {
        ...document,
        entries: {
          [project.id]: project,
          [page.id]: { ...page, children: [radioId, groupId] },
          // The Radio origin template shows the `selected` state.
          [radioId]: node(radioId, "lib:definition:origin-component-radio", {
            isSelected: { kind: "set", value: false },
          }),
          [groupId]: node(
            groupId,
            "lib:definition:origin-component-radiogroup",
            {},
            [
              {
                kind: "patch",
                address: {
                  instances: [groupId],
                  // ADR-251 contract 2: the first Radio sits in the RadioItems node.
                  templatePath: [
                    "lib:template:component-radiogroup",
                    "lib:template:component-radiogroup__2",
                    "lib:template:component-radiogroup__2__radio-1",
                  ],
                },
                props: { isSelected: { kind: "set", value: false } },
              },
            ],
          ),
        },
      },
      await buildCodeCatalogLibrary(),
    );
    expect(resolveCatalogNode(graph, radioId).props.isSelected).toBe(false);
    type Resolved = ReturnType<typeof resolveCatalogNode>;
    const radios: Resolved[] = [];
    const walk = (at: Resolved) => {
      if (at.sourceId === "lib:template:component-radio") radios.push(at);
      at.children.forEach(walk);
    };
    walk(resolveCatalogNode(graph, groupId));
    expect(radios.map((radio) => radio.props.isSelected)).toEqual([
      false,
      true,
    ]);
  });
});
