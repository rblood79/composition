import type {
  PropContractMap,
  ReusableCatalogDocument,
  CatalogReusableRoot,
} from "../types";
import { cardReusableDocument } from "./card";
import { sectionReusableDocument } from "./section";

export const reusableCatalogLibrary = {
  "catalog-reusable-card": cardReusableDocument,
  "catalog-reusable-section": sectionReusableDocument,
} as const satisfies Record<string, ReusableCatalogDocument>;

export type ReusableCatalogId = keyof typeof reusableCatalogLibrary;

export function getReusableCatalogDocument(
  reusableId: string,
): ReusableCatalogDocument | undefined {
  return reusableCatalogLibrary[reusableId as ReusableCatalogId];
}

export function getReusableCatalogRoot(
  reusableId: string,
): CatalogReusableRoot | undefined {
  return getReusableCatalogDocument(reusableId)?.children[0];
}

export function getReusableCatalogPropsSchema(
  reusableId: string,
): PropContractMap | undefined {
  return getReusableCatalogRoot(reusableId)?.["x-composition"]?.catalog
    ?.propsSchema;
}

export { cardPropsSchema, cardReusableDocument } from "./card";
export { sectionPropsSchema, sectionReusableDocument } from "./section";
