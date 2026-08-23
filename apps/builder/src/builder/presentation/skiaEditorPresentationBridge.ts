import type { FillItem } from "../../types/builder/fill.types";
import { recordEditorPresentationTargetIncrementalPatches } from "../performance/editorPresentationPhase0Metrics";
import type { StoreRenderBridge } from "../workspace/canvas/skia/StoreRenderBridge";
import type {
  EditorPresentationSessionEvent,
  EditorPresentationTransactionRuntime,
} from "./editorPresentationRuntime";
import type {
  EditorMutationDescriptor,
  EditorPresentationSession,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import type { SkiaPresentationProjectionIndex } from "./skiaPresentationProjectionIndex";

interface SkiaEditorPresentationBridgeOptions {
  readonly getActiveProjectId: () => string | null;
  readonly getProjectionIndex: () => SkiaPresentationProjectionIndex;
  readonly getStoreRenderBridge: () => StoreRenderBridge | null;
  readonly onPaintInvalidated: () => void;
  /** canonical terminal descriptor를 commit lane에 전달한다. */
  readonly onCommitted?: (input: {
    readonly descriptor: EditorMutationDescriptor;
    readonly revision: number;
  }) => void;
  readonly runtime: EditorPresentationTransactionRuntime;
}

interface SessionProjectionState {
  readonly fills?: readonly FillItem[];
  readonly stylePatch?: Readonly<Record<string, unknown>>;
  readonly kind: "fills" | "style";
  readonly projectId: string;
  readonly sequence: number;
  readonly target: EditorPresentationTargetRef;
  readonly terminalRevision: number | null;
}

/**
 * ADR-187 Skia paint consumer.
 *
 * Runtime의 changed-session event를 받아 해당 semantic target의 projection k만
 * 갱신한다. StoreRenderBridge가 canonical/layout/theme/image resync로 box draw data를
 * 교체한 경우에는 최신 projection index로 다시 resolve한 active/handoff layer를
 * 새 box에 재적용한다.
 */
export class SkiaEditorPresentationBridge {
  readonly #layersByRenderId = new Map<
    string,
    Map<string, SessionProjectionState>
  >();
  readonly #options: SkiaEditorPresentationBridgeOptions;
  readonly #renderIdsBySessionId = new Map<string, Set<string>>();
  readonly #stateBySessionId = new Map<string, SessionProjectionState>();
  readonly #unsubscribeSessionEvents: () => void;
  #sequence = 0;

  constructor(options: SkiaEditorPresentationBridgeOptions) {
    this.#options = options;
    this.#unsubscribeSessionEvents = options.runtime.subscribeSessionEvents(
      (event) => this.#handleSessionEvent(event),
    );

    // Bridge mount 전에 시작된 session만 1회 prime한다. 이후 publish hot path는
    // event.session 한 건만 처리하며 runtime session 전체를 재스캔하지 않는다.
    for (const session of options.runtime.getSnapshot().sessions.values()) {
      this.#updateSession(session);
    }
  }

  /**
   * StoreRenderBridge sync 완료 통지. renderer input이 commit revision을 소비했으면
   * handoff ownership만 release한다. 그 외 session은 바뀐 visible projection index로
   * 다시 resolve하고 active/final overlay를 새 box에 재적용한다.
   */
  handleStoreSync(renderedDocumentRevision: number): void {
    const activeProjectId = this.#options.getActiveProjectId();
    const projectionIndex = this.#options.getProjectionIndex();
    const releaseRenderIds = new Set<string>();
    const restoreRenderIds = new Set<string>();

    for (const [sessionId, state] of [...this.#stateBySessionId]) {
      if (state.projectId !== activeProjectId) {
        this.#addAll(restoreRenderIds, this.#removeSessionState(sessionId));
        continue;
      }
      if (
        state.terminalRevision !== null &&
        renderedDocumentRevision >= state.terminalRevision
      ) {
        this.#addAll(releaseRenderIds, this.#removeSessionState(sessionId));
        continue;
      }

      this.#addAll(restoreRenderIds, this.#detachSessionLayers(sessionId));
      const nextRenderIds = new Set(projectionIndex.resolve(state.target));
      this.#attachSessionLayers(sessionId, state, nextRenderIds);
      this.#addAll(restoreRenderIds, nextRenderIds);
    }

    // 같은 sync에서 terminal canonical handoff와 projection 이동이 겹치면
    // canonical revision을 소비한 release가 old base restore보다 우선한다.
    for (const renderId of releaseRenderIds) {
      restoreRenderIds.delete(renderId);
    }
    this.#reconcileRenderIds(restoreRenderIds, "restore");
    this.#reconcileRenderIds(releaseRenderIds, "release");
  }

  dispose(): void {
    this.#unsubscribeSessionEvents();
    const storeBridge = this.#options.getStoreRenderBridge();
    let changed = 0;
    if (storeBridge) {
      for (const [renderId, layers] of this.#layersByRenderId) {
        let didChange = false;
        for (const layer of layers.values()) {
          const hasActiveLayer = layer.terminalRevision === null;
          didChange =
            (layer.kind === "fills"
              ? hasActiveLayer
                ? storeBridge.restorePresentationFillPatch(renderId)
                : storeBridge.releasePresentationFillPatch(renderId)
              : hasActiveLayer
                ? storeBridge.restorePresentationStylePatch(renderId)
                : storeBridge.releasePresentationStylePatch(renderId)) ||
            didChange;
        }
        if (didChange) changed += 1;
      }
    }
    this.#layersByRenderId.clear();
    this.#renderIdsBySessionId.clear();
    this.#stateBySessionId.clear();
    if (changed > 0) this.#options.onPaintInvalidated();
  }

  #handleSessionEvent(event: EditorPresentationSessionEvent): void {
    if (event.type === "updated") {
      this.#updateSession(event.session);
      return;
    }

    if (event.result.status === "committed") {
      if (event.finalDescriptor) {
        this.#options.onCommitted?.({
          descriptor: event.finalDescriptor,
          revision: event.result.committedDocumentRevision,
        });
      }
      const state = this.#stateBySessionId.get(event.session.sessionId);
      if (!state) return;
      const handoffState: SessionProjectionState = Object.freeze({
        ...state,
        terminalRevision: event.result.committedDocumentRevision,
      });
      this.#stateBySessionId.set(event.session.sessionId, handoffState);
      for (const renderId of this.#renderIdsBySessionId.get(
        event.session.sessionId,
      ) ?? []) {
        this.#layersByRenderId
          .get(renderId)
          ?.set(event.session.sessionId, handoffState);
      }
      return;
    }

    this.#reconcileRenderIds(
      this.#removeSessionState(event.session.sessionId),
      "restore",
    );
  }

  #updateSession(session: EditorPresentationSession): void {
    const activeProjectId = this.#options.getActiveProjectId();
    const descriptor = session.applied?.descriptor;
    if (
      session.projectId !== activeProjectId ||
      !descriptor ||
      (descriptor.type !== "fills.replace" && descriptor.type !== "style.patch")
    ) {
      this.#reconcileRenderIds(
        this.#removeSessionState(session.sessionId),
        "restore",
      );
      return;
    }

    const affectedRenderIds = this.#detachSessionLayers(session.sessionId);
    this.#sequence += 1;
    const state: SessionProjectionState = Object.freeze({
      ...(descriptor.type === "fills.replace"
        ? { fills: descriptor.fills, kind: "fills" as const }
        : { kind: "style" as const, stylePatch: descriptor.patch }),
      projectId: session.projectId,
      sequence: this.#sequence,
      target: descriptor.target,
      terminalRevision: null,
    });
    const nextRenderIds = new Set(
      this.#options.getProjectionIndex().resolve(descriptor.target),
    );
    this.#stateBySessionId.set(session.sessionId, state);
    this.#attachSessionLayers(session.sessionId, state, nextRenderIds);
    this.#addAll(affectedRenderIds, nextRenderIds);
    this.#reconcileRenderIds(affectedRenderIds, "restore");
  }

  #attachSessionLayers(
    sessionId: string,
    state: SessionProjectionState,
    renderIds: Set<string>,
  ): void {
    for (const renderId of renderIds) {
      const layers =
        this.#layersByRenderId.get(renderId) ??
        new Map<string, SessionProjectionState>();
      layers.set(sessionId, state);
      this.#layersByRenderId.set(renderId, layers);
    }
    this.#renderIdsBySessionId.set(sessionId, renderIds);
  }

  #detachSessionLayers(sessionId: string): Set<string> {
    const renderIds = this.#renderIdsBySessionId.get(sessionId);
    const affected = new Set(renderIds ?? []);
    if (renderIds) {
      for (const renderId of renderIds) {
        const layers = this.#layersByRenderId.get(renderId);
        layers?.delete(sessionId);
        if (layers?.size === 0) this.#layersByRenderId.delete(renderId);
      }
    }
    this.#renderIdsBySessionId.delete(sessionId);
    return affected;
  }

  #removeSessionState(sessionId: string): Set<string> {
    const affected = this.#detachSessionLayers(sessionId);
    this.#stateBySessionId.delete(sessionId);
    return affected;
  }

  #addAll(target: Set<string>, source: ReadonlySet<string>): void {
    for (const value of source) target.add(value);
  }

  #reconcileRenderIds(
    renderIds: ReadonlySet<string>,
    emptyAction: "release" | "restore",
  ): void {
    const storeBridge = this.#options.getStoreRenderBridge();
    if (!storeBridge || renderIds.size === 0) return;

    let changed = 0;
    for (const renderId of renderIds) {
      const layers = this.#layersByRenderId.get(renderId);
      const effectiveByKind = new Map<
        SessionProjectionState["kind"],
        SessionProjectionState
      >();
      for (const layer of layers?.values() ?? []) {
        const effective = effectiveByKind.get(layer.kind);
        if (!effective || layer.sequence > effective.sequence) {
          effectiveByKind.set(layer.kind, layer);
        }
      }

      for (const kind of ["fills", "style"] as const) {
        const effective = effectiveByKind.get(kind);
        if (effective) {
          if (emptyAction === "release") {
            changed +=
              kind === "fills"
                ? Number(storeBridge.releasePresentationFillPatch(renderId))
                : Number(storeBridge.releasePresentationStylePatch(renderId));
          }
          changed +=
            kind === "fills"
              ? Number(
                  storeBridge.applyPresentationFillPatch(
                    renderId,
                    effective.fills ?? [],
                  ),
                )
              : Number(
                  storeBridge.applyPresentationStylePatch(
                    renderId,
                    effective.stylePatch ?? {},
                  ),
                );
          continue;
        }

        changed +=
          kind === "fills"
            ? Number(
                emptyAction === "release"
                  ? storeBridge.releasePresentationFillPatch(renderId)
                  : storeBridge.restorePresentationFillPatch(renderId),
              )
            : Number(
                emptyAction === "release"
                  ? storeBridge.releasePresentationStylePatch(renderId)
                  : storeBridge.restorePresentationStylePatch(renderId),
              );
      }
    }

    if (changed === 0) return;
    recordEditorPresentationTargetIncrementalPatches(changed);
    this.#options.onPaintInvalidated();
  }
}
