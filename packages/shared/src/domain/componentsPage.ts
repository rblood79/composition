/**
 * Components 페이지 판정 — 한 곳 (ADR-236 Phase 1).
 *
 * Components 페이지는 팔레트 origin 을 두는 시스템 페이지다 (ADR-228). builder 가 문서를 열 때
 * `repairComponentsPageNode` 가 `pageRole` · `slug` 를 채우지만, 그 전의 문서는 id 나 slug 만 맞을 수 있어
 * 판정은 셋 중 하나로 본다. 입력 모양 (page mirror · canonical page node · 요소) 은 아래 어댑터가 맞춘다.
 */

export const COMPONENTS_PAGE_ROLE = "components";
export const COMPONENTS_PAGE_SLUG = "/__components";
export const COMPONENTS_SYSTEM_PAGE_ID = "page-components";

export interface ComponentsPageFields {
  id?: unknown;
  pageRole?: unknown;
  slug?: unknown;
}

function normalizeSlug(slug: unknown): string {
  if (typeof slug !== "string" || slug.length === 0) return "";
  return slug.startsWith("/") ? slug : `/${slug}`;
}

/** 이 페이지가 Components 페이지인가 — pageRole · 시스템 id · slug 중 하나. */
export function isComponentsPage(
  page: ComponentsPageFields | null | undefined,
): boolean {
  if (!page) return false;
  return (
    page.pageRole === COMPONENTS_PAGE_ROLE ||
    page.id === COMPONENTS_SYSTEM_PAGE_ID ||
    normalizeSlug(page.slug) === COMPONENTS_PAGE_SLUG
  );
}

/** canonical page node → 판정 입력 (pageRole · slug 는 metadata 에 있다). */
export function componentsPageFieldsOfNode(node: {
  id?: unknown;
  metadata?: unknown;
}): ComponentsPageFields {
  const metadata = (node.metadata ?? undefined) as
    { pageRole?: unknown; slug?: unknown } | undefined;
  return { id: node.id, pageRole: metadata?.pageRole, slug: metadata?.slug };
}

/** 요소가 Components 페이지에 놓여 있는가 (페이지 판정이 아니라 소속 판정). */
export function isOnComponentsPage(
  node: { page_id?: string | null } | null | undefined,
): boolean {
  return node?.page_id === COMPONENTS_SYSTEM_PAGE_ID;
}
