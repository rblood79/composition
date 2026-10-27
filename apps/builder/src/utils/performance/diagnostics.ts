import { initLongTaskMonitorDiagnostics } from "../longTaskMonitor";

export function initPerformanceDiagnostics(): void {
  if (!import.meta.env.DEV) return;

  initLongTaskMonitorDiagnostics();
}
