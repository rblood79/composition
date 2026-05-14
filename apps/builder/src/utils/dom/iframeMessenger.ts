import { Element } from "../../types/core/store.types";
import type { DesignToken } from "../../types/theme";
import { ElementUtils } from "../element/elementUtils";

// 메시지 데이터 타입 정의
export interface MessageData {
  type: string;
  id: string;
  timestamp: number;
  [key: string]:
    | string
    | number
    | boolean
    | Element[]
    | Record<string, unknown>
    | undefined;
}

// 메시지 핸들러 타입 정의
export type MessageHandler<T = Record<string, unknown>> = (data: T) => void;

// 응답 메시지 타입 정의
export interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  id: string;
  timestamp: number;
}

interface PendingMessage {
  resolve: (response: MessageResponse) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface QueuedMessage extends PendingMessage {
  message: MessageData;
}

export class IframeMessenger {
  private iframe: HTMLIFrameElement | null = null;
  private handlers: Map<string, MessageHandler> = new Map();
  private messageQueue: QueuedMessage[] = [];
  private isReady = false;
  private maxQueueSize = 100;
  private allowedOrigins: string[];
  private pendingMessages = new Map<string, PendingMessage>();
  private readonly messageListener = (event: MessageEvent) => {
    this.handleWindowMessage(event);
  };
  private readonly iframeLoadListener = () => {
    this.isReady = true;
    this.flushMessageQueue();
  };

  constructor(iframeRef?: HTMLIFrameElement, allowedOrigins?: string[]) {
    this.allowedOrigins = allowedOrigins || [window.location.origin];
    if (iframeRef) this.setIframe(iframeRef);
    this.initMessageListener();
  }

  setIframe(iframe: HTMLIFrameElement) {
    if (this.iframe) {
      this.iframe.removeEventListener("load", this.iframeLoadListener);
    }

    this.iframe = iframe;
    this.isReady = false;

    iframe.addEventListener("load", this.iframeLoadListener);
  }

  private initMessageListener() {
    window.addEventListener("message", this.messageListener);
  }

  private handleWindowMessage(event: MessageEvent): void {
    if (!this.isAllowedOrigin(event.origin)) {
      console.warn(`Blocked message from unauthorized origin: ${event.origin}`);
      return;
    }

    if (!this.isExpectedSource(event.source)) {
      console.warn("Blocked message from unexpected source");
      return;
    }

    const message = event.data as Partial<MessageData & MessageResponse>;
    const { type, id, ...data } = message;

    if (!id || typeof id !== "string") {
      console.warn("Invalid message: missing or invalid ID");
      return;
    }

    const pending = this.pendingMessages.get(id);
    if (pending && typeof message.success === "boolean") {
      clearTimeout(pending.timeoutId);
      this.pendingMessages.delete(id);
      pending.resolve(message as MessageResponse);
      return;
    }

    if (type === "PREVIEW_READY") {
      this.isReady = true;
      this.flushMessageQueue();
      return;
    }

    const handler = this.handlers.get(String(type));
    if (handler) {
      try {
        handler(data);
      } catch (error) {
        console.error(`Message handler error for type "${type}":`, error);
      }
    }
  }

  private isExpectedSource(source: MessageEventSource | null): boolean {
    if (!this.iframe?.contentWindow) return true;
    return source === this.iframe.contentWindow;
  }

  private isAllowedOrigin(origin: string): boolean {
    return this.allowedOrigins.includes(origin);
  }

  registerHandler<T = Record<string, unknown>>(
    type: string,
    handler: MessageHandler<T>,
  ) {
    this.handlers.set(type, handler as MessageHandler);
  }

  unregisterHandler(type: string) {
    this.handlers.delete(type);
  }

  sendMessage(
    type: string,
    data: Record<string, unknown> = {},
    timeout = 5000,
  ): Promise<MessageResponse> {
    return new Promise((resolve, reject) => {
      const messageId = ElementUtils.generateId();
      const message: MessageData = {
        ...data,
        type,
        id: messageId,
        timestamp: Date.now(),
      };

      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        this.messageQueue = this.messageQueue.filter(
          (queued) => queued.message.id !== messageId,
        );
        reject(new Error(`Message timeout: ${type}`));
      }, timeout);

      const pending: PendingMessage = { resolve, reject, timeoutId };
      this.pendingMessages.set(messageId, pending);

      if (!this.isReady || !this.iframe?.contentWindow) {
        if (this.messageQueue.length >= this.maxQueueSize) {
          const removed = this.messageQueue.shift();
          if (removed) {
            clearTimeout(removed.timeoutId);
            this.pendingMessages.delete(removed.message.id);
            removed.reject(
              new Error(`Message queue overflow: ${removed.message.type}`),
            );
          }
        }
        this.messageQueue.push({ message, ...pending });
        return;
      }

      this.postMessage(message, pending);
    });
  }

  private postMessage(message: MessageData, pending: PendingMessage): void {
    try {
      this.iframe?.contentWindow?.postMessage(message, window.location.origin);
    } catch (error) {
      clearTimeout(pending.timeoutId);
      this.pendingMessages.delete(message.id);
      pending.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const queued = this.messageQueue.shift()!;
      this.postMessage(queued.message, queued);
    }
  }

  updateElementProps(
    elementId: string,
    props: Record<string, unknown>,
    merge = true,
  ): Promise<MessageResponse> {
    return this.sendMessage("UPDATE_ELEMENT_PROPS", {
      elementId,
      props,
      merge,
    });
  }

  updateThemeVars(vars: DesignToken[]): Promise<MessageResponse> {
    return this.sendMessage("THEME_VARS", { vars });
  }

  // 정리
  destroy() {
    window.removeEventListener("message", this.messageListener);

    if (this.iframe) {
      this.iframe.removeEventListener("load", this.iframeLoadListener);
    }

    this.pendingMessages.forEach((pending) => {
      clearTimeout(pending.timeoutId);
      pending.reject(new Error("IframeMessenger destroyed"));
    });
    this.pendingMessages.clear();

    this.handlers.clear();
    this.messageQueue = [];
    this.iframe = null;
    this.isReady = false;
  }
}

// 싱글톤 인스턴스
export const iframeMessenger = new IframeMessenger();
