let editingElementId: string | null = null;

export function setEditingElementId(id: string | null): void {
  if (editingElementId === id) return;
  editingElementId = id;
}

export function getEditingElementId(): string | null {
  return editingElementId;
}

// 구 전역 paragraph LRU 의 상한(MAX_PARAGRAPH_CACHE_SIZE / VITE_PARAGRAPH_CACHE_SIZE)
// 과 fontMgr 스냅샷은 ADR-174 Phase 3 에서 제거됨 — paragraph 는 텍스트 노드가
// 소유하며 (retainedParagraph.ts), fontMgr 무효화는 per-entry 검사로 대체.

// ADR-027 Phase D2 — 마지막 프레임에 텍스트를 그린 element-local 원점. 오버레이가 편집 진입
//   시 DOM 첫 줄 상자를 이 자리로 옮긴다 (overlay/overlayNudge.ts). 항목은 제자리 갱신이라
//   프레임당 할당 0. 편집 중 (텍스트 숨김) 에는 갱신되지 않아 진입 직전 프레임 값이 남는다.
export interface TextDrawOriginRecord {
  x: number;
  y: number;
}

const textDrawOrigins = new Map<string, TextDrawOriginRecord>();

export function recordTextDrawOrigin(
  elementId: string,
  x: number,
  y: number,
): void {
  if (!elementId) return;
  const existing = textDrawOrigins.get(elementId);
  if (existing) {
    existing.x = x;
    existing.y = y;
    return;
  }
  textDrawOrigins.set(elementId, { x, y });
}

export function getTextDrawOrigin(
  elementId: string,
): TextDrawOriginRecord | null {
  return textDrawOrigins.get(elementId) ?? null;
}
