/**
 * ADR-303 Phase 2 — 「자식은 컨테이너 배경을 따른다」 의 판정 하나.
 *
 * rule 값 `{color.container}` = 가장 가까운 컨테이너 조상의 배경 층 (없으면 `base`) — S2 의
 * `--s2-container-bg` (`Provider.tsx` · `Popover.tsx` · `Card.tsx` · `Modal.tsx`) 와 같은 뜻이다.
 * 컨테이너 = 배경이 층 역할 (`base` · `layer-1` · `layer-2` · `elevated` · `pasteboard`) 로 풀리는 노드:
 * 작성한 칠 (Fill 패널) 의 맨 위 층이 층 토큰이거나, 칠이 없고 rule 의 휴지 배경이 층 토큰이다.
 * 임의 hex · 그라데이션 · 이미지 칠은 컨테이너가 아니다 (층만 물려준다 — 그 위 자식은 상위 층을 따른다).
 *
 * 두 consumer 가 이 함수 하나를 읽는다 — Canvas 는 `presence.ts` 파생 `_containerLayer` →
 * `resolveCatalogPaint`, DOM 은 컨테이너 노드의 inline `--container-bg` (`domBinding.runtime.ts`) 를
 * 자식의 `var(--container-bg, var(--bg))` 가 CSS 상속으로 읽는다.
 */
import { tokenToCSSVar, type TokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { evaluatePaint } from "../rule/rulePaintTree";
import { resolveCatalogVariantName } from "../resolvers/resolveCatalogVariantName";
import { catalogFillTokenRef } from "../resolution/resolver";
import type { ComponentRule } from "../../types/catalog-style.types";
import type { CatalogConsumerNode } from "./compositionRoot";

export const CATALOG_LAYER_ROLES = [
  "base",
  "layer-1",
  "layer-2",
  "elevated",
  "pasteboard",
] as const;
export type CatalogLayerRole = (typeof CATALOG_LAYER_ROLES)[number];

/** The rule value a child writes to follow its container (`tokenResolver` — `--container-bg`). */
export const CATALOG_CONTAINER_TOKEN = "{color.container}";

const LAYER_OF_REF: ReadonlyMap<string, CatalogLayerRole> = new Map(
  CATALOG_LAYER_ROLES.map((role) => [`{color.${role}}`, role]),
);

type ContainerNode = Pick<CatalogConsumerNode, "props" | "fills" | "ruleId">;

const RULES = COMPONENT_RULES_TABLE as Readonly<Record<string, ComponentRule>>;

/**
 * The background layer a node gives its children, else undefined (not a container — its children
 * follow the layer above it).
 */
export function catalogContainerLayerOf(
  node: ContainerNode,
): CatalogLayerRole | undefined {
  // (bottom → top — the last enabled layer is what shows)
  const fills = node.fills ?? [];
  let top: (typeof fills)[number] | undefined;
  for (let index = fills.length - 1; index >= 0 && !top; index -= 1)
    if (fills[index].enabled !== false) top = fills[index];
  if (top) {
    if (top.kind !== "color" || top.opacity !== 1) return undefined;
    const ref = catalogFillTokenRef(top);
    return ref ? LAYER_OF_REF.get(ref) : undefined;
  }
  if (!node.ruleId || !catalogLayerRules().has(node.ruleId)) return undefined;
  const rule = RULES[node.ruleId];
  const variantName = resolveCatalogVariantName(rule, node.props);
  const tree = variantName
    ? rule.variants[variantName]?.paint?.backgroundColor
    : undefined;
  const rest = evaluatePaint(tree, { isQuiet: node.props.isQuiet === true });
  return rest === undefined ? undefined : LAYER_OF_REF.get(rest);
}

/** The layer of the nearest container ancestor (`base` when none) — what `{color.container}` reads. */
export function catalogContainerLayerAbove(
  node: Pick<CatalogConsumerNode, "parentId">,
  get: (id: string) => CatalogConsumerNode | undefined,
): CatalogLayerRole {
  for (let up = get(node.parentId); up; up = get(up.parentId)) {
    const layer = catalogContainerLayerOf(up);
    if (layer) return layer;
  }
  return "base";
}

const mentions =
  (match: (value: unknown) => boolean) =>
  (value: unknown): boolean =>
    match(value) ||
    (typeof value === "object" &&
      value !== null &&
      Object.values(value).some(mentions(match)));
const mentionsContainer = mentions(
  (value) => value === CATALOG_CONTAINER_TOKEN,
);
const mentionsLayer = mentions(
  (value) => typeof value === "string" && LAYER_OF_REF.has(value),
);

let layerRules: ReadonlySet<string> | undefined;
/** Rules whose some variant's background tree names a layer token — the only rule-backed containers. */
function catalogLayerRules(): ReadonlySet<string> {
  layerRules ??= new Set(
    Object.entries(RULES)
      .filter(([, rule]) =>
        Object.values(rule.variants ?? {}).some((variant) =>
          mentionsLayer(variant?.paint?.backgroundColor),
        ),
      )
      .map(([type]) => type),
  );
  return layerRules;
}

let readers: ReadonlySet<string> | undefined;
/** Rules that read `{color.container}` — the records the Canvas derives `_containerLayer` for. */
export function catalogContainerReaders(): ReadonlySet<string> {
  readers ??= new Set(
    Object.entries(RULES)
      .filter(([, rule]) => mentionsContainer(rule))
      .map(([type]) => type),
  );
  return readers;
}

/** ADR-303 — the inline variable a container gives its children (its layer token's own variable). */
export function catalogContainerCss(
  style: Record<string, unknown>,
  node: ContainerNode,
): void {
  const layer = catalogContainerLayerOf(node);
  if (layer)
    style["--container-bg"] = tokenToCSSVar(`{color.${layer}}` as TokenRef);
}
