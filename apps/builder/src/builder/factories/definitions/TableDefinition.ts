import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentCreationContext, ComponentDefinition } from "../types";
import {
  createDefaultTableProps,
  createDefaultTableHeaderProps,
  createDefaultTableBodyProps,
} from "../../../types/builder/unified.types";

/**
 * ADR-228 (2026-09-21): Table 의 **순수 definition** — `createTable` (TableComponents.ts) 이
 * store 에 직접 쓰는 imperative 경로라, origin seed (`components/catalogOrigins.ts`) 가 재사용할
 * side-effect 0 정의를 분리한다. 부모 props · TableHeader/TableBody 자식은 `createTable` 과 같은
 * `createDefault*Props` 에서 온다. store 를 import 하는 모듈과 분리한 이유 = `componentDefinitions`
 * 가 store 순환 없이 로드돼야 한다 (reusableCompositeOrigins ← 정규화 ← store).
 */
export function createTableDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement } = context;
  return {
    type: "Table",
    parent: {
      type: "Table",
      props: createDefaultTableProps() as ComponentElementProps,
      parent_id: parentElement?.id || null,
    },
    children: [
      {
        type: "TableHeader",
        props: createDefaultTableHeaderProps() as ComponentElementProps,
      },
      {
        type: "TableBody",
        props: createDefaultTableBodyProps() as ComponentElementProps,
      },
    ],
  };
}
