/* eslint-disable local/prefer-copy-paste-hook */
import {
  EventAction,
  ElementEvent,
  EventContext,
  EventExecutionResult,
  isImplementedActionType,
} from "../../types/events/events.types";
import {
  createActionHandlers,
  type EventActionHandler,
} from "./actionHandlerRegistry";

export class EventEngine {
  private static instance: EventEngine;
  private state: Record<string, unknown> = {};
  private actionHandlers: Record<string, EventActionHandler> = {};
  private executionTimeouts = new Map<string, NodeJS.Timeout>();
  private lastShownModalId?: string;
  private modalBackdrops = new Map<string, string>();
  private shownModalIds = new Set<string>();

  static getInstance(): EventEngine {
    if (!EventEngine.instance) {
      EventEngine.instance = new EventEngine();
    }
    return EventEngine.instance;
  }

  constructor() {
    this.initializeActionHandlers();
  }

  private initializeActionHandlers() {
    this.actionHandlers = createActionHandlers({
      updateState: this.executeUpdateStateAction.bind(this),
      navigate: this.executeNavigateAction.bind(this),
      toggleVisibility: this.executeToggleVisibilityAction.bind(this),
      showModal: this.executeShowModalAction.bind(this),
      hideModal: this.executeHideModalAction.bind(this),
      scrollTo: this.executeScrollToAction.bind(this),
      copyToClipboard: this.executeCopyToClipboardAction.bind(this),
      customFunction: this.executeCustomFunctionAction.bind(this),
      validateForm: this.executeValidateFormAction.bind(this),
      resetForm: this.executeResetFormAction.bind(this),
      showToast: this.executeShowToastAction.bind(this),
      submitForm: this.executeSubmitFormAction.bind(this),
      apiCall: this.executeAPICallAction.bind(this),
      setComponentState: this.executeSetComponentStateAction.bind(this),
      triggerComponentAction:
        this.executeTriggerComponentActionAction.bind(this),
      updateFormField: this.executeUpdateFormFieldAction.bind(this),
      filterCollection: this.executeFilterCollectionAction.bind(this),
      selectItem: this.executeSelectItemAction.bind(this),
      clearSelection: this.executeClearSelectionAction.bind(this),
      loadDataTable: this.executeLoadDataTableAction.bind(this),
      syncComponent: this.executeSyncComponentAction.bind(this),
      saveToDataTable: this.executeSaveToDataTableAction.bind(this),
      setVariable: this.executeSetVariableAction.bind(this),
      getVariable: this.executeGetVariableAction.bind(this),
      fetchDataTable: this.executeFetchDataTableAction.bind(this),
      refreshDataTable: this.executeRefreshDataTableAction.bind(this),
      executeApi: this.executeApiAction.bind(this),
    });
  }

  setState(key: string, value: unknown) {
    this.state[key] = value;
  }

  getState() {
    return { ...this.state };
  }

  /**
   * 외부에서 variables를 주입 (Canvas에서 runtimeStore의 variables 전달)
   */
  syncVariables(variables: Array<{ name: string; defaultValue?: unknown }>) {
    variables.forEach((variable) => {
      this.state[variable.name] = variable.defaultValue;
    });
  }

  async executeEvent(
    event: ElementEvent,
    context: EventContext,
  ): Promise<EventExecutionResult> {
    const startTime = Date.now();
    const actionResults: Array<{
      actionId: string;
      success: boolean;
      error?: string;
      data?: unknown;
    }> = [];

    // 이벤트 실행 타임아웃 설정
    const eventTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Event execution timeout")), 10000),
    );

