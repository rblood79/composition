import { setFields } from "../../../../../packages/shared/src/catalog/commands";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogConsumerNode } from "./compositionRoot";
import type { CatalogSelectionItem } from "./session";

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

/** The command that commits an inline text edit (`undefined` = the text did not change). */
export function catalogTextCommand(
  item: CatalogSelectionItem,
  key: string,
  before: string,
  after: string,
): CatalogCommand | undefined {
  if (after === before) return undefined;
  return setFields({
    targets: [item.target],
    props: { [key]: { kind: "set", value: after } },
    label: "Edit text",
  });
}
