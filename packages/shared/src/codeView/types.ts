/**
 * ADR-284 Phase 6 — the code view: a page of the document as React Aria code in the reference
 * examples' shape (Decision 9 · 연구 §8.5). One generator; the 1:1 positions (slots) map an edit of
 * the code back to a document field — everything else in the code is read only.
 */
import type {
  CatalogEntry,
  CatalogLibrary,
  EntryId,
  ViewComparison,
} from "../catalog/document/types";
import type { EndpointQuerySerialization } from "../collections/view/serialize";

/** What the generator reads of the document. */
export interface CodeViewReader {
  readonly projectId: string;
  readonly library: CatalogLibrary;
  getEntry(id: string): CatalogEntry | undefined;
}

/** A data collection as the code imports it (the data store's, not the document's). */
export interface CodeViewCollection {
  /** The bare id (`users` — the document names it `data:collection:users`). */
  readonly id: string;
  readonly name: string;
  readonly schema: readonly {
    readonly id?: string;
    readonly key: string;
    readonly type?: string;
    readonly reference?: {
      readonly collectionId: string;
      readonly keyField: string;
    };
    /** ADR-291 — a computed field's formula (stored over ids). */
    readonly formula?: string;
  }[];
  /** Loaded from an endpoint (`useAsyncList`); absent = local rows (`useListData` · an import). */
  readonly endpoint?: {
    readonly url: string;
    readonly method?: string;
    /** The view's request format (ADR-284 Decision 6) — absent · `none` = the rows are filtered here. */
    readonly querySerialization?: EndpointQuerySerialization;
    /** Where the response holds the items · the next cursor (`responseMapping`). */
    readonly dataPath?: string;
    readonly cursorPath?: string;
  };
}

/** A data endpoint a rule calls (`callEndpoint`). */
export interface CodeViewEndpoint {
  readonly id: string;
  readonly url: string;
  readonly method?: string;
}

export interface CodeViewInput {
  readonly reader: CodeViewReader;
  readonly pageId: EntryId<"page">;
  readonly collections: readonly CodeViewCollection[];
  readonly endpoints?: readonly CodeViewEndpoint[];
}

/** Where a view lives: a shared view entry, or a node's built-in view. */
export type CodeViewViewOwner =
  { readonly viewId: EntryId<"view"> } | { readonly nodeId: string };

/** The document field a slot of the code is (the inverse map's address). */
export type CodeViewSlotTarget =
  /** `let [<name>, …] = useState(…)` — a variable's name. */
  | { readonly kind: "variableName"; readonly variableId: string }
  /** `useState(<default>)` — a variable's default value. */
  | { readonly kind: "variableDefault"; readonly variableId: string }
  /**
   * A `filter` term — the condition's field, comparison and value. With `suffixes`: a request
   * parameter (`'gender_ne', String(gender)` — the key, the format's suffix and the value).
   */
  | {
      readonly kind: "condition";
      readonly owner: CodeViewViewOwner;
      readonly conditionId: string;
      readonly collectionId: string;
      readonly suffixes?: Readonly<Partial<Record<ViewComparison, string>>>;
    }
  /** A literal sort's field (`a.<field>`). */
  | {
      readonly kind: "sortField";
      readonly owner: CodeViewViewOwner;
      readonly collectionId: string;
    }
  /** A JSX handler prop · a `useDragAndDrop` handler name — the rule's When. */
  | {
      readonly kind: "trigger";
      readonly interactionIds: readonly string[];
      readonly ownerType: string;
    };

export interface CodeViewSlot {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly target: CodeViewSlotTarget;
}

/**
 * ADR-285 Decision 3 — the document unit a span of the code shows. The editor follows each span
 * through the edit operations: a span that stays is the same unit (edited), one deleted whole is
 * removed, text typed outside every span is new.
 */
