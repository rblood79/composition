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
): LibraryDefinitionId | undefined =>
  id?.startsWith(SAMPLE_PREFIX)
    ? (id.slice(SAMPLE_PREFIX.length) as LibraryDefinitionId)
    : undefined;

const INSTANCE_PREFIX = `${ORIGIN_VIEW_NODE}/instance/`;
/**
 * An instance the page draws beside an origin's sample (a variant, a state, a size); `key` names
 * it within the origin's card.
 */
export const originInstanceId = (
  originId: LibraryDefinitionId,
  key: string,
): NodeId => `${INSTANCE_PREFIX}${originId}/${key}` as NodeId;
/** The origin whose card a Components page instance is on; `undefined` = not one. */
export const originOfPageInstance = (
  id: string | undefined,
): LibraryDefinitionId | undefined =>
  id?.startsWith(INSTANCE_PREFIX)
    ? (id.slice(INSTANCE_PREFIX.length, id.indexOf("/", INSTANCE_PREFIX.length)) as LibraryDefinitionId)
    : undefined;

const THEME_PREFIX = `${ORIGIN_VIEW_NODE}/theme/`;
/** A theme value the page draws (a color swatch, a type sample, an icon, a spacing box). */
export const themeSampleId = (card: string, name: string): NodeId =>
  `${THEME_PREFIX}${card}/${name}/sample` as NodeId;
export const isThemeSample = (id: string | undefined): boolean =>
  !!id && id.startsWith(THEME_PREFIX) && id.endsWith("/sample");

const CARD_PREFIX = `${ORIGIN_VIEW_NODE}/origin/`;
/** A component's card (its group frame): the origin and its instances are inside. */
export const originCardId = (originId: LibraryDefinitionId): NodeId =>
  `${CARD_PREFIX}${originId}/card` as NodeId;
/** A card of the page: a component's (`originCardId`) or a theme's. */
export const isPageCard = (id: string | undefined): boolean =>
  !!id &&
  (id.startsWith(`${ORIGIN_VIEW_NODE}/`) ||
    id.startsWith(`${PROJECT_ORIGIN_VIEW_NODE}/`)) &&
  id.endsWith("/card");

const PROJECT_CARD_PREFIX = `${PROJECT_ORIGIN_VIEW_NODE}/component/`;
/** A project component's card on the project components page. */
export const projectComponentCardId = (definitionId: string): NodeId =>
  `${PROJECT_CARD_PREFIX}${definitionId}/card` as NodeId;
/** The cell that holds a component's origin node on the project components page. */
export const projectComponentOriginCellId = (definitionId: string): NodeId =>
  `${PROJECT_CARD_PREFIX}${definitionId}/origin` as NodeId;
export const isProjectComponentOriginCell = (id: string | undefined): boolean =>
  !!id && id.startsWith(PROJECT_CARD_PREFIX) && id.endsWith("/origin");

