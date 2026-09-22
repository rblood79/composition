import {
  migrateDialogTriggerInstances,
  LEGACY_DIALOG_CONTENT_ID,
} from "./migrateDialogTriggerInstances";
import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import {
  PALETTE_REUSABLE_ORIGIN_TYPES,
  catalogReusableOriginId,
  getReusableEntry,
} from "@composition/shared";
import { getComponentDefinitionCreator } from "../factories/componentDefinitions";
import { COMPLEX_COMPONENT_TAGS } from "../factories/constants";
import { composeCreationProps } from "../factories/creationStyleDefaults";
import type {
  ChildDefinition,
  ComponentCreationContext,
} from "../factories/types";
import { getDefaultProps } from "../../types/builder/unified.types";
import { applyFactoryPropagation } from "../utils/propagationEngine";
import { applyCanonicalDocumentMigrations } from "../../adapters/canonical/canonicalDocumentMigrations";
import { ensureTemplateOrigins } from "./ensureTemplateOrigins";

/**
 * ADR-228 — catalog 파생 generic origin seed (Decision 2).
 *
 * 팔레트의 RAC 컴포넌트 52 종 (`PALETTE_REUSABLE_ORIGIN_TYPES`) 은 손 seed 모듈 없이 **현행
 * 팔레트 생성 경로가 만드는 것과 같은 노드** 를 Components 페이지 origin 으로 시드한다:
 *
 * - leaf (COMPLEX 밖 — Button · Badge · Link · Chart …): `useElementCreator` else 분기와 같은
 *   `composeCreationProps(type, getDefaultProps(type))` (catalog defaults + FACTORY_LOCAL_DEFAULTS
 *   + 생성 style). 생성 진입점 initialProps (Chart 종류) 는 origin 에 넣지 않는다 — instance
 *   override 소유 (§3.2).
 * - complex (COMPLEX 멤버 — TextField · Select · Table …): `componentDefinitions.getComponentDefinitionCreator`
 *   의 **순수 definition** (root props + 자식 definition) 을 합성 context 로 호출해
 *   `applyFactoryPropagation` (ADR-048 seed 시점 전파) 까지 거친 뒤 canonical subtree 로 옮긴다 —
 *   `createComponent` 가 store 에 넣는 것과 같은 트리, store/DB mutation 0. 자식 id 는 origin id
 *   에서 경로로 파생해 재hydration 마다 새로 발급되지 않는다.
 * - 이미 ref 인 definition (ListBox/GridList → template origin) 은 이 모듈 대상이 아니다 —
 *   기존 `ensure*TemplateOrigins` 가 그 origin 을 소유한다 (`reusableCompositeOrigins.ts`).
 *
 * `metadata.propsSchema` 는 복제하지 않는다 — 편집 계약은 `resolveEditContract` (A″) 가 origin
 * type 의 catalog accepts 를 직접 읽는다 (passthrough schema 와 동치, breakdown §8.4-1).
 */

export const CATALOG_ORIGIN_METADATA_TYPE = "catalog-origin";

const SEED_CONTEXT: ComponentCreationContext = {
  parentElement: null,
  pageId: "",
  elements: [],
  doc: { version: "composition-1.0", children: [] },
};

/** ChildDefinition 중 canonical 노드로 옮길 필드 (Element 전용 필드 — parent_id/page_id/customId — 는 버린다). */
type SeedElement = {
  id: string;
  type: string;
  parent_id: string | null;
  props: Record<string, unknown>;
  extra: Partial<
    Pick<
      CanonicalNode,
      "name" | "slot" | "metadata" | "fills" | "reusable" | "sizing"
    >
  >;
};

