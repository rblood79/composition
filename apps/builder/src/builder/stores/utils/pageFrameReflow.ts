/**
 * 페이지 frame 크기 변경 → 이웃 페이지 재배치 (2026-09-22 사용자 요청 "페이지 간격도 frame 크기 따르게").
 *
 * 페이지 위치는 사용자가 끌어 놓은 문서 데이터 (ADR-177) 라 전체를 다시 쌓지 않는다. 한 페이지의
 * frame (body 저작 크기) 이 Δ 만큼 커지거나 줄면, **쌓는 축에서 그 페이지 뒤에 있는 페이지만**
 * Δ 만큼 밀어 간격을 그대로 둔다 — 상대 배치 (수동 정렬) 는 보존된다.
 *
 * - vertical: 바뀐 페이지보다 아래 (y 큼) 인 페이지에 Δheight
 * - horizontal: 오른쪽 (x 큼) 인 페이지에 Δwidth
 * - auto (격자): 아래 행 (y 큼) 에 Δheight · 같은 행의 오른쪽 (y 같고 x 큼) 에 Δwidth
 *
 * history 에 남기지 않는다 — 원인인 body 크기 편집이 이미 entry 1 이고, 그 undo/redo 로 frame 이
 * 되돌아오면 이 재배치가 다시 반대 방향으로 따라간다 (호출자가 frame 변화에 반응).
 */
import { normalizePageLayoutDirection, type PageLayoutDirection } from "../canvasSettings";

type PagePositions = Readonly<Record<string, { x: number; y: number } | undefined>>;

export interface PageFrameSizeLike {
  width: number;
  height: number;
}

export interface PageFrameReflowInput {
  positions: PagePositions;
  direction: PageLayoutDirection;
  changedPageId: string;
  prev: PageFrameSizeLike;
  next: PageFrameSizeLike;
}

export interface PagePositionShift {
  pageId: string;
  x: number;
  y: number;
}

export function computePageFrameReflow({
  positions,
  direction,
  changedPageId,
  prev,
  next,
}: PageFrameReflowInput): PagePositionShift[] {
  const origin = positions[changedPageId];
  if (!origin) return [];
  const dw = next.width - prev.width;
  const dh = next.height - prev.height;
  if (dw === 0 && dh === 0) return [];
  const normalized = normalizePageLayoutDirection(direction);
  const shifts: PagePositionShift[] = [];

  for (const [pageId, position] of Object.entries(positions)) {
    if (pageId === changedPageId || !position) continue;
    let dx = 0;
    let dy = 0;
    if (normalized === "vertical") {
      if (position.y > origin.y) dy = dh;
    } else if (normalized === "horizontal") {
      if (position.x > origin.x) dx = dw;
    } else {
      if (position.y > origin.y) dy = dh;
      else if (position.y === origin.y && position.x > origin.x) dx = dw;
    }
    if (dx !== 0 || dy !== 0) {
      shifts.push({ pageId, x: position.x + dx, y: position.y + dy });
    }
  }
  return shifts;
}
