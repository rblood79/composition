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
        props: {},
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
        props: {},
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
