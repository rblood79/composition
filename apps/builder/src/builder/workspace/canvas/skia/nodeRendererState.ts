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
