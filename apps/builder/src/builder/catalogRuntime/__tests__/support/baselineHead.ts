import { execFileSync } from "node:child_process";

/**
 * ADR-248 G0 oracle validity (breakdown §5 "관련 파일이 변하면 영향 baseline 재측정"): the frozen
 * old-app outputs stay the oracle at a later HEAD only if the baseline HEAD is its ancestor and no
 * source file under the product roots changed except in comments. Returns the current HEAD for
 * the run record; any other source change fails, so the baseline must be re-measured.
 */
const SOURCE_ROOTS = [
  "apps/builder/src",
  "apps/publish/src",
  "packages/shared/src",
  "packages/specs/src",
  "packages/engine/src",
];

/** Test files are not product source: they change no oracle output. */
const TEST_FILE = /(\.test\.[cm]?[tj]sx?$)|(\/__tests__\/)/;

/**
 * ADR-248 new-model roots. The frozen G0 outputs come from the old app; a change here cannot reach
 * them while no product file outside these roots imports into them (then nothing outside reaches
 * them transitively either). `assertNewModelUnreachable` checks that at the compared HEAD, so the
 * new model can change during Phase 4a–4d without an old-app re-measure. The Phase 4e cutover
 * connects them and retires the old app — that commit fails this check by design.
 */
const NEW_MODEL_ROOTS = [
  "packages/shared/src/catalog/document/",
  "packages/shared/src/catalog/resolution/",
  "packages/shared/src/catalog/transactions/",
  "packages/shared/src/catalog/commands/",
  "packages/shared/src/catalog/preview/",
  "apps/builder/src/builder/catalogRuntime/",
];
/** Import specifiers that resolve into a new-model root (relative, deep or barrel-relative). */
const NEW_MODEL_IMPORT =
  "(from|import\\()[[:space:]]*['\"][^'\"]*(catalog/(document|resolution|transactions|commands|preview)|catalogRuntime|\\.\\.?/(document|resolution|transactions|commands|preview))(/[^'\"]*)?['\"]";

/**
 * Product source changes reviewed as unrelated to the frozen G0 outputs (layout, paint, DOM,
 * storage). Keyed by path; the blob SHA pins the reviewed content, so any later edit fails again.
 * `blob: null` is a reviewed deletion (the path must stay deleted).
 */
const REVIEWED_UNRELATED: Readonly<
  Record<string, { blob: string | null; reason: string }>
