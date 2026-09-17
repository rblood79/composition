/**
 * ADR-222 — UI 독립 spacing presentation 세션 어댑터 (breakdown §4 · §4.2).
 *
 * 캔버스 드래그 · 인라인 숫자 입력 · (향후) 패널이 같은 어댑터로 한 세션을 연다.
 * 세션은 기존 presentation runtime handle 하나를 소유하고,
 *
 * - `setDelta`/`setValues` 가 프레임당 descriptor 하나를 publish 하고 (숫자 px),
 * - runtime 의 `updated` 이벤트로 descriptor revision ↔ 값 을 대응시키며,
 * - layout receipt (`editorPresentationLayoutReceipt`) 의 `published` 만 **확정값** 으로
 *   승격한다 — 배지·패널·핸들 기하가 읽는 값은 이 확정값이다. rejected 는 세션을 취소한다.
 * - `finish` 는 마지막 descriptor 의 receipt 를 기다린 뒤 (상한 1초) px 문자열 patch 로
 *   history 1개를 남긴다. 시작 effective 값과 같으면 raw override 를 만들지 않고 no-op.
 *
 * canonical/history/DB 쓰기는 finish 의 commit 한 번뿐이다 (HC1).
 */

import type { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import type {
  EditorMutationDescriptor,
  EditorPresentationCancelReason,
  EditorPresentationHandle,
} from "./editorPresentationTypes";
import {
  subscribeLayoutReceipts,
  type PresentationLayoutReceipt,
} from "./editorPresentationLayoutReceipt";
import {
  PADDING_PROPERTY_BY_SIDE,
  type SpacingCapability,
  type SpacingProperty,
  type SpacingSide,
} from "./editorPresentationSpacingCapability";

export type SpacingSessionKind = "padding" | "gap";

export interface SpacingSessionBeginInput {
  readonly capability: SpacingCapability;
  readonly kind: SpacingSessionKind;
  /** padding 일 때 조작할 변 (1 · 2 · 4). gap 은 무시. */
  readonly sides?: readonly SpacingSide[];
  /**
   * padding link (패널 박스 모델의 link ON): 잡은 변의 값을 `sides` 전부에 같은 값으로 준다
   * — delta 는 잡은 변의 시작값 기준, 다른 변의 시작값 차이는 보존하지 않는다.
   */
  readonly uniformFrom?: SpacingSide;
  readonly ownerId: string;
  readonly runtime: EditorPresentationTransactionRuntime;
  /** 테스트 seam — 기본 setTimeout */
  readonly scheduleTimeout?: (fn: () => void, ms: number) => () => void;
}

export type SpacingSessionValues = Readonly<
  Partial<Record<SpacingProperty, number>>
>;

export type SpacingSessionPhase = "active" | "finalizing" | "closed";

export type SpacingSessionFinishResult =
  | { readonly status: "committed"; readonly committedDocumentRevision: number }
  | { readonly status: "no-op" }
  | {
      readonly status: "cancelled";
      readonly reason: EditorPresentationCancelReason;
    }
  | { readonly status: "failed"; readonly error: unknown };

export interface SpacingSessionSnapshot {
  readonly kind: SpacingSessionKind;
  readonly properties: readonly SpacingProperty[];
  readonly phase: SpacingSessionPhase;
  /** 시작 effective 값 */
  readonly startValues: SpacingSessionValues;
  /** 마지막으로 요청한 값 (pending 포함) */
  readonly requestedValues: SpacingSessionValues;
  /** layout receipt 로 확정된 값 — 표시 정본 */
  readonly confirmedValues: SpacingSessionValues;
  readonly confirmedPublicationRevision: number | null;
}

const RECEIPT_TIMEOUT_MS = 1000;

function propertiesFor(
  input: SpacingSessionBeginInput,
): readonly SpacingProperty[] {
  if (input.kind === "gap") {
    return input.capability.gap.supported
      ? [input.capability.gap.property]
      : [];
  }
  const sides = input.sides ?? [];
  return sides.map((side) => PADDING_PROPERTY_BY_SIDE[side]);
}

function startValuesFor(
  input: SpacingSessionBeginInput,
  properties: readonly SpacingProperty[],
): SpacingSessionValues {
  const values: Partial<Record<SpacingProperty, number>> = {};
  for (const property of properties) {
    if (property === "rowGap" || property === "columnGap") {
      values[property] = input.capability.gap.supported
        ? input.capability.gap.value
        : 0;
    } else if (input.capability.padding.supported) {
      const side = (
        Object.keys(PADDING_PROPERTY_BY_SIDE) as SpacingSide[]
      ).find((candidate) => PADDING_PROPERTY_BY_SIDE[candidate] === property)!;
      values[property] = input.capability.padding.values[side];
    }
  }
  return values;
}

function valuesEqual(
  left: SpacingSessionValues,
  right: SpacingSessionValues,
  properties: readonly SpacingProperty[],
): boolean {
  return properties.every((property) => left[property] === right[property]);
}

function toPxPatch(values: SpacingSessionValues): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `${value}px`]),
  );
}

