import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type { EditTarget } from "../../../../../packages/shared/src/catalog/document/types";
import { readPropSource } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";
import { collapsesSegmentBreaks } from "../workspace/canvas/utils/textWhiteSpace";

/** Props that hold an element's own text, in the order the inline editor looks for one. */
const TEXT_KEYS = ["children", "label", "value"] as const;

/**
 * ADR-248 Phase 4e-3b: the prop a drawn record's inline text editing writes — the first of its
 * resolved props that holds a string. `undefined` = the element has no own text (a container or a
 * component whose text lives in a child).
 */
export function catalogTextKey(
  record: Pick<CatalogConsumerNode, "props"> | undefined,
): string | undefined {
  if (!record) return undefined;
  const props = record.props as Readonly<Record<string, unknown>>;
  return TEXT_KEYS.find((key) => typeof props[key] === "string");
}

/** The text a record's `key` is written as (a `{{ name }}` template, not its value; empty when absent). */
export function catalogTextOf(
  record: Pick<CatalogConsumerNode, "props" | "templateProps">,
  key: string,
): string {
  const value = (
    (record.templateProps ?? record.props) as Readonly<Record<string, unknown>>
  )[key];
  return typeof value === "string" ? value : "";
}

/**
 * The command that commits an inline text edit (`undefined` = the text did not change). A line
 * break typed into a `normal` / `nowrap` text would be saved but collapsed by CSS and the Canvas
 * alike, so the commit lifts `white-space` to `pre-wrap` (`nowrap` → `pre`) when the new text has
 * one — the old editor's `resolveCommittedWhiteSpace` (user live 2026-09-20: "shift+enter 로
 * 줄바꿈이 동작하지 않음"). `whiteSpace` is the record's resolved value.
 */
export function catalogTextCommand(
  item: CatalogSelectionItem,
  key: string,
  before: string,
  after: string,
  whiteSpace?: unknown,
): CatalogCommand | undefined {
  if (after === before) return undefined;
  const lifted = committedWhiteSpace(whiteSpace, after);
  return setFields({
    targets: [item.target],
    props: { [key]: { kind: "set", value: after } },
    ...(lifted
      ? { visual: { whiteSpace: { kind: "set", value: lifted } } }
      : {}),
    label: "Edit text",
  });
}

/**
 * ADR-254 Decision 5: the command that commits an inline edit of a bound text (`textBinding.ts`) —
 * the text goes to its source, the instance's prop (`source` · `prop`), not to the edited position:
 * a position's own text would hide every later edit of the prop. A text the position already wrote
 * itself is removed in the same step (one source again). The `white-space` lift stays on the
 * edited position (its style axis is its own).
 */
export function catalogBoundTextCommand(
  graph: CatalogGraph,
  item: CatalogSelectionItem,
  key: string,
  bound: { readonly target: EditTarget; readonly prop: string },
  before: string,
  after: string,
  whiteSpace?: unknown,
): CatalogCommand | undefined {
  if (after === before) return undefined;
  const lifted = committedWhiteSpace(whiteSpace, after);
  const ownText = readPropSource(graph, item.target, key).own !== undefined;
  const commands: CatalogCommand[] = [
    setFields({
      targets: [bound.target],
      props: { [bound.prop]: { kind: "set", value: after } },
    }),
  ];
  if (ownText || lifted)
    commands.push(
      setFields({
        targets: [item.target],
        ...(ownText ? { props: { [key]: { kind: "remove" } } } : {}),
        ...(lifted
          ? { visual: { whiteSpace: { kind: "set", value: lifted } } }
          : {}),
      }),
    );
  return () => composeCommands(graph, "Edit text", commands);
}

/** `pre-wrap` / `pre` when the committed text's line breaks would otherwise collapse, else null. */
export function committedWhiteSpace(
  whiteSpace: unknown,
  committedText: string,
): "pre-wrap" | "pre" | null {
  if (!committedText.includes("\n")) return null;
  if (!collapsesSegmentBreaks(whiteSpace as string | undefined)) return null;
  return whiteSpace === "nowrap" ? "pre" : "pre-wrap";
}
