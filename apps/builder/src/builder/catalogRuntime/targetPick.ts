import {
  exposedCapabilities,
  isCapabilityTarget,
  type ExposureInput,
} from "@composition/shared";
import type {
  DefinitionId,
  EditTarget,
  InteractionEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogConsumerNode } from "../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  CATALOG_OPEN_BODY_TYPES,
  catalogOpenOwnerOf,
} from "../../../../../packages/shared/src/catalog/runtime/runtimeStateProps";
import {
  catalogExposureInput,
  catalogInteractionsCommand,
  catalogInteractionsOf,
  type CatalogInteractionOwner,
} from "./interactions";
import { catalogSubpartOwnerType } from "./subpart";
import { catalogTargetRefOf, sameCatalogTarget } from "./targetRef";
import type { CatalogVariableReader } from "./stateVariables";
import type { CatalogWorkspace } from "./workspace";

/**
 * ADR-283 Decision 5 — the Canvas target pick's raise and rule patch. Loaded when a pick starts
 * (`CatalogCanvas` — the part-owner tables stay out of the initial bundle, G4).
 */

/** What a Canvas target pick resolves a clicked record to (ADR-283 Decision 5). */
export interface CatalogTargetPick {
  /** The record the rule will target (the clicked one, or the part's state owner). */
  recordId: string;
  type: string;
  /** The clicked part's type when the pick went up to its state owner (two names on the tag). */
  raisedFrom?: string;
  /** Whether the type takes a capability (one without is not picked — 「capability 없음」). */
  capable: boolean;
}

/**
 * ADR-283 Decision 5 (user decision 1 「둘만」) — the clicked component itself, except the two parts
 * RAC hands their state to a parent: a field's part (Label · Input · NumberField's stepper Button …
 * — `catalogSubpartOwnerType`) goes to its field, an overlay body (Modal · Popover · Tooltip, and
 * the Dialog inside one) to its trigger (`catalogOpenOwnerOf` — the dispatcher's owner too).
 */
export function catalogPickTargetRecord(
  graph: CatalogVariableReader,
  records: ReadonlyMap<string, CatalogConsumerNode>,
  openOwnerOf: (bodyId: string) => string | null | undefined,
  recordId: string,
): CatalogTargetPick | undefined {
  const typeOf = (id: string | undefined) => {
    const record = id ? records.get(id) : undefined;
    if (!record) return "";
    try {
      return definitionTypeName(graph, record.definitionId as DefinitionId);
    } catch {
      return "";
    }
  };
  const clicked = records.get(recordId);
  if (!clicked) return undefined;
  const clickedType = typeOf(recordId);
  const pick = (id: string, raisedFrom?: string): CatalogTargetPick => {
    const type = typeOf(id);
    return {
      recordId: id,
      type,
      ...(raisedFrom ? { raisedFrom } : {}),
      capable: !!type && isCapabilityTarget(type),
    };
  };
  const fieldType = catalogSubpartOwnerType(graph, records, recordId, "all");
  if (fieldType)
    for (
      let cursor = records.get(clicked.parentId);
      cursor;
      cursor = records.get(cursor.parentId)
    )
      if (typeOf(cursor.id) === fieldType) return pick(cursor.id, clickedType);
  const body = CATALOG_OPEN_BODY_TYPES.has(clickedType)
    ? recordId
    : clickedType === "Dialog" &&
        CATALOG_OPEN_BODY_TYPES.has(typeOf(clicked.parentId))
      ? clicked.parentId
      : undefined;
  const trigger = body ? openOwnerOf(body) : undefined;
  if (trigger) return pick(trigger, clickedType);
  return pick(recordId);
}

/**
 * ADR-283 Decision 5 — the rule patch of a Canvas pick (one history step): the picked place as
 * the rule's stored reference; a capability the new target does not take falls back to `hide`
 * (`fallback` says which — the panel's notice). `undefined` = nothing to write (no capability, a
 * place out of the rule's reach, the same target).
 */