export class SpacingPresentationSession {
  readonly kind: SpacingSessionKind;
  readonly properties: readonly SpacingProperty[];
  readonly sessionId: string;
  readonly capability: SpacingCapability;

  #handle: EditorPresentationHandle;
  #uniformFrom: SpacingProperty | null;
  #phase: SpacingSessionPhase = "active";
  #startValues: SpacingSessionValues;
  #requestedValues: SpacingSessionValues;
  #confirmedValues: SpacingSessionValues;
  #confirmedPublicationRevision: number | null = null;
  /** runtime session revision → 그 revision 에서 applied 된 값 (null = base 복귀) */
  #valuesByRevision = new Map<number, SpacingSessionValues | null>();
  #latestRevision = 0;
  #receiptedRevision = 0;
  #listeners = new Set<() => void>();
  #unsubscribeEvents: () => void;
  #unsubscribeReceipts: () => void;
  #scheduleTimeout: (fn: () => void, ms: number) => () => void;
  #finishWaiters: Array<(receipt: PresentationLayoutReceipt | null) => void> =
    [];
  #lastRejectReason: string | null = null;

  constructor(input: SpacingSessionBeginInput) {
    this.kind = input.kind;
    this.capability = input.capability;
    this.properties = propertiesFor(input);
    if (this.properties.length === 0) {
      throw new Error(
        "Spacing session requires at least one supported property",
      );
    }
    this.#startValues = startValuesFor(input, this.properties);
    this.#uniformFrom =
      input.kind === "padding" && input.uniformFrom
        ? PADDING_PROPERTY_BY_SIDE[input.uniformFrom]
        : null;
    this.#requestedValues = this.#startValues;
    this.#confirmedValues = this.#startValues;
    this.#scheduleTimeout =
      input.scheduleTimeout ??
      ((fn, ms) => {
        const id = setTimeout(fn, ms);
        return () => clearTimeout(id);
      });
    this.#handle = input.runtime.beginEditorPresentation({
      commitIntent: "style-layout-spacing",
      ownerId: input.ownerId,
      projectId: input.capability.projectId,
      targets: [input.capability.target],
    });
    this.sessionId = this.#handle.sessionId;
    this.#unsubscribeEvents = input.runtime.subscribeSessionEvents((event) => {
      if (event.session.sessionId !== this.sessionId) return;
      if (event.type === "updated") {
        const descriptor = event.session.applied?.descriptor;
        const values =
          descriptor && descriptor.type === "style.patch"
            ? (descriptor.patch as SpacingSessionValues)
            : null;
        this.#valuesByRevision.set(event.session.revision, values);
        this.#latestRevision = Math.max(
          this.#latestRevision,
          event.session.revision,
        );
        // bridge 는 이 어댑터보다 먼저 구독했으므로 receipt 가 같은 flush 안에서
        // 이 이벤트보다 앞서 도착한다 — 값 기록 후 확정을 다시 시도한다.
        this.#tryConfirm();
        return;
      }
      // terminal (다른 경로의 cancel 포함) → 닫힘
      if (this.#phase !== "closed") this.#close();
    });
    this.#unsubscribeReceipts = subscribeLayoutReceipts((receipt) =>
      this.#handleReceipt(receipt),
    );
  }

  get phase(): SpacingSessionPhase {
    return this.#phase;
  }

  #snapshotCache: SpacingSessionSnapshot | null = null;

  /** 참조 안정 — 상태가 바뀌어 notify 될 때만 새 객체 (useSyncExternalStore 계약). */
  getSnapshot(): SpacingSessionSnapshot {
    this.#snapshotCache ??= {
      kind: this.kind,
      properties: this.properties,
      phase: this.#phase,
      startValues: this.#startValues,
      requestedValues: this.#requestedValues,
      confirmedValues: this.#confirmedValues,
      confirmedPublicationRevision: this.#confirmedPublicationRevision,
    };
    return this.#snapshotCache;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /**
   * 시작 snapshot 기준 공통 delta (breakdown §4-4). 여러 변은 각각 같은 delta 를
   * 받아 비대칭 차이를 보존하고, 어느 변이 0 에 닿으면 공통 delta 를 제한한다.
   */
  setDelta(delta: number): boolean {
    if (this.#phase !== "active") return false;
    if (this.#uniformFrom) {
      // link: 잡은 변의 시작값 + delta 를 모든 변에 (0 에서 멈춤)
      const value = Math.max(0, (this.#startValues[this.#uniformFrom] ?? 0) + delta);
      const next: Partial<Record<SpacingProperty, number>> = {};
      for (const property of this.properties) next[property] = value;
      return this.setValues(next);
    }
    let clamped = delta;
    for (const property of this.properties) {
      const start = this.#startValues[property] ?? 0;
      if (start + clamped < 0) clamped = -start;
    }
    const next: Partial<Record<SpacingProperty, number>> = {};
    for (const property of this.properties) {
      next[property] = (this.#startValues[property] ?? 0) + clamped;
    }
    return this.setValues(next);
  }

  /** 절대값 (인라인 입력). 음수·비유한 값은 거부. */
  setValues(values: SpacingSessionValues): boolean {
    if (this.#phase !== "active") return false;
    const next: Partial<Record<SpacingProperty, number>> = {};
    for (const property of this.properties) {
      const value = values[property] ?? this.#requestedValues[property] ?? 0;
      if (!Number.isFinite(value) || value < 0) return false;
      next[property] = value;
    }
    if (valuesEqual(next, this.#requestedValues, this.properties)) return true;
    this.#requestedValues = next;
    const descriptor: EditorMutationDescriptor = {
      patch: { ...next },
      target: this.capability.target,
      type: "style.patch",
    };
    const published = this.#handle.publish(descriptor);
    if (!published) {
      this.cancel("conflict");
      return false;
    }
    this.#notify();
    return true;
  }

  /**
   * 마지막 descriptor 의 layout receipt 를 확인한 뒤 commit 1회. 값이 시작값과 같으면
   * override 를 만들지 않는다 (no-op). receipt 가 rejected 이거나 제한 시간을 넘기면 취소.
   */
  finish(): Promise<SpacingSessionFinishResult> {
    if (this.#phase !== "active") {
      return Promise.resolve({ status: "cancelled", reason: "superseded" });
    }
    this.#phase = "finalizing";
    this.#notify();

    if (
      valuesEqual(this.#requestedValues, this.#startValues, this.properties)
    ) {
      this.#handle.cancel("superseded");
      this.#close();
      return Promise.resolve({ status: "no-op" });
    }

    return new Promise((resolve) => {
      const complete = (receipt: PresentationLayoutReceipt | null): void => {
        if (this.#phase === "closed") {
          resolve({ status: "cancelled", reason: "superseded" });
          return;
        }
        if (!receipt || receipt.result !== "published") {
          this.#handle.cancel("conflict");
          this.#close();
          resolve({ status: "cancelled", reason: "conflict" });
          return;
        }
        const result = this.#handle.finish({
          patch: toPxPatch(this.#requestedValues),
          target: this.capability.target,
          type: "style.patch",
        });
        this.#close();
        resolve(result);
      };
      if (this.#isLatestReceipted()) {
        complete(this.#latestReceipt);
        return;
      }
      const cancelTimeout = this.#scheduleTimeout(() => {
        this.#finishWaiters = this.#finishWaiters.filter((w) => w !== waiter);
        complete(null);
      }, RECEIPT_TIMEOUT_MS);
      const waiter = (receipt: PresentationLayoutReceipt | null): void => {
        cancelTimeout();
        complete(receipt);
      };
      this.#finishWaiters.push(waiter);
    });
  }

  cancel(reason: EditorPresentationCancelReason): boolean {
    if (this.#phase === "closed") return false;
    const cancelled = this.#handle.cancel(reason);
    this.#close();
    return cancelled;
  }

  get lastRejectReason(): string | null {
    return this.#lastRejectReason;
  }

  #latestReceipt: PresentationLayoutReceipt | null = null;

  #isLatestReceipted(): boolean {
    // 아직 어떤 frame 도 flush 되지 않았으면 (latestRevision 0) receipt 를 기다린다.
    return (
      this.#latestRevision > 0 &&
      this.#receiptedRevision >= this.#latestRevision &&
      this.#valuesByRevision.get(this.#latestRevision) !== undefined &&
      this.#requestedMatchesRevision(this.#latestRevision)
    );
  }

  #requestedMatchesRevision(revision: number): boolean {
    const values = this.#valuesByRevision.get(revision);
    if (values === undefined) return false;
    if (values === null) {
      return valuesEqual(
        this.#requestedValues,
        this.#startValues,
        this.properties,
      );
    }
    return valuesEqual(values, this.#requestedValues, this.properties);
  }

  #handleReceipt(receipt: PresentationLayoutReceipt): void {
    if (receipt.sessionId !== this.sessionId || this.#phase === "closed") {
      return;
    }
    // stale/역순 receipt 는 무시 (§4.2)
    if (receipt.descriptorRevision < this.#receiptedRevision) return;
    this.#receiptedRevision = receipt.descriptorRevision;
    this.#latestReceipt = receipt;
    if (receipt.result === "rejected") {
      this.#lastRejectReason = receipt.reason;
      const waiters = this.#finishWaiters.splice(0);
      if (waiters.length > 0) {
        for (const waiter of waiters) waiter(receipt);
        return;
      }
      this.cancel("conflict");
      return;
    }
    this.#tryConfirm();
  }

  /** 최신 published receipt 와 그 revision 의 값이 둘 다 있으면 확정값으로 승격. */
  #tryConfirm(): void {
    const receipt = this.#latestReceipt;
    if (!receipt || receipt.result !== "published") return;
    if (
      this.#confirmedPublicationRevision === receipt.layoutPublicationRevision
    ) {
      return;
    }
    const values = this.#valuesByRevision.get(receipt.descriptorRevision);
    if (values === undefined) return;
    this.#confirmedValues = values ?? this.#startValues;
    this.#confirmedPublicationRevision = receipt.layoutPublicationRevision;
    this.#notify();
    if (
      this.#finishWaiters.length > 0 &&
      this.#requestedMatchesRevision(receipt.descriptorRevision)
    ) {
      for (const waiter of this.#finishWaiters.splice(0)) waiter(receipt);
    }
  }

  #close(): void {
    if (this.#phase === "closed") return;
    this.#phase = "closed";
    this.#unsubscribeEvents();
    this.#unsubscribeReceipts();
    for (const waiter of this.#finishWaiters.splice(0)) waiter(null);
    this.#notify();
    this.#listeners.clear();
    if (activeSession === this) setActiveSpacingSession(null);
  }

  #notify(): void {
    this.#snapshotCache = null;
    for (const listener of this.#listeners) listener();
  }
}

// ─── 활성 세션 registry (패널·오버레이 read 공유) ──────────────────────────

let activeSession: SpacingPresentationSession | null = null;
const activeListeners = new Set<() => void>();

export function setActiveSpacingSession(
  session: SpacingPresentationSession | null,
): void {
  if (activeSession === session) return;
  activeSession = session;
  for (const listener of activeListeners) listener();
}

export function getActiveSpacingSession(): SpacingPresentationSession | null {
  return activeSession;
}

export function subscribeActiveSpacingSession(
  listener: () => void,
): () => void {
  activeListeners.add(listener);
  return () => {
    activeListeners.delete(listener);
  };
}
