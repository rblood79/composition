import {
  createComponent,
  duplicateNodes,
  removeTargets,
} from "../../../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands/compose";
import type { NewId } from "../../../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import type { NodeId } from "../../../../../../../packages/shared/src/catalog/document/types";

/**
 * The component shape tests written before ADR-260 build on — the definition owns the template and
 * an instance stands where the node stood — made with today's commands in one step: create the
 * component (the node stays as its origin), copy the origin (an instance, right after it), delete
 * the origin (its definition keeps it as a hidden template). Selects the instance.
 */
export const componentizeInPlace =
  (input: {
    id: NodeId;
    name: string;
    newId: NewId;
    label?: string;
  }): CatalogCommand =>
  (reader) => {
    const plan = composeCommands(
      reader as CatalogGraph,
      input.label ?? "Create component",
      [
        createComponent(input),
        duplicateNodes({ ids: [input.id], newId: input.newId }),
        removeTargets({ targets: [{ kind: "node", id: input.id }] }),
      ],
    );
    return {
      ...plan,
      selectAfter: (plan.selectAfter ?? []).filter((id) => id !== input.id),
    };
  };
