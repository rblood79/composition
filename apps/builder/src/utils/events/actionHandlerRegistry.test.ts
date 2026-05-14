import { describe, expect, it, vi } from "vitest";
import { IMPLEMENTED_ACTION_TYPES } from "../../types/events/events.registry";
import {
  createActionHandlers,
  type EventActionExecutor,
} from "./actionHandlerRegistry";

function createExecutor(): EventActionExecutor {
  return {
    updateState: vi.fn(),
    navigate: vi.fn(),
    toggleVisibility: vi.fn(),
    showModal: vi.fn(),
    hideModal: vi.fn(),
    scrollTo: vi.fn(),
    copyToClipboard: vi.fn(),
    customFunction: vi.fn(),
    validateForm: vi.fn(),
    resetForm: vi.fn(),
    showToast: vi.fn(),
    submitForm: vi.fn(),
    apiCall: vi.fn(),
    setComponentState: vi.fn(),
    triggerComponentAction: vi.fn(),
    updateFormField: vi.fn(),
    filterCollection: vi.fn(),
    selectItem: vi.fn(),
    clearSelection: vi.fn(),
    loadDataTable: vi.fn(),
    syncComponent: vi.fn(),
    saveToDataTable: vi.fn(),
    setVariable: vi.fn(),
    getVariable: vi.fn(),
    fetchDataTable: vi.fn(),
    refreshDataTable: vi.fn(),
    executeApi: vi.fn(),
  };
}

describe("createActionHandlers", () => {
  it("covers every implemented action type from the registry", () => {
    const handlers = createActionHandlers(createExecutor());

    expect(Object.keys(handlers).sort()).toEqual(
      [...IMPLEMENTED_ACTION_TYPES].sort(),
    );
  });
});