function pickCanonicalExtras(
  definition: Omit<ChildDefinition, "children">,
): SeedElement["extra"] {
  const source = definition as Record<string, unknown>;
  const extra: SeedElement["extra"] = {};
  if (typeof source.name === "string") extra.name = source.name;
  if (source.slot !== undefined)
    extra.slot = source.slot as CanonicalNode["slot"];
  if (source.metadata !== undefined)
    extra.metadata = source.metadata as CanonicalNode["metadata"];
  if (Array.isArray(source.fills)) extra.fills = source.fills;
  if (source.reusable === true) extra.reusable = true;
  if (source.sizing !== undefined)
    extra.sizing = source.sizing as CanonicalNode["sizing"];
  return extra;
}

/**
 * definition 트리를 안정 id 의 평탄 element 목록으로 (parent 먼저, DFS 순).
 * id = `<originId>__<index path>` — 재hydration 에 같은 id, 문서 내 `/` 없음.
 */
function flattenDefinitionChildren(
  originId: string,
  children: readonly ChildDefinition[],
  parentId: string,
  path: readonly number[],
  out: SeedElement[],
): void {
  children.forEach((child, index) => {
    const { children: nested, ...definition } = child;
    const nextPath = [...path, index + 1];
    const id = `${originId}__${nextPath.join("_")}`;
    out.push({
      id,
      type: definition.type,
      parent_id: parentId,
      props: { ...((definition.props ?? {}) as Record<string, unknown>) },
      extra: pickCanonicalExtras(definition),
    });
    if (nested && nested.length > 0) {
      flattenDefinitionChildren(originId, nested, id, nextPath, out);
    }
  });
}

function nestSeedElements(
  parentId: string,
  elements: readonly SeedElement[],
): CanonicalNode[] {
  return elements
    .filter((element) => element.parent_id === parentId)
    .map((element) => {
      const children = nestSeedElements(element.id, elements);
      return {
        id: element.id,
        type: element.type as CanonicalNode["type"],
        props: element.props,
        ...element.extra,
        ...(children.length > 0 ? { children } : {}),
      };
    });
}

/**
 * type 의 generic origin 을 현행 생성 경로와 같은 내용으로 만든다 (기존 origin 없음 가정 —
 * 기존이 있으면 `repairCatalogOrigin` 이 이 결과를 base 로 사용자 값을 보존한다).
 */
export function buildCatalogOrigin(type: string): CanonicalNode {
  return normalizeSeed(buildRawCatalogOrigin(type));
}

/**
 * seed 를 로드 시 형태 migration (`applyCanonicalDocumentMigrations` — circle leaf stale inline
 * diameter · field inline layout · ColorField label · Checkbox/Radio items) 에 통과시킨다.
 * factory 기본값에는 migration 이 지우는 잔재 (ProgressCircle `style.width/height 32`) 가 남아
 * 있어, 그대로 시드하면 다음 로드의 migration 이 origin 을 바꿔 재hydration Δ≠0 이 된다.
 * origin = **정규화 뒤의 노드** 가 정의다.
 */
function normalizeSeed(origin: CanonicalNode): CanonicalNode {
  const migrated = applyCanonicalDocumentMigrations({
    version: "composition-1.0",
    children: [origin],
  });
  return migrated.children[0] ?? origin;
}

/** creationVariants 전부가 같은 값으로 싣는 initialProps 키 — origin 이 소유할 공통 기본값. */
function commonCreationVariantProps(
  type: string,
): Record<string, unknown> | undefined {
  const variants = getReusableEntry(type)?.panel.creationVariants;
  if (!variants || variants.length === 0) return undefined;
  const [first, ...rest] = variants;
  const common: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(first.initialProps)) {
    const encoded = JSON.stringify(value);
    if (
      rest.every(
        (variant) =>
          Object.hasOwn(variant.initialProps, key) &&
          JSON.stringify(variant.initialProps[key]) === encoded,
      )
    ) {
      common[key] = value;
    }
  }
  return common;
}

