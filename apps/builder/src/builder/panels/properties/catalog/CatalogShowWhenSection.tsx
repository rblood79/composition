import { memo, useCallback, useSyncExternalStore } from "react";
import { Minus } from "lucide-react";
import { setShowWhen } from "../../../../../../../packages/shared/src/catalog/commands";
import {
  CATALOG_STATE_KEYS,
  type CatalogShowCondition,
  type CatalogShowWhen,
  type CatalogStateKey,
  type NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogStateConditions,
  catalogStateKeysOf,
  catalogStateOwner,
} from "../../../../../../../packages/shared/src/catalog/runtime/presence";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySelect } from "../../../components/property/PropertySelect";
import { ACTION_ICONS } from "../../../config/actionIcons";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { useToastStore } from "../../../stores/toast";

const AddIcon = ACTION_ICONS.add;
const MAX_CONDITIONS = 3;
const NEAREST = "nearest";

type Root = CatalogWorkspace["root"];

/** An ancestor that gives state keys: its record, type and — an authored node — its node id. */
interface StateAncestor {
  readonly recordId: string;
  readonly type: string;
  readonly nodeId?: string;
  readonly keys: readonly string[];
}

/** The selected record's ancestors that give state keys, nearest first. */
function stateAncestors(root: Root, identity: string): StateAncestor[] {
  const out: StateAncestor[] = [];
  const record = root.canvasInputs.get(identity);
  for (
    let cursor = record && root.canvasInputs.get(record.parentId);
    cursor;
    cursor = root.canvasInputs.get(cursor.parentId)
  ) {
    const type = root.typeOf(cursor);
    const keys = type ? catalogStateKeysOf(type) : [];
    if (!keys.length) continue;
    // An authored node's record is its own id (`…::project:node:X` = X); a template position's is not.
    const own = cursor.id.slice(cursor.id.lastIndexOf("::") + 2);
    out.push({
      recordId: cursor.id,
      type,
      ...(own === cursor.sourceId ? { nodeId: own } : {}),
      keys,
    });
  }
  return out;
}

/**
 * Whether the selected record's section applies: an authored node with a state-giving ancestor, or
 * one that already has a condition. (The panel reads this before mounting — no hook per selection.)
 */
export function catalogShowWhenApplies(root: Root, identity: string): boolean {
  const record = root.canvasInputs.get(identity);
  if (!record) return false;
  return !!record.showWhen || stateAncestors(root, identity).length > 0;
}

interface ConditionView {
  key: CatalogStateKey;
  not: boolean;
  /** `nearest`, or `node:<id>` (a stored address). */
  owner: string;
  linked: boolean;
}
interface ShowWhenView {
  nodeId: string;
  conditions: ConditionView[];
  ancestors: StateAncestor[];
}

/**
 * ADR-256 Decision 7 — the states in which the selected node is there (`showWhen`): up to three
 * conditions, each a state key of an ancestor part (as given or negated), read from the nearest
 * ancestor that gives it or from one ancestor by its address. An unlinked condition is false.
 */
