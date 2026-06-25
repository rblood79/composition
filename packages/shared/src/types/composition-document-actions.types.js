/**
 * @fileoverview Canonical Document Actions / Adapter API — ADR-116 Phase 1 (G2)
 *
 * Phase 1 = Canonical Document Store/API surface + skeleton + unit test (R1 명시 scope).
 *
 * 본 파일은 `CanonicalDocumentActions` contract 를 정의한다.
 *
 * `CanonicalDocumentActions` — `CompositionDocument` 자체를 mutate 하는 store
 *    surface. legacy `Element` 입력을 받지 않으며 history entry 가 canonical
 *    patch 단위로 기록되도록 시그니처를 잡는다 (design breakdown §6 원칙 1, 3).
 *
 * **저장 backing 결정 (ADR-116 Phase 1 D2=β)**:
 * - 본 actions surface 는 별도 Zustand slice
 *   (`apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts`)
 *   가 구현. 기존 elementsMap wrapper 가 아니라 분리 store 로 G3 hot path
 *   cutover 시점에 elementsMap 의존 제거가 자연스럽도록 설계.
 *
 * **Phase 1 land 외 영역 (Phase 2~5)**:
 * - history/undo 통합 — Phase 1 에서는 mutation 단위 caller 가 직접 history
 *   entry 를 push 하지 않음. Phase 2/3 시점에 canonical patch → history record
 *   변환 결정 (R1 잔존).
 * - persistence write-through — Phase 3 (R1, R5 잔존).
 * - elementsMap legacy store 와 양방향 sync — Phase 2 hot path cutover 와 함께.
 */
export {};
//# sourceMappingURL=composition-document-actions.types.js.map