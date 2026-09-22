/**
 * ADR-232 G1 oracle — **ADR-232 이전의 저장 좌표 배치 구현** 을 그대로 얼린 사본.
 *
 * 원본 (`stores/elements.ts` 의 `calculatePagePositions` · `placeUserPages` · `placeSystemColumn`)
 * 은 Phase 3 에서 삭제됐다. "새 문서의 배치가 그때와 같다" 는 계약은 남아야 하므로 참조
 * 구현을 여기 둔다 — **수정 금지**. 파생이 이 출력과 갈리면 회귀다 (의도한 변경이라면 이
 * 파일이 아니라 ADR 을 고친다).
 */

type OraclePage = { id: string };
type OraclePoint = { x: number; y: number };
type OraclePositions = Record<string, OraclePoint>;
type OraclePageSizes = Readonly<
  Record<string, { width: number; height: number } | undefined>
>;
type OracleDirection = "auto" | "vertical" | "horizontal";

/** 열 수 — 원본 `resolveAutoPageColumnCount` 와 같은 식. */
function resolveAutoPageColumnCount(
  pageWidth: number,
  gap: number,
  availableWidth: number,
): number {
  if (
    !Number.isFinite(pageWidth) ||
    pageWidth <= 0 ||
    !Number.isFinite(gap) ||
    gap < 0 ||
    !Number.isFinite(availableWidth) ||
    availableWidth <= 0
  ) {
    return 1;
  }
  return Math.max(1, Math.floor((availableWidth + gap) / (pageWidth + gap)));
}

/**
 * ADR-231 — 시스템 페이지 (Components …) 는 사용자 격자 밖 **왼쪽 세로 열**:
 * `x = homeX − (max 시스템 폭 + gap)` · `y = homeY + Σ(앞선 시스템 페이지 높이 + gap)`.
 * 격자 참여 0 이라 어느 breakpoint · 방향에서도 겹침 경로가 없고 (사용자 페이지 x ≥ homeX,
 * 열 오른쪽 끝 = homeX − gap), 시스템 페이지가 늘어도 같은 열에 아래로 쌓인다.
 */
function placeSystemColumn(
  systemPages: readonly OraclePage[],
  home: OraclePoint,
  gap: number,
  sizeOf: (id: string) => { width: number; height: number },
): OraclePositions {
  const positions: OraclePositions = {};
  if (systemPages.length === 0) return positions;
  let maxWidth = 0;
  for (const page of systemPages) {
    maxWidth = Math.max(maxWidth, sizeOf(page.id).width);
  }
  const x = home.x - (maxWidth + gap);
  let y = home.y;
  for (const page of systemPages) {
    positions[page.id] = { x, y };
    y += sizeOf(page.id).height + gap;
  }
  return positions;
}

function splitSystemPages<T extends OraclePage>(
  pages: readonly T[],
  systemPageIds: ReadonlySet<string> | undefined,
): { userPages: T[]; systemPages: T[] } {
  if (!systemPageIds || systemPageIds.size === 0) {
    return { userPages: [...pages], systemPages: [] };
  }
  const userPages: T[] = [];
  const systemPages: T[] = [];
  for (const page of pages) {
    (systemPageIds.has(page.id) ? systemPages : userPages).push(page);
  }
  return { userPages, systemPages };
}

export function calculatePagePositions(
  pages: readonly OraclePage[],
  pageWidth: number,
  pageHeight: number,
  gap: number,
  direction: OracleDirection = "horizontal",
  availableWidth?: number,
  pageStartX = 0,
  pageSizes?: OraclePageSizes,
  /** ADR-231 — 시스템 페이지 집합: 격자에서 빼고 왼쪽 세로 열에 둔다. */
  systemPageIds?: ReadonlySet<string>,
): OraclePositions {
  const sizeOf = (id: string) => ({
    width: pageSizes?.[id]?.width ?? pageWidth,
    height: pageSizes?.[id]?.height ?? pageHeight,
  });
  const { userPages, systemPages } = splitSystemPages(pages, systemPageIds);
  const normalizedDirection: OracleDirection = direction;
  const positions = placeUserPages(
    userPages,
    pageWidth,
    gap,
    normalizedDirection,
    availableWidth,
    pageStartX,
    sizeOf,
  );
  if (systemPages.length > 0) {
    const home =
      userPages.length > 0
        ? positions[userPages[0].id]!
        : { x: normalizedDirection === "auto" ? pageStartX : 0, y: 0 };
    Object.assign(positions, placeSystemColumn(systemPages, home, gap, sizeOf));
  }
  return positions;
}

function placeUserPages(
  pages: readonly OraclePage[],
  pageWidth: number,
  gap: number,
  normalizedDirection: OracleDirection,
  availableWidth: number | undefined,
  pageStartX: number,
  sizeOf: (id: string) => { width: number; height: number },
): OraclePositions {
  const positions: OraclePositions = {};

  if (normalizedDirection === "vertical") {
    let currentY = 0;
    for (const page of pages) {
      positions[page.id] = { x: 0, y: currentY };
      currentY += sizeOf(page.id).height + gap;
    }
    return positions;
  }

  if (normalizedDirection === "auto") {
    // 열은 breakpoint 폭 기준 (열 수 · x 칸), 행 높이는 그 행에서 가장 큰 frame — 폭이 다른
    // 페이지가 섞여도 칸은 유지되고 높이만 따라간다.
    const columnCount = resolveAutoPageColumnCount(
      pageWidth,
      gap,
      availableWidth ?? 0,
    );
    let rowY = 0;
    let rowMaxHeight = 0;
    for (let index = 0; index < pages.length; index++) {
      const column = index % columnCount;
      if (column === 0 && index > 0) {
        rowY += rowMaxHeight + gap;
        rowMaxHeight = 0;
      }
      positions[pages[index].id] = {
        x: pageStartX + column * (pageWidth + gap),
        y: rowY,
      };
      rowMaxHeight = Math.max(rowMaxHeight, sizeOf(pages[index].id).height);
    }
    return positions;
  }

  let currentX = 0;
  for (const page of pages) {
    positions[page.id] = { x: currentX, y: 0 };
    currentX += sizeOf(page.id).width + gap;
  }
  return positions;
}