export type CodeViewAnchorTarget =
  /** A JSX element (`<Text>…</Text>`, with its `{state && …}` wrapper). */
  | { readonly kind: "node"; readonly nodeId: string }
  /**
   * An attribute of an element: an own prop (`prop`), a prop a variable drives (`state` — the
   * controlled pair · a named state · a rule's state), a handler (`handler` — the rules on that
   * When), the list's rows (`items`) or its drag hooks (`dnd`).
   */
  | {
      readonly kind: "attribute";
      readonly nodeId: string;
      readonly name: string;
      readonly source:
        "prop" | "state" | "handler" | "items" | "dnd" | "ref" | "metadata";
      readonly interactionIds?: readonly string[];
    }
  /** An element's text (`children` — a literal or a template). */
  | { readonly kind: "text"; readonly nodeId: string }
  /** A row template (`{item => <ListBoxItem …>}`) — the binding's field map. */
  | { readonly kind: "rows"; readonly nodeId: string }
  /** `let [x, setX] = useState(…)` · a list's named selection. */
  | { readonly kind: "variable"; readonly variableId: string }
  /** A view's statements (`let items = rows.filter(…).toSorted(…)` · a grouping · a count). */
  | { readonly kind: "view"; readonly owner: CodeViewViewOwner }
  /**
   * ADR-291 — a collection's computed columns (`let <rows>Fields = {<key>: {type, formula}}`):
   * each `formula` text (shown over field keys) is the column's formula; `type` is read only.
   */
  | { readonly kind: "fields"; readonly collectionId: string }
  /** One `filter` term (with its skip guard) or request parameter — a condition. */
  | {
      readonly kind: "condition";
      readonly owner: CodeViewViewOwner;
      readonly conditionId: string;
    }
  /**
   * A line the document makes from other units (`key` names it — `import:react-aria` ·
   * `collection:<id>` · `effect:<id>` · `useFilter:base` · `collator` · `navigate` · `toasts` ·
   * `dnd:<nodeId>` · `state:<nodeId>:<prop>` · `comment`): not edited itself, checked against the
   * code the document gives (Decision 6).
   */
  | { readonly kind: "derived"; readonly key: string }
  /**
   * ADR-296 E9 — one rule of a When that holds several (`function on<Node><When>() { … }`): the
   * function is the rule, its name the rule's code identifier.
   */
  | { readonly kind: "handler"; readonly interactionId: string }
  /** ADR-296 Phase 2 — a route of `App.tsx` (`{path, element}`): the page it is. */
  | { readonly kind: "route"; readonly pageId: string }
  /** ADR-296 Phase 2 — a page's `<title>` · `<meta>` (its `meta`). */
  | { readonly kind: "pageMeta"; readonly pageId: string };

export interface CodeViewAnchor {
  readonly start: number;
  readonly end: number;
  readonly target: CodeViewAnchorTarget;
}

export interface CodeViewResult {
  readonly code: string;
  readonly slots: readonly CodeViewSlot[];
  /** ADR-285 — every document unit's span (a superset of the slots' units). */
  readonly anchors: readonly CodeViewAnchor[];
  /** The names the code gives document things — the inverse map reads an edit by them. */
  readonly symbols: CodeViewSymbols;
}

export interface CodeViewSymbols {
  /** Code name → variable id (`search` → `project:stateVariable:…`). */
  readonly variables: Readonly<Record<string, string>>;
  /** Collection id → field key → field id (`data:field:<id>`). */
  readonly fields: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * ADR-287 — a rule's implicit state (`let [meterValue, setMeterValue] = useState(40)` for a Do
   * that writes a prop no variable names): its code name → the node and prop. The inverse reads a
   * setter call on it as that node's Do.
   */
  readonly states?: Readonly<
    Record<string, { readonly nodeId: string; readonly prop: string }>
  >;
  /** ADR-296 E9 — a named handler function → its rule (`onSaveButtonPress` → the rule's id). */
  readonly handlers?: Readonly<Record<string, string>>;
  /** ADR-296 E3 — a node's ref (`formRef`) → the node (an imperative Do — `formRef.current?.submit()`). */
  readonly refs?: Readonly<Record<string, string>>;
  /**
   * ADR-296 E4 · E13 — a Do's target the page code names by text (`capability('hide', {target:
   * '<ref>'})`): an instance position (`'<instance>/<path>'`), an origin's own (`'local:<path>'`) or
   * a node of another page (`'<route>#<node>'`) → the document's target.
   */
  readonly targets?: Readonly<Record<string, unknown>>;
  /**
   * ADR-296 E13 — a Do the page code cannot write (a variable of another page …), kept as
   * `keep('<token>')`: the token → the Do as the document holds it (read back unchanged).
   */
  readonly kept?: Readonly<Record<string, unknown>>;
  /** ADR-296 — a token prop's name (`token('<name>')`) → the token id. */
  readonly tokens?: Readonly<Record<string, string>>;
  /** ADR-296 Phase 2 — a page's component name (`App.tsx` · its file) → the page id. */
  readonly pages?: Readonly<Record<string, string>>;
  /** ADR-296 Phase 2 — a layout's component name → its definition id. */
  readonly layouts?: Readonly<Record<string, string>>;
  /** ADR-296 Phase 2 — a theme's name → its id. */
  readonly themes?: Readonly<Record<string, string>>;
}