    try {
      await Promise.race([
        this.executeEventActions(event, context, actionResults),
        eventTimeout,
      ]);
    } catch (error) {
      actionResults.push({
        actionId: "event",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const totalExecutionTime = Date.now() - startTime;

    return {
      success: actionResults.every((result) => result.success),
      actionResults,
      totalExecutionTime,
    };
  }

  private async executeEventActions(
    event: ElementEvent,
    context: EventContext,
    actionResults: Array<{
      actionId: string;
      success: boolean;
      error?: string;
      data?: unknown;
    }>,
  ): Promise<void> {
    for (const action of event.actions) {
      // enabled가 명시적으로 false인 경우만 스킵 (undefined는 true로 간주)
      if (action.enabled === false) {
        continue;
      }

      try {
        const result = await this.executeActionWithTimeout(action, context);
        actionResults.push({
          actionId: action.id,
          success: true,
          data: result,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        actionResults.push({
          actionId: action.id,
          success: false,
          error: err.message,
        });
        console.error(`[EventEngine] Action execution failed:`, err);
      }
    }
  }

  private async executeActionWithTimeout(
    action: EventAction,
    context: EventContext,
  ): Promise<unknown> {
    const actionId = action.id;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.executionTimeouts.delete(actionId);
        reject(new Error(`Action timeout: ${action.type}`));
      }, 5000);

      this.executionTimeouts.set(actionId, timeout);

      this.executeAction(action.type, action, context)
        .then((result) => {
          clearTimeout(timeout);
          this.executionTimeouts.delete(actionId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.executionTimeouts.delete(actionId);
          reject(error);
        });
    });
  }

  private async executeAction(
    actionType: string,
    action: EventAction,
    context: EventContext,
  ): Promise<unknown> {
    // Registry 기반 타입 검증
    if (!isImplementedActionType(actionType)) {
      throw new Error(`Action type not implemented: ${actionType}`);
    }

    const handler = this.actionHandlers[actionType];
    if (!handler) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    return await handler(action, context);
  }

  // 보안 강화된 custom_function 실행
  private async executeCustomFunctionAction(
    action: EventAction,
    context: EventContext,
  ): Promise<unknown> {
    const config = this.getActionConfig<{
      code: string;
      params?: Record<string, unknown>;
    }>(action);
    const code = config.code;

    // 코드가 없으면 조용히 스킵 (사용자가 아직 코드를 입력하지 않은 경우)
    if (!code || !code.trim()) {
      console.warn(
        "[EventEngine] Custom function has no code, skipping execution",
      );
      return undefined;
    }

    // 코드 검증
    if (!this.isValidCustomCode(code)) {
      throw new Error("Invalid custom code: contains forbidden patterns");
    }

    try {
      // 안전한 실행 컨텍스트 생성
      const safeContext = {
        event: context.event,
        element: context.element,
        state: this.getState(),
        params: config.params || {},
        console: {
          log: (...args: unknown[]) =>
            console.log("[Custom Function]", ...args),
          error: (...args: unknown[]) =>
            console.error("[Custom Function]", ...args),
          warn: (...args: unknown[]) =>
            console.warn("[Custom Function]", ...args),
        },
        // 제한된 DOM API만 제공
        document: {
          getElementById: (id: string) => {
            const element = document.getElementById(id);
            return element
              ? {
                  style: element.style,
                  textContent: element.textContent,
                  value: (element as HTMLInputElement).value,
                }
              : null;
          },
        },
      };

      // with 문 대신 직접 컨텍스트 객체를 사용
      const func = new Function(
        "context",
        `
                "use strict";
                const { event, element, state, params, console, document } = context;
                ${code}
            `,
      );

      return func(safeContext);
    } catch (error) {
      throw new Error(`Custom function execution failed: ${error}`, {
        cause: error,
      });
    }
  }

  private isValidCustomCode(code: string): boolean {
    // 위험한 패턴 검사
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /setTimeout\s*\(/,
      /setInterval\s*\(/,
      /import\s*\(/,
      /require\s*\(/,
      /window\./,
      /document\./,
      /localStorage/,
      /sessionStorage/,
      /fetch\s*\(/,
      /XMLHttpRequest/,
      /\.innerHTML/,
      /\.outerHTML/,
      /\.insertAdjacentHTML/,
    ];

    return !dangerousPatterns.some((pattern) => pattern.test(code));
  }

  /**
   * 액션 설정 가져오기 (config 또는 value 필드 지원)
   * Inspector에서는 config 필드를, 레거시 시스템에서는 value 필드를 사용
   */
  private getActionConfig<T>(action: EventAction): T {
    const actionData = action as { config?: unknown; value?: unknown };
    return (actionData.config || actionData.value || {}) as T;
  }

  // 나머지 액션 핸들러들...
  private async executeUpdateStateAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      key?: string;
      storePath?: string;
      value: unknown;
    }>(action);
    const key = config.key || config.storePath; // storePath도 지원 (Inspector 호환)
    if (key && typeof key === "string") {
      this.setState(key, config.value);
    }
  }

  private async executeNavigateAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      path?: string;
      url?: string; // 하위 호환성
      openInNewTab?: boolean;
      newTab?: boolean; // 하위 호환성
      replace?: boolean;
    }>(action);

    // path 또는 url (하위 호환)
    const path = config.path || config.url;
    // openInNewTab 또는 newTab (하위 호환)
    const openInNewTab = config.openInNewTab || config.newTab;
    const replace = config.replace;

    // 경로가 없으면 조용히 스킵 (사용자가 아직 경로를 입력하지 않은 경우)
    if (!path || typeof path !== "string" || !path.trim()) {
      console.warn(
        "[EventEngine] Navigate action has no path, skipping execution. Config was:",
        config,
      );
      return;
    }

    // 새 탭에서 열기
    if (openInNewTab) {
      window.open(path, "_blank");
      return;
    }

    // 내부 페이지인지 외부 URL인지 구분
    const isInternalPage = this.isInternalPath(path);

    if (isInternalPage) {
      // 빌더 모드 (iframe 안)에서 실행 중인지 확인
      if (this.isBuilderMode()) {
        // postMessage로 부모에게 페이지 전환 요청
        this.postBuilderMessage("NAVIGATE_TO_PAGE", { path, replace });
      } else {
        // 퍼블리시 모드에서는 React Router 사용 (향후 구현)
        console.warn(
          "[EventEngine] Navigate in published mode not yet implemented",
        );
        // TODO: 향후 퍼블리시 모드에서 React Router navigate() 호출
      }
    } else {
      // 외부 URL - 기존 방식
      try {
        new URL(path);
        window.location.href = path;
      } catch {
        throw new Error("Invalid URL");
      }
    }
  }

  /**
   * 빌더 모드(iframe 안)에서 실행 중인지 확인
   */
  private isBuilderMode(): boolean {
    return window.self !== window.top && window.parent !== window.self;
  }

  private postBuilderMessage(type: string, payload: unknown): void {
    window.parent.postMessage({ type, payload }, window.location.origin);
  }

  /**
   * 내부 페이지 경로인지 확인 (slug 기반)
   * 예: "/", "/dashboard", "/about" 등
   */
  private isInternalPath(path: string): boolean {
    // 외부 URL 패턴 (http://, https://, //, mailto:, tel: 등)
    const externalUrlPattern = /^(https?:\/\/|\/\/|mailto:|tel:)/i;

    // 외부 URL이 아니고 슬래시로 시작하면 내부 페이지
    return !externalUrlPattern.test(path) && path.startsWith("/");
  }

  // 누락된 메서드들 추가
  private async executeToggleVisibilityAction(
    action: EventAction,
    context: EventContext,
  ): Promise<void> {
    const config = this.getActionConfig<{ show?: boolean; elementId?: string }>(
      action,
    );
    const targetId = config.elementId || context.elementId;
    const element = this.findElementByAny(targetId) || context.element;

    if (!element) {
      console.warn(
        `[EventEngine] Toggle visibility: element not found for id "${targetId}"`,
      );
      return;
    }

    element.style.display = config.show === false ? "none" : "block";
  }

  private async executeShowModalAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      modalId: string;
      backdrop?: boolean;
    }>(action);
    const modalId =
      typeof config.modalId === "string" ? config.modalId.trim() : "";
    const backdrop = config.backdrop ?? true;

