/**
 * ADR-224 — 캔버스 핸들 resize 의 presentation 세션 (spacing 세션과 같은 어법, breakdown §4.3).
 *
 * 드래그 중에는 프레임당 `style.patch` 하나 — 요청 크기 (숫자 px) + marker 축의 Fill 파생
 * CSS 제거 키 (`""`) — 를 publish 해 엔진이 Fixed 로 미리 놓는다. `finish` 는 runtime 의
 * commit 한 번 (`RESIZE_COMMIT_INTENT` → `commitCanvasResizePresentation`) 으로 store 명령
 * `applyCanvasResize` 를 부른다: 그 축의 marker null + CSS px + Fill 파생 CSS 정리, 다른 축
 * 보존, history 1개. 시작 크기와 같으면 no-op (override 를 만들지 않는다).
 *
 * layout receipt 가 rejected (grid 조상 · 스트림 없음 등) 면 미리보기가 안 보였으므로 commit
 * 하지 않고 취소한다 — 안 보인 값을 저장하지 않는다.
 */

import { useStore } from "../stores";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import type {
  EditorPresentationCommitInput,
  EditorPresentationCommitResult,
  EditorPresentationTransactionRuntime,
} from "./editorPresentationRuntime";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationFinishResult,
  EditorPresentationHandle,
} from "./editorPresentationTypes";
import {
  subscribeLayoutReceipts,
  type PresentationLayoutReceipt,
} from "./editorPresentationLayoutReceipt";

export const RESIZE_COMMIT_INTENT = "style-layout-size-resize";

export interface ResizeSessionSize {
  readonly width?: number;
  readonly height?: number;
  /** absolute 요소의 CSS left/top px — bridge 가 현재 left/top 과의 차로 layout x/y 를 옮긴다 */
  readonly left?: number;
  readonly top?: number;
}

export interface ResizeSessionBeginInput {
  readonly nodeId: string;
  readonly projectId: string;
  readonly ownerId: string;
  readonly runtime: EditorPresentationTransactionRuntime;
  /** 시작 used border-box (scene px) + absolute 면 시작 CSS left/top — 같은 값이면 finish 는 no-op */
  readonly startSize: ResizeSessionSize;
  /** 요청 축의 Fill 파생 CSS 제거 키 (값 "") — `resolveFillReleasePatch` */
  readonly releasePatch: Readonly<Record<string, "">>;
}

export type ResizeSessionPhase = "active" | "finalizing" | "closed";

const SIZE_KEYS = ["width", "height", "left", "top"] as const;

function sizeEqual(
  requested: ResizeSessionSize | null,
  start: ResizeSessionSize,
): boolean {
  if (!requested) return true;
  return SIZE_KEYS.every(
    (key) => requested[key] === undefined || requested[key] === start[key],
  );
}

function sameRequest(a: ResizeSessionSize, b: ResizeSessionSize): boolean {
  return SIZE_KEYS.every((key) => a[key] === b[key]);
}

export class ResizePresentationSession {
  readonly sessionId: string;
  readonly nodeId: string;

  #handle: EditorPresentationHandle;
  #phase: ResizeSessionPhase = "active";
  #startSize: ResizeSessionSize;
  #releasePatch: Readonly<Record<string, "">>;
  #requested: ResizeSessionSize | null = null;
  #lastReject: PresentationLayoutReceipt | null = null;
  #unsubscribeEvents: () => void;
  #unsubscribeReceipts: () => void;

