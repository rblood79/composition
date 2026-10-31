/**
 * ADR-296 Phase 0 (G0) · Decision 8 (G1) — every key of the document types as one place in the
 * project's file tree, or a named reason it is not code. A key the types gain is a compile error
 * here until it has a place (`Coverage<T>` maps every key) — no field leaves the code silently
 * (R1). `phase` is the ADR-296 phase that gives the place its emit and read (0 = already, ADR-284 ·
 * 285 · 294 vocabulary). The static test (`fieldCoverage.static.test.ts`) checks the table's
 * shape; the read gates of each phase check the forms.
 */
import type {
  AssetEntry,
  CatalogDataField,
  CatalogPageMeta,
  CatalogSiteSettings,
  CollectionEntry,
  DataBindingRef,
  DefinitionEntry,
  DefinitionOverrideEntry,
  DescendantPatchFields,
  EndpointEntry,
  InteractionAction,
  InteractionEntry,
  NodeEntry,
  NodeMetadata,
  NodeResponsiveLayer,
  NodeThemeOverride,
  PageEntry,
  ProjectEntry,
  ProjectVariableEntry,
  StateVariableEntry,
  ThemeEntry,
  TokenEntry,
  ViewEntry,
} from "../catalog/document/types";

/** The project's virtual file tree (breakdown §3) — `<…>` is an entry's identifier (`names.ts`). */
export type CodeViewFile =
  | "index.html"
  | "site.config.ts"
  | "src/App.tsx"
  | "src/Toast.tsx"
  | "src/theme.css"
  | "src/state/project.ts"
  | "src/data/<collection>.ts"
  | "src/api/<endpoint>.ts"
  | "src/components/<Name>.tsx"
  | "src/components/<Name>.css"
  | "src/pages/<Page>.tsx"
  | "src/pages/<Page>.css"
  | "public/<asset>"
  | "node_modules/@composition/library/<Name>.tsx"
  | "node_modules/@composition/catalog/<Type>.css";

export type CodeViewPhase = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CodeViewFieldPlace =
  | {
      readonly file: CodeViewFile;
      /** The form the generator writes. */
      readonly form: string;
      /** The document command the reader plans (`—` = derived · read only). */
      readonly command: string;
      readonly phase: CodeViewPhase;
    }
  /** Not code — the reason (the anchor holds an identity; a tool state; bytes; a secret). */
  | { readonly notInCode: string };

/** Every key of `T` (optional ones too) has a place. */
export type CodeViewCoverage<T> = {
  readonly [K in keyof T]-?: CodeViewFieldPlace;
};

const IDENTITY: CodeViewFieldPlace = {
  notInCode:
    "identity — the anchor holds it, never the text (ADR-285 Decision 3)",
};
const KIND: CodeViewFieldPlace = {
  notInCode: "the entry's kind — the file it is in says it",
};
const at = (
  file: CodeViewFile,
  form: string,
  command: string,
  phase: CodeViewPhase,
): CodeViewFieldPlace => ({ file, form, command, phase });

/* ─── project · pages ─────────────────────────────────────────────────────────────────── */

