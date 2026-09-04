import type { CompositionDocument } from "@composition/shared";
import { Element } from "../../../types/core/store.types";

/**
 * 컴포넌트 생성 결과 타입
 */
export interface ComponentCreationResult {
  parent: Element;
  children: Element[];
  allElements: Element[];
}

/** 컴포넌트 생성기가 기존 트리에서 실제로 읽는 구조 필드만 노출한다. */
export interface ComponentCreationSourceNode {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  parent_id?: string | null;
  page_id?: string | null;
  customId?: string | null;
  deleted?: boolean;
}

/**
 * 컴포넌트 생성 컨텍스트
 */
export interface ComponentCreationContext {
  parentElement: ComponentCreationSourceNode | null;
  pageId: string;
  elements: ComponentCreationSourceNode[];
  // ⭐ Layout/Slot System: Layout 모드에서 요소 생성 시 사용
  layoutId?: string | null;
  /**
   * ADR-903 P3-E E-6: layout 모드에서 body element 변환에 필요한 canonical
   * document. `findBodyByContext` 가 frame node id 매칭에 사용.
   */
  doc: CompositionDocument;
}

/**
 * 자식 요소 정의 (재귀적 중첩 지원)
 */
export type ChildDefinition = Omit<
  Element,
  "id" | "created_at" | "updated_at" | "parent_id"
> & {
  children?: ChildDefinition[];
};

/**
 * 컴포넌트 정의 타입
 */
export interface ComponentDefinition {
  type: string;
  parent: Omit<Element, "id" | "created_at" | "updated_at">;
  children: ChildDefinition[];
}

/**
 * 컴포넌트 생성자 함수 타입
 */
export type ComponentCreator = (
  context: ComponentCreationContext,
) => Promise<ComponentCreationResult>;