> = {
  "apps/builder/src/builder/components/styles/panel-system.css": {
    blob: "f8ebc69a3168c4824465a2b06bfb68ac9b3aa671",
    reason:
      "e309ce75a: `.panel-tablist` fixed height removed (the row keeps its padding + 28px tabs); side panel chrome only — no canvas, layout, paint, DOM or storage output",
  },
  "apps/builder/src/builder/styles/layout/canvas.css": {
    blob: "70cb4dc305ff9bafee41a33d303432aea31aa52e",
    reason:
      "e309ce75a: side panel / command palette `.panel-header` fixed height removed (min-height kept); the rule does not select the canvas surface — no canvas, layout, paint, DOM or storage output",
  },
  "apps/builder/src/builder/styles/modules/builder-menu-row.css": {
    blob: "98a4ad509cd5995c374369e6dcc46944e50ecb5f",
    reason:
      "e309ce75a: menu row separator margin; header menu chrome only — no canvas, layout, paint, DOM or storage output",
  },
  "apps/builder/src/builder/workspace/canvas/viewport/useViewportControl.ts": {
    blob: "65cb05b56322035c349db049ccf3551b10e31054",
    reason:
      "5a445b732: root overscroll-behavior-x while the canvas consumes wheel events (browser history swipe); no camera, layout or paint change",
  },
  "apps/builder/src/builder/main/BuilderHeader.tsx": {
    blob: "1949b551420be8a81bc4af9a8aa27dea65b46eb7",
    reason:
      "96ab2cee1: header full-menu delete action (confirm → dashboard with router state) and help/about items removed; 831148f24: menu body replaced by the lazy HeaderMainMenu (trigger preload, menuHost). The only G0 script opening the menu is the storage-surface oracle (root Export, run at the baseline HEAD only — see builderMenuStructure); the trigger and the hidden zip import input are unchanged, no canvas/DOM/storage output; d11a659a0: the lazy menu body uses preloadableLazy (a preloaded body renders without Suspense) — menu open timing only",
  },
  "apps/builder/src/dashboard/index.tsx": {
    blob: "cc456723c114286fc3fdf71c57ba91f693818ce6",
    reason:
      "96ab2cee1: dashboard deletes only when the location state carries deleteProjectId (early return otherwise); G0 project creation/navigation unchanged",
  },
  "apps/builder/src/i18n/translations.ts": {
    blob: "ec3398d1a8fde9f567c075bb715fcf28beb82744",
    reason:
      "96ab2cee1: removed the header menu help/about label keys; ea7893dad: AI assistant prompt/tool description strings only — no G0 scenario renders the full menu or the AI panel; 831148f24: four command.* labels and headerMenu.* strings (tooltips, palette, menu) — no G0 selector uses these labels",
  },
  "apps/builder/src/i18n/types.ts": {
    blob: "5eab3777593c9db7510187d42136e63b1ac01139",
    reason:
      "96ab2cee1: the two header label keys; ea7893dad: the removed AI prompt rule5 key — translation key type only; 831148f24: headerMenu key types",
  },
  "apps/builder/src/builder/panels/ai/hooks/useAgentLoop.ts": {
    blob: "e0f6e74596721b5f05a09299eb45ea2f211cff04",
    reason:
      "ea7893dad: AI panel agent loop stores the turn context on its user message; the AI panel is not opened in any G0 scenario",
  },
  "apps/builder/src/builder/stores/conversation.ts": {
    blob: "e2c69a54d5a6f56b1aafd26f3a7f3f93627fb8d3",
    reason:
      "ea7893dad: AI conversation store keeps per-turn context metadata; no canvas/DOM/storage output",
  },
  "apps/builder/src/services/ai/AgentService.ts": {
    blob: "9620e422b925ca6606eb16dc5131ab5478dfae5e",
    reason:
      "ea7893dad: AI request history re-attaches earlier turn contexts; AI service only",
  },
  "apps/builder/src/services/ai/compiler/oneShot.ts": {
    blob: "e9704cab510ca5f9c87eba4573476a1eef5a09ef",
    reason:
      "ea7893dad: one-shot prompt wording and default maxTokens; AI service only",
  },
  "apps/builder/src/services/ai/createAgentRunner.ts": {
    blob: "0cd063e5dad79119b41b3bd72be5521fb1847aca",
    reason:
      "ea7893dad: optional onTurnContext callback passed through; AI service only",
  },
  "apps/builder/src/services/ai/systemPrompt.ts": {
    blob: "b62e88f0d2f46d07b6e0d6ba946707ada37894b8",
    reason: "ea7893dad: system prompt rule5 removed; AI service only",
  },
  "apps/builder/src/types/integrations/ai.types.ts": {
    blob: "d1deb1f796b5a4894f1a11b4b8c813f5f98524dd",
    reason: "ea7893dad: AI agent callback type; types only",
  },
  "apps/builder/src/types/integrations/chat.types.ts": {
    blob: "c16bdefa52e211e012f052e9e59cf8434c599a4f",
    reason: "ea7893dad: chat message turn-context metadata type; types only",
  },
  "apps/builder/src/dashboard/pendingProjectDelete.ts": {
    blob: "7efaa874ddf0578a6eb4b2acfafebd036cfaaaae",
    reason:
      "96ab2cee1: new router-state helper for the header delete action; not on any G0 scenario path",
  },
  "apps/builder/src/builder/components/overlay/CommandPalette.tsx": {
    blob: "ae99c4d8ed389c3f8402aaf5412d2233a4667630",
    reason:
      "831148f24: command palette filter moved to matchesCommandSearch (same matches); no G0 scenario opens the palette",
  },
  "apps/builder/src/builder/components/overlay/commandSearch.ts": {
    blob: "5d5f2f43a5bbfc23078969e0313e4c19cd30b5ea",
    reason:
      "831148f24: new pure command search filter used by the palette and the full menu",
  },
  "apps/builder/src/builder/components/overlay/contextMenu/ContextMenuOverlay.tsx":
    {
      blob: "19157b421f785487fa37ac5329ee6c9313d80c99",
      reason:
        "831148f24: context menu icon size 14 -> 16; no G0 script right-clicks",
    },
  "apps/builder/src/builder/config/commandMeta.ts": {
    blob: "734af62d95540d719897fdead9d4bb98fcb4e4a2",
    reason:
      "831148f24: copy/paste styles precondition metadata, read only by the full menu and the agent executor (not by keydown)",
  },
  "apps/builder/src/builder/hooks/useActiveScope.ts": {
    blob: "a633594b6d674f683b62e9d9ea210fe04cfbb15e",
    reason:
      "831148f24: added pure panelIdForScope for the full menu; scope inference unchanged",
  },
  "apps/builder/src/builder/hooks/useGlobalKeyboardShortcuts.ts": {
    blob: "891e4d08bf521e1b127bbd1809c7671f8c5bbeb8",
    reason:
      "831148f24: scoped handler branch extracted to createScopedHandler (context?.scope ?? activeScope); keydown passes no context, so copy/paste/delete resolve as before; zoom shortcuts untouched",
  },
  "apps/builder/src/builder/hooks/useKeyboardShortcutsRegistry.ts": {
    blob: "06c3c812cbc4b02a7a790905f79e479965be84c2",
    reason:
      "831148f24: handler typed as CommandHandler and an optional canRun published to the command registry; the keydown path (input skip, scope match, preventDefault, handler()) is unchanged — Shift+1/Shift+2 fire as before",
  },
  "apps/builder/src/builder/main/BuilderCore.tsx": {
    blob: "d274cd6956517b8c65086e15bb1706d3d8a59e9e",
    reason:
      "831148f24: removed the workflow overlay selector/header prop; 6dd0c0965: the static shell skeleton release and the presented-chrome snapshot writer (localStorage, after presentation) removed — G0 captures run after presentation from fresh contexts (no snapshot), and the storage oracle reads no localStorage",
  },
  "apps/builder/src/builder/main/headerMenu/HeaderMainMenu.css": {
    blob: "4194f2549323a72f60895b3108dfed1b2332c072",
    reason:
      "831148f24/904469b40: .header-menu-* selectors only, loaded with the lazy menu chunk; nothing in the canvas matches",
  },
  "apps/builder/src/builder/main/headerMenu/HeaderMainMenu.tsx": {
    blob: "97c59648dd02fe261ce89edd20b4b9774a4576cc",
    reason:
      "831148f24/904469b40: lazy full-menu body (icon column per section); effects run only while the menu is mounted",
  },
  "apps/builder/src/builder/main/headerMenu/builderMenuStructure.ts": {
    blob: "4e118fb646a782f7272fe0f8f76f07cf8802b63a",
    reason:
      "831148f24: full-menu tree — Export now sits in the File submenu. The G0 storage-surface oracle clicks root 'Export' (UI path only; it asserts HEAD === baseline, and the export runs the same onExportProject), so frozen export/persisted values are unchanged",
  },
  "apps/builder/src/builder/main/headerMenu/headerMenuActions.ts": {
    blob: "14e7db0a6a768c5296dc5c4dbbea99c0b27267e6",
    reason:
      "831148f24: menu action table; exportProject calls the same host.onExportProject as before",
  },
  "apps/builder/src/builder/main/headerMenu/headerMenuRuntime.ts": {
    blob: "15a7634aa2d1a168a294d5c73c1e9723de5aa023",
    reason:
      "831148f24: helpers the header imports statically; no import side effects",
  },
  "apps/builder/src/builder/main/headerMenu/menuModel.ts": {
    blob: "5f299449d33f16a4da5b2e0d2af5671c283cdbb6",
    reason: "831148f24: pure menu model for the lazy menu",
  },
  "apps/builder/src/builder/main/headerMenu/resolveMenuItemState.ts": {
    blob: "2d35577d784b25e9eaa34c8aaa5f31f17f630030",
    reason:
      "831148f24: menu item enabled/disabled resolution for the lazy menu",
  },
  "apps/builder/src/builder/panels/core/panelConfigs.ts": {
    blob: "38b6dabbbd6496480d195db9349674fe851bc007",
    reason:
      "831148f24: Theme (left) and History (right) hidden from the rail, fields/settings hidden from the menu. Rail width (fit-content 40px) and the canvas inset read from it are unchanged; persisted rail order/visibility ignore hiddenFromRail. Only the unconsumed full-viewport system-child-visual-pinned PNGs (33, hashed by the freeze audit, no G3 pixel leg) would differ in the rail band; every compared capture clip lies between x 70 and 1200",
  },
  "apps/builder/src/builder/panels/core/types.ts": {
    blob: "75251d02d1879f32f4467e360b4277223ecede30",
    reason: "831148f24: hiddenFromMenu type only",
  },
  "apps/builder/src/builder/panels/history/HistoryPanel.tsx": {
    blob: "a6750567936231f21270bf585f8809f94e320414",
    reason:
      "831148f24: snapshot creation delegated to createUserSnapshot; the History panel is not opened in any G0 scenario",
  },
  "apps/builder/src/builder/panels/history/userSnapshotActions.ts": {
    blob: "74f3709a4c93fd0e2c0a5d3b21cc183a85cf7a7b",
    reason:
      "831148f24: loadProject then createSnapshot, called only by the History button and the menu",
  },
  "apps/builder/src/builder/stores/commandRegistry.ts": {
    blob: "574a2b2b1fbcd71cb91fe53d454bc1f5f6137228",
    reason:
      "831148f24: CommandRunContext/CommandHandler types and optional canRun, read only by the menu item state",
  },
  "apps/builder/src/builder/styles/layout/header.css": {
    blob: "1030008b924900c4d9706602cb97ac9b3b816506",
    reason:
      "831148f24: .header-menu-popover / .header-menu flex, min-width and overflow; rendered only while the menu is open; 400d09eae: .header-menu-item[data-open] keeps a submenu trigger's active style — menu only",
  },
  "apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx": {
    blob: "9722b895541397ad81581a9d01c043c4aa043089",
    reason:
      "831148f24: zoom-to-selection target computation extracted (resolveZoomToSelectionTarget) and published as canRun; the zoom math, condition and canvasActiveScope registration are unchanged — Shift+2 behaves as before",
  },
  "apps/builder/src/services/agent/agentReadModel.ts": {
    blob: "6256e994719aa43f0c96daf7a1a9e517c212e20b",
    reason:
      "831148f24: buildAgentReadModel moved here unchanged; agent/AI path only",
  },
  "apps/builder/src/services/agent/executeAgentCommand.ts": {
    blob: "3e33768e3c548722bb7c6a5b4e8408d920ee4cc5",
    reason: "831148f24: re-exports the moved read model; agent/AI path only",
  },
  "apps/builder/src/builder/styles/modules/error-loading.css": {
    blob: "11b4a740526e4696c51b9a385817390095fcb0fa",
    reason:
      "6dd0c0965: canvas scrollbar hidden while .app.builder-booting only; G0 captures run after boot",
  },
  "apps/builder/src/staticShell/staticShell.ts": {
    blob: "0a2ecb8784d2f448d79bd2f6f0e5649eb78b63e9",
    reason:
      "6dd0c0965: cold-entry shell reduced to canvas background, progress bar and theme (no panel skeleton); released before the builder is presented, before any G0 capture; a42c49328: `.ts` import specifiers only",
  },
  "apps/builder/src/staticShell/staticShellRelease.ts": {
    blob: "6dd1455926287539260da77e46a02a0c449e95b4",
    reason: "6dd0c0965: skeleton release removed with the skeleton; boot-only",
  },
  "apps/builder/src/staticShell/scheduleShellSnapshotWrite.ts": {
    blob: null,
    reason:
      "6dd0c0965: deleted — the presented-chrome snapshot writer (localStorage only; no G0 oracle reads it)",
  },
  "apps/builder/src/staticShell/shellSnapshot.ts": {
    blob: null,
    reason:
      "6dd0c0965: deleted — the shell snapshot model used only by the removed skeleton/writer",
  },
  "apps/builder/src/utils/ui/preloadableLazy.tsx": {
    blob: "5ec5351d2dc61eff1215ad1807de552a66e6515e",
    reason:
      "d11a659a0: lazy helper whose preloaded module renders without Suspense; used only by the header menu",
  },
  "apps/builder/src/builder/utils/componentMap.ts": {
    blob: null,
    reason:
      "2b7bb30ab: deleted — no import anywhere at the baseline (git grep 2a5c970), so no G0 path reached it",
  },
  "apps/builder/src/builder/utils/componentUtils.ts": {
    blob: null,
    reason:
      "2b7bb30ab: deleted — no import anywhere at the baseline (git grep 2a5c970), so no G0 path reached it",
  },
  "packages/shared/src/domain/componentTraits.ts": {
    blob: "e8cacce72833546816cf96b452bc374b7e131dc0",
    reason:
      "ADR-248 Phase 4b G0 routes: TableHeader/TableBody/Row rows carrying only the new `tableItemHost` family, read by the typed graph's fillSlot check (new model). No old consumer reads the family, and the nesting tables (containerTypeSet · componentContractMap) read container/children/owners, none set — no canvas, layout, paint, DOM or storage output",
  },
};

