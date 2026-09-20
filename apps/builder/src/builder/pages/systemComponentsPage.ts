import {
  COMPONENTS_PAGE_ROLE,
  COMPONENTS_PAGE_SLUG,
  type CanonicalNode,
  type CompositionDocument,
  isEditorPageNode,
  isComponentsPageMetadata,
} from "@composition/shared";

export const COMPONENTS_SYSTEM_PAGE_ID = "page-components";
export const COMPONENTS_SYSTEM_PAGE_TITLE = "Components";
export const COMPONENTS_SYSTEM_BODY_ID = "page-components-body";

type PageLike = {
  id?: string;
  title?: string | null;
  slug?: string | null;
  pageRole?: unknown;
  systemOwned?: unknown;
};

function normalizeSlug(slug: string | null | undefined): string {
  if (!slug) return "";
  return slug.startsWith("/") ? slug : `/${slug}`;
}

// 시스템 페이지 body 기본 style — overflow:auto 를 **실제 props.style 로** 부여.
//   Why: 스크롤 동작/렌더/휠 4 소비자(fullTreeLayout GAP4 maxScroll / buildSpecNodeData
//   scrollbar shape / buildBoxNodeData / useScrollWheelInteraction)가 전부 raw
//   element.props.style.overflow 를 읽는다 — catalog containerStyles fallback 은
//   buildNodeStyle(layout) + 패널만 소비하므로, catalog 기본값만으로는 콘텐츠가 페이지 높이
//   (pageHeight, 기본 1080)를 넘어도 maxScrollTop 이 0 에 머물러 스크롤바가 안 나온다.
//   일반 사용자 페이지는 createDefaultBodyProps 로 이미 overflow:auto 를 real style 로 갖는다 —
//   시스템 페이지(props:{})만 이 채널을 빠뜨려 비대칭이었다. (2026-07-21 사용자 보고)
const SYSTEM_PAGE_BODY_PROPS: Record<string, unknown> = {
  style: { overflow: "auto" },
};

/**
 * ADR-228 Decision 4 — Components 페이지 body 는 origin 전집 (R 57 + item template + 사용자 origin)
 * 을 **카테고리 순 grid** 로 보인다: flex wrap 흐름 (한 줄에 여러 origin, 넘치면 다음 줄) + 간격.
 * 세로 한 줄 stack (block) 이면 57 origin 이 3천 px 를 넘게 쌓여 페이지가 "전집" 으로 읽히지 않는다.
 * 순서는 siblings 순서 (= seed 순서 · 사용자 이동) 그대로 — 여기서는 흐름만 정한다.
 * 기존 문서에는 **부재 키만** 채운다 (사용자가 body style 을 만졌으면 그 값 우선).
 */
const COMPONENTS_BODY_GRID_STYLE: Record<string, unknown> = {
  display: "flex",
  flexDirection: "row",
  flexWrap: "wrap",
  alignItems: "flex-start",
  alignContent: "flex-start",
  gap: 24,
  padding: 24,
};

// 기존 프로젝트의 시스템 페이지 body(props:{})에 overflow:auto 를 1회 보강(migration).
//   사용자/기존 명시 overflow 는 보존(덮어쓰기 금지). 보강 대상이 없으면 원본 children 참조를
//   그대로 반환해 idempotent(불필요한 re-persist 방지).
function ensureBodyOverflowAuto(
  children: CanonicalNode[] | undefined,
): CanonicalNode[] | undefined {
  if (!children) return children;
  let mutated = false;
  const next = children.map((child) => {
    // "body" 는 ComponentTag 리터럴 유니온 밖(생성부도 `as CanonicalNode["type"]` 캐스트) →
    //   비교는 string 으로 좁힌다.
    if ((child.type as string) !== "body") return child;
    const style = (child.props?.style ?? {}) as Record<string, unknown>;
    const nextStyle: Record<string, unknown> = { ...style };
    if (style.overflow == null) nextStyle.overflow = "auto";
    // ADR-228: grid 흐름 키도 부재 시에만.
    for (const [key, value] of Object.entries(COMPONENTS_BODY_GRID_STYLE)) {
      if (nextStyle[key] == null) nextStyle[key] = value;
    }
    if (Object.keys(nextStyle).length === Object.keys(style).length)
      return child;
    mutated = true;
    return {
      ...child,
      props: { ...child.props, style: nextStyle },
    };
  });
  return mutated ? next : children;
}