export function catalogTargetPickCommand(
  graph: CatalogVariableReader,
  ruleId: string,
  target: EditTarget,
  type: string,
  exposure: ExposureInput,
):
  | { command: CatalogCommand; fallback?: { from: string; to: string } }
  | undefined {
  const rule = graph.getEntry(ruleId as never);
  if (rule?.kind !== "interaction" || rule.action.opcode !== "capability")
    return undefined;
  const owner: CatalogInteractionOwner = {
    ownerId: rule.ownerId,
    ...(rule.address ? { address: rule.address } : {}),
  };
  const ref = catalogTargetRefOf(graph, owner, target);
  if (!ref || !isCapabilityTarget(type)) return undefined;
  if (sameCatalogTarget(ref, rule.action.target)) return undefined;
  const keeps = rule.action.capabilityId in exposedCapabilities(type, exposure);
  const next: InteractionEntry = {
    ...rule,
    action: {
      opcode: "capability",
      target: ref,
      capabilityId: keeps ? rule.action.capabilityId : "hide",
    },
  };
  return {
    command: catalogInteractionsCommand(
      owner,
      catalogInteractionsOf(graph, owner).map((item) =>
        item.id === rule.id ? next : item,
      ),
      "Set interaction target",
    ),
    ...(keeps
      ? {}
      : { fallback: { from: rule.action.capabilityId, to: "hide" } }),
  };
}

/** What the Canvas target pick shows and writes for one record under the pointer. */
export interface CatalogCanvasTargetPick extends CatalogTargetPick {
  /** The document place picked (`undefined` = not an element place). */
  target?: EditTarget;
  /** The tag's text parts: `type · name · #htmlId` (else the id's short tail). */
  name?: string;
  /** The record's DOM id (Accessibility ID — the `id=""` the Preview renders). */
  htmlId?: string;
  shortId: string;
  /** The rule patch of a click (`undefined` = nothing to write — out of reach, same target). */
  write?: ReturnType<typeof catalogTargetPickCommand>;
}

/**
 * ADR-283 Decision 5 — the Canvas pick for the record a click would select: the raised record
 * (field part → field, overlay body → trigger), its place and the rule patch a click writes.
 */
export function catalogCanvasTargetPick(
  workspace: CatalogWorkspace,
  ruleId: string,
  recordId: string,
): CatalogCanvasTargetPick | undefined {
  const graph = workspace.runtime.graph;
  const records = workspace.root.domInputs;
  const pick = catalogPickTargetRecord(
    graph,
    records,
    (bodyId) =>
      catalogOpenOwnerOf(workspace.root, bodyId, (node) => {
        try {
          return definitionTypeName(graph, node.definitionId as DefinitionId);
        } catch {
          return "";
        }
      }),
    recordId,
  );
  if (!pick) return undefined;
  const target = workspace.positionOfRecord(pick.recordId)?.target;
  const leaf = target
    ? target.kind === "node"
      ? target.id
      : target.address.templatePath.at(-1)!
    : pick.recordId;
  const entry = graph.getEntry(leaf as never);
  // (An unnamed instance of a project component reads as its component — the picker's label.)
  const component =
    entry?.kind === "node" && !entry.name
      ? graph.getEntry(entry.definitionId as never)
      : undefined;
  const name =
    entry?.kind === "node"
      ? (entry.name ??
        (component?.kind === "definition" ? component.name : undefined))
      : undefined;
  const htmlId = records.get(pick.recordId)?.htmlId;
  return {
    ...pick,
    ...(target ? { target } : {}),
    ...(name ? { name } : {}),
    ...(htmlId ? { htmlId } : {}),
    shortId: leaf.split(":").pop()!.slice(0, 4),
    ...(target && pick.capable
      ? {
          write: catalogTargetPickCommand(
            graph,
            ruleId,
            target,
            pick.type,
            catalogExposureInput(graph, target),
          ),
        }
      : {}),
  };
}