    // 보안 검증: modalId가 유효한지 확인
    if (!modalId) {
      throw new Error("Invalid modal ID");
    }

    const found = this.findModalElement(modalId);
    if (!found) {
      throw new Error(`Modal with ID "${modalId}" not found`);
    }
    const { element: modal, resolvedId } = found;

    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    this.lastShownModalId = resolvedId;
    this.shownModalIds.add(resolvedId);

    if (backdrop) {
      const backdropId = this.ensureModalBackdrop(resolvedId);
      modal.setAttribute("data-backdrop-id", backdropId);
    }
  }

  private async executeHideModalAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{ modalId?: string }>(action);
    const modalId =
      typeof config.modalId === "string" ? config.modalId.trim() : "";
    const targetModalIds = this.getModalIdsToHide(modalId);

    if (!targetModalIds.length) {
      console.warn("[EventEngine] No modal IDs to hide");
      return;
    }

    for (const id of targetModalIds) {
      this.hideModalById(id);
    }
  }

  private getModalIdsToHide(requestedId: string): string[] {
    if (requestedId) {
      return [requestedId];
    }

    if (this.lastShownModalId) {
      return [this.lastShownModalId];
    }

    if (this.shownModalIds.size) {
      return [...this.shownModalIds];
    }

    if (this.modalBackdrops.size) {
      return [...this.modalBackdrops.keys()];
    }

    return [];
  }

  private escapeSelector(value: string): string {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return CSS.escape(value);
    }

    return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  /**
   * Normalize element ID by stripping leading # prefix
   * ElementPicker returns "#customId" format, but DOM uses "customId"
   */
  private normalizeElementId(targetId: string): string {
    return targetId.startsWith("#") ? targetId.slice(1) : targetId;
  }

  private findElementByAny(targetId?: string): HTMLElement | null {
    if (!targetId) {
      return null;
    }

    // Strip # prefix if present (ElementPicker returns #customId format)
    const normalizedId = this.normalizeElementId(targetId);

    // 1. Try native DOM id attribute (matches customId set via id={element.customId})
    const byId = document.getElementById(normalizedId);
    if (byId) {
      return byId;
    }

    // 2. Try data attributes
    const safeId = this.escapeSelector(normalizedId);
    const selectors = [
      `[data-element-id="${safeId}"]`, // UUID lookup
      `[data-custom-id="${safeId}"]`, // customId lookup
      `[data-modal-id="${safeId}"]`, // Modal-specific lookup
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (el) {
        return el;
      }
    }

    // 3. Log warning for debugging
    console.warn(
      `[EventEngine] Element not found for ID: "${targetId}" (normalized: "${normalizedId}")`,
    );
    return null;
  }

  private findModalElement(
    modalId: string,
  ): { element: HTMLElement; resolvedId: string } | null {
    if (!modalId) {
      return null;
    }

    // Strip # prefix if present
    const normalizedId = this.normalizeElementId(modalId);

    const byId = document.getElementById(normalizedId);
    if (byId) {
      return { element: byId, resolvedId: byId.id || normalizedId };
    }

    const safeId = this.escapeSelector(normalizedId);
    const selectors = [
      `[data-element-id="${safeId}"]`,
      `[data-modal-id="${safeId}"]`,
      `[data-custom-id="${safeId}"]`,
    ];

    for (const selector of selectors) {
      const candidate = document.querySelector(selector) as HTMLElement | null;
      if (candidate) {
        const resolvedId =
          candidate.id ||
          candidate.getAttribute("data-element-id") ||
          candidate.getAttribute("data-modal-id") ||
          candidate.getAttribute("data-custom-id") ||
          normalizedId;
        return { element: candidate, resolvedId };
      }
    }

    console.warn(
      `[EventEngine] Modal not found for ID: "${modalId}" (normalized: "${normalizedId}")`,
    );
    return null;
  }

  private ensureModalBackdrop(modalId: string): string {
    const existingId = this.modalBackdrops.get(modalId);
    if (existingId) {
      const existing = document.getElementById(existingId);
      if (existing) {
        return existingId;
      }
    }

    const backdropId = `modal-backdrop-${modalId}`;
    let backdrop = document.getElementById(backdropId);

    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = backdropId;
      backdrop.className = "modal-backdrop";
      backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999;
            `;

      backdrop.addEventListener("click", () => {
        this.hideModalById(modalId);
      });

      document.body.appendChild(backdrop);
    }

    this.modalBackdrops.set(modalId, backdropId);
    return backdropId;
  }

  private hideModalById(modalId: string) {
    const found = this.findModalElement(modalId);
    if (!found) {
      console.warn(`Modal with ID "${modalId}" not found`);
      return;
    }
    const { element: modal, resolvedId } = found;

    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");

    const backdropId =
      modal.getAttribute("data-backdrop-id") ||
      this.modalBackdrops.get(resolvedId);
    if (backdropId) {
      const backdrop = document.getElementById(backdropId);
      if (backdrop) {
        backdrop.remove();
      }
      this.modalBackdrops.delete(resolvedId);
    }

    this.shownModalIds.delete(resolvedId);

    if (this.lastShownModalId === resolvedId) {
      this.lastShownModalId = undefined;
    }
  }

  private async executeScrollToAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      elementId: string;
      behavior?: ScrollBehavior;
      position?: "start" | "center" | "end" | "nearest";
      offset?: number;
    }>(action);
    const {
      elementId,
      behavior = "smooth",
      position = "start",
      offset = 0,
    } = config;

    // Use findElementByAny for consistent element lookup (supports #customId, UUID, data attributes)
    const element = this.findElementByAny(elementId);

    if (element) {
      element.scrollIntoView({ behavior, block: position });

      // Apply offset if specified
      if (offset !== 0) {
        window.scrollBy({ top: -offset, behavior });
      }
    }
  }

  private async executeCopyToClipboardAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{ text: string }>(action);
    const { text } = config;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      // 폴백 구현
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  }

  private async executeValidateFormAction(
    action: EventAction,
  ): Promise<boolean> {
    const config = this.getActionConfig<{ formId: string; rules?: unknown[] }>(
      action,
    );
    const { formId, rules = [] } = config;

    if (!formId || typeof formId !== "string") {
      throw new Error("Invalid form ID");
    }

    // Use findElementByAny for consistent element lookup (supports #customId, UUID)
    const form = this.findElementByAny(formId) as HTMLFormElement;
    if (!form) {
      throw new Error(`Form with ID "${formId}" not found`);
    }

    let isValid = true;
    const errors: string[] = [];

    for (const rule of rules) {
      const { field, type, message, required, minLength, maxLength, pattern } =
        rule as {
          field: string;
          type: string;
          message?: string;
          required?: boolean;
          minLength?: number;
          maxLength?: number;
          pattern?: string;
        };
      const fieldElement = form.querySelector(
        `[name="${field}"]`,
      ) as HTMLInputElement;

      if (!fieldElement) {
        errors.push(`Field "${field}" not found`);
        isValid = false;
        continue;
      }

      const value = fieldElement.value.trim();

      // 필수 필드 검증
      if (required && !value) {
        errors.push(message || `Field "${field}" is required`);
        isValid = false;
        continue;
      }

      // 길이 검증
      if (minLength && value.length < minLength) {
        errors.push(
          message ||
            `Field "${field}" must be at least ${minLength} characters`,
        );
        isValid = false;
      }

      if (maxLength && value.length > maxLength) {
        errors.push(
          message ||
            `Field "${field}" must be no more than ${maxLength} characters`,
        );
        isValid = false;
      }

      // 패턴 검증
      if (pattern && value && !new RegExp(pattern).test(value)) {
        errors.push(message || `Field "${field}" format is invalid`);
        isValid = false;
      }

      // 타입별 검증
      switch (type) {
        case "email":
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(message || `Field "${field}" must be a valid email`);
            isValid = false;
          }
          break;
        case "number":
          if (value && isNaN(Number(value))) {
            errors.push(message || `Field "${field}" must be a number`);
            isValid = false;
          }
          break;
        case "url":
          if (value) {
            try {
              new URL(value);
            } catch {
              errors.push(message || `Field "${field}" must be a valid URL`);
              isValid = false;
            }
          }
          break;
      }
    }

    // 에러 표시
    if (!isValid) {
      console.warn("Form validation errors:", errors);
      // 에러를 상태에 저장하거나 UI에 표시
      this.setState("formErrors", { formId, errors });
    }

    return isValid;
  }

  private async executeResetFormAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{ formId: string }>(action);
    const { formId } = config;

    // Use findElementByAny for consistent element lookup (supports #customId, UUID)
    const form = this.findElementByAny(formId) as HTMLFormElement;

    if (form) {
      form.reset();
    }
  }

  private async executeSubmitFormAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{ formId: string }>(action);

    // Use findElementByAny for consistent element lookup (supports #customId, UUID)
    const form = this.findElementByAny(config.formId) as HTMLFormElement;

    if (form) {
      form.requestSubmit();
    }
  }

  private async executeShowToastAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      message: string;
      variant?: "info" | "success" | "warning" | "error";
      duration?: number;
    }>(action);

    // postMessage로 Builder에 토스트 표시 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("SHOW_TOAST", config);
    } else {
      console.log(`[Toast ${config.variant || "info"}]: ${config.message}`);
    }
  }

  private async executeAPICallAction(action: EventAction): Promise<unknown> {
    const config = this.getActionConfig<{
      endpoint: string;
      method?: string;
      headers?: Record<string, string>;
      body?: unknown;
    }>(action);

    try {
      const response = await fetch(config.endpoint, {
        method: config.method || "GET",
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[EventEngine] API call failed:", error);
      throw error;
    }
  }

  // ===== Phase 3: Component Interaction Actions =====

  private async executeSetComponentStateAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      targetId: string;
      statePath: string;
      value: unknown;
    }>(action);

    // postMessage로 Preview에 상태 변경 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("SET_COMPONENT_STATE", config);
    } else {
      console.warn(
        "[EventEngine] setComponentState in published mode not yet implemented",
      );
    }
  }

  private async executeTriggerComponentActionAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      targetId: string;
      action: string;
      params?: Record<string, unknown>;
    }>(action);

    // postMessage로 Preview에 액션 실행 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("TRIGGER_COMPONENT_ACTION", config);
    } else {
      console.warn(
        "[EventEngine] triggerComponentAction in published mode not yet implemented",
      );
    }
  }

  private async executeUpdateFormFieldAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      formId?: string;
      fieldName: string;
      value: unknown;
    }>(action);

    let field:
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null = null;

    if (config.formId) {
      // Use findElementByAny for consistent element lookup (supports #customId, UUID)
      const form = this.findElementByAny(config.formId) as HTMLFormElement;
      if (form) {
        field = form.querySelector(`[name="${config.fieldName}"]`);
      }
    } else {
      field = document.querySelector(`[name="${config.fieldName}"]`);
    }

    if (field) {
      field.value = String(config.value);
      // trigger change event
      field.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      console.warn(`[EventEngine] Form field not found: ${config.fieldName}`);
    }
  }

  // ===== Phase 4: Collection Interaction Actions =====

  private async executeFilterCollectionAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      targetId: string;
      filterMode: "text" | "function" | "field";
      query?: string;
      filterFn?: string;
      fieldName?: string;
      fieldValue?: unknown;
    }>(action);

    // postMessage로 Preview에 필터링 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("FILTER_COLLECTION", config);
    } else {
      console.warn(
        "[EventEngine] filterCollection in published mode not yet implemented",
      );
    }
  }

  private async executeSelectItemAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      targetId: string;
      itemId?: string;
      itemIndex?: number;
      behavior: "replace" | "add" | "toggle";
    }>(action);

    // postMessage로 Preview에 선택 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("SELECT_ITEM", config);
    } else {
      console.warn(
        "[EventEngine] selectItem in published mode not yet implemented",
      );
    }
  }

  private async executeClearSelectionAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{ targetId: string }>(action);

    // postMessage로 Preview에 선택 해제 요청
    if (this.isBuilderMode()) {
      this.postBuilderMessage("CLEAR_SELECTION", config);
    } else {
      console.warn(
        "[EventEngine] clearSelection in published mode not yet implemented",
      );
    }
  }

  // ===== Phase 5: Data Panel Integration Actions =====

  /**
   * DataTable 로드 액션
   * DataTable을 로드하거나 강제 새로고침합니다.
   */
  private async executeLoadDataTableAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      dataTableName: string;
      forceRefresh?: boolean;
      cacheTTL?: number;
      targetVariable?: string;
    }>(action);

    if (!config.dataTableName) {
      console.warn("[EventEngine] loadDataTable: dataTableName is required");
      return;
    }

    // Builder 모드에서만 실행 (Canvas → Builder 통신)
    if (this.isBuilderMode()) {
      this.postBuilderMessage("LOAD_DATA_TABLE", {
        dataTableName: config.dataTableName,
        forceRefresh: config.forceRefresh ?? false,
        cacheTTL: config.cacheTTL,
        targetVariable: config.targetVariable,
      });
    } else {
      console.warn(
        "[EventEngine] loadDataTable in published mode not yet implemented",
      );
    }
  }

  /**
   * 컴포넌트 간 데이터 동기화 액션
   * 소스 컴포넌트의 데이터를 타겟 컴포넌트로 동기화합니다.
   */
  private async executeSyncComponentAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      sourceId: string;
      targetId: string;
      syncMode: "replace" | "merge" | "append";
      dataPath?: string;
    }>(action);

    if (!config.sourceId || !config.targetId) {
      console.warn(
        "[EventEngine] syncComponent: sourceId and targetId are required",
      );
      return;
    }

    if (this.isBuilderMode()) {
      this.postBuilderMessage("SYNC_COMPONENT", {
        sourceId: config.sourceId,
        targetId: config.targetId,
        syncMode: config.syncMode || "replace",
        dataPath: config.dataPath,
      });
    } else {
      console.warn(
        "[EventEngine] syncComponent in published mode not yet implemented",
      );
    }
  }

  /**
   * DataTable에 데이터 저장 액션
   * API 응답이나 변수의 데이터를 DataTable에 저장합니다.
   */
  private async executeSaveToDataTableAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      dataTableName: string;
      source: "response" | "variable" | "static";
      sourcePath?: string;
      saveMode: "replace" | "merge" | "append" | "upsert";
      keyField?: string;
      transform?: string;
    }>(action);

    if (!config.dataTableName) {
      console.warn("[EventEngine] saveToDataTable: dataTableName is required");
      return;
    }

    if (this.isBuilderMode()) {
      this.postBuilderMessage("SAVE_TO_DATA_TABLE", {
        dataTableName: config.dataTableName,
        source: config.source || "response",
        sourcePath: config.sourcePath,
        saveMode: config.saveMode || "replace",
        keyField: config.keyField,
        transform: config.transform,
      });
    } else {
      console.warn(
        "[EventEngine] saveToDataTable in published mode not yet implemented",
      );
    }
  }

  // ===== Variable Actions =====

  /**
   * Variable 값 설정 액션
   * Global/Page 변수의 값을 설정합니다.
   */
  private async executeSetVariableAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      variableName: string;
      value: unknown;
      persist?: boolean;
    }>(action);

    if (!config.variableName) {
      console.warn("[EventEngine] setVariable: variableName is required");
      return;
    }

    // 로컬 상태에도 저장 (Canvas 내에서 즉시 사용 가능)
    this.setState(config.variableName, config.value);

    // Builder에 변경 사항 알림 (persist:true인 경우 DB에 저장)
    if (this.isBuilderMode()) {
      this.postBuilderMessage("SET_VARIABLE", {
        variableName: config.variableName,
        value: config.value,
        persist: config.persist ?? false,
      });
    }
  }

  /**
   * Variable 값 가져오기 액션
   * Global/Page 변수의 값을 가져와 지정된 상태에 저장합니다.
   */
  private async executeGetVariableAction(
    action: EventAction,
  ): Promise<unknown> {
    const config = this.getActionConfig<{
      variableName: string;
      targetStatePath?: string;
    }>(action);

    if (!config.variableName) {
      console.warn("[EventEngine] getVariable: variableName is required");
      return undefined;
    }

    const value = this.state[config.variableName];

    // targetStatePath가 있으면 해당 경로에 저장
    if (config.targetStatePath) {
      this.setState(config.targetStatePath, value);
    }

    return value;
  }

  /**
   * DataTable 데이터 fetch 액션
   */
  private async executeFetchDataTableAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      dataTableName: string;
      targetVariable?: string;
    }>(action);

    if (!config.dataTableName) {
      console.warn("[EventEngine] fetchDataTable: dataTableName is required");
      return;
    }

    if (this.isBuilderMode()) {
      this.postBuilderMessage("FETCH_DATA_TABLE", {
        dataTableName: config.dataTableName,
        targetVariable: config.targetVariable,
      });
    } else {
      console.warn(
        "[EventEngine] fetchDataTable in published mode not yet implemented",
      );
    }
  }

  /**
   * DataTable 새로고침 액션
   */
  private async executeRefreshDataTableAction(
    action: EventAction,
  ): Promise<void> {
    const config = this.getActionConfig<{
      dataTableName: string;
    }>(action);

    if (!config.dataTableName) {
      console.warn("[EventEngine] refreshDataTable: dataTableName is required");
      return;
    }

    if (this.isBuilderMode()) {
      this.postBuilderMessage("REFRESH_DATA_TABLE", {
        dataTableName: config.dataTableName,
      });
    } else {
      console.warn(
        "[EventEngine] refreshDataTable in published mode not yet implemented",
      );
    }
  }

  /**
   * API 실행 액션 (ApiEndpoint 기반)
   */
  private async executeApiAction(action: EventAction): Promise<void> {
    const config = this.getActionConfig<{
      endpointName: string;
      params?: Record<string, unknown>;
      targetVariable?: string;
    }>(action);

    if (!config.endpointName) {
      console.warn("[EventEngine] executeApi: endpointName is required");
      return;
    }

    if (this.isBuilderMode()) {
      this.postBuilderMessage("EXECUTE_API", {
        endpointName: config.endpointName,
        params: config.params,
        targetVariable: config.targetVariable,
      });
    } else {
      console.warn(
        "[EventEngine] executeApi in published mode not yet implemented",
      );
    }
  }

  // 정리 메서드
  cleanup() {
    this.executionTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.executionTimeouts.clear();

    // 상태 정리
    this.state = {};

    // 모달 상태 정리
    this.modalBackdrops.forEach((id) => {
      const backdrop = document.getElementById(id);
      if (backdrop) {
        backdrop.remove();
      }
    });
    this.modalBackdrops.clear();
    this.shownModalIds.clear();
    this.lastShownModalId = undefined;

    // 액션 핸들러 정리
    this.actionHandlers = {};
  }
}

// 싱글톤 인스턴스
export const eventEngine = new EventEngine();
