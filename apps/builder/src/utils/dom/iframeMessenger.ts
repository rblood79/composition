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

export class IframeMessenger {
  private iframe: HTMLIFrameElement | null = null;
  private handlers: Map<string, MessageHandler> = new Map();
  private messageQueue: MessageData[] = [];
  private isReady = false;
  private maxQueueSize = 100;
  private allowedOrigins: string[];
  private messageTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(iframeRef?: HTMLIFrameElement, allowedOrigins?: string[]) {
    this.allowedOrigins = allowedOrigins || [window.location.origin];
    if (iframeRef) this.setIframe(iframeRef);
    this.initMessageListener();
  }

  setIframe(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.isReady = false;

    iframe.addEventListener("load", () => {
      this.isReady = true;
      this.flushMessageQueue();
    });
  }

  private initMessageListener() {
    window.addEventListener("message", (event) => {
      // Origin 검증 강화
      if (!this.isAllowedOrigin(event.origin)) {
        console.warn(
          `Blocked message from unauthorized origin: ${event.origin}`,
        );
        return;
      }

      const { type, id, ...data } = event.data as MessageData;

      // 메시지 ID 검증
      if (!id || typeof id !== "string") {
        console.warn("Invalid message: missing or invalid ID");
        return;
      }

      // iframe 준비 신호 처리
      if (type === "PREVIEW_READY") {
        this.isReady = true;
        this.flushMessageQueue();
        return;
      }

      const handler = this.handlers.get(type);
      if (handler) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Message handler error for type "${type}":`, error);
        }
      }
    });
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
        type,
        id: messageId,
        timestamp: Date.now(),
        ...data,
      };

      // 타임아웃 설정
      const timeoutId = setTimeout(() => {
        this.messageTimeouts.delete(messageId);
        reject(new Error(`Message timeout: ${type}`));
      }, timeout);

      this.messageTimeouts.set(messageId, timeoutId);

      if (!this.isReady || !this.iframe?.contentWindow) {
        if (this.messageQueue.length >= this.maxQueueSize) {
          // 큐가 가득 찬 경우 오래된 메시지 제거
          const removed = this.messageQueue.shift();
          if (removed?.id) {
            const timeoutId = this.messageTimeouts.get(removed.id);
            if (timeoutId) {
              clearTimeout(timeoutId);
              this.messageTimeouts.delete(removed.id);
            }
          }
        }
        this.messageQueue.push(message);
        return;
      }

      try {
        this.iframe.contentWindow.postMessage(message, window.location.origin);

        // 응답 핸들러 등록
        const responseHandler = (event: MessageEvent) => {
          const response = event.data as MessageResponse;
          if (response.id === messageId) {
            clearTimeout(timeoutId);
            this.messageTimeouts.delete(messageId);
            window.removeEventListener("message", responseHandler);
            resolve(response);
          }
        };

        window.addEventListener("message", responseHandler);
      } catch (error) {
        clearTimeout(timeoutId);
        this.messageTimeouts.delete(messageId);
        reject(error);
      }
    });
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      this.sendMessage(message.type, message);
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
    // 모든 타임아웃 정리
    this.messageTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.messageTimeouts.clear();

    this.handlers.clear();
    this.messageQueue = [];
    this.iframe = null;
    this.isReady = false;
  }
}

// 싱글톤 인스턴스
export const iframeMessenger = new IframeMessenger();