export const PROJECT_COVERAGE: CodeViewCoverage<ProjectEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: {
    notInCode:
      "the project's name — the dashboard renames it (no document command; the site's title is `index.html`)",
  },
  pageIds: at(
    "src/App.tsx",
    "createBrowserRouter([{path, element}]) — the routes' order",
    "createPage · removePage · reorderPages",
    2,
  ),
  componentPageIds: {
    notInCode:
      "the Components tab's pages — Builder tool pages outside the routes (ADR-282 Phase 3)",
  },
  definitionIds: at(
    "src/components/<Name>.tsx",
    "one file per Local component",
    "createComponent · dissolveComponent",
    5,
  ),
  overrideIds: at(
    "src/components/<Name>.tsx",
    "a Library origin's Local override (its changed part)",
    "unlockOrigin · resetOrigin",
    5,
  ),
  themeIds: at(
    "src/theme.css",
    '[data-theme="<name>"] {…}',
    "createTheme · removeTheme",
    4,
  ),
  tokenIds: at("src/theme.css", ":root { --<token>: … }", "setThemeToken", 4),
  stateVariableIds: at(
    "src/pages/<Page>.tsx",
    "let [x, setX] = useState(…) — in its owner's file (a component input in the component's)",
    "addRecord · updateRecord · removeRecords",
    0,
  ),
  interactionIds: at(
    "src/pages/<Page>.tsx",
    "a JSX handler · a named handler function (E9) — in its owner's file",
    "setNodeInteractions",
    0,
  ),
  assetIds: at(
    "public/<asset>",
    "the asset list (read only) · `/public/<name>` where used",
    "— (uploaded in the Assets panel)",
    6,
  ),
  viewIds: at(
    "src/pages/<Page>.tsx",
    "let v = rows.filter(…).toSorted(…)",
    "view commands (`codeViewViews.ts`)",
    0,
  ),
  collectionIds: at(
    "src/data/<collection>.ts",
    "one file per collection",
    "addCollection · removeCollection",
    3,
  ),
  endpointIds: at(
    "src/api/<endpoint>.ts",
    "one file per endpoint",
    "setEndpoint · removeEndpoint",
    3,
  ),
  projectVariableIds: at(
    "src/state/project.ts",
    "export const projectState = {…}",
    "setProjectVariable · removeProjectVariable",
    3,
  ),
  site: at(
    "index.html",
    "<html lang> · <title> · <meta> · <link rel=icon> (+ site.config.ts)",
    "setSiteSettings",
    6,
  ),
  activeThemeId: at("src/App.tsx", '<Theme name="…">', "setActiveTheme", 2),
  pageLayout: {
    notInCode:
      "the Canvas's page grid — a Builder setting (사용자 결정 2026-10-28), not the app",
  },
  toastPlacement: at(
    "src/App.tsx",
    '<MyToastRegion placement="…" />',
    "setToastPlacement",
    2,
  ),
  toastShapeId: at(
    "src/Toast.tsx",
    "<ToastRegion>{({toast}) => <Shape toast={toast} />}</ToastRegion>",
    "setToastShape",
    2,
  ),
};

export const PAGE_COVERAGE: CodeViewCoverage<PageEntry> = {
  kind: KIND,
  id: IDENTITY,
  route: at("src/App.tsx", "{path: '/…'}", "updatePage (route)", 2),
  name: at(
    "src/App.tsx",
    "element: <Page/> — the page's file and function name",
    "updatePage (name)",
    2,
  ),
  children: at(
    "src/pages/<Page>.tsx",
    "<Page …>…</Page> — the body's elements (E7)",
    "insertNodes · moveNodes · removeTargets",
    0,
  ),
  placement: {
    notInCode: "where the page frame sits on the Canvas — a Builder view state",
  },
  guideEntries: { notInCode: "the Canvas's guides — a Builder view state" },
  parentId: at(
    "src/App.tsx",
    "{path, element, children: [ … ]}",
    "updatePage (parentId)",
    2,
  ),
  meta: at(
    "src/pages/<Page>.tsx",
    "<title> · <meta name=…> (React 19)",
    "updatePage (meta)",
    2,
  ),
  originIds: {
    notInCode:
      "the Library page's given cards (ADR-282 Phase 3) — a Builder tool page record",
  },
};

export const PAGE_META_COVERAGE: CodeViewCoverage<CatalogPageMeta> = {
  title: at("src/pages/<Page>.tsx", "<title>…</title>", "updatePage", 2),
  description: at(
    "src/pages/<Page>.tsx",
    '<meta name="description" content="…" />',
    "updatePage",
    2,
  ),
  socialImage: at(
    "src/pages/<Page>.tsx",
    '<meta property="og:image" content="/public/…" />',
    "updatePage",
    2,
  ),
  hidden: at(
    "src/pages/<Page>.tsx",
    '<meta name="robots" content="noindex" />',
    "updatePage",
    2,
  ),
};

export const SITE_COVERAGE: CodeViewCoverage<CatalogSiteSettings> = {
  title: at("index.html", "<title>", "setSiteSettings", 6),
  description: at(
    "index.html",
    '<meta name="description">',
    "setSiteSettings",
    6,
  ),
  lang: at("index.html", "<html lang>", "setSiteSettings", 6),
  favicon: at(
    "index.html",
    '<link rel="icon" media="(prefers-color-scheme: …)">',
    "setSiteSettings",
    6,
  ),
  appIcon: at(
    "index.html",
    '<link rel="apple-touch-icon">',
    "setSiteSettings",
    6,
  ),
  appName: at(
    "index.html",
    '<meta name="application-name">',
    "setSiteSettings",
    6,
  ),
  themeColor: at(
    "index.html",
    '<meta name="theme-color">',
    "setSiteSettings",
    6,
  ),
  socialImage: at(
    "index.html",
    '<meta property="og:image">',
    "setSiteSettings",
    6,
  ),
  search: at(
    "site.config.ts",
    "search: {index, sitemap, robots}",
    "setSiteSettings",
    6,
  ),
  redirects: at(
    "site.config.ts",
    "redirects: [{from, to, permanent}]",
    "setSiteSettings",
    6,
  ),
  access: at(
    "site.config.ts",
    "access: {kind, …} — no secret (286 사용자 결정 2)",
    "setSiteSettings",
    6,
  ),
};