  constructor(input: ResizeSessionBeginInput) {
    this.nodeId = input.nodeId;
    this.#startSize = input.startSize;
    this.#releasePatch = input.releasePatch;
    this.#handle = input.runtime.beginEditorPresentation({
      commitIntent: RESIZE_COMMIT_INTENT,
      ownerId: input.ownerId,
      projectId: input.projectId,
      targets: [{ kind: "canonical-node", nodeId: input.nodeId }],
    });
    this.sessionId = this.#handle.sessionId;
    this.#unsubscribeEvents = input.runtime.subscribeSessionEvents((event) => {
      if (event.session.sessionId !== this.sessionId) return;
      if (event.type === "updated") return;
      // terminal (다른 경로의 cancel 포함) → 닫힘
      this.#close();
    });
    this.#unsubscribeReceipts = subscribeLayoutReceipts((receipt) => {
      if (receipt.sessionId !== this.sessionId) return;
      if (receipt.result === "rejected") this.#lastReject = receipt;
      else this.#lastReject = null;
    });
  }

  get phase(): ResizeSessionPhase {
    return this.#phase;
  }

  get requested(): ResizeSessionSize | null {
    return this.#requested;
  }

  get lastRejectReason(): string | null {
    return this.#lastReject?.result === "rejected"
      ? this.#lastReject.reason
      : null;
  }

  /** 프레임당 요청 크기 — 같은 값이면 publish 하지 않는다. */
  setSize(size: ResizeSessionSize): boolean {
    if (this.#phase !== "active") return false;
    for (const key of SIZE_KEYS) {
      const value = size[key];
      if (value === undefined) continue;
      if (!Number.isFinite(value)) return false;
      if ((key === "width" || key === "height") && value < 0) return false;
    }
    if (this.#requested && sameRequest(this.#requested, size)) return true;
    this.#requested = { ...size };
    const descriptor: EditorMutationDescriptor = {
      patch: { ...this.#releasePatch, ...size },
      target: { kind: "canonical-node", nodeId: this.nodeId },
      type: "style.patch",
    };
    const published = this.#handle.publish(descriptor);
    if (!published) {
      this.cancel("conflict");
      return false;
    }
    return true;
  }

  /** commit 1회 (runtime → `commitCanvasResizePresentation`). 시작 크기와 같으면 no-op. */
  finish(): EditorPresentationFinishResult {
    if (this.#phase !== "active") {
      return { status: "cancelled", reason: "superseded" };
    }
    this.#phase = "finalizing";
    if (sizeEqual(this.#requested, this.#startSize)) {
      this.#handle.cancel("superseded");
      this.#close();
      return { status: "no-op" };
    }
    if (this.#lastReject) {
      this.#handle.cancel("conflict");
      this.#close();
      return { status: "cancelled", reason: "conflict" };
    }
    // 마지막 applied/pending descriptor 그대로 commit — 값 형식이 같아 closing 재적용 0 (restore 없음)
    const result = this.#handle.finish();
    this.#close();
    return result;
  }

  cancel(reason: EditorPresentationCancelReason): boolean {
    if (this.#phase === "closed") return false;
    const cancelled = this.#handle.cancel(reason);
    this.#close();
    return cancelled;
  }

  #close(): void {
    if (this.#phase === "closed") return;
    this.#phase = "closed";
    this.#unsubscribeEvents();
    this.#unsubscribeReceipts();
    if (activeSession === this) setActiveResizeSession(null);
  }
}

// ─── runtime commit (editorPresentationCanonicalRuntimeOptions 가 intent 로 분기) ──────

function readPx(value: unknown, allowNegative = false): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (allowNegative || value >= 0) return value;
  }
  if (typeof value === "string" && /^\s*-?\d+(?:\.\d+)?px\s*$/.test(value)) {
    const parsed = Number.parseFloat(value);
    if (allowNegative || parsed >= 0) return parsed;
  }
  throw new Error("ADR-224 resize commit expects px sizes (width/height ≥ 0)");
}

export function commitCanvasResizePresentation(
  input: EditorPresentationCommitInput,
): EditorPresentationCommitResult {
  const { descriptor } = input;
  if (
    descriptor.type !== "style.patch" ||
    descriptor.target.kind !== "canonical-node"
  ) {
    throw new Error(
      "ADR-224 resize commit accepts a canonical-node style patch",
    );
  }
  const canonical = useCanonicalDocumentStore.getState();
  if (canonical.currentProjectId !== input.projectId) {
    throw new Error("Editor presentation project is no longer active");
  }
  if (canonical.documentVersion !== input.baseDocumentVersion) {
    throw new Error(
      "Editor presentation document version changed before commit",
    );
  }
  const error = useStore
    .getState()
    .applyCanvasResize(descriptor.target.nodeId, {
      width: readPx(descriptor.patch.width),
      height: readPx(descriptor.patch.height),
      left: readPx(descriptor.patch.left, true),
      top: readPx(descriptor.patch.top, true),
    });
  if (error) throw new Error(`ADR-224 resize commit failed: ${error}`);
  return {
    committedDocumentRevision:
      useCanonicalDocumentStore.getState().documentVersion,
  };
}

// ─── 활성 세션 registry (디버그·오버레이 read 공유) ────────────────────────────────

let activeSession: ResizePresentationSession | null = null;

export function setActiveResizeSession(
  session: ResizePresentationSession | null,
): void {
  activeSession = session;
}

export function getActiveResizeSession(): ResizePresentationSession | null {
  return activeSession;
}
