/**
 * ADR-285 Decision 2 — the closed vocabulary as one table: each form the generator writes
 * (`emit` — a `generate.ts` function) and the reader that takes it back to the document (`read` —
 * a function of `inverse/parse.ts` or the builder's `codeViewEdit.ts` · `codeViewViews.ts`). Every
 * form has its reader (no pending form — 2026-10-27); the static test (`vocabulary.static.test.ts`)
 * checks both names exist and that none goes back to pending.
 *
 * ADR-296 G1 (R2) — names are not the gate: `adr296Vocabulary.test.tsx` holds one document per row
 * whose code shows the form, and an edit of that form that the reader turns into a document change
 * (the row's read proven, not named). A row with `file` writes into a file of a later phase.
 */
export interface CodeViewVocabularyItem {
  /** The form as the code shows it. */
  readonly form: string;
  readonly emit: string;
  /** The reader. */
  readonly read: string;
  /** The document unit it is. */
  readonly unit: string;
  /** ADR-296 — the file the form is in when not the page's (`src/components/<Name>.tsx` — Phase 5). */
  readonly file?: string;
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
    // ADR-287 — a rule's Do on a prop no variable names: RAC's pattern (`useState` + the controlled
    //   prop), the state starting at the authored value; the setter call is the Do.
    form: "let [nodeProp, setNodeProp] = useState(v) · <Tag prop={nodeProp}> · setNodeProp(…)",
    emit: "writeState",
    read: "capabilityAt",
    unit: "rule Do (a reference API prop)",
  },
  {
    form: "let {selectedKeys: x, setSelectedKeys: setX} = list",
    emit: "writeCollections",
    read: "planSelections",
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
    read: "requestOf",
    unit: "condition (request)",
  },
  {
    form: "url.searchParams.set(_sort …)",
    emit: "writeSortParams",
    read: "requestOf",
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
    read: "specOf",
    unit: "view (built-in)",
  },
  {
    form: "a `filter` term (18 comparisons · skip · 적용)",
    emit: "fragmentOfCondition",
    read: "conditionOf",
    unit: "condition",
  },
  {
    form: "an or of terms",
    emit: "fragmentOfGroup",
    read: "itemOf",
    unit: "condition group",
  },
  {
    form: ".toSorted((a, b) => collator.compare(…))",
    emit: "writeView",
    read: "specOf",
    unit: "sort",
  },
  {
    form: "Map.groupBy(…) · counts",
    emit: "writeGroup",
    read: "groupedOf",
    unit: "group · aggregates",
  },
  {
    form: "[{id: 'row-1', count: …}]",
    emit: "aggregateFields",
    read: "aggregateOf",
    unit: "aggregates",
  },
  {
    form: "useDragAndDrop({…})",
    emit: "writeDragAndDrop",
    read: "planDragAndDrop",
    unit: "drop rules",
  },
  {
    form: "<Tag …>…</Tag>",
    emit: "writeNode",
    read: "planElements",
    unit: "node",
  },
  {
    // ADR-294 — an instance receives its component's event: the callback prop (`property:<key>`).
    form: "<Instance onName={(value) => …}> · <Instance name={x}>",
    emit: "writeNode",
    read: "planHandlers",
    unit: "rule (a component event received) · a variable property's value",
  },
  {
    // ADR-294 — an origin rule sends its component's event (the component's own file — ADR B).
    form: "props.onName?.(value)",
    emit: "writeAction",
    read: "emitOf",
    unit: "rule Do (a component event sent)",
    file: "src/components/<Name>.tsx",
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
    read: "whenOf",
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
    read: "textValue",
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
    read: "dosOf",
    unit: "rule Dos (lists · capability · endpoint)",
  },
  {
    form: "items={rows} · {item => <Item …>}",
    emit: "writeNode",
    read: "planCodeViews",
    unit: "binding · rows",
  },
  // ADR-296 Phase 1 — the page file's repairs (E1 ~ E13 · the silent omissions).
  {
    // E9 (사용자 결정 7) — several rules on one When: each a named function, the handler calls them.
    form: "function onNodeWhen() {…} · onWhen={() => { onNodeWhen(); onNodeWhen2(); }}",
    emit: "namedHandlers",
    read: "namedCalls",
    unit: "rules of one When (one function = one rule)",
  },
  {
    // E1 (사용자 결정 4) — a When the panel hides (press side · hover · focus · keyboard).
    form: "onHoverStart={() => {…}} (a hidden When)",
    emit: "writeNode",
    read: "planHandlers",
    unit: "rule (a When the panel hides)",
  },
  {
    // E2 — show · hide · toggle on the node's display state.
    form: "setNodeIsVisible(true | false | v => !v)",
    emit: "writeAction",
    read: "capabilityAt",
    unit: "rule Do (show · hide · toggle)",
  },
  {
    // E3 — an imperative Do: the node's ref (derived) and the call.
    form: "let formRef = useRef<HTMLFormElement>(null) · <Form ref={formRef}> · formRef.current?.submit()",
    emit: "writeRefs",
    read: "dosOf",
    unit: "rule Do (imperative — submit · reset)",
  },
  {
    // E4 · E13 — a Do whose target is not a node of this page (an instance position · local · another page · unset).
    form: "capability('hide', {target: '<ref>' | null})",
    emit: "targetRef",
    read: "dosOf",
    unit: "rule Do (a target by reference)",
  },
  {
    // E13 — a Do the page cannot write (a project variable until Phase 3 …), kept as the document holds it.
    form: "keep('do-1')",
    emit: "keepDo",
    read: "dosOf",
    unit: "rule Do (kept as is)",
  },
  {
    // E10 · E12 — a tree's parent key · one key removed.
    form: "list.append(parentKey, v) · insert(parentKey, i, v) · move(key, parentKey, i) · remove(key)",
    emit: "writeAction",
    read: "dosOf",
    unit: "rule Dos (tree data · one key)",
  },
  {
    // The silent omission of a token prop — the token by name.
    form: "prop={token('<name>')}",
    emit: "propCode",
    read: "propValue",
    unit: "prop (a token)",
  },
  {
    // A prop's typed object (a calendar duration · a number format) — written and read.
    form: "prop={{months: 2}}",
    emit: "propCode",
    read: "propValue",
    unit: "prop (a typed object)",
  },
  // ADR-296 Phase 3 — the data definition files and their use on a page.
  {
    // E8 (사용자 결정 5) — the project variables a page uses.
    form: "let {cart, setCart} = useProjectState() · setCart(…)",
    emit: "writeState",
    read: "dosOf",
    unit: "rule Do (a project variable)",
  },
  {
    // E11 — an endpoint by its name (its file `api/<name>.ts`).
    form: "await saveOrder({body})",
    emit: "writeAction",
    read: "dosOf",
    unit: "rule Do (an endpoint call)",
  },
  {
    form: "export const fields = […] · settings · export default [rows]",
    emit: "generateCollectionFile",
    read: "planCodeViewCollection",
    unit: "collection (schema · rows · settings)",
    file: "src/data/<collection>.ts",
  },
  {
    form: "export default endpoint({…})",
    emit: "generateEndpointFile",
    read: "planCodeViewEndpoint",
    unit: "endpoint",
    file: "src/api/<endpoint>.ts",
  },
  {
    form: "export const projectState = {name: start, // persist}",
    emit: "generateProjectStateFile",
    read: "planCodeViewProjectState",
    unit: "project variables",
    file: "src/state/project.ts",
  },
  {
    form: "createBrowserRouter([{path, element, children}]) · <ToastContainer placement> · <Theme name>",
    emit: "generateAppFile",
    read: "planCodeViewApp",
    unit: "pages (routes · order · parent · layout) · toast · theme",
    file: "src/App.tsx",
  },
  {
    form: "<Page …> · <title> · <meta> · id · className · aria-label · {false && <T/>} · useParams()",
    emit: "writeHead",
    read: "planHead",
    unit: "the page body · meta · metadata · enabled",
  },
];
