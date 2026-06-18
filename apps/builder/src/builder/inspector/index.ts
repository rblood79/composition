// 🚀 Single Source of Truth: InspectorSync 제거
// Builder Store가 직접 상태를 관리하므로 더 이상 동기화 컴포넌트 필요 없음

export * from "./types";
export * from "./hooks";
// ADR-912 후속 cleanup: ./editors (getEditor/registry) barrel 삭제 — dead 체인이었음.