/**
 * ADR-248 Phase 3 commit (2026-09-30): the frozen outputs the gated tests read were re-measured on
 * this product source with the old app (5173 dev server — `adr248-native-state-baseline.mjs`,
 * `adr248-storage-baseline.mjs`). `native-state-pinned` (= `native-state`) baseline fields and both
 * PNGs are byte-identical. `storage.json` grew by a constant 519 B at every count (the initial
 * project's component origins), so the byte sub-gate budget built from the frozen samples is 519 B
 * stricter at count 0 and unchanged above. Blob-pinned like `REVIEWED_UNRELATED`: a later edit of
 * any of these files fails again until its baseline is re-measured.
 */
const REMEASURED_PHASE3_SOURCE: Readonly<Record<string, string>> = {
  "apps/builder/src/builder/components/breadcrumbs/breadcrumbsTemplateOrigins.ts":
    "06c4d21ba65f139f55ae3a5cd4ae1735758ded14",
  "apps/builder/src/builder/components/itemSlotRoles.ts":
    "acce5287beee34b264ec8a0624066de0d87b729a",
  "apps/builder/src/builder/components/reusableCompositeOrigins.ts":
    "eb284bf4edfd8d0ba266a7bd73db2c595c7d3020",
  "apps/builder/src/builder/components/staticCollectionMigration.ts":
    "f221e926160dc7a4385eabddb14f7a413933f7fe",
  "apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts":
    "ce60a268d2b29bac3cb3c6ac918d6312e977155a",
  "apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts":
    "784a62167e821c710203e8a30ddab29182a7660e",
  "apps/builder/src/builder/workspace/canvas/scene/canonicalSceneModel.ts":
    "59d0a42198299b661cb513aaf6c9413c4c398599",
  "apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts":
    "af80374398281260415e3c70459c088a88d2a2dd",
  "apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts":
    "f774b5421c652326245b9c46e835a21496bbcebb",
  "apps/builder/src/builder/workspace/canvas/skia/itemLabelInheritance.ts":
    "43772667af2a9a3383828db3f6337a8c2314e3f6",
  "apps/builder/src/builder/workspace/canvas/skia/nodeRendererTypes.ts":
    "3a50cce3c41daaed2319e61a83a2b5937c3ac0ca",
  "apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts":
    "13fde4dd1f0d88dbaa51c237d9ab2aeb0169e2fc",
  "apps/builder/src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts":
    "0098562cf8fb1529de1d89fa4d039f3db44e1023",
  "apps/builder/src/builder/workspace/canvas/wasm-bindings/engine.ts":
    "640b4d94bf129c39662397dcedfc6b9e4345cd59",
  "apps/builder/src/builder/workspace/canvas/wasm-bindings/engineWasm.ts":
    "89fe13fad929b978f759350d14bb443875f7345c",
  "apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutBridge.ts":
    "19b6da1cf6991e79bab28fded4fb4af68e7c9595",
  "apps/builder/src/preview/App.tsx":
    "210bdf486a7a697ef7cb94104681a32404438a15",
  "apps/builder/src/preview/components/CanonicalNodeRenderer.tsx":
    "245a7b1382bc890f692ba932588d465b164cad8e",
  "apps/builder/src/utils/theme/neutralToSkiaColors.ts":
    "37f3e1fa140a2dd2e6a2b9d2331908ea421770cb",
  "packages/engine/src/tree.rs": "143992b8724859170ed1f4c96124f413366aa622",
  "packages/engine/src/wasm.rs": "6c7ba81575c782affa723f89744d4da4da67dfe6",
  "packages/shared/src/catalog/bindings/Breadcrumbs.binding.ts":
    "50f2e7754c2aed993227769d7509cdd4142390a6",
  "packages/shared/src/catalog/generated/componentRulesTable.ts":
    "cb48e588ac0a0e133d8c4592e8103ad493d66570",
  "packages/shared/src/catalog/index.ts":
    "31d8792a2b34cebf320785cd98c65086775b7701",
  "packages/shared/src/catalog/outputs/toRacProps.ts":
    "f1f37a762f7cacb49ef6f450e2fa4ceae9bd6960",
  "packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox.ts":
    "13ca49fdb11fe9fd96708aca815608d867dbccf1",
  "packages/shared/src/catalog/slotRoles.ts":
    "c731f8661e411a96483b798174b868a6f81abcef",
  "packages/shared/src/components/Breadcrumb.tsx":
    "b3dc9293cfc694b738faec5011f6fd1562939d55",
  "packages/shared/src/components/Breadcrumbs.tsx":
    "dd83830e5d7994cfa6b23d6326a6562b3125ca0e",
  "packages/shared/src/components/FieldNecessityIndicator.ts":
    "eaa8b66f251d22f27c8869f297518c1bfd9f060c",
  "packages/shared/src/components/Icon.tsx":
    "b3209193483c1369a9a7c6b2a8e3dc3e66a56f89",
  "packages/shared/src/components/styles/Breadcrumbs.css":
    "2c2c4af4526f4836b42ad98adf84acb03865c428",
  "packages/shared/src/components/styles/generated/Breadcrumb.css":
    "69e805861451df9e8ddea7f040c66c4fd2484021",
  "packages/shared/src/components/styles/generated/Breadcrumbs.css":
    "807474a0ca35ae290be396c5596c8a382186726c",
  "packages/shared/src/components/styles/generated/Button.css":
    "7527d8049b1aaa00aa4c09fc9984ecb1201678e5",
  "packages/shared/src/components/styles/generated/Disclosure.css":
    "b78b88b7fec0dc307dc30a274b3e8b8f088ab98b",
  "packages/shared/src/components/styles/generated/Link.css":
    "f468f693721bbe2fe56c4b4a9b44cd7707eba23b",
  "packages/shared/src/components/styles/generated/Select.css":
    "c79ef7ea22747c27daeda7a321d4029c1d0dc77f",
  "packages/shared/src/components/styles/generated/ToggleButton.css":
    "541c5b0df667bafccbe530cb1349058237a44f63",
  "packages/shared/src/components/styles/GridList.css":
    "a194a7b990b6c0e0627535e9b4c2331e719055b3",
  "packages/shared/src/components/styles/theme/preview-system.css":
    "5ae21947fe1a6ef149d0411e659826aea3cddfb8",
  "packages/shared/src/renderers/LayoutRenderers.tsx":
    "9c59cfa9008dc7640af5f8e6ffa9b55c003b33d6",
  "packages/shared/src/types/composition-document.types.ts":
    "2b61a10d5c78d655446dd671959fb37e3f085cec",
  "packages/shared/src/types/renderer.types.ts":
    "39ad2ec6a84a99242ed46d2389def535ac6aee95",
  "packages/shared/src/utils/dateFieldDefaults.ts":
    "b2f83522529e4dbf2b5d0388377ceef8c4398b09",
  "packages/specs/src/index.ts": "08522376e62285136892269c720e2e15d4fd712a",
  "packages/specs/src/primitives/colors.ts":
    "2966dc2c450ddf4c9edd89ab3df24326a6a4a2dd",
  "packages/specs/src/primitives/index.ts":
    "5f320bc4e06e957be155a7fa4f286cda2e22286e",
  "packages/specs/src/primitives/spacing.ts":
    "cff4dad0038f3148a3255556d5ba41d6a5134af5",
  "packages/specs/src/renderers/index.ts":
    "3062d240dae995b80ad246f62f93a7f10f9bd9ff",
  "packages/specs/src/renderers/skiaPrimitives.ts":
    "3f502298fa4a04e4440fc3ab1887de2a246efac1",
  "packages/specs/src/renderers/utils/resolveComponentVisual.ts":
    "38181c8a992b9b5efc76020a930a23bf995a8f36",
};
const REMEASURED_PHASE3_REASON =
  "ADR-248 Phase 3 commit: native-state-pinned re-measured byte-identical; storage +519 B constant (budget stricter)";

