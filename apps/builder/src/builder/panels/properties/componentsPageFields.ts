import type { ResolvedField } from "@composition/shared";
import { COMPONENTS_SYSTEM_PAGE_ID } from "../../pages/systemComponentsPage";

/**
 * Components 페이지는 등록된 컴포넌트 (origin) 를 테마처럼 손보는 자리다 — collection 의 외부 데이터
 * 연결 (`dataBinding`: dataTable · collection · api · variable) 은 사용자 페이지의 instance 가 자기 데이터로
 * 정하는 축이라 origin 에는 뜻이 없다 (사용자 판정 2026-09-21). origin 의 Properties 에서 그 필드
 * (Data 절 + 「새 테이블」 액션) 를 뺀다. 정적 `items` 편집 (chip/행의 견본) 은 그대로 — origin 의 시각
 * 견본이고 instance 가 상속한다.
 */
export function isComponentsPageNode(
  node: { page_id?: string | null } | null | undefined,
): boolean {
  return node?.page_id === COMPONENTS_SYSTEM_PAGE_ID;
}

export function omitDataBindingOnComponentsPage<T extends ResolvedField>(
  fields: readonly T[],
  node: { page_id?: string | null } | null | undefined,
): T[] {
  if (!isComponentsPageNode(node)) return [...fields];
  return fields.filter((field) => field.kind !== "binding");
}
