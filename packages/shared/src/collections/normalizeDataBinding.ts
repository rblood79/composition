/**
 * legacy `DataBinding { type: "collection", config }` → v2 `PropertyDataBinding` (ADR-152 Phase 5).
 *
 * Phase 0 실측 (breakdown §1-6) 에서 legacy 형식 저장 문서는 0건이다. 그래도 import envelope ·
 * 구 문서가 collection 을 `config.collectionId / datatableId / name` 으로 가리키면 v2 로 올려
 * 읽기 경로 (`useCollectionData` · `readDataBindingRows`) 가 legacy 분기 없이 같은 resolve
 * (`resolveBoundCollection`) 를 지나게 한다. inline static (`config.data`) · api (`config.endpoint`)
 * 는 collection 참조가 아니라 변환하지 않는다.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeDataBinding<T>(binding: T): T | Record<string, unknown> {
  if (!isRecord(binding) || binding.type !== "collection") return binding;
  const config = isRecord(binding.config) ? binding.config : {};
  const collectionId =
    typeof config.collectionId === "string" && config.collectionId
      ? config.collectionId
      : typeof config.datatableId === "string" && config.datatableId
        ? config.datatableId
        : undefined;
  const name =
    typeof config.name === "string" && config.name ? config.name : undefined;
  if (!collectionId && !name) return binding;
  return {
    source: "dataTable",
    ...(collectionId ? { collectionId } : {}),
    name: name ?? collectionId,
  };
}
