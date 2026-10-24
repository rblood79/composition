import type { LibraryDefinitionId, NodeId } from "../document/types";

/**
 * The Components page view (user 2026-10-05): the Builder draws every built-in component origin
 * on one derived page — a sample of each origin with its state variants as instances beside it,
 * grouped by palette category. The page is graph view entries (never saved): `ORIGIN_VIEW_NODE`
 * is its root frame, `originSampleId` an origin's sample, `originInstanceId` an instance beside it. `originView` (Builder) builds
 * the entries and holds the edit rules. A leaf: the composition root reads it in the Preview too
 * (G5 bundle gate).
 */
export const COMPONENTS_VIEW = "view:components";
/**
 * The project's components page (user 2026-10-14): one derived page that lists every component
 * made with Create component, as the Components page lists the built-in origins. A card draws
 * the origin node itself (ADR-260 — it stands on a page; the card shows that very node, so an
 * edit there is an edit of the origin) and an instance beside it.
 */
export const PROJECT_COMPONENTS_VIEW = "view:project-components";
export type CatalogComponentsViewId =
  | typeof COMPONENTS_VIEW
  | typeof PROJECT_COMPONENTS_VIEW;
/** Either derived components page (the built-in origins, or the project's components). */
export const isComponentsView = (
  id: string | undefined,
): id is CatalogComponentsViewId =>
  id === COMPONENTS_VIEW || id === PROJECT_COMPONENTS_VIEW;
export const isProjectComponentsView = (
  id: string | undefined,
): id is typeof PROJECT_COMPONENTS_VIEW => id === PROJECT_COMPONENTS_VIEW;

/** The Components page's root frame. */
export const ORIGIN_VIEW_NODE = "project:node:catalog-origin-view" as NodeId;
/**
 * The project components page's root frame (its own id: the read model keeps rows by identity,
 * and the two pages are different trees). It starts with `ORIGIN_VIEW_NODE`, so a check for a
 * derived page node (`startsWith(ORIGIN_VIEW_NODE)`) takes both pages.
 */
export const PROJECT_ORIGIN_VIEW_NODE =
  "project:node:catalog-origin-view-project" as NodeId;
/** The root frame a derived components page draws. */
export const componentsViewRoot = (view: CatalogComponentsViewId): NodeId =>
  isProjectComponentsView(view) ? PROJECT_ORIGIN_VIEW_NODE : ORIGIN_VIEW_NODE;
/** A derived components page's root frame. */
export const isComponentsViewRoot = (id: string | undefined): boolean =>
  id === ORIGIN_VIEW_NODE || id === PROJECT_ORIGIN_VIEW_NODE;

/**
 * ADR-282 Phase 3 — a Components page node stored in the document (the page made the first time
 * the tab opens it) takes a short id (user 2026-10-25 「Library 가 왜 1mb」 — the view's path ids
 * averaged 99 B and every parent's children list repeats them): `project:node:cp-` + the node's
 * role on the page (`card` · `inst` — an instance beside an origin · `theme` — a theme value ·
 * `origin` — a Library ◆ holder · `local` — a Local ◆ cell; none for a frame or a caption) + a
 * hash of its view id. The roots keep their ids (`ORIGIN_VIEW_NODE` · `PROJECT_ORIGIN_VIEW_NODE`).
 * The role helpers below read either form.
 */
export const componentPageNodeId = (viewId: string): NodeId => {
  if (!isPageViewNode(viewId)) return viewId as NodeId;
  const role = viewRole(viewId);
  return `${STORED_PREFIX}${role ? `${role}-` : ""}${hash53(viewId)}` as NodeId;
};
const STORED_PREFIX = "project:node:cp-";
/** A derived page's node under either root (not a root itself). */
const isPageViewNode = (id: string) =>
  id.startsWith(`${ORIGIN_VIEW_NODE}/`) ||
  id.startsWith(`${PROJECT_ORIGIN_VIEW_NODE}/`);
/** A components page's own node — a view's, or one its stored page holds (not a root). */
export const isComponentPageNode = (id: string | undefined): boolean =>
  !!id && (isPageViewNode(id) || id.startsWith(STORED_PREFIX));