/* ─── components ──────────────────────────────────────────────────────────────────────── */

export const DEFINITION_COVERAGE: CodeViewCoverage<DefinitionEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at(
    "src/components/<Name>.tsx",
    "export function <Name>(…) — the file's name too",
    "renameDefinition",
    5,
  ),
  mode: {
    notInCode:
      "a definition's implementation kind — a Local component is always composite (its template)",
  },
  accepts: at(
    "src/components/<Name>.tsx",
    "<Name>Props (derived from the properties)",
    "—",
    5,
  ),
  defaults: at(
    "src/components/<Name>.tsx",
    "({prop = default}) — a property's default",
    "applyComponentProperty",
    5,
  ),
  visual: at("src/components/<Name>.css", ".<root> {…}", "setFields", 4),
  stateRules: at(
    "src/components/<Name>.css",
    ".<root>[data-hovered] {…}",
    "setFields (state)",
    4,
  ),
  bindingId: {
    notInCode:
      "the catalog primitive binding — the Library's, not the author's",
  },
  templateRootId: at(
    "src/components/<Name>.tsx",
    "the function's JSX (the template)",
    "template node commands (origin — every instance)",
    5,
  ),
  usage: at(
    "src/App.tsx",
    "a layout route `element: <Layout/>` with <Outlet/> (usage: layout)",
    "createLayout · applyLayout · deleteLayout",
    2,
  ),
  properties: at(
    "src/components/<Name>.tsx",
    "({label, isActive, team, onPick, children, header}) — the 5 kinds + slots",
    "addComponentProperty · addComponentOutputProperty · renameComponentProperty · removeComponentProperty",
    5,
  ),
};

export const DEFINITION_OVERRIDE_COVERAGE: CodeViewCoverage<DefinitionOverrideEntry> =
  {
    kind: KIND,
    id: IDENTITY,
    targetId: at(
      "src/components/<Name>.tsx",
      "import {<Name>} from '@composition/library' — the origin it overrides",
      "unlockOrigin",
      5,
    ),
    defaults: at(
      "src/components/<Name>.tsx",
      "the changed defaults",
      "override commands",
      5,
    ),
    visual: at("src/components/<Name>.css", ".<root> {…}", "setFields", 4),
    stateRules: at(
      "src/components/<Name>.css",
      "[data-…] {…}",
      "setFields (state)",
      4,
    ),
    templateRootId: at(
      "src/components/<Name>.tsx",
      "the unlocked template's JSX",
      "template node commands",
      5,
    ),
    templateMap: {
      notInCode:
        "Library template node → its copy — the anchors carry it (each copy's element)",
    },
  };

/* ─── nodes ───────────────────────────────────────────────────────────────────────────── */

