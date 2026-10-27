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

export interface CodeViewResult {
  readonly code: string;
  readonly slots: readonly CodeViewSlot[];
  /** The names the code gives document things — the inverse map reads an edit by them. */
  readonly symbols: CodeViewSymbols;
}

export interface CodeViewSymbols {
  /** Code name → variable id (`search` → `project:stateVariable:…`). */
  readonly variables: Readonly<Record<string, string>>;
  /** Collection id → field key → field id (`data:field:<id>`). */
  readonly fields: Readonly<Record<string, Readonly<Record<string, string>>>>;
}