export function isComponentsPageMirror(page: PageLike): boolean {
  return (
    page.pageRole === COMPONENTS_PAGE_ROLE ||
    (page.systemOwned === true &&
      normalizeSlug(page.slug) === COMPONENTS_PAGE_SLUG) ||
    page.id === COMPONENTS_SYSTEM_PAGE_ID ||
    normalizeSlug(page.slug) === COMPONENTS_PAGE_SLUG
  );
}

export function countUserPagesForAutoName(pages: PageLike[]): number {
  return pages.filter((page) => !isComponentsPageMirror(page)).length;
}

function createComponentsPageNode(): CanonicalNode {
  return {
    id: COMPONENTS_SYSTEM_PAGE_ID,
    type: "frame",
    name: COMPONENTS_SYSTEM_PAGE_TITLE,
    metadata: {
      type: "legacy-page",
      pageId: COMPONENTS_SYSTEM_PAGE_ID,
      slug: COMPONENTS_PAGE_SLUG,
      parent_id: null,
      pageRole: COMPONENTS_PAGE_ROLE,
      systemOwned: true,
      previewExcluded: true,
      publishExcluded: true,
      excludeFromAutoNameCount: true,
    },
    children: [
      {
        id: COMPONENTS_SYSTEM_BODY_ID,
        type: "body" as CanonicalNode["type"],
        props: {
          style: {
            ...(SYSTEM_PAGE_BODY_PROPS.style as Record<string, unknown>),
            ...COMPONENTS_BODY_GRID_STYLE,
          },
        },
      },
    ],
  };
}

function createFallbackHomePageNode(): CanonicalNode {
  return {
    id: "page-home",
    type: "frame",
    name: "Home",
    metadata: {
      type: "legacy-page",
      pageId: "page-home",
      slug: "/",
      parent_id: null,
    },
    children: [
      {
        id: "page-home-body",
        type: "body" as CanonicalNode["type"],
        props: { ...SYSTEM_PAGE_BODY_PROPS },
      },
    ],
  };
}

function isComponentsPageNodeCandidate(node: CanonicalNode): boolean {
  const metadata = node.metadata;
  return (
    isComponentsPageMetadata(metadata) ||
    node.id === COMPONENTS_SYSTEM_PAGE_ID ||
    (metadata?.systemOwned === true &&
      metadata.slug === COMPONENTS_PAGE_SLUG) ||
    metadata?.slug === COMPONENTS_PAGE_SLUG
  );
}

function repairComponentsPageNode(node: CanonicalNode): CanonicalNode {
  const metadata = {
    ...(node.metadata ?? { type: "legacy-page" }),
    type: node.metadata?.type === "page" ? "page" : "legacy-page",
    pageId: node.id,
    slug: COMPONENTS_PAGE_SLUG,
    parent_id: null,
    pageRole: COMPONENTS_PAGE_ROLE,
    systemOwned: true,
    previewExcluded: true,
    publishExcluded: true,
    excludeFromAutoNameCount: true,
  };
  delete (metadata as Record<string, unknown>).order_num;

  return {
    ...node,
    name: COMPONENTS_SYSTEM_PAGE_TITLE,
    metadata,
    // 기존 프로젝트: body(props:{})에 overflow:auto 보강 (신규 생성 경로와 정합).
    children: ensureBodyOverflowAuto(node.children),
  };
}

export function ensureComponentsSystemPage(
  document: CompositionDocument,
): CompositionDocument {
  const existingComponentsIndex = document.children.findIndex(
    isComponentsPageNodeCandidate,
  );
  const componentsNode =
    existingComponentsIndex >= 0
      ? repairComponentsPageNode(document.children[existingComponentsIndex])
      : createComponentsPageNode();

  let children = document.children.filter(
    (_node, index) => index !== existingComponentsIndex,
  );
  if (!children.some(isEditorPageNode)) {
    children = [...children, createFallbackHomePageNode()];
  }

  const firstPageIndex = children.findIndex(isEditorPageNode);
  const insertIndex = firstPageIndex >= 0 ? firstPageIndex : children.length;
  const nextChildren = [
    ...children.slice(0, insertIndex),
    componentsNode,
    ...children.slice(insertIndex),
  ];

  const changed =
    nextChildren.length !== document.children.length ||
    nextChildren.some((node, index) => node !== document.children[index]);

  return changed ? { ...document, children: nextChildren } : document;
}
