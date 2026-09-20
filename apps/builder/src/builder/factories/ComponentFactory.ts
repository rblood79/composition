import type { CompositionDocument } from "@composition/shared";
import { Element } from "../../types/core/store.types";
import {
  ComponentCreationResult,
  ComponentCreationContext,
  ComponentCreator,
  ComponentDefinition,
  ComponentCreationSourceNode,
  InitialCanonicalFields,
} from "./types";
import {
  createElementsFromDefinition,
  addElementsToStore,
} from "./utils/elementCreation";
import { ElementUtils } from "../../utils/element/elementUtils";

import { createTable, createColumnGroup } from "./definitions/TableComponents";
import {
  COMPONENT_DEFINITIONS,
  getComponentDefinitionCreator,
} from "./componentDefinitions";

/**
 * 통합 컴포넌트 팩토리
 * - 모든 복합 컴포넌트 생성을 관리
 * - 공통 로직 추출로 중복 코드 제거
 */
export class ComponentFactory {
  /** ADR-228: type → 순수 definition creator — 정본은 `componentDefinitions.ts`. */
  static getDefinitionCreator = getComponentDefinitionCreator;

  /**
   * 컴포넌트 생성자 맵 — ADR-228 (2026-09-21) 부터 `definitions` 에서 파생한다 (type 당
   * `createComponent(definition, context)` 래핑). Table 만 imperative `createTable` 로 덮는다.
   * 종전 손 매핑 + 컴포넌트당 private wrapper 55 개는 같은 정보의 중복이라 제거 —
   * 등록 집합 (`getRegisteredTypes`) 은 definitions 키 ∪ {Table} 로 동일하다.
   *
   * 이력 주석 (등록 집합 변경): Form/Card/InlineAlert 는 reusable origin 전환으로 creators
   *   진입점 제거 (ADR-912 R-5 · ADR-148 Phase 3) · Avatar 는 creation.mode="none" leaf 로
   *   제거 (ADR-914 Phase 4-B) · FileUpload compound 추가 (ADR-201).
   */
  private static creators: Record<string, ComponentCreator> = {
    ...Object.fromEntries(
      Object.entries(COMPONENT_DEFINITIONS).map(([type, definition]) => [
        type,
        (context: ComponentCreationContext) =>
          ComponentFactory.createComponent(definition, context),
      ]),
    ),
    Table: ComponentFactory.createTable,
  };

  /**
   * 등록된 creator type 목록.
   *
   * ADR-139: `componentRegistrationContract` 가 placeable 컴포넌트 집합을
   * enumerate 하는 진입점. `creators` 는 `private static` 이라 외부에서 직접
   * 키를 읽을 수 없으므로 read-only 접근자를 노출한다.
   */
  static getRegisteredTypes(): string[] {
    return Object.keys(ComponentFactory.creators);
  }

  /**
   * 복합 컴포넌트 생성 (메인 메서드)
   * @param layoutId - reusable frame 편집 컨텍스트 id
   * @param doc - Canonical CompositionDocument (ADR-903 P3-E E-6: layout body 변환 용)
   */
  static async createComplexComponent(
    type: string,
    parentElement: ComponentCreationSourceNode | null,
    pageId: string,
    elements: ComponentCreationSourceNode[],
    layoutId: string | null | undefined,
    doc: CompositionDocument,
    initialProps?: Record<string, unknown>,
    initialCanonical?: InitialCanonicalFields,
  ): Promise<ComponentCreationResult> {
    const creator = this.creators[type];
    if (!creator) {
      throw new Error(`No creator found for component type: ${type}`);
    }

    const context: ComponentCreationContext = {
      parentElement,
      pageId,
      elements,
      layoutId,
      doc,
      initialProps,
      initialCanonical,
    };

    return await creator.call(this, context);
  }

  /**
   * 공통 컴포넌트 생성 로직
   * reusable frame context 우선, 없으면 page context 사용
   */
  private static async createComponent(
    definitionCreator: (
      context: ComponentCreationContext,
    ) => ComponentDefinition,
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    const { parentElement, pageId, elements, layoutId, doc } = context;
    let parentId = parentElement?.id || null;

    // parent_id가 없으면 현재 page/frame body 요소를 parent로 설정
    if (!parentId) {
      parentId = ElementUtils.findBodyByContext(
        elements,
        pageId || null,
        layoutId || null,
        doc,
      );
      // body element를 찾아서 context 업데이트
      const bodyElement = elements.find((el) => el.id === parentId);
      if (bodyElement) {
        context = { ...context, parentElement: bodyElement };
      }
    }

    // 1. 컴포넌트 정의 생성
    const definition = definitionCreator(context);
    // ADR-202: 초기 override를 삽입/propagation/history 전에 합친다.
    // 생성 후 별도 update를 하면 undo가 갈라지고 합성 자식에 요청 prop이 전달되지 않는다.
    if (context.initialProps) {
      const defaults = definition.parent.props ?? {};
      const initial = context.initialProps;
      definition.parent.props = {
        ...defaults,
        ...initial,
        ...(initial.style
          ? {
              style: {
                ...((defaults.style as Record<string, unknown>) ?? {}),
                ...(initial.style as Record<string, unknown>),
              },
            }
          : {}),
      };
    }

    // 2. Element 데이터 생성 (ADR-111: page/frame ownership 명시 주입)
    const { parent, children } = createElementsFromDefinition(definition, {
      pageId: pageId || null,
      layoutId,
    });

    // canonical 초기값도 첫 insert event 안에 포함한다.
    Object.assign(parent, context.initialCanonical);
    // 3. 스토어에 추가 (IndexedDB persistence via addElement)
    addElementsToStore(parent, children);

    return {
      parent,
      children,
      allElements: [parent, ...children],
    };
  }

  // ==================== Table (imperative) ====================

  private static async createTable(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return await createTable(context);
  }

  /**
   * ColumnGroup 생성 (공개 메서드)
   */
  static async createColumnGroup(
    parentElement: Element | null,
    pageId: string,
    elements: Element[] = [],
  ): Promise<ComponentCreationResult> {
    const context: ComponentCreationContext = {
      parentElement,
      pageId,
      elements,
      doc: { version: "composition-1.0", children: [] },
    };
    return await createColumnGroup(context);
  }
}