function buildRawCatalogOrigin(type: string): CanonicalNode {
  const originId = catalogReusableOriginId(type);
  const metadata: CanonicalNode["metadata"] = {
    type: CATALOG_ORIGIN_METADATA_TYPE,
    systemOwned: true,
    componentFamily: type,
  };

  const definitionCreator = COMPLEX_COMPONENT_TAGS.has(type)
    ? getComponentDefinitionCreator(type)
    : undefined;
  if (!definitionCreator) {
    // leaf — 팔레트 else 분기와 같은 합성. 진입점이 여럿인 type (Chart creationVariants 7) 은
    //   모든 진입점이 같은 값으로 명시하는 키 (공통 기본값) 만 origin 이 소유하고, 진입점마다
    //   갈리는 키 (chartType · orientation …) 는 instance patch 로 남긴다 (§3.2).
    return {
      id: originId,
      type: type as CanonicalNode["type"],
      name: type,
      reusable: true,
      props: composeCreationProps(
        type,
        getDefaultProps(type),
        commonCreationVariantProps(type),
      ),
      metadata,
    };
  }

  const definition = definitionCreator(SEED_CONTEXT);
  if (definition.parent.type === "ref") {
    throw new Error(
      `[catalogOrigins] "${type}" 의 factory definition 이 이미 ref (${String(
        (definition.parent as { ref?: unknown }).ref,
      )}) — template origin 을 reusableId 로 재사용해야 하며 generic seed 대상이 아니다`,
    );
  }
  const rootProps = {
    ...((definition.parent.props ?? {}) as Record<string, unknown>),
  };
  const root: SeedElement = {
    id: originId,
    type: definition.parent.type,
    parent_id: null,
    props: rootProps,
    extra: pickCanonicalExtras(definition.parent as ChildDefinition),
  };
  const flat: SeedElement[] = [];
  flattenDefinitionChildren(originId, definition.children, originId, [], flat);
  // ADR-048 factory 전파 — createElementsFromDefinition 과 같은 함수로 seed 시점 자식 값을 맞춘다.
  const propagated = applyFactoryPropagation(root, flat);
  const children = nestSeedElements(originId, propagated);

  return {
    id: originId,
    type: definition.parent.type as CanonicalNode["type"],
    name: type,
    reusable: true,
    props: rootProps,
    ...root.extra,
    ...(children.length > 0 ? { children } : {}),
    metadata: { ...(root.extra.metadata ?? {}), ...metadata },
  };
}

/**
 * 기존 origin 보존 + 결손 보강 (IconButton `repairOrigin` 과 같은 원칙):
 * root props 는 **부재 키만** base 로 채우고 (schema 진화 · 사용자 값 우선), children ·
 * responsive · slot · fills 는 기존 그대로 (사용자 편집 보존), metadata 는 코드 정본
 * (systemOwned · componentFamily) 을 확정한다. 기존이 없으면 base.
 */
export function repairCatalogOrigin(
  existing: CanonicalNode | undefined,
  base: CanonicalNode,
): CanonicalNode {
  if (!existing) return base;
  // 기존 시스템 Dialog 본문을 새 trigger의 자식으로 옮긴다. origin ID와 기존
  // 자식 ID는 유지하므로 ref와 사용자 콘텐츠 참조가 끊기지 않는다.
  if (existing.type === "Dialog" && base.type === "DialogTrigger") {
    const { id, name, reusable, metadata, ...content } = existing;
    return {
      ...base,
      id,
      name: name ?? base.name,
      reusable,
      metadata: {
        ...base.metadata,
        ...metadata,
        type: metadata?.type ?? CATALOG_ORIGIN_METADATA_TYPE,
      },
      children: [
        { ...base.children![0], id: `${id}--trigger` },
        { ...content, id: LEGACY_DIALOG_CONTENT_ID, type: "Dialog" },
      ],
    };
  }
  const hasExistingChildren = Array.isArray(existing.children);
  return {
    ...base,
    ...existing,
    props: { ...(base.props ?? {}), ...(existing.props ?? {}) },
    ...(hasExistingChildren
      ? { children: existing.children }
      : base.children
        ? { children: base.children }
        : {}),
    reusable: true,
    metadata: {
      ...(base.metadata ?? {}),
      ...(existing.metadata ?? {}),
      type:
        existing.metadata?.type ??
        base.metadata?.type ??
        CATALOG_ORIGIN_METADATA_TYPE,
      systemOwned: true,
      componentFamily: base.metadata?.componentFamily,
    },
  };
}

