/**
 * URL Generator Utility
 *
 * Nested Routes & Slug System을 위한 URL 생성 유틸리티
 *
 * URL 결정 우선순위:
 * 1. Page.slug가 절대 경로 (/ 로 시작)인 경우 → 그대로 사용
 * 2. Layout.slug가 있는 경우 → Layout.slug + "/" + Page.slug
 * 3. parent_id가 있는 경우 → 부모 URL + "/" + Page.slug
 * 4. 그 외 → "/" + Page.slug
 */

// ============================================
// Types
// ============================================

export interface UrlPage {
  id: string;
  slug: string;
  parent_id?: string | null;
}

export interface UrlLayout {
  slug?: string | null;
}

interface GeneratePageUrlParams {
  page: UrlPage;
  layout?: UrlLayout | null;
  allPages?: UrlPage[];
}

// ============================================
// URL Generation
// ============================================

/**
 * 페이지의 최종 URL을 생성합니다.
 *
 * @param page - 대상 페이지
 * @param layout - 페이지에 적용된 Layout (optional)
 * @param allPages - 전체 페이지 목록 (parent_id 기반 URL 생성 시 필요)
 *
 * @example
 * // Absolute path
 * generatePageUrl({ page: { slug: '/products/shoes' } })
 * // → '/products/shoes'
 *
 * @example
 * // With Layout slug
 * generatePageUrl({
 *   page: { slug: 'nike' },
 *   layout: { slug: '/products' }
 * })
 * // → '/products/nike'
 *
 * @example
 * // With parent_id (hierarchical)
 * generatePageUrl({
 *   page: { slug: 'nike', parent_id: 'page-2' },
 *   allPages: [
 *     { id: 'page-1', slug: '/products' },
 *     { id: 'page-2', slug: 'shoes', parent_id: 'page-1' }
 *   ]
 * })
 * // → '/products/shoes/nike'
 */
export function generatePageUrl({
  page,
  layout,
  allPages,
}: GeneratePageUrlParams): string {
  // 1. 절대 경로인 경우 그대로 반환
  if (page.slug.startsWith("/")) {
    return page.slug;
  }

  // 2. Layout slug가 있는 경우
  if (layout?.slug) {
    return normalizeUrl(`${layout.slug}/${page.slug}`);
  }

  // 3. parent_id가 있는 경우 (계층 기반)
  if (page.parent_id && allPages) {
    const parentUrl = buildParentPath(page.parent_id, allPages);
    return normalizeUrl(`${parentUrl}/${page.slug}`);
  }

  // 4. 기본값: 상대 경로를 절대 경로로 변환
  return normalizeUrl(`/${page.slug}`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * 부모 페이지 경로를 재귀적으로 구성합니다.
 *
 * @param parentId - 부모 페이지 ID
 * @param allPages - 전체 페이지 목록
 */
function buildParentPath(parentId: string, allPages: UrlPage[]): string {
  const parent = allPages.find((p) => p.id === parentId);
  if (!parent) return "";

  // 부모가 절대 경로면 그대로 반환
  if (parent.slug.startsWith("/")) {
    return parent.slug;
  }

  // 부모도 parent_id가 있으면 재귀
  if (parent.parent_id) {
    return `${buildParentPath(parent.parent_id, allPages)}/${parent.slug}`;
  }

  return `/${parent.slug}`;
}

/**
 * URL 정규화 (연속 슬래시 제거)
 *
 * @param url - 정규화할 URL
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+/g, "/");
}

// ============================================
// Circular Reference Detection
// ============================================

/**
 * 순환 참조 검증
 *
 * 페이지의 parent_id 설정 시 순환 참조가 발생하는지 확인합니다.
 *
 * @param pageId - 검증 대상 페이지 ID
 * @param newParentId - 설정하려는 새 parent_id
 * @param allPages - 전체 페이지 목록
 * @returns true면 순환 참조 발생
 *
 * @example
 * // Page A → Page B → Page A 형태의 순환 참조
 * hasCircularReference('page-a', 'page-b', [
 *   { id: 'page-a', parent_id: null },
 *   { id: 'page-b', parent_id: 'page-a' }
 * ])
 * // → true (page-a를 page-b의 자식으로 설정하면 순환)
 */
export function hasCircularReference(
  pageId: string,
  newParentId: string | null,
  allPages: UrlPage[],
): boolean {
  if (!newParentId) return false;

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === pageId) return true; // 순환 발견
    if (visited.has(currentId)) return true; // 이미 방문 (무한 루프 방지)
    visited.add(currentId);

    const parent = allPages.find((p) => p.id === currentId);
    currentId = parent?.parent_id || null;
  }

  return false;
}

