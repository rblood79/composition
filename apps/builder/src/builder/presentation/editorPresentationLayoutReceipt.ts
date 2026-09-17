/**
 * Layout publication 완료·실패 receipt (ADR-222 §4.2, 리뷰 m2 수리).
 *
 * runtime 의 `session.applied` 는 descriptor 분류 직후 올라가는 계산 **요청**이고,
 * Skia layout bridge 의 targeted 계산·command patch 가 실제로 성공했는지는
 * 알려주지 않는다. 캔버스 spacing 세션 (값 배지 · 패널 표시 · finish) 은
 * 이 receipt 의 `descriptorRevision` 을 session revision 과 대응시켜 성공한
 * publication 의 값만 읽는다. Builder 내부 신호이며 canonical schema 나 iframe
 * 메시지가 아니다 — Preview 는 기존 protocol 을 그대로 쓴다.
 *
 * snapGuidePresentation 과 같은 module-level 채널이다. bridge 인스턴스는
 * SkiaCanvas 내부 ref 에만 있어 세션 어댑터가 직접 구독할 수 없기 때문이다.
 */

export type PresentationLayoutRejectReason =
  | "render-node-missing"
  | "root-key-missing"
  | "stream-missing"
  | "affected-node-missing"
  | "plan-root-ambiguous"
  | "root-context-missing"
  | "layout-missing"
  | "compute-null"
  | "compute-incomplete"
  | "targeted-unsupported"
  | "canonical-revision-mismatch"
  | "publication-rejected"
  | "command-patch-rejected"
  | "restore-rejected";

export type PresentationLayoutReceipt =
  | {
      readonly sessionId: string;
      readonly descriptorRevision: number;
      readonly baseCanonicalRevision: number;
      readonly rootKey: string;
      readonly layoutPublicationRevision: number;
      readonly result: "published";
    }
  | {
      readonly sessionId: string;
      readonly descriptorRevision: number;
      readonly baseCanonicalRevision: number | null;
      readonly rootKey: string | null;
      readonly result: "rejected";
      readonly reason: PresentationLayoutRejectReason;
    };

type ReceiptListener = (receipt: PresentationLayoutReceipt) => void;

const listeners = new Set<ReceiptListener>();
let lastReceipt: PresentationLayoutReceipt | null = null;

export function publishLayoutReceipt(receipt: PresentationLayoutReceipt): void {
  lastReceipt = receipt;
  for (const listener of listeners) listener(receipt);
}

export function subscribeLayoutReceipts(listener: ReceiptListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 마지막 receipt (진단용 — 세션 어댑터는 구독으로 대응시킨다). */
export function getLastLayoutReceipt(): PresentationLayoutReceipt | null {
  return lastReceipt;
}

export function resetLayoutReceiptsForTest(): void {
  listeners.clear();
  lastReceipt = null;
}
