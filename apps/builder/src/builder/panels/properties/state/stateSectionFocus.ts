/**
 * ADR-214 Phase 5 — Data 탭 인덱스 "소유자로 점프" 가 Properties 상태 절을 열고 특정 정의로
 * 스크롤하게 하는 1회성 신호 (ADR-212 `openFieldPanel({ focus })` 와 같은 seq 어법 — 같은
 * 대상을 두 번 눌러도 다시 반응한다).
 */
import { create } from "zustand";

export interface StateSectionFocusRequest {
  /** 소유자 노드 (페이지 노드 id 또는 요소 id) */
  ownerNodeId: string;
  /** 스크롤·펼침 대상 정의 (없으면 절만) */
  variableId: string | null;
  seq: number;
}

interface StateSectionFocusStore {
  request: StateSectionFocusRequest | null;
  requestFocus: (ownerNodeId: string, variableId?: string | null) => void;
}

export const useStateSectionFocus = create<StateSectionFocusStore>((set, get) => ({
  request: null,
  requestFocus: (ownerNodeId, variableId = null) =>
    set({
      request: { ownerNodeId, variableId, seq: (get().request?.seq ?? 0) + 1 },
    }),
}));