export const CatalogShowWhenSection = memo(function CatalogShowWhenSection({
  identity,
  workspace,
  root,
}: {
  identity: string;
  workspace: CatalogWorkspace;
  root: Root;
}) {
  const read = useCallback((): ShowWhenView | null => {
    const record = root.canvasInputs.get(identity);
    const position = workspace.positionOfRecord(identity);
    if (!record || position?.target.kind !== "node") return null;
    const get = (id: string) => root.canvasInputs.get(id);
    return {
      nodeId: position.target.id,
      ancestors: stateAncestors(root, identity),
      conditions: record.showWhen
        ? catalogStateConditions(record.showWhen).map((condition) => ({
            key: condition.key,
            not: condition.not,
            owner:
              condition.from && "ancestor" in condition.from
                ? "nodeId" in condition.from.ancestor
                  ? `node:${condition.from.ancestor.nodeId}`
                  : NEAREST
                : NEAREST,
            linked: !!catalogStateOwner(
              record,
              condition.key,
              condition.from,
              get,
              root.typeOf,
            ),
          }))
        : [],
    };
  }, [identity, root, workspace]);
  const subscribe = useCallback(
    (notify: () => void) => workspace.runtime.subscribeSteps(() => notify()),
    [workspace],
  );
  const viewKey = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  const view = JSON.parse(viewKey) as ShowWhenView | null;

  const write = useCallback(
    (conditions: readonly ConditionView[]) => {
      const current = read();
      if (!current) return;
      const all = conditions.map((condition): CatalogShowCondition => {
        if (condition.owner === NEAREST)
          return condition.not ? { not: condition.key } : condition.key;
        const from = {
          ancestor: { nodeId: condition.owner.slice(5) as NodeId },
        };
        return condition.not
          ? { not: condition.key, from }
          : { key: condition.key, from };
      });
      const showWhen: CatalogShowWhen | null = all.length ? { all } : null;
      try {
        workspace.execute(
          setShowWhen({ id: current.nodeId as NodeId, showWhen }),
        );
      } catch (error) {
        useToastStore
          .getState()
          .showToast(
            "error",
            error instanceof Error ? error.message : String(error),
          );
      }
    },
    [read, workspace],
  );

  if (!view) return null;
  const keys = CATALOG_STATE_KEYS.filter((key) =>
    view.ancestors.some((ancestor) => ancestor.keys.includes(key)),
  );
  const change = (index: number, patch: Partial<ConditionView>) =>
    write(
      view.conditions.map((condition, at) => {
        if (at !== index) return condition;
        const next = { ...condition, ...patch };
        // A new key keeps the owner only if that owner gives it.
        if (patch.key && next.owner !== NEAREST) {
          const owner = view.ancestors.find(
            (ancestor) => `node:${ancestor.nodeId}` === next.owner,
          );
          if (!owner?.keys.includes(patch.key)) next.owner = NEAREST;
        }
        return next;
      }),
    );
  return (
    <PropertySection title="Show when">
      {view.conditions.map((condition, index) => {
        const owners = view.ancestors.filter(
          (ancestor) =>
            ancestor.nodeId && ancestor.keys.includes(condition.key),
        );
        const sameType = (type: string) =>
          owners.filter((owner) => owner.type === type).length > 1;
        return (
          <div key={index} className="show-when-condition">
            <div className="list-row">
              <div className="list-row__body">
                <span className="list-row__label">
                  {condition.not ? "not " : ""}
                  {condition.key}
                </span>
              </div>
              <div className="list-row__actions">
                <button
                  type="button"
                  className="list-row__action"
                  aria-label={`Remove condition ${index + 1}`}
                  onClick={() =>
                    write(view.conditions.filter((_, at) => at !== index))
                  }
                >
                  <Minus size={12} />
                </button>
              </div>
            </div>
            <div className="list-row__fields">
              <div className="fieldset-row">
                <PropertySelect
                  label="State"
                  value={condition.key}
                  options={keys.map((key) => ({ value: key, label: key }))}
                  translateOptions={false}
                  onChange={(value) =>
                    change(index, { key: value as CatalogStateKey })
                  }
                />
                <PropertySelect
                  label="Is"
                  value={condition.not ? "false" : "true"}
                  options={[
                    { value: "true", label: "true" },
                    { value: "false", label: "false" },
                  ]}
                  translateOptions={false}
                  onChange={(value) =>
                    change(index, { not: value === "false" })
                  }
                />
              </div>
              <div className="fieldset-row" data-wide="true">
                <PropertySelect
                  label="From"
                  value={condition.owner}
                  options={[
                    { value: NEAREST, label: "Nearest" },
                    ...owners.map((owner, at) => ({
                      value: `node:${owner.nodeId}`,
                      label: sameType(owner.type)
                        ? `${owner.type} (${at + 1})`
                        : owner.type,
                    })),
                    ...(condition.owner !== NEAREST &&
                    !owners.some(
                      (owner) => `node:${owner.nodeId}` === condition.owner,
                    )
                      ? [{ value: condition.owner, label: "Unlinked" }]
                      : []),
                  ]}
                  translateOptions={false}
                  onChange={(value) => change(index, { owner: value })}
                  afterControl={
                    condition.linked ? undefined : (
                      <span slot="description">Not connected</span>
                    )
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
      {view.conditions.length < MAX_CONDITIONS && keys.length > 0 && (
        <button
          type="button"
          className="control-button"
          data-variant="add"
          onClick={() =>
            write([
              ...view.conditions,
              { key: keys[0]!, not: false, owner: NEAREST, linked: true },
            ])
          }
        >
          <AddIcon size={14} />
          <span>Add condition</span>
        </button>
      )}
    </PropertySection>
  );
});