function assertNewModelUnreachable(
  git: (...args: string[]) => string,
  head: string,
): void {
  let hits: string[] = [];
  try {
    hits = git(
      "grep",
      "-n",
      "-E",
      NEW_MODEL_IMPORT,
      head,
      "--",
      ...SOURCE_ROOTS,
    )
      .split("\n")
      .filter(Boolean);
  } catch {
    hits = []; // git grep exits 1 when nothing matches
  }
  const outside = hits.filter((line) => {
    const file = line.slice(head.length + 1).split(":")[0];
    return (
      !TEST_FILE.test(file) &&
      !NEW_MODEL_ROOTS.some((root) => file.startsWith(root))
    );
  });
  if (outside.length)
    throw new Error(`BASELINE_NEW_MODEL_REACHABLE:${outside.join("|")}`);
}

/** Source text without `//` and block comments; string/template literals are kept intact. */
function stripComments(source: string, css: boolean): string {
  let output = "";
  for (let index = 0; index < source.length;) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (!css && char === "/" && next === "/") {
      const end = source.indexOf("\n", index);
      index = end === -1 ? source.length : end;
      continue;
    }
    if (char === '"' || char === "'" || (!css && char === "`")) {
      let end = index + 1;
      while (end < source.length && source[end] !== char)
        end += source[end] === "\\" ? 2 : 1;
      output += source.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    output += char;
    index++;
  }
  return output.replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n");
}

