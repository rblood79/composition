import { describe, expect, it } from "vitest";
import { CatalogGraph, ownedChildren } from "../../document/graph";
import type { CatalogOperation } from "../../transactions/transaction";
import type {
  DefinitionEntry,
  DefinitionId,
  EntryId,
  InstanceAddress,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import type { CatalogCommand } from "../compose";
import {
  addComponentProperty,
  setInstanceProperty,
  stageOver,
  copyNodes,
  createComponent,
  detachInstances,
  dissolveComponent,
  duplicateDefinition,
  duplicateNodes,
  editItems,
  groupNodes,
  insertCollectionItem,
  insertNodes,
  moveNodes,
  pasteNodes,
  pushInstanceOverrides,
  removeTargets,
  renameNode,
  renameDefinition,
  resetInstance,
  setFields,
  setWholeField,
  swapInstance,
  ungroupNodes,
  type NewId,
  type NodeParent,
} from "..";
import {
  graphOf,
  library,
  node,
  PAGE,
  PROJECT,
  snapshot,
  text,
} from "./fixture";

/**
 * ADR-248 Phase 4b G2: a seeded random sequence of 500 commands. After every accepted command
 * the full validator (a fresh graph built from the export) agrees with the transaction's local
 * validation and every page root resolves; a refused command leaves graph, revision and history
 * untouched; undoing every accepted command in reverse restores the starting graph.
 */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("ADR-248 Phase 4b random command sequence", () => {
  it("500 random commands: full validator after each, refusals are no-ops, full undo restores", () => {
    const graph = graphOf(
      [
        node("box", "lib:definition:section", {
          children: ["project:node:a", "project:node:list"],
        }),
        text("a", "A"),
        node("list", "lib:definition:listbox", {
          children: ["project:node:i1"],
        }),
        node("i1", "lib:definition:item", {
          props: { children: { kind: "set", value: "One" } },
        }),
        node("pick", "lib:definition:picker"),
        node("panel", "lib:definition:panel"),
      ],
      ["box", "pick", "panel"],
    );
    const initial = snapshot(graph);
    const random = mulberry32(248);
    const pickOne = <T>(items: readonly T[]): T | undefined =>
      items.length ? items[Math.floor(random() * items.length)] : undefined;
    let next = 0;
    const newId: NewId = (kind) => `project:${kind}:r${++next}` as never;
    const makeId = (kind: string) => `project:${kind}:r${++next}`;

    /** Test-side walk (commands never walk the document): owned nodes under the pages. */
    const ownedNodes = (): NodeEntry[] => {
      const out: NodeEntry[] = [];
      const project = graph.getEntry(PROJECT) as ProjectEntry;
      const stack: string[] = project.pageIds.flatMap(
        (id) => (graph.getEntry(id) as PageEntry).children,
      );
      while (stack.length) {
        const entry = graph.getEntry(stack.pop()!);
        if (entry?.kind !== "node") continue;
        out.push(entry);
        stack.push(...ownedChildren(entry));
      }
      return out.sort((a, b) => a.id.localeCompare(b.id));
    };
    /** The picker stays at the page root so its template positions stay reachable. */
    const KEEP = "project:node:pick";
    const movable = () => ownedNodes().filter((entry) => entry.id !== KEEP);
    const typeOf = (entry: NodeEntry) => entry.definitionId;
    const containers = () =>
      ownedNodes().filter(
        (entry) => typeOf(entry) === "lib:definition:section",
      );
    const parents = (): NodeParent[] => [
      { kind: "page", id: PAGE },
      ...containers().map((entry): NodeParent => ({
        kind: "node",
        id: entry.id,
      })),
    ];
    /** Instances of a composite: a project component or a library one (Panel · Picker · Badge). */
    const composites = () =>
      ownedNodes().filter(
        (entry) =>
          entry.definitionId.startsWith("project:definition:") ||
          ["lib:definition:panel", "lib:definition:picker", "lib:definition:badge"].includes(
            entry.definitionId,
          ),
      );
    const pickers = () =>
      ownedNodes().filter((entry) => typeOf(entry) === "lib:definition:picker");
    const listPosition = (ownerId: NodeId): NodeParent => ({
      kind: "descendant",
      ownerId,
      address: {
        instances: [ownerId],
        templatePath: ["lib:template:pickRoot", "lib:template:list"],
      },
    });
    const itemAddress = (ownerId: NodeId): InstanceAddress => ({
      instances: [ownerId],
      templatePath: [
        "lib:template:pickRoot",
        "lib:template:list",
        "lib:template:item2",
      ],
    });

    const actions: Record<string, () => CatalogCommand | undefined> = {
      insertText: () => {
        const parent = pickOne(parents());
        const id = makeId("node") as NodeId;
        return parent
          ? insertNodes({
              parent,
              index: Math.floor(random() * 4),
              entries: [text(id.slice(13), `T${next}`)],
              rootIds: [id],
              newId,
            })
          : undefined;
      },
      insertItem: () => {
        const lists = ownedNodes().filter(
          (entry) => typeOf(entry) === "lib:definition:listbox",
        );
        const picker = pickOne(pickers());
        const host: NodeParent | undefined =
          random() < 0.5 && picker
            ? listPosition(picker.id)
            : lists.length
              ? { kind: "node", id: pickOne(lists)!.id }
              : undefined;
        const id = makeId("node") as NodeId;
        return host
          ? insertCollectionItem({
              host,
              entries: [
                node(id.slice(13), "lib:definition:item", {
                  props: { children: { kind: "set", value: `I${next}` } },
                }),
              ],
              rootId: id,
              key: id,
              newId,
            })
          : undefined;
      },
      move: () => {
        const target = pickOne(movable());
        const parent = pickOne(parents());
        return target && parent
          ? moveNodes({
              ids: [target.id],
              parent,
              index: Math.floor(random() * 3),
              newId,
            })
          : undefined;
      },
      remove: () => {
        const a = pickOne(movable());
        const b = pickOne(movable());
        return a
          ? removeTargets({
              targets: [
                { kind: "node", id: a.id },
                ...(b && random() < 0.3
                  ? [{ kind: "node" as const, id: b.id }]
                  : []),
              ],
            })
          : undefined;
      },
      hidePosition: () => {
        const picker = pickOne(pickers());
        return picker
          ? removeTargets({
              targets: [
                {
                  kind: "descendant",
                  ownerId: picker.id,
                  address: itemAddress(picker.id),
                },
              ],
            })
          : undefined;
      },
      duplicate: () => {
        const target = pickOne(movable());
        return target ? duplicateNodes({ ids: [target.id], newId }) : undefined;
      },
      paste: () => {
        const source = pickOne(movable());
        const parent = pickOne(parents());
        return source && parent
          ? (reader) =>
              pasteNodes({
                clipboard: copyNodes(reader, [source.id]),
                parent,
                newId,
              })(reader)
          : undefined;
      },
      group: () => {
        const parent = pickOne(parents());
        if (!parent) return undefined;
        const list =
          parent.kind === "page"
            ? (graph.getEntry(parent.id) as PageEntry).children
            : parent.kind === "node"
              ? (graph.getEntry(parent.id) as NodeEntry).children
              : [];
        const members = list
          .filter((id) => id !== KEEP && random() < 0.6)
          .slice(0, 2);
        return members.length
          ? groupNodes({
              ids: members,
              group: node(makeId("node").slice(13), "lib:definition:section"),
              newId,
            })
          : undefined;
      },
      ungroup: () => {
        const group = pickOne(containers());
        return group ? ungroupNodes({ ids: [group.id], newId }) : undefined;
      },
      setText: () => {
        const texts = ownedNodes().filter(
          (entry) => typeOf(entry) === "lib:definition:text",
        );
        const picker = pickOne(pickers());
        if (random() < 0.4 && picker)
          return setFields({
            targets: [
              {
                kind: "descendant",
                ownerId: picker.id,
                address: itemAddress(picker.id),
              },
            ],
            props: { children: { kind: "set", value: `P${next}` } },
            visual: { color: { kind: "set", value: "red" } },
          });
        const target = pickOne(texts);
        return target
          ? setFields({
              targets: [{ kind: "node", id: target.id }],
              props: { children: { kind: "set", value: `S${next}` } },
              ...(random() < 0.5
                ? {
                    breakpoint: "tablet" as const,
                    props: undefined,
                    visual: { color: { kind: "set" as const, value: "blue" } },
                  }
                : {}),
            })
          : undefined;
      },
      fills: () => {
        const target = pickOne(ownedNodes());
        return target
          ? setWholeField({
              targets: [{ kind: "node", id: target.id }],
              field: "fills",
              value:
                random() < 0.3
                  ? undefined
                  : [
                      {
                        kind: "color",
                        id: `f${next}`,
                        enabled: true,
                        opacity: 1,
                        blendMode: "normal",
                        color: "#112233ff",
                      },
                    ],
            })
          : undefined;
      },
      items: () => {
        const lists = ownedNodes().filter(
          (entry) => typeOf(entry) === "lib:definition:listbox",
        );
        const list = pickOne(lists);
        return list
          ? editItems({
              target: { kind: "node", id: list.id },
              key: "items",
              edit:
                random() < 0.6
                  ? { kind: "add", item: { id: `k${++next}`, label: "Row" } }
                  : { kind: "remove", id: 0 },
            })
          : undefined;
      },
      componentize: () => {
        const target = pickOne(containers());
        return target
          ? createComponent({ id: target.id, name: `C${next}`, newId })
          : undefined;
      },
      detach: () => {
        const instances = ownedNodes().filter(
          (entry) =>
            entry.definitionId === "lib:definition:panel" ||
            entry.definitionId.startsWith("project:definition:"),
        );
        const target = pickOne(instances);
        return target
          ? detachInstances({ ids: [target.id], newId })
          : undefined;
      },
      dissolve: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const id = pickOne(project.definitionIds);
        return id
          ? dissolveComponent({
              definitionId: id as EntryId<"definition">,
              newId,
            })
          : undefined;
      },
      // ADR-279: place an instance of a component; duplicate · rename a component; paste a copy of
      // its origin (the Local page's template root → an instance).
      placeInstance: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const definitionId = pickOne(project.definitionIds);
        const parent = pickOne(parents());
        const id = makeId("node") as NodeId;
        return definitionId && parent
          ? insertNodes({
              parent,
              index: Math.floor(random() * 4),
              entries: [node(id.slice(13), definitionId)],
              rootIds: [id],
              newId,
            })
          : undefined;
      },
      duplicateComponent: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const id = pickOne(project.definitionIds);
        return id
          ? duplicateDefinition({
              definitionId: id as EntryId<"definition">,
              newId,
            })
          : undefined;
      },
      renameComponent: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const id = pickOne(project.definitionIds);
        return id
          ? renameDefinition({
              id: id as EntryId<"definition">,
              name: random() < 0.2 ? "" : `C${++next}`,
            })
          : undefined;
      },
      pasteOrigin: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const definition = graph.getEntry(
          pickOne(project.definitionIds) ?? "",
        ) as DefinitionEntry | undefined;
        const parent = pickOne(parents());
        return definition?.templateRootId && parent
          ? (reader) =>
              pasteNodes({
                clipboard: copyNodes(reader, [definition.templateRootId!]),
                parent,
                newId,
              })(reader)
          : undefined;
      },
      // ADR-261 Phase 2: swap a component instance (library or project) to another component.
      swap: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const components = [
          "lib:definition:panel",
          "lib:definition:badge",
          "lib:definition:picker",
          ...project.definitionIds,
        ];
        const target = pickOne(
          ownedNodes().filter((entry) =>
            components.includes(entry.definitionId),
          ),
        );
        const definitionId = pickOne(
          components.filter((id) => id !== target?.definitionId),
        );
        return target && definitionId
          ? swapInstance({
              id: target.id,
              definitionId: definitionId as DefinitionId,
            })
          : undefined;
      },
      // ADR-261 Phase 4: a property on a node of a component origin (text on a text node, else
      // boolean), and an instance's value for one.
      property: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const definition = graph.getEntry(
          pickOne(project.definitionIds) ?? "",
        ) as DefinitionEntry | undefined;
        if (!definition?.templateRootId) return undefined;
        const inOrigin: NodeEntry[] = [];
        const stack = [definition.templateRootId as string];
        while (stack.length) {
          const entry = graph.getEntry(stack.pop()!);
          if (entry?.kind !== "node") continue;
          inOrigin.push(entry);
          stack.push(...ownedChildren(entry));
        }
        const target = pickOne(inOrigin);
        if (!target) return undefined;
        const text = target.definitionId === "lib:definition:text";
        // (Phase 5: an instance swap property on a layer below the root.)
        const kind = text
          ? "text"
          : target.id !== definition.templateRootId && random() < 0.4
            ? "instance"
            : "boolean";
        return addComponentProperty({
          definitionId: definition.id,
          key: `p${++next}`,
          name: `P${next}`,
          kind,
          target:
            kind === "text"
              ? { id: target.id, prop: "children" }
              : { id: target.id },
        });
      },
      propertyValue: () => {
        const instance = pickOne(
          ownedNodes().filter((entry) => {
            const definition = graph.getEntry(entry.definitionId);
            return (
              definition?.kind === "definition" &&
              !!definition.properties?.length
            );
          }),
        );
        if (!instance) return undefined;
        const property = pickOne(
          (
            (graph.getEntry(instance.definitionId) as DefinitionEntry)
              .properties ?? []
          ).filter((item) => item.kind !== "instance"),
        );
        return property
          ? setFields({
              targets: [{ kind: "node", id: instance.id }],
              props: {
                [property.key]: {
                  kind: "set",
                  value: property.kind === "text" ? `V${next}` : random() < 0.5,
                },
              },
            })
          : undefined;
      },
      // ADR-261 Phase 5: an instance's value for an instance swap property (or the default) — a
      // component with an instance but no such property yet gets one in the same step.
      instanceValue: () => {
        const project = graph.getEntry(PROJECT) as ProjectEntry;
        const instance = pickOne(
          ownedNodes().filter((entry) => {
            const definition = graph.getEntry(entry.definitionId);
            return (
              definition?.kind === "definition" &&
              definition.usage !== "layout" &&
              !!definition.templateRootId
            );
          }),
        );
        if (!instance) return undefined;
        const definition = graph.getEntry(
          instance.definitionId,
        ) as DefinitionEntry;
        let property = pickOne(
          (definition.properties ?? []).filter(
            (item) => item.kind === "instance",
          ),
        );
        let add: CatalogCommand | undefined;
        if (!property) {
          const below: NodeEntry[] = [];
          const stack = [definition.templateRootId as string];
          while (stack.length) {
            const entry = graph.getEntry(stack.pop()!);
            if (entry?.kind !== "node") continue;
            if (entry.id !== definition.templateRootId) below.push(entry);
            stack.push(...ownedChildren(entry));
          }
          const target = pickOne(
            below.filter(
              (entry) =>
                !definition.properties?.some(
                  (item) =>
                    item.kind === "text" &&
                    item.targets.some((other) => other.id === entry.id),
                ),
            ),
          );
          if (!target) return undefined;
          const key = `p${++next}`;
          property = { key, name: key, kind: "instance", targets: [{ id: target.id }] };
          add = addComponentProperty({
            definitionId: definition.id,
            key,
            name: key,
            kind: "instance",
            target: { id: target.id },
          });
        }
        const definitionId = pickOne([
          null,
          "lib:definition:badge",
          "lib:definition:text",
          ...project.definitionIds,
        ]);
        const set = setInstanceProperty({
          ownerId: instance.id,
          instances: [instance.id],
          key: property.key,
          definitionId: (definitionId ?? null) as DefinitionId | null,
          newId,
        });
        if (!add) return set;
        const first = add;
        return (reader) => {
          const stage = stageOver(reader);
          const made = first(stage);
          stage.apply(made.ops);
          const value = set(stage);
          return { label: value.label, ops: [...made.ops, ...value.ops] };
        };
      },
      // ADR-262: push an instance's overrides onto its component's origin · reset them all.
      push: () => {
        const target = pickOne(composites());
        return target
          ? pushInstanceOverrides({ id: target.id, newId })
          : undefined;
      },
      resetAll: () => {
        const target = pickOne(composites());
        return target ? resetInstance({ id: target.id }) : undefined;
      },
      rename: () => {
        const target = pickOne(ownedNodes());
        return target
          ? renameNode({
              id: target.id,
              name: random() < 0.2 ? "" : `N${next}`,
            })
          : undefined;
      },
    };
    const names = Object.keys(actions);
    const accepted: Record<string, number> = {};
    const refused: Record<string, number> = {};
    const inverses: (readonly CatalogOperation[])[] = [];
    for (let step = 0; step < 500; step++) {
      const name = names[Math.floor(random() * names.length)];
      const command = actions[name]();
      if (!command) continue;
      const revision = graph.revision;
      const history = graph.history.length;
      const before = snapshot(graph);
      try {
        const plan = command(graph);
        const result = applyCatalogTransaction(graph, {
          projectId: graph.projectId,
          expectedRevision: graph.revision,
          history: { kind: "record", label: plan.label },
          ops: plan.ops,
        });
        inverses.push(result.inverse);
        accepted[name] = (accepted[name] ?? 0) + 1;
      } catch (error) {
        if (!(error instanceof CatalogValidationError)) throw error;
        refused[name] = (refused[name] ?? 0) + 1;
        expect(graph.revision).toBe(revision);
        expect(graph.history.length).toBe(history);
        expect(snapshot(graph)).toBe(before);
        continue;
      }
      // Full validator on the export agrees with the local structural validation.
      const exported = graph.exportDocument();
      expect(() => new CatalogGraph(exported, library())).not.toThrow();
      for (const pageId of (graph.getEntry(PROJECT) as ProjectEntry).pageIds)
        for (const rootId of (graph.getEntry(pageId) as PageEntry).children)
          resolveCatalogNode(graph, rootId);
    }
    console.info(
      "[adr248-4b-random]",
      JSON.stringify({ accepted, refused, steps: inverses.length }),
    );
    expect(inverses.length).toBeGreaterThan(250);
    for (const name of names) expect(accepted[name] ?? 0).toBeGreaterThan(0);
    for (const inverse of [...inverses].reverse())
      applyCatalogTransaction(graph, {
        projectId: graph.projectId,
        expectedRevision: graph.revision,
        history: { kind: "record", label: "undo" },
        ops: inverse,
      });
    expect(snapshot(graph)).toBe(initial);
  });
});
