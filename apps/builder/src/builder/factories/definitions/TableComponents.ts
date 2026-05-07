import {
  Element,
  ComponentElementProps,
} from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentCreationContext, ComponentCreationResult } from "../types";
import {
  createDefaultTableProps,
  createDefaultTableHeaderProps,
  createDefaultTableBodyProps,
  createDefaultColumnGroupProps,
} from "../../../types/builder/unified.types";
import { addElementsToStore } from "../utils/elementCreation";
import { saveElementsToDb } from "../utils/dbPersistence";
import { generateCustomId } from "../../utils/idGeneration";

/**
 * Table 컴포넌트 생성 (특수 처리 필요)
 */
export async function createTable(
  context: ComponentCreationContext,
): Promise<ComponentCreationResult> {
  const { parentElement, elements, pageId } = context;
  let parentId = parentElement?.id || null;

  // parent_id가 없으면 body 요소를 parent로 설정
  if (!parentId) {
    parentId = ElementUtils.findBodyElement(elements, pageId);
  }

  const defaultProps = createDefaultTableProps();

  // 부모 요소 생성
  const parent: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId("Table", elements),
    type: "Table",
    props: defaultProps as ComponentElementProps,
    parent_id: parentId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // TableHeader 생성
  const tableHeader: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId("TableHeader", [...elements, parent]),
    type: "TableHeader",
    props: createDefaultTableHeaderProps() as ComponentElementProps,
    parent_id: parent.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // TableBody 생성
  const tableBody: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId("TableBody", [...elements, parent, tableHeader]),
    type: "TableBody",
    props: createDefaultTableBodyProps() as ComponentElementProps,
    parent_id: parent.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const children: Element[] = [tableHeader, tableBody];

  // 스토어에 추가
  addElementsToStore(parent, children);

  // DB에 저장
  await saveElementsToDb(parent, children, parentId, pageId);

  return {
    parent,
    children,
    allElements: [parent, ...children],
  };
}

/**
 * ColumnGroup 컴포넌트 생성
 */
export async function createColumnGroup(
  context: ComponentCreationContext,
): Promise<ComponentCreationResult> {
  const { parentElement, elements } = context;

  // ⭐ Layout/Slot System

  const parent: Element = {
    id: ElementUtils.generateId(),
    customId: generateCustomId("ColumnGroup", elements),
    type: "ColumnGroup",
    props: createDefaultColumnGroupProps(),
    parent_id: parentElement?.id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const children: Element[] = [];

  return {
    parent,
    children,
    allElements: [parent, ...children],
  };
}
