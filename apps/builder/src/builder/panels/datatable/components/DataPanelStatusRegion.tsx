/**
 * Data 패널 하단 `role=status` 영역 — ADR-212 HC4 (Main 아트보드 하단 줄
 * "Products 마지막 실행 3분 전 · 401 · 왜 실패했지?"). 항상 마운트, 내용만 바뀐다.
 */
import { Button } from "react-aria-components/Button";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import { useDataPanelStatusStore } from "../stores/dataPanelStatusStore";

export function DataPanelStatusRegion() {
  const i18n = useOptionalI18n();
  const localize = (key: string, fallback: string) =>
    i18n ? translateKey(i18n.t, `datatable.${key}`, fallback) : fallback;
  const status = useDataPanelStatusStore((state) => state.status);
  return (
    <div
      className="datatable-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={localize("statusRegion", "Data panel status")}
      data-tone={status?.tone ?? "none"}
      data-testid="datatable-status"
    >
      {status ? (
        <span key={status.seq} className="datatable-status-message">
          {status.message}
        </span>
      ) : null}
      {status?.action ? (
        <Button className="datatable-status-action" onPress={status.action.run}>
          {status.action.label}
        </Button>
      ) : null}
    </div>
  );
}
