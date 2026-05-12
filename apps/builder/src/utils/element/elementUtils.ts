/**
 * Element Utilities
 *
 * ✅ Refactored (2025-11-12)
 * - Removed API wrapper methods (ADR-128 이후 cloud elements API 전체 dead)
 * - Kept essential utility functions (generateId, findBodyElement, etc.)
 */

import type { CompositionDocument } from "@composition/shared";
import { Element } from "../../types/core/store.types";
import { frameNodeIdForLegacyLayout } from "../../adapters/canonical";

// 통합 요소 관리 유틸리티
export class ElementUtils {
  /**
   * Generate unique element ID using crypto.randomUUID()
   */
  static generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Delay utility for async operations
   */
  static async delay(ms: number = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Find the body element for a given page
   * Used for automatically setting body as parent when parent_id is null
   */
  static findBodyElement(elements: Element[], pageId: string): string | null {
    const bodyElement = elements.find(
      (el) => el.page_id === pageId && el.type === "body",
    );
    return bodyElement?.id || null;
  }

  /**
   * Find the body element for a given layout (canonical reusable frame).
   *
   * ADR-903 P3-E E-6: write-through 전환 후 legacy frame ownership field 는
   * null. canonical frame node id 를 `el.parent_id` 와 매칭한다.
   */
  static findLayoutBodyElement(
    elements: Element[],
    layoutId: string,
    doc: CompositionDocument,
  ): string | null {
    const frameNodeId = frameNodeIdForLegacyLayout(layoutId, doc);
    if (!frameNodeId) return null;
    const bodyElement = elements.find(
      (el) => el.parent_id === frameNodeId && el.type === "body",
    );
    return bodyElement?.id || null;
  }

  /**
   * Find body element by context (page or layout)
   * Automatically chooses the right method based on provided IDs
   *
   * ADR-903 P3-E E-6: layout 모드 분기는 canonical document (`doc`) 필수.
   * Page 모드는 `el.page_id` 사용 (P3 outside scope, retained legacy column).
   *
   * @param elements - All elements
   * @param pageId - Page ID (for page mode)
   * @param layoutId - Layout ID (for layout mode)
   * @param doc - Canonical CompositionDocument (layout 모드에서 frame parent 변환 용)
   * @returns Body element ID or null
   */
  static findBodyByContext(
    elements: Element[],
    pageId: string | null,
    layoutId: string | null,
    doc: CompositionDocument,
  ): string | null {
    // Layout mode takes priority
    if (layoutId) {
      return this.findLayoutBodyElement(elements, layoutId, doc);
    }
    // Fall back to page mode
    if (pageId) {
      return this.findBodyElement(elements, pageId);
    }
    return null;
  }

  /**
   * Migrate orphan elements (parent_id === null) to body element
   * Excludes the body element itself
   *
   * @param elements - All elements
   * @param pageId - Target page ID
   * @returns Updated elements array and list of elements that need DB update
   */
  static migrateOrphanElementsToBody(
    elements: Element[],
    pageId: string,
  ): { elements: Element[]; updatedElements: Element[] } {
    const bodyElement = elements.find(
      (el) => el.page_id === pageId && el.type === "body",
    );

    if (!bodyElement) {
      console.warn(`⚠️ Body 요소를 찾을 수 없습니다: pageId=${pageId}`);
      return { elements, updatedElements: [] };
    }

    const orphanElements = elements.filter(
      (el) =>
        el.page_id === pageId && el.parent_id === null && el.type !== "body",
    );

    if (orphanElements.length === 0) {
      return { elements, updatedElements: [] };
    }

    console.log(`🔄 ${orphanElements.length}개의 고아 요소를 body로 이동:`, {
      pageId,
      bodyId: bodyElement.id,
      orphanIds: orphanElements.map((el) => el.id),
    });

    // orphan 요소들의 parent_id를 body.id로 설정
    const updatedElements = orphanElements.map((el) => ({
      ...el,
      parent_id: bodyElement.id,
    }));

    // 전체 요소 배열에서 업데이트된 요소들로 교체
    const newElements = elements.map((el) => {
      const updated = updatedElements.find((u) => u.id === el.id);
      return updated || el;
    });

    return {
      elements: newElements,
      updatedElements,
    };
  }

  /**
   * Get all child elements recursively
   */
  static getDescendants(elements: Element[], parentId: string): Element[] {
    const children = elements.filter((el) => el.parent_id === parentId);
    const allDescendants = [...children];

    children.forEach((child) => {
      allDescendants.push(...this.getDescendants(elements, child.id));
    });

    return allDescendants;
  }

  /**
   * Check if an element is ancestor of another element
   */
  static isAncestor(
    elements: Element[],
    ancestorId: string,
    descendantId: string,
  ): boolean {
    let current = elements.find((el) => el.id === descendantId);

    while (current) {
      if (current.parent_id === ancestorId) {
        return true;
      }
      current = elements.find((el) => el.id === current!.parent_id);
    }

    return false;
  }

  /**
   * Get the path from root to element (breadcrumb)
   */
  static getElementPath(elements: Element[], elementId: string): Element[] {
    const path: Element[] = [];
    let current = elements.find((el) => el.id === elementId);

    while (current) {
      path.unshift(current);
      current = elements.find((el) => el.id === current!.parent_id);
    }

    return path;
  }
}