export function baselineCompatibleHead(
  repo: string,
  baselineHead: string,
): string {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  const head = git("rev-parse", "HEAD").trim();
  if (head === baselineHead) return head;
  try {
    git("merge-base", "--is-ancestor", baselineHead, head);
  } catch {
    throw new Error(`BASELINE_HEAD_NOT_ANCESTOR:${baselineHead}..${head}`);
  }
  const changes = git(
    "diff",
    "--name-status",
    baselineHead,
    head,
    "--",
    ...SOURCE_ROOTS,
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  let newModelChecked = false;
  for (const [status, file] of changes) {
    if (TEST_FILE.test(file)) continue;
    if (NEW_MODEL_ROOTS.some((root) => file.startsWith(root))) {
      if (!newModelChecked) {
        assertNewModelUnreachable(git, head);
        newModelChecked = true;
      }
      continue;
    }
    const reviewed =
      REVIEWED_UNRELATED[file] ??
      (REMEASURED_PHASE3_SOURCE[file]
        ? {
            blob: REMEASURED_PHASE3_SOURCE[file],
            reason: REMEASURED_PHASE3_REASON,
          }
        : undefined);
    if (reviewed) {
      if (reviewed.blob === null) {
        if (status !== "D")
          throw new Error(
            `BASELINE_HEAD_SOURCE_CHANGED:reviewed-deletion:${file}`,
          );
      } else if (git("rev-parse", `${head}:${file}`).trim() !== reviewed.blob)
        throw new Error(`BASELINE_HEAD_SOURCE_CHANGED:reviewed-blob:${file}`);
      continue;
    }
    if (status !== "M")
      throw new Error(`BASELINE_HEAD_SOURCE_CHANGED:${status}:${file}`);
    const css = file.endsWith(".css");
    if (
      stripComments(git("show", `${baselineHead}:${file}`), css) !==
      stripComments(git("show", `${head}:${file}`), css)
    )
      throw new Error(`BASELINE_HEAD_SOURCE_CHANGED:M:${file}`);
  }
  return head;
}
