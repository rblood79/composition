/**
 * ADR-285 Decision 2 — the closed vocabulary as one table: each form the generator writes
 * (`emit` — a `generate.ts` function) and the reader that takes it back to the document (`read` —
 * a function of `inverse/parse.ts` or the builder's `codeViewEdit.ts`). A form whose reader does
 * not exist yet is `pending`: an edit of it is refused by the regenerated-code check (its line,
 * never a partial apply), and unchanged it round-trips as text. The static test
 * (`vocabulary.static.test.ts`) checks both names exist and holds the pending list (it only
 * shrinks).
 */
export interface CodeViewVocabularyItem {
  /** The form as the code shows it. */
  readonly form: string;
  readonly emit: string;
  /** The reader; `undefined` = pending. */
  readonly read?: string;
  /** The document unit it is. */
  readonly unit: string;
}

export const CODE_VIEW_VOCABULARY: readonly CodeViewVocabularyItem[] = [
  {
    form: "import {…} from '…'",
    emit: "writeImports",
    read: "importCovered",
    unit: "derived",
  },
  {
    form: "let [x, setX] = useState<T>(v)",
    emit: "writeState",
    read: "planVariables",
    unit: "variable",
  },
  {
    form: "let {selectedKeys: x, setSelectedKeys: setX} = list",
    emit: "writeCollections",
    unit: "variable (a list's selection)",
  },
  {
    form: "useListData · useAsyncList · useEffect(reload)",
    emit: "writeCollections",
    read: "compareRegenerated",
    unit: "derived",
  },
  {
    form: "url.searchParams.append(…)",
    emit: "writeParam",
    unit: "condition (request)",
  },
  {
    form: "url.searchParams.set(_sort …)",
    emit: "writeSortParams",
    unit: "sort (request)",
  },
  {
    form: "useFilter · useCollator · useNavigate",
    emit: "run",
    read: "compareRegenerated",
    unit: "derived",
  },
  {
    form: "let v = rows.filter(item => …)",
    emit: "writeView",
    read: "viewOf",
    unit: "view (built-in)",
  },
  {
    form: "a `filter` term (18 comparisons · skip · 적용)",
    emit: "fragmentOfCondition",
    read: "conditionOf",
    unit: "condition",
  },
  { form: "an or of terms", emit: "fragmentOfGroup", unit: "condition group" },
  {
    form: ".toSorted((a, b) => collator.compare(…))",
    emit: "writeView",
    unit: "sort",
  },
  {
    form: "Map.groupBy(…) · counts",
    emit: "writeGroup",
    unit: "group · aggregates",
  },
  {
    form: "[{id: 'row-1', count: …}]",
    emit: "aggregateFields",
    unit: "aggregates",
  },
  { form: "useDragAndDrop({…})", emit: "writeDragAndDrop", unit: "drop rules" },
  {
    form: "<Tag …>…</Tag>",
    emit: "writeNode",
    read: "planElements",
    unit: "node",
  },
  {
    form: 'prop="…" · prop={literal} · prop={x}',
    emit: "propCode",
    read: "propValue",
    unit: "prop",
  },
  {
    form: "prop={x === … && …}",
    emit: "propWhen",
    unit: "prop (value condition)",
  },
  {
    form: "text · {`…${x}…`}",
    emit: "textCode",
    read: "textValue",
    unit: "text",
  },
  {
    form: "{`…${row?.f ?? ''}…`}",
    emit: "textCode",
    unit: "text (a row's field)",
  },
  {
    form: "onX={setX}",
    emit: "handlerCode",
    read: "actionsOf",
    unit: "rule (Set state)",
  },
  {
    form: "onX={() => { setX(…); toasts.add(…); navigate(…); }}",
    emit: "writeAction",
    read: "actionsOf",
    unit: "rule Dos",
  },
  {
    form: "list.update · move · remove · insert … · reload · capability · fetch",
    emit: "writeAction",
    unit: "rule Dos (lists · capability · endpoint)",
  },
  {
    form: "items={rows} · {item => <Item …>}",
    emit: "writeNode",
    read: "planItems",
    unit: "binding · rows",
  },
];