export const NODE_COVERAGE: CodeViewCoverage<NodeEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at(
    "src/pages/<Page>.tsx",
    'className="<node name>" (kebab-case, `names.ts`) — with the page\'s CSS file (its selector)',
    "renameNode",
    4,
  ),
  definitionId: at(
    "src/pages/<Page>.tsx",
    "<Tag> — a RAC type, or a component's name (5)",
    "insertNodes (palette origin)",
    0,
  ),
  children: at(
    "src/pages/<Page>.tsx",
    "nested JSX",
    "insertNodes · moveNodes · removeTargets",
    0,
  ),
  props: at(
    "src/pages/<Page>.tsx",
    'prop="…" · prop={…}',
    "setFields (props)",
    0,
  ),
  visual: at(
    "src/pages/<Page>.css",
    ".<class> { prop: value }",
    "setFields",
    4,
  ),
  sizing: at(
    "src/pages/<Page>.css",
    "width · height · min* · max*",
    "setFields",
    4,
  ),
  stateRules: at(
    "src/pages/<Page>.css",
    ".<class>[data-hovered] · [data-pressed] · …",
    "setFields (state)",
    4,
  ),
  descendantOverrides: at(
    "src/pages/<Page>.tsx",
    "overrides={{'<path>': {…}}} on the instance (+ .css chain)",
    "setFields (descendant target) · instance rule commands",
    5,
  ),
  binding: at(
    "src/pages/<Page>.tsx",
    "items={rows} · {item => <Item …>} · rows.find(…)",
    "catalogBindingCommand · view commands",
    0,
  ),
  slot: at(
    "src/components/<Name>.tsx",
    "{children} · {header} — a slot of the component",
    "setSlotDeclaration",
    5,
  ),
  regions: at(
    "src/components/<Name>.tsx",
    "a layout's named content regions — named slot props",
    "createLayout",
    5,
  ),
  placeholder: {
    notInCode: "the editor's empty-frame hint — drawn on the Canvas only",
  },
  enabled: at(
    "src/pages/<Page>.tsx",
    "{false && <T …/>} — off for every consumer",
    "setWholeField (enabled)",
    2,
  ),
  presentWhen: at(
    "src/components/<Name>.tsx",
    "{label && <Text>{label}</Text>} — a text part present while not empty",
    "template node commands",
    5,
  ),
  showWhen: at(
    "src/components/<Name>.tsx",
    "{({isSelected}) => isSelected && <T/>} — a RAC render prop",
    "setShowWhen",
    5,
  ),
  displayState: {
    notInCode:
      "the state shown while editing (ADR-278 · 282) — a Builder view state",
  },
  originOf: {
    notInCode: "a Components page ◆ cell's origin — a Builder view reference",
  },
  layout: at(
    "src/pages/<Page>.css",
    "display · flex* · grid* · margin* · inset*",
    "setFields",
    4,
  ),
  fills: at(
    "src/pages/<Page>.css",
    "background: layer1, layer2",
    "setWholeField (fills)",
    4,
  ),
  fillSizing: at(
    "src/pages/<Page>.css",
    "flex: <factor> · align-self: stretch",
    "setFillSizing",
    4,
  ),
  responsive: at(
    "src/pages/<Page>.css",
    "@media (max-width: <bp>) { .<class> {…} }",
    "setFields (breakpoint)",
    4,
  ),
  visibility: at(
    "src/pages/<Page>.css",
    "@media … { .<class> { display: none } }",
    "setWholeField (visibility)",
    4,
  ),
  themeOverride: at(
    "src/pages/<Page>.css",
    ".<class> { color-scheme: dark; --theme-tint: blue }",
    "setWholeField (themeOverride)",
    4,
  ),
  metadata: at(
    "src/pages/<Page>.tsx",
    'id="…" · className="<name> <author>" · aria-label="…"',
    "setHtmlId · setNodeAttribute",
    2,
  ),
};

export const NODE_METADATA_COVERAGE: CodeViewCoverage<NodeMetadata> = {
  htmlId: at("src/pages/<Page>.tsx", 'id="…"', "setHtmlId", 2),
  className: at(
    "src/pages/<Page>.tsx",
    'className="<node name> <author classes>"',
    "setNodeAttribute",
    2,
  ),
  ariaLabel: at(
    "src/pages/<Page>.tsx",
    'aria-label="…"',
    "setNodeAttribute",
    2,
  ),
};

export const NODE_THEME_OVERRIDE_COVERAGE: CodeViewCoverage<NodeThemeOverride> =
  {
    mode: at(
      "src/pages/<Page>.css",
      "color-scheme: dark | light",
      "setWholeField",
      4,
    ),
    tint: at(
      "src/pages/<Page>.css",
      "--theme-tint: <tint>",
      "setWholeField",
      4,
    ),
  };

export const RESPONSIVE_LAYER_COVERAGE: CodeViewCoverage<NodeResponsiveLayer> =
  {
    visual: at(
      "src/pages/<Page>.css",
      "@media { .<class> { … } }",
      "setFields (breakpoint)",
      4,
    ),
    layout: at(
      "src/pages/<Page>.css",
      "@media { … }",
      "setFields (breakpoint)",
      4,
    ),
    sizing: at(
      "src/pages/<Page>.css",
      "@media { … }",
      "setFields (breakpoint)",
      4,
    ),
    fillSizing: at(
      "src/pages/<Page>.css",
      "@media { … }",
      "setFillSizing (breakpoint)",
      4,
    ),
  };