// ============================================
// Nesting Depth Calculation
// ============================================

/**
 * 중첩 깊이 계산
 *
 * 페이지의 계층 구조에서 현재 페이지의 깊이를 계산합니다.
 * 루트 레벨(parent_id 없음)은 0, 한 단계 자식은 1, ...
 *
 * @param pageId - 대상 페이지 ID
 * @param allPages - 전체 페이지 목록
 * @returns 중첩 깊이 (0부터 시작)
 *
 * @example
 * // /products/shoes/nike 구조에서
 * getNestingDepth('nike-page-id', allPages)
 * // → 2 (products=0, shoes=1, nike=2)
 */
export function getNestingDepth(pageId: string, allPages: UrlPage[]): number {
  let depth = 0;
  let currentId: string | null = pageId;

  while (currentId) {
    const page = allPages.find((p) => p.id === currentId);
    if (!page?.parent_id) break;
    depth++;
    currentId = page.parent_id;
  }

  return depth;
}

// ============================================
// Dynamic Route Parameter Support
// ============================================

/**
 * Slug에서 동적 파라미터 패턴 추출
 *
 * React Router 스타일의 :paramName 형식을 사용합니다.
 *
 * @param slug - 분석할 slug
 * @returns 동적 파라미터 이름 배열
 *
 * @example
 * extractDynamicParams('/products/:categoryId/items/:itemId')
 * // → ['categoryId', 'itemId']
 *
 * extractDynamicParams('/users/:userId')
 * // → ['userId']
 */
export function extractDynamicParams(slug: string): string[] {
  const paramPattern = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const params: string[] = [];
  let match;

  while ((match = paramPattern.exec(slug)) !== null) {
    params.push(match[1]);
  }

  return params;
}

/**
 * 동적 파라미터 slug를 React Router 형식으로 변환
 *
 * :paramName 형식을 그대로 유지 (React Router 호환)
 *
 * @param slug - 원본 slug
 * @returns React Router 호환 path
 *
 * @example
 * convertToRouterPath('/products/:categoryId')
 * // → '/products/:categoryId'
 */
export function convertToRouterPath(slug: string): string {
  // React Router는 :paramName 형식을 그대로 사용하므로 변환 불필요
  return slug;
}

/**
 * 동적 URL을 실제 값으로 채워넣기
 *
 * @param slug - 동적 파라미터가 포함된 slug
 * @param params - 파라미터 값 객체
 * @returns 실제 URL
 *
 * @example
 * fillDynamicParams('/products/:categoryId/items/:itemId', {
 *   categoryId: 'shoes',
 *   itemId: '123'
 * })
 * // → '/products/shoes/items/123'
 */
export function fillDynamicParams(
  slug: string,
  params: Record<string, string>,
): string {
  let result = slug;

  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`:${key}`, value);
  }

  return result;
}

/**
 * 슬러그가 동적 파라미터를 포함하는지 확인
 *
 * @param slug - 확인할 slug
 * @returns 동적 파라미터 포함 여부
 */
export function hasDynamicParams(slug: string): boolean {
  return /:([a-zA-Z_][a-zA-Z0-9_]*)/.test(slug);
}

/**
 * URL이 동적 패턴과 일치하는지 확인하고 파라미터 추출
 *
 * @param pattern - 동적 파라미터가 포함된 패턴 (예: /products/:categoryId)
 * @param url - 실제 URL (예: /products/shoes)
 * @returns 일치하면 파라미터 객체, 불일치하면 null
 *
 * @example
 * matchDynamicUrl('/products/:categoryId', '/products/shoes')
 * // → { categoryId: 'shoes' }
 *
 * matchDynamicUrl('/products/:categoryId/items/:itemId', '/products/shoes/items/123')
 * // → { categoryId: 'shoes', itemId: '123' }
 *
 * matchDynamicUrl('/products/:categoryId', '/users/123')
 * // → null
 */
export function matchDynamicUrl(
  pattern: string,
  url: string,
): Record<string, string> | null {
  // 패턴을 정규식으로 변환
  const paramNames: string[] = [];
  const regexPattern = pattern.replace(
    /:([a-zA-Z_][a-zA-Z0-9_]*)/g,
    (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    },
  );

  const regex = new RegExp(`^${regexPattern}$`);
  const match = url.match(regex);

  if (!match) return null;

  // 파라미터 추출
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = match[index + 1];
  });

  return params;
}
