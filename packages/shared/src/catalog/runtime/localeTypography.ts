import { resolveToken, type TokenRef } from "@composition/rendering";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { CatalogConsumerNode } from "./compositionRoot";
import { catalogAncestorInherited } from "./inheritedProps";
import { installedTypographyOverride } from "./themeMaps";

/** DOM I18nProvider와 같은 host 경계에서 언어를 읽는다. */
export function catalogTypographyLocale(
  node: CatalogConsumerNode,
  get: (id: string) => CatalogConsumerNode | undefined,
  typeOf: (node: CatalogConsumerNode) => string,
  fallback: string | undefined,
): string | undefined {
  return catalogAncestorInherited(node, get, typeOf).locale ?? fallback;
}

/** Rule의 locale 기본값 → Theme의 명시 토큰 → 노드/Library 저작값의 우선순위. */
export function catalogLocaleLineHeight(
  rule: ComponentRule | undefined,
  size: unknown,
  locale: string | undefined,
  explicitVisual: boolean,
): number | undefined {
  if (!rule?.localeTypography || explicitVisual) return undefined;
  const step = rule.sizes[String(size ?? rule.defaultSize)];
  const font = step?.fontSize;
  const token =
    typeof font === "string"
      ? /^\{typography\.(text-[\w-]+)\}$/.exec(font)?.[1]
      : undefined;
  const themeLine =
    token && installedTypographyOverride(`${token}--line-height`);
  if (typeof themeLine === "number" && themeLine > 0) {
    const px = resolveToken(font as TokenRef);
    if (typeof px === "number" && px > 0) return themeLine / px;
  }
  if (!locale) return undefined;
  try {
    return rule.localeTypography[new Intl.Locale(locale).language]?.lineHeight;
  } catch {
    return undefined;
  }
}