export const BINDING_COVERAGE: CodeViewCoverage<DataBindingRef> = {
  collectionId: at(
    "src/pages/<Page>.tsx",
    "items={users}",
    "catalogBindingCommand",
    0,
  ),
  fieldMap: at(
    "src/pages/<Page>.tsx",
    "{item => <ListBoxItem textValue={item.name}>}",
    "catalogBindingCommand",
    0,
  ),
  key: at(
    "src/pages/<Page>.tsx",
    "rows.find(row => row.id === …)",
    "catalogBindingCommand",
    0,
  ),
  viewId: at("src/pages/<Page>.tsx", "items={<view>}", "view commands", 0),
  view: at(
    "src/pages/<Page>.tsx",
    "let v = rows.filter(…)",
    "view commands",
    0,
  ),
};

/** A position an instance writes (`overrides` — ADR-296 Decision 4). */
export const DESCENDANT_PATCH_COVERAGE: CodeViewCoverage<DescendantPatchFields> =
  {
    props: at(
      "src/pages/<Page>.tsx",
      "overrides={{'<path>': {isDisabled: true}}}",
      "setFields (descendant target)",
      5,
    ),
    visual: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…> {…}",
      "setFields (descendant)",
      4,
    ),
    sizing: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…> {…}",
      "setFields (descendant)",
      4,
    ),
    stateRules: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…>[data-hovered] {…}",
      "setFields (descendant · state)",
      4,
    ),
    enabled: at(
      "src/pages/<Page>.tsx",
      "overrides={{'<path>': {hidden: true}}}",
      "setWholeField (enabled)",
      5,
    ),
    displayState: {
      notInCode:
        "the state shown at a position while editing (ADR-278) — a Builder view state",
    },
    layout: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…> {…}",
      "setFields (descendant)",
      4,
    ),
    fills: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…> { background }",
      "setWholeField",
      4,
    ),
    fillSizing: at(
      "src/pages/<Page>.css",
      ".<instance> .<path…> { flex }",
      "setFillSizing",
      4,
    ),
    responsive: at(
      "src/pages/<Page>.css",
      "@media { .<instance> .<path…> {…} }",
      "setFields (breakpoint)",
      4,
    ),
    visibility: at(
      "src/pages/<Page>.css",
      "@media { … display: none }",
      "setWholeField (visibility)",
      4,
    ),
    interactions: at(
      "src/pages/<Page>.tsx",
      "rules({inherited: {<handler>: 'off' | () => {…}}})",
      "catalogInheritedRuleEnabledCommand · catalogReplaceInheritedRuleCommand",
      5,
    ),
  };

/* ─── variables · rules ───────────────────────────────────────────────────────────────── */

export const STATE_VARIABLE_COVERAGE: CodeViewCoverage<StateVariableEntry> = {
  kind: KIND,
  id: IDENTITY,
  ownerId: at(
    "src/pages/<Page>.tsx",
    "where its `useState` line is (a node's: its page)",
    "addRecord",
    0,
  ),
  name: at(
    "src/pages/<Page>.tsx",
    "let [<name>, set<Name>]",
    "renameVariable",
    0,
  ),
  valueType: at(
    "src/pages/<Page>.tsx",
    "useState<T>(…) · the literal's type",
    "updateRecord",
    0,
  ),
  defaultValue: at(
    "src/pages/<Page>.tsx",
    "useState(<default>)",
    "updateRecord",
    0,
  ),
  source: at(
    "src/pages/<Page>.tsx",
    "selectedKeys={x} onSelectionChange={setX} — a named RAC state",
    "addRecord (source)",
    0,
  ),
  input: at(
    "src/components/<Name>.tsx",
    "({role}) — a variable property's input",
    "addComponentOutputProperty (variable)",
    5,
  ),
};

export const INTERACTION_COVERAGE: CodeViewCoverage<InteractionEntry> = {
  kind: KIND,
  id: {
    notInCode:
      "identity — the anchor; its code name is the named handler (`function on<Node><When>()`, E9)",
  },
  ownerId: at(
    "src/pages/<Page>.tsx",
    "the element the handler is on",
    "setNodeInteractions",
    0,
  ),
  address: at(
    "src/pages/<Page>.tsx",
    "overrides={{'<path>': {on<When>: rules({own: [() => {…}]})}}} (E5)",
    "address rule commands",
    5,
  ),
  trigger: at(
    "src/pages/<Page>.tsx",
    "on<When>={…} — every RAC callback, the panel's hidden ones too (E1)",
    "setNodeInteractions",
    0,
  ),
  actions: at(
    "src/pages/<Page>.tsx",
    "the handler's statements (`ACTION_COVERAGE`)",
    "setNodeInteractions",
    0,
  ),
};

