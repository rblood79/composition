// @vitest-environment jsdom
// TEMPORARY audit (2026-11-13) — delete after the audit. Not a gate.
import "fake-indexeddb/auto";
import { appendFileSync } from "node:fs";
import { act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
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
import { containerTypeSet } from "../../../../../../packages/shared/src/domain/componentTraits";
import { catalogElementlessType } from "../../../../../../packages/shared/src/catalog/runtime/elementless";
import { catalogParticipatesInFlow } from "../../../../../../packages/shared/src/catalog/runtime/layoutParticipation";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { catalogSubpartOwnerType } from "../subpart";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:audit" as NodeId;
const OUT = process.env.AUDIT_OUT ?? "";
const [shard, shards] = (process.env.AUDIT_SHARD ?? "0/1")
  .split("/")
  .map(Number) as [number, number];
const STRUCTURAL = containerTypeSet("structural", { lowercase: true });

it.skipIf(!OUT)(
  "audit",
  async () => {
    const library = await buildCodeCatalogLibrary();
    const origins = [...library.definitions.keys()]
      .map(String)
      .filter((id) => id.startsWith("lib:definition:origin-component-"))
      .sort()
      .filter((_, index) => index % shards === shard);
    for (const definitionId of origins) {
      const origin = definitionId.replace(
        "lib:definition:origin-component-",
        "",
      );
      let workspace: CatalogWorkspace | undefined;
      try {
        workspace = new CatalogWorkspace(
          new CatalogGraph(
            newCatalogProjectDocument({
              projectId: "project:project:audit" as EntryId<"project">,
              name: "Audit",
            }),
            library,
          ),
          new CatalogStorage(indexedDB, `audit-${Math.random()}`),
          {
            engine: await nodeLayoutEngine(),
            viewport: { width: 1200, height: 800 },
            autosaveSchedule: () => {},
          },
        );
        const ws = workspace;
        ws.execute(
          insertNodes({
            parent: { kind: "node", id: BODY },
            entries: [
              {
                kind: "node",
                id: NODE,
                definitionId,
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              } as NodeEntry,
            ],
            rootIds: [NODE],
            newId: ws.newId,
          }),
        );
        const root = ws.root;
        const top = root.recordsOfSource(NODE)[0]!;
        const under = (id: string): boolean => {
          let at: string | undefined = id;
          while (at) {
            if (at === top) return true;
            at = root.domInputs.get(at)?.parentId;
          }
          return false;
        };
        const records = [...root.domInputs.values()].filter(
          (record) => under(record.id) && !record.hidden,
        );
        const typeOf = (id: string | undefined) => {
          const record = id ? root.domInputs.get(id) : undefined;
          return record ? root.typeOf(record) : "";
        };
        const rows = records.map((record) => {
          const type = root.typeOf(record);
          const owner = catalogSubpartOwnerType(
            ws.runtime.graph,
            root.domInputs,
            record.id,
            "style",
          );
          const elementless = catalogElementlessType(type);
          const target = ws.itemOfRecord(record.id)?.target;
          const editable = !owner && !elementless && !!target;
          const spacing =
            STRUCTURAL.has(type.toLowerCase()) ||
            record.children.some((id) => {
              const child = root.domInputs.get(id);
              return !!child && catalogParticipatesInFlow(child);
            });
          return {
            record,
            type,
            owner,
            elementless,
            target,
            editable,
            spacing,
          };
        });
        let writeError = "";
        for (const row of rows.filter((row) => row.editable)) {
          try {
            act(() => {
              ws.execute(
                setFields({
                  targets: [row.target!],
                  visual: { paddingLeft: { kind: "set", value: 30 } },
                }),
              );
            });
          } catch (error) {
            writeError += `${row.type}:${String((error as Error).message).slice(0, 60)};`;
          }
        }
        let markup = "";
        try {
          markup = renderToStaticMarkup(renderCatalogDom(root, top));
        } catch (error) {
          markup = `!${String((error as Error).message).slice(0, 80)}`;
        }
        const host = document.createElement("div");
        if (!markup.startsWith("!")) host.innerHTML = markup;
        for (const row of rows) {
          const id = row.record.id;
          const element = markup.startsWith("!")
            ? null
            : (host.querySelector(
                `[data-catalog-id="${CSS.escape(id)}"]`,
              ) as HTMLElement | null);
          const input = (root.getLayoutInput(id) ?? {}) as Record<
            string,
            unknown
          >;
          const inline = element?.getAttribute("style") ?? "";
          appendFileSync(
            OUT,
            [
              origin,
              row.type,
              typeOf(row.record.parentId),
              row.owner
                ? `owner:${row.owner}`
                : row.elementless
                  ? "elementless"
                  : row.target
                    ? "editable"
                    : "no-target",
              markup.startsWith("!") ? "dom-error" : element ? "dom" : "no-dom",
              row.editable
                ? input.paddingLeft === "30px"
                  ? "canvas30"
                  : `canvas:${String(input.paddingLeft ?? "-")}`
                : "-",
              row.editable && element
                ? /padding-left:\s*30px/.test(inline)
                  ? "dom30"
                  : "dom:not30"
                : "-",
              row.spacing ? "overlay" : "-",
              writeError ? `err:${writeError}` : "",
            ].join("\t") + "\n",
          );
        }
      } catch (error) {
        appendFileSync(
          OUT,
          `${origin}\tERROR\t${String((error as Error).message).slice(0, 120)}\n`,
        );
      } finally {
        if (workspace) act(() => workspace!.dispose());
      }
    }
    expect(true).toBe(true);
  },
  60 * 60 * 1000,
);
