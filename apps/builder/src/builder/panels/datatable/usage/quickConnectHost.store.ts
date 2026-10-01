import {
  captureQuickConnectTarget,
  executeQuickConnect,
  planTableColumns,
  precheckQuickConnectTarget,
  readBackQuickConnect,
} from "../utils/quickConnect";
import {
  setQuickConnectHostTestFallback,
  type QuickConnectHost,
} from "./quickConnectHost";

/**
 * ADR-248 4e-7: the old element store's QuickConnectHost — no longer in the app (the catalog workspace
 * provides the host). Old-store tests import this module to run against it; it goes with the
 * old store.
 */
export const STORE_QUICK_CONNECT_HOST: QuickConnectHost = {
  capture: captureQuickConnectTarget,
  precheck: precheckQuickConnectTarget,
  planColumns: planTableColumns,
  execute: executeQuickConnect,
  readBack: readBackQuickConnect,
};

setQuickConnectHostTestFallback(STORE_QUICK_CONNECT_HOST);