type StoredRole = "card" | "inst" | "theme" | "origin" | "local";
/** The role a stored page node carries in its id (`undefined` = a view id, or no role). */
const storedRole = (id: string): StoredRole | undefined => {
  if (!id.startsWith(STORED_PREFIX)) return undefined;
  const role = id.slice(STORED_PREFIX.length).split("-")[0];
  return role === "card" ||
    role === "inst" ||
    role === "theme" ||
    role === "origin" ||
    role === "local"
    ? role
    : undefined;
};
/** A 53-bit string hash (cyrb53) in base 36 — stable across sessions. */
function hash53(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export const isLibraryOrigin = (
  id: string | undefined,
): id is LibraryDefinitionId => !!id && id.startsWith("lib:definition:origin-");

const SAMPLE_PREFIX = `${ORIGIN_VIEW_NODE}/sample/`;
/** The node the Components page draws for a library origin: its one editable sample. */
export const originSampleId = (definitionId: LibraryDefinitionId): NodeId =>
  `${SAMPLE_PREFIX}${definitionId}` as NodeId;
/** The library origin a Components page node is the sample of; `undefined` = not one. */
export const originOfSample = (
  id: string | undefined,
): LibraryDefinitionId | undefined => {
  return id?.startsWith(SAMPLE_PREFIX)
    ? (id.slice(SAMPLE_PREFIX.length) as LibraryDefinitionId)
    : undefined;
};

const INSTANCE_PREFIX = `${ORIGIN_VIEW_NODE}/instance/`;
/**
 * An instance the page draws beside an origin's sample (a variant, a state, a size); `key` names
 * it within the origin's card.
 */
export const originInstanceId = (
  originId: LibraryDefinitionId,
  key: string,
): NodeId => `${INSTANCE_PREFIX}${originId}/${key}` as NodeId;
/**
 * Whether a Components page node is an instance beside an origin (a variant, a state — stored or
 * a view's).
 */
export const isPageInstance = (id: string | undefined): boolean =>
  !!id && (id.startsWith(INSTANCE_PREFIX) || storedRole(id) === "inst");
/** The origin whose card a derived Components page instance is on; `undefined` = not one. */
export const originOfPageInstance = (
  id: string | undefined,
): LibraryDefinitionId | undefined => {
  return id?.startsWith(INSTANCE_PREFIX)
    ? (id.slice(
        INSTANCE_PREFIX.length,
        id.indexOf("/", INSTANCE_PREFIX.length),
      ) as LibraryDefinitionId)
    : undefined;
};

const THEME_PREFIX = `${ORIGIN_VIEW_NODE}/theme/`;
/** A theme value the page draws (a color swatch, a type sample, an icon, a spacing box). */
export const themeSampleId = (card: string, name: string): NodeId =>
  `${THEME_PREFIX}${card}/${name}/sample` as NodeId;
export const isThemeSample = (id: string | undefined): boolean =>
  !!id &&
  ((id.startsWith(THEME_PREFIX) && id.endsWith("/sample")) ||
    storedRole(id) === "theme");

const CARD_PREFIX = `${ORIGIN_VIEW_NODE}/origin/`;
/** A component's card (its group frame): the origin and its instances are inside. */
export const originCardId = (originId: LibraryDefinitionId): NodeId =>
  `${CARD_PREFIX}${originId}/card` as NodeId;
/** A card of the page: a component's (`originCardId`) or a theme's. */
export const isPageCard = (id: string | undefined): boolean =>
  !!id &&
  ((isPageViewNode(id) && id.endsWith("/card")) ||
    storedRole(id) === "card");

const PROJECT_CARD_PREFIX = `${PROJECT_ORIGIN_VIEW_NODE}/component/`;
/** A project component's card on the project components page. */
export const projectComponentCardId = (definitionId: string): NodeId =>
  `${PROJECT_CARD_PREFIX}${definitionId}/card` as NodeId;
/** The cell that holds a component's origin node on the project components page. */
export const projectComponentOriginCellId = (definitionId: string): NodeId =>
  `${PROJECT_CARD_PREFIX}${definitionId}/origin` as NodeId;
export const isProjectComponentOriginCell = (
  id: string | undefined,
): boolean =>
  !!id &&
  ((id.startsWith(PROJECT_CARD_PREFIX) && id.endsWith("/origin")) ||
    storedRole(id) === "local");
/**
 * ADR-282: the Library page nodes that hold an origin's ◆ (a card's Origin line, an overlay's body
 * line, a collection card's Item line) — an unlocked origin's copy root stands there.
 */
export const isLibraryOriginCell = (id: string | undefined): boolean =>
  !!id &&
  ((id.startsWith(`${ORIGIN_VIEW_NODE}/origin/`) &&
    (id.endsWith("/line/origin/1") ||
      id.endsWith("/origin/body-line") ||
      id.endsWith("/line/items/1"))) ||
    storedRole(id) === "origin");

/**
 * A Library page node that may hold an origin's ◆ (an unlocked origin's copy root stands there):
 * a ◆ line or body line, or a card of the Origin line alone (user 2026-10-25).
 */
export const holdsLibraryOrigin = (id: string | undefined): boolean =>
  isLibraryOriginCell(id) || isPageCard(id);

/** The role a view id's node takes on its stored page (`componentPageNodeId`). */
function viewRole(id: string): StoredRole | undefined {
  if (isPageCard(id)) return "card";
  if (isPageInstance(id)) return "inst";
  if (isThemeSample(id)) return "theme";
  if (isLibraryOriginCell(id)) return "origin";
  if (isProjectComponentOriginCell(id)) return "local";
  return undefined;
}
