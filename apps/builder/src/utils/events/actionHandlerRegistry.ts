import type {
  EventAction,
  EventContext,
} from "../../types/events/events.types";

export type EventActionHandler = (
  action: EventAction,
  context: EventContext,
) => unknown;

export interface EventActionExecutor {
  updateState: EventActionHandler;
  navigate: EventActionHandler;
  toggleVisibility: EventActionHandler;
  showModal: EventActionHandler;
  hideModal: EventActionHandler;
  scrollTo: EventActionHandler;
  copyToClipboard: EventActionHandler;
  customFunction: EventActionHandler;
  validateForm: EventActionHandler;
  resetForm: EventActionHandler;
  showToast: EventActionHandler;
  submitForm: EventActionHandler;
  apiCall: EventActionHandler;
  setComponentState: EventActionHandler;
  triggerComponentAction: EventActionHandler;
  updateFormField: EventActionHandler;
  filterCollection: EventActionHandler;
  selectItem: EventActionHandler;
  clearSelection: EventActionHandler;
  loadDataTable: EventActionHandler;
  syncComponent: EventActionHandler;
  saveToDataTable: EventActionHandler;
  setVariable: EventActionHandler;
  getVariable: EventActionHandler;
  fetchDataTable: EventActionHandler;
  refreshDataTable: EventActionHandler;
  executeApi: EventActionHandler;
}

export function createActionHandlers(
  executor: EventActionExecutor,
): Record<string, EventActionHandler> {
  return {
    // Legacy snake_case
    update_state: executor.updateState,
    set_state: executor.updateState,
    navigate: executor.navigate,
    toggle_visibility: executor.toggleVisibility,
    show_modal: executor.showModal,
    hide_modal: executor.hideModal,
    show_toast: executor.showToast,
    scroll_to: executor.scrollTo,
    copy_to_clipboard: executor.copyToClipboard,
    custom_function: executor.customFunction,
    validate_form: executor.validateForm,
    reset_form: executor.resetForm,
    submit_form: executor.submitForm,
    update_form_field: executor.updateFormField,
    api_call: executor.apiCall,
    set_component_state: executor.setComponentState,
    trigger_component_action: executor.triggerComponentAction,
    filter_collection: executor.filterCollection,
    select_item: executor.selectItem,
    clear_selection: executor.clearSelection,

    // Inspector camelCase
    updateState: executor.updateState,
    setState: executor.updateState,
    scrollTo: executor.scrollTo,
    showModal: executor.showModal,
    hideModal: executor.hideModal,
    showToast: executor.showToast,
    toggleVisibility: executor.toggleVisibility,
    validateForm: executor.validateForm,
    resetForm: executor.resetForm,
    submitForm: executor.submitForm,
    copyToClipboard: executor.copyToClipboard,
    customFunction: executor.customFunction,
    apiCall: executor.apiCall,

    // Component interaction
    setComponentState: executor.setComponentState,
    triggerComponentAction: executor.triggerComponentAction,
    updateFormField: executor.updateFormField,

    // Collection interaction
    filterCollection: executor.filterCollection,
    selectItem: executor.selectItem,
    clearSelection: executor.clearSelection,

    // Data panel integration
    loadDataTable: executor.loadDataTable,
    syncComponent: executor.syncComponent,
    saveToDataTable: executor.saveToDataTable,

    // Variables and API
    setVariable: executor.setVariable,
    getVariable: executor.getVariable,
    fetchDataTable: executor.fetchDataTable,
    refreshDataTable: executor.refreshDataTable,
    executeApi: executor.executeApi,
  };
}
