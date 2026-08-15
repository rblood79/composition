// 통합된 스토어 타입 정의
export type {
  Element,
  Page,
  ComponentElementProps,
  ElementsState,
  ThemeState,
  SelectionState,
  Store,
  getDefaultProps,
  ColumnElementProps,
  CellElementProps,
  RowElementProps,
} from "../builder/unified.types";

// 테마 타입은 별도 모듈에서 import
export type { DesignToken } from "../theme";
