/**
 * MessagingService - Unified iframe messaging layer
 *
 * Architecture:
 * ┌─────────────────────────────────────┐
 * │  Application Layer                  │
 * │  (Builder, Inspector, Preview)      │
 * └──────────────┬──────────────────────┘
 *                │
 * ┌──────────────▼──────────────────────┐
 * │  Message Service (Facade)           │  ← THIS FILE
 * │  - High-level API                   │
 * │  - Type-safe methods                │
 * └──────────────┬──────────────────────┘
 *                │
 * ┌──────────────▼──────────────────────┐
 * │  Transport Layer                    │  ← IframeMessenger
 * │  - Queue management                 │
 * │  - Timeout handling                 │
 * │  - Origin validation                │
 * └─────────────────────────────────────┘
 *
 * Benefits:
 * - Single source of truth for messaging
 * - Type-safe API
 * - Consistent error handling
 * - Automatic queue management
 * - Origin validation
 */

import { IframeMessenger, MessageResponse } from "../utils/dom/iframeMessenger";
import { Element, ComponentElementProps } from "../types/core/store.types";
import { DesignToken } from "../types/theme";

/**
 * Unified message payload type
 */
export interface MessagePayload {
  // Element Operations
  elements?: Element[];
  elementId?: string;
  props?: ComponentElementProps;
  element?: Element;
  elementIds?: string[];
  merge?: boolean;

  // Theme Operations
  tokens?: DesignToken[];
  vars?: Array<{ cssVar: string; value: string; isDark?: boolean }>;
  styles?: Record<string, string>;
  isDark?: boolean;

  // Navigation
  path?: string;

  // Error & Loading
  message?: string;
  error?: string;
  loading?: boolean;

  // Generic
  [key: string]: unknown;
}

/**
 * MessagingService - High-level facade over IframeMessenger
 */
export class MessagingService {
  private static instance: MessagingService;
  private messenger: IframeMessenger;

  private constructor() {
    this.messenger = new IframeMessenger();
  }

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  // ===== Initialization =====

  /**
   * Set the iframe reference for messaging
   */
  setIframe(iframe: HTMLIFrameElement): void {
    this.messenger.setIframe(iframe);
  }

  /**
   * Get iframe by ID (fallback method)
   */
  private getIframeById(id: string): HTMLIFrameElement | null {
    return document.getElementById(id) as HTMLIFrameElement;
  }

  /**
   * Initialize with iframe ID
   */
  initWithId(iframeId: string): void {
    const iframe = this.getIframeById(iframeId);
    if (iframe) {
      this.setIframe(iframe);
    }
  }

  // ===== Element Operations =====

  /**
   * Update element props (merge or replace)
   */
  async updateElementProps(
    elementId: string,
    props: ComponentElementProps,
    merge = true,
  ): Promise<MessageResponse> {
    return this.messenger.sendMessage("UPDATE_ELEMENT_PROPS", {
      elementId,
      props,
      merge,
    });
  }

  /**
   * Add a new element
   */
  async addElement(element: Element): Promise<MessageResponse> {
    return this.messenger.sendMessage("ELEMENT_ADDED", { element });
  }

  /**
   * Remove a single element
   */
  async removeElement(elementId: string): Promise<MessageResponse> {
    return this.messenger.sendMessage("DELETE_ELEMENT", { elementId });
  }

  /**
   * Remove multiple elements
   */
  async removeElements(elementIds: string[]): Promise<MessageResponse> {
    return this.messenger.sendMessage("DELETE_ELEMENTS", { elementIds });
  }

  /**
   * Select an element
   */
  async selectElement(
    elementId: string | null,
    props?: ComponentElementProps,
  ): Promise<MessageResponse> {
    return this.messenger.sendMessage("ELEMENT_SELECTED", {
      elementId,
      props,
    });
  }

  // ===== Theme Operations =====

  /**
   * Update theme variables (new format with dark mode support)
   */
  async updateThemeVars(
    vars: Array<{ cssVar: string; value: string; isDark?: boolean }>,
  ): Promise<MessageResponse> {
    return this.messenger.sendMessage("THEME_VARS", { vars });
  }

  /**
   * Update theme tokens (legacy format)
   */
  async updateThemeTokens(
    styles: Record<string, string>,
  ): Promise<MessageResponse> {
    return this.messenger.sendMessage("UPDATE_THEME_TOKENS", { styles });
  }

  /**
   * Update theme tokens using DesignToken format
   */
  async updateThemeFromTokens(tokens: DesignToken[]): Promise<MessageResponse> {
    return this.messenger.updateThemeVars(tokens);
  }

  /**
   * Set dark mode
   */
  async setDarkMode(isDark: boolean): Promise<MessageResponse> {
    return this.messenger.sendMessage("SET_DARK_MODE", { isDark });
  }

  // ===== Navigation =====

  /**
   * Navigate to a page
   */
  async navigateToPage(path: string): Promise<MessageResponse> {
    return this.messenger.sendMessage("NAVIGATE_TO_PAGE", { path });
  }

  // ===== Error & Loading States =====

  /**
   * Send error message
   */
  async sendError(message: string): Promise<MessageResponse> {
    return this.messenger.sendMessage("ERROR", { message });
  }

  /**
   * Send loading state
   */
  async sendLoading(loading: boolean): Promise<MessageResponse> {
    return this.messenger.sendMessage("LOADING", { loading });
  }

  // ===== Message Handlers =====

  /**
   * Register a message handler
   */
  registerHandler<T = MessagePayload>(
    type: string,
    handler: (data: T) => void,
  ): void {
    this.messenger.registerHandler(type, handler);
  }

  /**
   * Unregister a message handler
   */
  unregisterHandler(type: string): void {
    this.messenger.unregisterHandler(type);
  }

  // ===== Cleanup =====

  /**
   * Destroy the messaging service
   */
  destroy(): void {
    this.messenger.destroy();
  }

  // ===== Direct Access (for advanced use cases) =====

  /**
   * Get the underlying IframeMessenger instance
   */
  getMessenger(): IframeMessenger {
    return this.messenger;
  }

  /**
   * Send a custom message
   */
  async sendCustomMessage(
    type: string,
    data: MessagePayload = {},
    timeout = 5000,
  ): Promise<MessageResponse> {
    return this.messenger.sendMessage(type, data, timeout);
  }
}

// ===== Singleton Instance =====

/**
 * Global singleton instance
 */
export const messagingService = MessagingService.getInstance();

// ===== Convenience Functions =====

/**
 * Send message to iframe (simple wrapper)
 */
export function sendToIframe(
  type: string,
  payload: MessagePayload,
): Promise<MessageResponse> {
  return messagingService.sendCustomMessage(type, payload);
}

/**
 * Send message to window (for Preview → Parent communication)
 */
export function sendToWindow(type: string, payload: MessagePayload): void {
  window.postMessage({ type, payload }, window.location.origin);
}

/**
 * Clear overlay (convenience function)
 */
export function clearOverlay(): void {
  sendToWindow("CLEAR_OVERLAY", {});
}
