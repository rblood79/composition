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
export type CatalogComponentsViewId = typeof COMPONENTS_VIEW;
export const isComponentsView = (
  id: string | undefined,
): id is CatalogComponentsViewId => id === COMPONENTS_VIEW;

/** The Components page's root frame. */
export const ORIGIN_VIEW_NODE = "project:node:catalog-origin-view" as NodeId;

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
/** A component's card (its group frame): the origin, its parts and its instances are inside. */
export const originCardId = (originId: LibraryDefinitionId): NodeId =>
  `${CARD_PREFIX}${originId}/card` as NodeId;
/**
 * The instance a card draws to show an origin's parts in place (its template's children, each
 * region outlined by the editor chrome).
 */
export const originPartsId = (originId: LibraryDefinitionId): NodeId =>
  originInstanceId(originId, "parts");
export const isPageParts = (id: string | undefined): boolean =>
  !!id && id.startsWith(INSTANCE_PREFIX) && id.endsWith("/parts");
/** A card of the page: a component's (`originCardId`) or a theme's. */
export const isPageCard = (id: string | undefined): boolean =>
  !!id && id.startsWith(`${ORIGIN_VIEW_NODE}/`) && id.endsWith("/card");