/** One Do per opcode — the form and the phase its gaps close (E-numbers, breakdown §2c). */
export const ACTION_COVERAGE: Readonly<
  Record<InteractionAction["opcode"], CodeViewFieldPlace>
> = {
  setState: at(
    "src/pages/<Page>.tsx",
    "setX(…) · setX(v => !v) · setX(v => v + n) · a project variable's setter (E8 — 3)",
    "setNodeInteractions",
    0,
  ),
  navigate: at(
    "src/pages/<Page>.tsx",
    "navigate('/route')",
    "setNodeInteractions",
    0,
  ),
  callEndpoint: at(
    "src/pages/<Page>.tsx",
    "await <endpoint>({body}) — by name (E11, 3; until then the URL, ambiguous refused — 1)",
    "setNodeInteractions",
    1,
  ),
  append: at(
    "src/pages/<Page>.tsx",
    "list.append(value) · list.append(parentKey, value) (E10)",
    "setNodeInteractions",
    1,
  ),
  update: at(
    "src/pages/<Page>.tsx",
    "list.update(key, {...})",
    "setNodeInteractions",
    0,
  ),
  reload: at("src/pages/<Page>.tsx", "list.reload()", "setNodeInteractions", 0),
  insert: at(
    "src/pages/<Page>.tsx",
    "list.insert(index, value) · (parentKey, index, value) (E10)",
    "setNodeInteractions",
    1,
  ),
  insertBefore: at(
    "src/pages/<Page>.tsx",
    "list.insertBefore(key, value)",
    "setNodeInteractions",
    0,
  ),
  insertAfter: at(
    "src/pages/<Page>.tsx",
    "list.insertAfter(key, value)",
    "setNodeInteractions",
    0,
  ),
  prepend: at(
    "src/pages/<Page>.tsx",
    "list.prepend(value) · (parentKey, value) (E10)",
    "setNodeInteractions",
    1,
  ),
  move: at(
    "src/pages/<Page>.tsx",
    "list.move(key, toIndex) · (key, toParentKey, index) (E10)",
    "setNodeInteractions",
    1,
  ),
  moveBefore: at(
    "src/pages/<Page>.tsx",
    "list.moveBefore(key, keys)",
    "setNodeInteractions",
    0,
  ),
  moveAfter: at(
    "src/pages/<Page>.tsx",
    "list.moveAfter(key, keys)",
    "setNodeInteractions",
    0,
  ),
  removeSelectedItems: at(
    "src/pages/<Page>.tsx",
    "list.removeSelectedItems()",
    "setNodeInteractions",
    0,
  ),
  loadMore: at(
    "src/pages/<Page>.tsx",
    "list.loadMore()",
    "setNodeInteractions",
    0,
  ),
  setFilterText: at(
    "src/pages/<Page>.tsx",
    "list.setFilterText(value)",
    "setNodeInteractions",
    0,
  ),
  remove: at(
    "src/pages/<Page>.tsx",
    "list.remove(...keys) · a single key (E12)",
    "setNodeInteractions",
    1,
  ),
  toast: at(
    "src/pages/<Page>.tsx",
    "toasts.add({title, variant}, {timeout}) (295 후속 C5)",
    "setNodeInteractions",
    0,
  ),
  emit: at(
    "src/components/<Name>.tsx",
    "props.on<Name>?.(value) — in the component's own file (294 · 5)",
    "setNodeInteractions",
    5,
  ),
  capability: at(
    "src/pages/<Page>.tsx",
    "setNodeProp(…) · show/hide/toggle (E2) · formRef.current?.submit() (E3) · a target reference (E4)",
    "setNodeInteractions",
    1,
  ),
};

/* ─── theme · assets · views ──────────────────────────────────────────────────────────── */

export const THEME_COVERAGE: CodeViewCoverage<ThemeEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at("src/theme.css", '[data-theme="<name>"]', "updateTheme", 4),
  tokenIds: at(
    "src/theme.css",
    "the theme block's --tokens",
    "setThemeToken",
    4,
  ),
  preset: at(
    "src/theme.css",
    "--tint · --neutral · --radius · color-scheme (the preset's 4 keys)",
    "updateTheme",
    4,
  ),
};

