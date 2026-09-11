/**
 * Data 패널 `role=status` live region — ADR-212 HC4 · Y4.
 *
 * 성공·진행 문구 (저장 · 행 추가 · Run 결과 · import 결과) 는 여기로 온다. 토스트는 전부
 * `role=alert` (assertive) 라 성공 문구까지 끼어들었다 (Phase 0 §4). 오류는 그대로 토스트.
 * 영역은 `DataTablePanel` 하단에 항상 마운트돼 있다 — live region 은 내용이 바뀔 때만
 * 읽히므로 같은 문구를 두 번 알리려면 `seq` 가 바뀐다.
 */
import { create } from "zustand";

export interface DataPanelStatus {
  message: string;
  /** 표시 색만 — 오류는 여기로 오지 않는다 (토스트 `role=alert`) */
  tone: "info" | "success";
  seq: number;
  /** 문구 옆 액션 (예: "왜 실패했지?") */
  action?: { label: string; run: () => void };
}

interface DataPanelStatusStore {
  status: DataPanelStatus | null;
  announce: (
    message: string,
    options?: {
      tone?: DataPanelStatus["tone"];
      action?: DataPanelStatus["action"];
    },
  ) => void;
  clear: () => void;
}

export const useDataPanelStatusStore = create<DataPanelStatusStore>(
  (set, get) => ({
    status: null,
    announce: (message, options) =>
      set({
        status: {
          message,
          tone: options?.tone ?? "info",
          seq: (get().status?.seq ?? 0) + 1,
          ...(options?.action ? { action: options.action } : {}),
        },
      }),
    clear: () => set({ status: null }),
  }),
);

export const announceDataPanelStatus = (
  message: string,
  options?: Parameters<DataPanelStatusStore["announce"]>[1],
): void => useDataPanelStatusStore.getState().announce(message, options);
