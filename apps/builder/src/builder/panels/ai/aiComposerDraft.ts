/**
 * AI 패널 입력창 초안 — 다른 표면 (Data 패널 "AI 로 설명", ADR-212 Phase 1) 이 문구를
 * 미리 채워 넣는 한 경로. `ChatInput` 이 구독해 초안이 생기면 입력창에 넣고 비운다.
 * 자동 전송은 하지 않는다 — 보내는 것은 사용자.
 */
import { create } from "zustand";

interface AiComposerDraftStore {
  draft: string | null;
  setDraft: (draft: string) => void;
  consume: () => string | null;
}

export const useAiComposerDraftStore = create<AiComposerDraftStore>(
  (set, get) => ({
    draft: null,
    setDraft: (draft) => set({ draft }),
    consume: () => {
      const draft = get().draft;
      if (draft !== null) set({ draft: null });
      return draft;
    },
  }),
);

export const setAiComposerDraft = (draft: string): void =>
  useAiComposerDraftStore.getState().setDraft(draft);