export const TOKEN_COVERAGE: CodeViewCoverage<TokenEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at("src/theme.css", "--<name>", "setThemeToken", 4),
  tokenType: at(
    "src/theme.css",
    "the value's CSS type (color · length · number)",
    "—",
    4,
  ),
  value: at("src/theme.css", "--<name>: <value>", "setThemeToken", 4),
  source: at(
    "src/theme.css",
    "a spec token is read only (/* composition: spec token */)",
    "—",
    4,
  ),
};

export const ASSET_COVERAGE: CodeViewCoverage<AssetEntry> = {
  kind: KIND,
  id: IDENTITY,
  contentId: {
    notInCode: "the bytes' content address — uploads stay in the Assets panel",
  },
  mediaType: {
    notInCode: "the bytes' media type — uploads stay in the Assets panel",
  },
  byteLength: {
    notInCode: "the bytes' size — uploads stay in the Assets panel",
  },
  filename: at(
    "public/<asset>",
    "the file's name in the list (read only)",
    "—",
    6,
  ),
};

export const VIEW_COVERAGE: CodeViewCoverage<ViewEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at("src/pages/<Page>.tsx", "let <name> = …", "view commands", 0),
  source: at(
    "src/pages/<Page>.tsx",
    "<rows>.filter(…) · <view>.filter(…)",
    "view commands",
    0,
  ),
  where: at("src/pages/<Page>.tsx", ".filter(item => …)", "view commands", 0),
  groupBy: at("src/pages/<Page>.tsx", "Map.groupBy(…)", "view commands", 0),
  emptyGroups: at(
    "src/pages/<Page>.tsx",
    "[...new Set(…)].map(…)",
    "view commands",
    0,
  ),
  aggregates: at(
    "src/pages/<Page>.tsx",
    "{count: rows.length, …}",
    "view commands",
    0,
  ),
  sort: at("src/pages/<Page>.tsx", ".toSorted(…)", "view commands", 0),
};

/* ─── data ────────────────────────────────────────────────────────────────────────────── */

export const COLLECTION_COVERAGE: CodeViewCoverage<CollectionEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at(
    "src/data/<collection>.ts",
    "the file's name · the import's name",
    "updateCollection",
    3,
  ),
  description: at(
    "src/data/<collection>.ts",
    "/** <description> */",
    "updateCollection",
    3,
  ),
  schema: at(
    "src/data/<collection>.ts",
    "export type <Row> = {…} · export const fields = {…} (computed — 291)",
    "updateCollection",
    3,
  ),
  mockData: at(
    "src/data/<collection>.ts",
    "export default [{…}, …] (≤ 1,000)",
    "updateCollection",
    3,
  ),
  useMockData: at(
    "src/data/<collection>.ts",
    "export const useMockData = …",
    "updateCollection",
    3,
  ),
  executionPolicy: at(
    "src/data/<collection>.ts",
    "export const policy = {mode, intervalSec}",
    "updateCollection",
    3,
  ),
};

export const DATA_FIELD_COVERAGE: CodeViewCoverage<CatalogDataField> = {
  id: IDENTITY,
  key: at("src/data/<collection>.ts", "<key>: <type>", "updateCollection", 3),
  type: at("src/data/<collection>.ts", "the TS type", "updateCollection", 3),
  format: at(
    "src/data/<collection>.ts",
    "/** @format email */",
    "updateCollection",
    3,
  ),
  label: at(
    "src/data/<collection>.ts",
    "/** <label> */",
    "updateCollection",
    3,
  ),
  required: at(
    "src/data/<collection>.ts",
    "key: T (required) · key?: T",
    "updateCollection",
    3,
  ),
  defaultValue: at(
    "src/data/<collection>.ts",
    "/** @default … */",
    "updateCollection",
    3,
  ),
  children: at(
    "src/data/<collection>.ts",
    "a nested object type",
    "updateCollection",
    3,
  ),
  reference: at(
    "src/data/<collection>.ts",
    "/** @ref <collection>.<key> */",
    "updateCollection",
    3,
  ),
  formula: at(
    "src/data/<collection>.ts",
    "fields.<key> = {type, formula}",
    "updateCollection",
    3,
  ),
};

