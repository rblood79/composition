// 통합된 스토어 타입 정의
//
// 실측상 이 경로로 소비되는 것은 아래 3개뿐이다 (`Element` 113 · `Page` 13 ·
// `ComponentElementProps` 12). 종전에 함께 재수출하던 `ElementsState` /
// `ThemeState` / `SelectionState` / `Store` 는 원본이 삭제됐고,
// `getDefaultProps` / `ColumnElementProps` / `CellElementProps` /
// `RowElementProps` / `DesignToken` 은 이 경로 소비처가 0건이라 함께 정리했다
// (원본은 각각 `unified.types` / `../theme` 에 그대로 있고 직접 import 된다).
export type {
  Element,
  Page,
  ComponentElementProps,
} from "../builder/unified.types";