/**
 * factory definition 이 이미 `type:"ref"` (template origin) 인 type — generic seed 대상이 아니라
 * 기존 `ensure*TemplateOrigins` 가 소유한다. 정적 집합으로 두어 모듈 로드 시 factory 를 평가하지
 * 않는다 (import 순환 회피); 집합 ↔ definition 실측 일치는 `catalogOrigins.test.ts` 가 강제.
 */
export const TEMPLATE_ORIGIN_REUSABLE_TYPES: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
  // ADR-229 Phase 1: definition 은 plain 이지만 chip item template origin (`component-tag-item-*`)
  //   의 slot 보유자가 origin 의 TagList 자식이라 generic 경로가 표현하지 못한다 — 손 ensurer
  //   (`taggroup/tagGroupTemplateOrigins.ts`) 가 generic 과 같은 트리 + slot 을 시드한다.
  "TagGroup",
]);

/** generic seed 대상 type — `PALETTE_REUSABLE_ORIGIN_TYPES` − template origin 보유 3. */
export function getCatalogOriginTypes(): readonly string[] {
  return PALETTE_REUSABLE_ORIGIN_TYPES.filter(
    (type) => !TEMPLATE_ORIGIN_REUSABLE_TYPES.has(type),
  );
}

const CATALOG_ORIGIN_IDS: ReadonlySet<string> = new Set(
  getCatalogOriginTypes().map(catalogReusableOriginId),
);

export function isCatalogOriginId(id: string): boolean {
  return CATALOG_ORIGIN_IDS.has(id);
}

/**
 * 활성 generic origin을 Components page body에 보장한다 (멱등).
 * 은퇴한 Modal은 외부 ref가 사용 중일 때만 보강하고, 미사용 시스템 원본은 정리한다.
 */
export function ensureCatalogOrigins(
  document: CompositionDocument,
): CompositionDocument {
  document = migrateDialogTriggerInstances(document);
  // Modal은 팔레트에서 은퇴했다. 기존 인스턴스가 참조할 때만 호환 원본을 유지한다.
  const modalId = catalogReusableOriginId("Modal");
  const modalNodeIds = new Set([modalId]);
  const refs = new Set<string>();
  const collect = (
    nodes: readonly (Partial<CanonicalNode> & {
      ref?: string;
      descendants?: RefNode["descendants"];
    })[],
    insideModal = false,
  ): void => {
    for (const node of nodes) {
      const isModal = insideModal || node.id === modalId;
      if (isModal && node.id) modalNodeIds.add(node.id);
      if (!isModal && typeof node.ref === "string") refs.add(node.ref);
      collect(node.children ?? [], isModal);
      collect(Object.values(node.descendants ?? {}), isModal);
    }
  };
  collect(document.children);
  const needsModal = [...refs].some((ref) => modalNodeIds.has(ref));
  const removeUnusedModal = (nodes: CanonicalNode[]): CanonicalNode[] => {
    let changed = false;
    const next = nodes.flatMap((node) => {
      if (node.id === modalId && node.metadata?.systemOwned === true) {
        changed = true;
        return [];
      }
      if (!node.children) return [node];
      const children = removeUnusedModal(node.children);
      if (children === node.children) return [node];
      changed = true;
      return [{ ...node, children }];
    });
    return changed ? next : nodes;
  };
  const children = needsModal
    ? document.children
    : removeUnusedModal(document.children);
  const source =
    children === document.children ? document : { ...document, children };
  const types = getCatalogOriginTypes().filter(
    (type) => type !== "Modal" || needsModal,
  );
  return ensureTemplateOrigins(source, CATALOG_ORIGIN_IDS, (existing) =>
    types.map((type) =>
      repairCatalogOrigin(
        existing.get(catalogReusableOriginId(type)),
        buildCatalogOrigin(type),
      ),
    ),
  );
}
