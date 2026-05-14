import { initLongTaskMonitorDiagnostics } from "../longTaskMonitor";
import { initPostMessageMonitorDiagnostics } from "../postMessageMonitor";

export function initPerformanceDiagnostics(): void {
  if (!import.meta.env.DEV) return;

  initLongTaskMonitorDiagnostics();
  initPostMessageMonitorDiagnostics();
}
