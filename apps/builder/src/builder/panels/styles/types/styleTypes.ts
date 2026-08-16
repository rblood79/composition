/**
 * styleTypes - StylesPanel 관련 TypeScript 타입 정의
 */

// `SectionProps` 는 여기 두지 않는다 — 정본은 `components/panel/Section.tsx` 이고
// `components/panel/index.ts` + `components/index.ts` 배럴이 그것을 재수출한다
// (`panel-structure.md` §"섹션은 `Section` 컴포넌트 경유만"). 종전에 이 파일에도
// `{ selectedElement }` 형상의 동명 선언이 있었는데 소비처가 0건이었다.

/**
 * 스타일 출처 타입
 */
export type StyleSource =
  | { type: "inline"; location: "user-set" }
  | { type: "computed"; location: string } // CSS class name
  | { type: "inherited"; location: string } // Parent element type
  | { type: "default"; location: "component-default" };

/**
 * 스타일 값 정보 (출처 포함)
 */
export interface StyleValueInfo {
  value: string;
  source: StyleSource;
  isModified: boolean;
}

/**
 * Cascade 정보 (상속 체인)
 */
export interface CascadeInfo {
  winner: string; // 최종 적용 값
  overridden: string[]; // 오버라이드된 값들
}

/**
 * 스타일 수정 상태
 */
export interface ModifiedStylesState {
  hasModifiedStyles: boolean;
  modifiedProperties: string[];
  modifiedCount: number;
}
