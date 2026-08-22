import { recordEditorPresentationPreviewDeltaMessage } from "../performance/editorPresentationPhase0Metrics";
import type {
  EditorPresentationProtocolMessage,
  EditorPresentationFinishMessage,
} from "./editorPresentationProtocol";
import type {
  EditorPresentationSessionEvent,
  EditorPresentationTransactionRuntime,
} from "./editorPresentationRuntime";

export interface EditorPresentationPreviewTransport {
  ensureCanonicalDocumentSent(projectId: string, revision: number): void;
  send(message: EditorPresentationProtocolMessage): void;
}

interface EditorPresentationPreviewBridgeOptions {
  readonly readDocumentRevision: (projectId: string) => number;
  readonly runtime: EditorPresentationTransactionRuntime;
}

/**
 * Runtime frame event를 Preview protocol의 단일 stream으로 변환한다.
 * iframe lifecycle/ready queue는 transport가 소유하고 이 bridge는 semantic payload와
 * canonical-before-terminal 순서만 소유한다.
 */
export class EditorPresentationPreviewBridge {
  readonly #options: EditorPresentationPreviewBridgeOptions;
  readonly #unsubscribe: () => void;
  #transport: EditorPresentationPreviewTransport | null = null;

  constructor(options: EditorPresentationPreviewBridgeOptions) {
    this.#options = options;
    this.#unsubscribe = options.runtime.subscribeSessionEvents((event) =>
      this.#handleSessionEvent(event),
    );
  }

  attachTransport(transport: EditorPresentationPreviewTransport | null): void {
    this.#transport = transport;
  }

  dispose(): void {
    this.#transport = null;
    this.#unsubscribe();
  }

  #send(message: EditorPresentationProtocolMessage): void {
    const transport = this.#transport;
    if (!transport) return;
    recordEditorPresentationPreviewDeltaMessage(message);
    transport.send(message);
  }

  #handleSessionEvent(event: EditorPresentationSessionEvent): void {
    const transport = this.#transport;
    if (!transport) return;
    const { session } = event;
    if (event.type === "updated") {
      if (session.revision === 0 && !session.applied) return;
      this.#send({
        type: "EDITOR_PRESENTATION_PATCH",
        projectId: session.projectId,
        sessionId: session.sessionId,
        revision: session.revision,
        baseDocumentRevision: session.baseDocumentVersion,
        mutations: session.applied
          ? Object.freeze([session.applied.descriptor])
          : Object.freeze([]),
      });
      return;
    }

    if (event.result.status === "cancelled") {
      this.#send({
        type: "EDITOR_PRESENTATION_CANCEL",
        projectId: session.projectId,
        sessionId: session.sessionId,
        revision: session.revision,
      });
      return;
    }
    if (event.result.status === "failed") return;

    const committedDocumentRevision =
      event.result.status === "committed"
        ? event.result.committedDocumentRevision
        : this.#options.readDocumentRevision(session.projectId);
    transport.ensureCanonicalDocumentSent(
      session.projectId,
      committedDocumentRevision,
    );
    const message: EditorPresentationFinishMessage = {
      type: "EDITOR_PRESENTATION_FINISH",
      projectId: session.projectId,
      sessionId: session.sessionId,
      revision: session.revision,
      committedDocumentRevision,
      finalMutations: event.finalDescriptor
        ? Object.freeze([event.finalDescriptor])
        : Object.freeze([]),
    };
    this.#send(message);
  }
}
