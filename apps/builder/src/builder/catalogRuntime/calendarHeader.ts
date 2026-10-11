import {
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogReader,
  EditTarget,
  NodeEntry,
  NodeId,
  NodeParent,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

/**
 * ADR-256 Phase 9 — a calendar's header as one Properties choice: RAC's heading, or its month ·
 * year pickers in the heading's place (react-aria.adobe.com Calendar 「Month and year pickers」:
 * `Button[previous] + CalendarMonthPicker + CalendarYearPicker + Button[next]`). The choice is the
 * header's children — no prop of its own (D2): switching is one step that shows the chosen parts
 * and switches the others off (`enabled: false`, so a picker keeps its format when switched back),
 * putting a part in only when the header has none.
 */
export type CatalogCalendarHeaderMode = "heading" | "pickers";

const HEADING = "CalendarHeading";
const PICKERS = ["CalendarMonthPicker", "CalendarYearPicker"] as const;

function typeOf(reader: CatalogReader, position: CatalogPosition): string {
  try {
    return definitionTypeName(reader, position.definitionId);
  } catch {
    return "";
  }
}

/** The calendar's headers (one per month block template), shown positions only. */
function headers(
  reader: CatalogReader,
  calendar: CatalogPosition,
): CatalogPosition[] {
  const found: CatalogPosition[] = [];
  const visit = (position: CatalogPosition, depth: number) => {
    for (const child of childPositions(reader, position)) {
      const type = typeOf(reader, child);
      if (type === "CalendarHeader") found.push(child);
      else if (depth < 3 && type !== "CalendarGrid") visit(child, depth + 1);
    }
  };
  visit(calendar, 0);
  return found;
}

/** A header's children with their types (switched-off ones too). */
function parts(reader: CatalogReader, header: CatalogPosition) {
  return childPositions(reader, header, { includeDisabled: true }).map(
    (position) => ({ position, type: typeOf(reader, position) }),
  );
}

/** What the calendar's header shows: pickers when any header shows one; none without a header. */
export function catalogCalendarHeaderMode(
  reader: CatalogReader,
  calendar: CatalogPosition | undefined,
): CatalogCalendarHeaderMode | undefined {
  if (!calendar) return undefined;
  let list: CatalogPosition[];
  try {
    list = headers(reader, calendar);
  } catch {
    return undefined;
  }
  if (!list.length) return undefined;
  return list.some((header) =>
    parts(reader, header).some(
      ({ position, type }) =>
        !position.disabled && (PICKERS as readonly string[]).includes(type),
    ),
  )
    ? "pickers"
    : "heading";
}

function parentOf(header: CatalogPosition): NodeParent {
  const target = header.target;
  if (target.kind === "node") return { kind: "node", id: target.id };
  return {
    kind: "descendant",
    ownerId: target.ownerId,
    address: target.address,
  };
}

/** Put the parts the header lacks in, where the other choice's parts stand (else before `next`). */
const insertMissing =
  (
    calendar: CatalogPosition,
    index: number,
    types: readonly string[],
    others: readonly string[],
    newId: NewId,
  ): CatalogCommand =>
  (reader) => {
    const header = headers(reader, calendar)[index];
    if (!header) return { label: "Calendar header", ops: [] };
    const children = parts(reader, header);
    const missing = types.filter(
      (type) => !children.some((child) => child.type === type),
    );
    if (!missing.length) return { label: "Calendar header", ops: [] };
    const anchor = children.findIndex((child) => others.includes(child.type));
    const next = children.findIndex(
      (child, at) => at > 0 && child.type === "Button",
    );
    const at = anchor >= 0 ? anchor : next >= 0 ? next : children.length;
    const library = reader.library;
    const entries: NodeEntry[] = missing.map((type) => {
      const definitionId = catalogPaletteDefinitionId(library, type);
      return {
        kind: "node",
        id: newId("node") as NodeId,
        definitionId,
        children: [],
        props: catalogCreationProps(library, definitionId, type),
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
    });
    return insertNodes({
      parent: parentOf(header),
      index: at,
      entries,
      rootIds: entries.map((entry) => entry.id),
      newId,
    })(reader);
  };

/** Show the chosen parts and switch the others off (each a write only when it changes). */
const showChosen =
  (
    calendar: CatalogPosition,
    index: number,
    shown: readonly string[],
    hidden: readonly string[],
  ): CatalogCommand =>
  (reader) => {
    const header = headers(reader, calendar)[index];
    if (!header) return { label: "Calendar header", ops: [] };
    const ops = parts(reader, header).flatMap(({ position, type }) => {
      const enabled = shown.includes(type)
        ? true
        : hidden.includes(type)
          ? false
          : undefined;
      if (enabled === undefined || !position.disabled === enabled) return [];
      const inherited =
        position.target.kind === "node"
          ? true
          : position.inheritedEnabled !== false;
      return setWholeField({
        targets: [position.target],
        field: "enabled",
        value: enabled === inherited ? undefined : enabled,
      })(reader).ops;
    });
    return { label: "Calendar header", ops };
  };

/** The shown pickers of every header, by type (their props are edited from the calendar). */
export function catalogCalendarPickerTargets(
  reader: CatalogReader,
  calendar: CatalogPosition | undefined,
): Record<(typeof PICKERS)[number], EditTarget[]> {
  const found: Record<(typeof PICKERS)[number], EditTarget[]> = {
    CalendarMonthPicker: [],
    CalendarYearPicker: [],
  };
  if (!calendar) return found;
  try {
    for (const header of headers(reader, calendar))
      for (const { position, type } of parts(reader, header))
        if (!position.disabled && type in found)
          found[type as (typeof PICKERS)[number]].push(position.target);
  } catch {
    // A calendar mid-edit (a stale position) shows no picker fields.
  }
  return found;
}

/** A picker prop on every shown picker of that type (one step; `undefined` clears it). */
export function catalogCalendarPickerPropCommand(
  targets: readonly EditTarget[],
  key: "format" | "visibleYears",
  value: string | number | undefined,
): CatalogCommand {
  return setFields({
    targets,
    props: {
      [key]: value === undefined ? { kind: "remove" } : { kind: "set", value },
    },
    label: "Calendar picker",
  });
}

/** Switch the calendar's header to the heading or to the month · year pickers (one step). */
export function catalogCalendarHeaderCommand(
  graph: CatalogGraph,
  calendar: CatalogPosition,
  mode: CatalogCalendarHeaderMode,
  newId: NewId,
): CatalogCommand {
  const count = headers(graph, calendar).length;
  const shown = mode === "pickers" ? [...PICKERS] : [HEADING];
  const hidden = mode === "pickers" ? [HEADING] : [...PICKERS];
  const commands: CatalogCommand[] = [];
  for (let index = 0; index < count; index++)
    commands.push(
      insertMissing(calendar, index, shown, hidden, newId),
      showChosen(calendar, index, shown, hidden),
    );
  const label =
    mode === "pickers" ? "Calendar month and year pickers" : "Calendar heading";
  // The calendar stays selected (its Properties hold the switch) — not the parts put in.
  return () => {
    const { selectAfter: _selectAfter, ...plan } = composeCommands(
      graph,
      label,
      commands,
    );
    return plan;
  };
}
