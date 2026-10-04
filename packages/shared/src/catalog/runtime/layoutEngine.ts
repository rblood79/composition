import type { EngineTraceNode, LayoutResult } from "./engineTypes";

export interface LayoutEngineAPI {
  isAvailable(): boolean;

  // ── batch tree 구축 (PersistentLayoutTree.buildFull 경유) ──
  buildTreeBatch(nodesJson: string): number[];
  buildTreeBatchBinary(data: Uint8Array): number[];
  hasBinaryProtocol(): boolean;

  // ── 증분 갱신 ──
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: number[]): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;

  // ── 레이아웃 계산/수집 ──
  /** vw/vh 기준 viewport (border-box page 크기 = breakpoint). 미호출 시 엔진 기본 1920×1080. */
  setViewport(width: number, height: number): void;
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: number[]): Map<number, LayoutResult>;

  // ── 상태 ──
  clear(): void;
  nodeCount(): number;

  // ── 판정 트레이스 (ADR-183 — 디버그 채널) ──
  // optional: 필수 계약이 아니라 테스트용 fake 엔진이 구현을 강제받지 않는다.
  // 소비자는 `?.` 호출 + 미지원 시 false/null 로 강등.
  enableLayoutTrace?(enabled: boolean): boolean;
  getLayoutTrace?(handle: number): EngineTraceNode | null;

  // ── strict 입력 (하니스·진단 채널) ──
  // 기본 false. 켜면 `buildTreeBatch` 가 엔진이 읽지 않는 키를 오류로 낸다 —
  // "파이프라인이 보냈는데 엔진이 버린 키" 를 rect 불일치가 아니라 그 자리에서
  // 실패로 만든다. production 은 켜지 않는다 (미지 키 하나로 레이아웃 전체 실패).
  // optional: 테스트용 fake 엔진이 구현을 강제받지 않는다.
  setStrictInput?(enabled: boolean): void;
  /** 높이 확정 0 판정 (기본 false). ADR-248 새 runtime 만 켠다 — 현재 Builder 출력 불변. */
  setDefiniteZeroHeight?(enabled: boolean): void;
  /** batch payload 에서 엔진이 버리는 키 — `[{index, keys}]`. hot path 금지. */
  inspectUnknownKeys?(nodesJson: string): { index: number; keys: string[] }[];
}
