/**
 * Element Types
 *
 * 🚀 Phase 10 B2.2: 공유 Element 타입 정의
 *
 * Builder와 Publish App에서 공통으로 사용하는 Element 관련 타입입니다.
 *
 * @since 2025-12-11 Phase 10 B2.2
 */
import type { CSSProperties, ReactNode } from "react";
/**
 * 데이터 바인딩 타입
 */
export interface DataBinding {
    type: "collection" | "value" | "field";
    source: "supabase" | "api" | "state" | "static" | "parent";
    config: Record<string, unknown>;
}
/**
 * 필드 타입 (컬렉션 컴포넌트용)
 */
export type FieldType = "string" | "number" | "boolean" | "date" | "image" | "url" | "email";
/**
 * 필드 정의
 */
export interface FieldDefinition {
    key: string;
    label?: string;
    type?: FieldType;
    visible?: boolean;
    order?: number;
}
/**
 * 컬럼 매핑
 */
export interface ColumnMapping {
    [fieldKey: string]: FieldDefinition;
}
/**
 * 기본 Element Props
 */
export interface BaseElementProps {
    id?: string;
    className?: string;
    style?: CSSProperties;
    computedStyle?: Partial<CSSProperties>;
    "data-element-id"?: string;
    children?: ReactNode;
}
/**
 * Element 구조
 */
export interface Element {
    id: string;
    customId?: string;
    /**
     * ADR-113 P1+P2 (2026-04-27): canonical `type` 필드로 rename 완료. 값 공간은
     * pencil 정합 ComponentTag literal union 으로 수렴 (composition-document.types.ts
     * 참조). DB 컬럼 rename 은 Phase 4 (DB_VERSION 8→9).
     */
    type: string;
    props: Record<string, unknown>;
    fills?: unknown[];
    parent_id?: string | null;
    page_id?: string | null;
    created_at?: string;
    updated_at?: string;
    deleted?: boolean;
    dataBinding?: DataBinding;
    events?: unknown[];
    /**
     * master 컴포넌트 표시 이름
     *
     * @deprecated ADR-903 P0: canonical 'name' 필드로 rename. 모든 노드에 사용자 표시
     * 이름 허용 (reusable 전용 아님).
     */
    componentName?: string;
    /**
     * 이 요소가 참조하는 디자인 변수 목록 (e.g., ['$--primary', '$--spacing-md'])
     *
     * @deprecated ADR-903 P0: canonical 인라인 VariableRef ({ $var: "<key>" }) 참조로 전환.
     * 배열 필드 해체 후 필드 값 자체에 변수 참조 허용.
     */
    variableBindings?: string[];
}
/**
 * Page 구조
 */
export interface Page {
    id: string;
    title: string;
    project_id: string;
    slug: string;
    parent_id?: string | null;
    created_at?: string;
    updated_at?: string;
}
import type { ComponentSize } from "./componentVariants.types";
/**
 * 공통 컴포넌트 Props
 */
export interface CommonComponentProps extends BaseElementProps {
    variant?: string;
    size?: ComponentSize;
    isDisabled?: boolean;
}
export type { ComponentSize } from "./componentVariants.types";
//# sourceMappingURL=element.types.d.ts.map