export const ENDPOINT_COVERAGE: CodeViewCoverage<EndpointEntry> = {
  kind: KIND,
  id: IDENTITY,
  name: at(
    "src/api/<endpoint>.ts",
    "the file's name · the caller's name (E11)",
    "setEndpoint",
    3,
  ),
  description: at(
    "src/api/<endpoint>.ts",
    "/** <description> */",
    "setEndpoint",
    3,
  ),
  method: at("src/api/<endpoint>.ts", "endpoint({method})", "setEndpoint", 3),
  baseUrl: at("src/api/<endpoint>.ts", "endpoint({url})", "setEndpoint", 3),
  path: at("src/api/<endpoint>.ts", "endpoint({url})", "setEndpoint", 3),
  headers: at(
    "src/api/<endpoint>.ts",
    "endpoint({headers: {…}})",
    "setEndpoint",
    3,
  ),
  queryParams: at(
    "src/api/<endpoint>.ts",
    "endpoint({query: {…}})",
    "setEndpoint",
    3,
  ),
  bodyType: at(
    "src/api/<endpoint>.ts",
    "endpoint({body: {type}})",
    "setEndpoint",
    3,
  ),
  bodyTemplate: at(
    "src/api/<endpoint>.ts",
    "endpoint({body: {template}})",
    "setEndpoint",
    3,
  ),
  responseMapping: at(
    "src/api/<endpoint>.ts",
    "endpoint({response: {data, cursor, …}})",
    "setEndpoint",
    3,
  ),
  querySerialization: at(
    "src/api/<endpoint>.ts",
    "endpoint({query: {format}})",
    "setEndpoint",
    3,
  ),
  targetCollectionId: at(
    "src/api/<endpoint>.ts",
    "endpoint({fills: <collection>})",
    "setEndpoint",
    3,
  ),
  executionMode: at(
    "src/api/<endpoint>.ts",
    "endpoint({run: 'client' | 'server'})",
    "setEndpoint",
    3,
  ),
  serverConfig: at(
    "src/api/<endpoint>.ts",
    "endpoint({server: {…, secret('NAME')}}) — names only",
    "setEndpoint",
    3,
  ),
  timeout: at("src/api/<endpoint>.ts", "endpoint({timeout})", "setEndpoint", 3),
  retryCount: at(
    "src/api/<endpoint>.ts",
    "endpoint({retry})",
    "setEndpoint",
    3,
  ),
  uploadDryRun: at(
    "src/api/<endpoint>.ts",
    "endpoint({dryRun})",
    "setEndpoint",
    3,
  ),
};

export const PROJECT_VARIABLE_COVERAGE: CodeViewCoverage<ProjectVariableEntry> =
  {
    kind: KIND,
    id: IDENTITY,
    name: at("src/state/project.ts", "<name>: …", "renameVariable", 3),
    valueType: at(
      "src/state/project.ts",
      "<name>: <value> as <T>",
      "setProjectVariable",
      3,
    ),
    defaultValue: at(
      "src/state/project.ts",
      "<name>: <value>",
      "setProjectVariable",
      3,
    ),
    persist: at("src/state/project.ts", "// persist", "setProjectVariable", 3),
    validation: at(
      "src/state/project.ts",
      "/** @validate {…} */",
      "setProjectVariable",
      3,
    ),
  };

/** Every coverage table by the type it maps (the static test walks them). */
export const CODE_VIEW_COVERAGE = {
  ProjectEntry: PROJECT_COVERAGE,
  PageEntry: PAGE_COVERAGE,
  CatalogPageMeta: PAGE_META_COVERAGE,
  CatalogSiteSettings: SITE_COVERAGE,
  DefinitionEntry: DEFINITION_COVERAGE,
  DefinitionOverrideEntry: DEFINITION_OVERRIDE_COVERAGE,
  NodeEntry: NODE_COVERAGE,
  NodeMetadata: NODE_METADATA_COVERAGE,
  NodeThemeOverride: NODE_THEME_OVERRIDE_COVERAGE,
  NodeResponsiveLayer: RESPONSIVE_LAYER_COVERAGE,
  DataBindingRef: BINDING_COVERAGE,
  DescendantPatchFields: DESCENDANT_PATCH_COVERAGE,
  StateVariableEntry: STATE_VARIABLE_COVERAGE,
  InteractionEntry: INTERACTION_COVERAGE,
  InteractionAction: ACTION_COVERAGE,
  ThemeEntry: THEME_COVERAGE,
  TokenEntry: TOKEN_COVERAGE,
  AssetEntry: ASSET_COVERAGE,
  ViewEntry: VIEW_COVERAGE,
  CollectionEntry: COLLECTION_COVERAGE,
  CatalogDataField: DATA_FIELD_COVERAGE,
  EndpointEntry: ENDPOINT_COVERAGE,
  ProjectVariableEntry: PROJECT_VARIABLE_COVERAGE,
} as const;
