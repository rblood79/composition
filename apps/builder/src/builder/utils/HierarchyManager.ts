import { Element } from "../../types/core/store.types";

export interface ElementNode {
  element: Element;
  children: ElementNode[];
  depth: number;
}

export interface ElementTree {
  roots: ElementNode[];
  elementMap: Map<string, ElementNode>;
  flatList: Element[];
}

export interface HierarchyStats {
  totalElements: number;
  maxDepth: number;
  averageDepth: number;
  orphanedElements: Element[];
}

export interface CacheConfig {
  maxCacheSize: number;
  enableIncrementalUpdate: boolean;
  enableBatchProcessing: boolean;
  batchSize: number;
}

export class HierarchyManager {
  private static elementMap: Map<string, ElementNode> = new Map();
  private static treeCache: Map<string, ElementTree> = new Map();
  private static childrenCache: Map<string, Element[]> = new Map();

  // 성능 최적화 설정
  private static config: CacheConfig = {
    maxCacheSize: 1000,
    enableIncrementalUpdate: true,
    enableBatchProcessing: true,
    batchSize: 100,
  };

  /**
   * 설정 업데이트
   */
  static updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 요소 배열로부터 계층 구조 트리 생성 (최적화됨)
   */
  static buildElementTree(elements: Element[]): ElementTree {
    const cacheKey = this.generateCacheKey(elements);

    // 캐시된 트리가 있으면 반환
    if (this.treeCache.has(cacheKey)) {
      return this.treeCache.get(cacheKey)!;
    }

    // 캐시 크기 제한
    if (this.treeCache.size >= this.config.maxCacheSize) {
      this.clearOldestCache();
    }

    const elementMap = new Map<string, ElementNode>();
    const roots: ElementNode[] = [];

    // 배치 처리로 요소 노드 생성
    if (this.config.enableBatchProcessing) {
      this.createNodesInBatches(elements, elementMap);
    } else {
      this.createNodesSequentially(elements, elementMap);
    }

    // 계층 구조 구성 (최적화됨)
    this.buildHierarchy(elements, elementMap, roots);

    // order_num으로 정렬
    this.sortNodesByOrder(roots);

    const tree: ElementTree = {
      roots,
      elementMap,
      flatList: elements,
    };

    // 캐시에 저장
    this.treeCache.set(cacheKey, tree);

    return tree;
  }

  /**
   * 배치 처리로 노드 생성
   */
  private static createNodesInBatches(
    elements: Element[],
    elementMap: Map<string, ElementNode>,
  ): void {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);

      batch.forEach((element) => {
        elementMap.set(element.id, {
          element,
          children: [],
          depth: 0,
        });
      });
    }
  }

  /**
   * 순차 처리로 노드 생성
   */
  private static createNodesSequentially(
    elements: Element[],
    elementMap: Map<string, ElementNode>,
  ): void {
    elements.forEach((element) => {
      elementMap.set(element.id, {
        element,
        children: [],
        depth: 0,
      });
    });
  }

  /**
   * 계층 구조 구성 (최적화됨)
   */
  private static buildHierarchy(
    elements: Element[],
    elementMap: Map<string, ElementNode>,
    roots: ElementNode[],
  ): void {
    // 부모-자식 관계를 한 번에 처리
    const parentChildMap = new Map<string, Element[]>();

    elements.forEach((element) => {
      const parentId = element.parent_id ?? "root";
      if (!parentChildMap.has(parentId)) {
        parentChildMap.set(parentId, []);
      }
      parentChildMap.get(parentId)!.push(element);
    });

    // 루트 요소들 처리
    const rootElements = parentChildMap.get("root") || [];
    rootElements.forEach((element) => {
      const node = elementMap.get(element.id)!;
      roots.push(node);
    });

    // 자식 요소들 처리
    parentChildMap.forEach((children, parentId) => {
      if (parentId === "root") return;

      const parentNode = elementMap.get(parentId);
      if (parentNode) {
        children.forEach((element) => {
          const childNode = elementMap.get(element.id)!;
          parentNode.children.push(childNode);
          childNode.depth = parentNode.depth + 1;
        });
      }
    });
  }

  /**
   * 특정 부모의 자식 요소들 반환 (source/canonical projection order 보존)
   */
  static getOrderedChildren(
    parentId: string | null,
    elements: Element[],
  ): Element[] {
    const cacheKey = `children:${parentId || "null"}:${this.generateCacheKey(elements)}`;

    if (this.childrenCache.has(cacheKey)) {
      return this.childrenCache.get(cacheKey)!;
    }

    const children = elements.filter((el) => el.parent_id === parentId);

    // 캐시에 저장
    this.childrenCache.set(cacheKey, children);

    return children;
  }

  /**
   * 다음 order_num 계산
   *
   * ⚠️ 캐시 사용 안 함: 연속 요소 생성 시 중복 order_num 방지
   * 같은 elements 배열로 여러 요소를 연속 생성하면 캐시 키가 동일하여
   * 같은 order_num이 반환되는 문제가 있었음
   */
  static calculateNextOrderNum(
    parentId: string | null,
    elements: Element[],
  ): number {
    const siblings = elements.filter((el) => el.parent_id === parentId);
    if (siblings.length === 0) return 0;
    return Math.max(...siblings.map((el) => el.order_num || 0)) + 1;
  }

  /**
   * 증분 업데이트 (요소가 추가/삭제/수정될 때)
   */
  static incrementalUpdate(
    newElements: Element[],
    targetElementId?: string,
  ): void {
    if (!this.config.enableIncrementalUpdate) {
      this.clearCache();
      return;
    }

    // 관련된 캐시만 무효화
    const affectedParentIds = new Set<string | null>();

    if (targetElementId) {
      const targetElement = newElements.find((el) => el.id === targetElementId);
      if (targetElement) {
        affectedParentIds.add(targetElement.parent_id ?? null);
      }
    }

    // 관련 캐시 삭제
    this.clearRelatedCache(affectedParentIds);
  }

  /**
   * 관련 캐시만 삭제
   */
  private static clearRelatedCache(parentIds: Set<string | null>): void {
    const keysToDelete: string[] = [];

    this.childrenCache.forEach((_, key) => {
      const parentId = key.split(":")[1];
      if (parentIds.has(parentId === "null" ? null : parentId)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.childrenCache.delete(key);
    });
  }

  /**
   * 오래된 캐시 삭제 (LRU 방식)
   */
  private static clearOldestCache(): void {
    const cacheEntries = Array.from(this.treeCache.entries());
    const toDelete = cacheEntries.slice(
      0,
      Math.floor(this.config.maxCacheSize * 0.2),
    );

    toDelete.forEach(([key]) => {
      this.treeCache.delete(key);
    });
  }

  /**
   * 대용량 요소 처리용 배치 메서드
   */
  static processLargeElementSet(
    elements: Element[],
    batchCallback: (batch: Element[]) => void,
  ): void {
    const batchSize = this.config.batchSize;

    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      batchCallback(batch);
    }
  }

  /**
   * 성능 통계 반환
   */
  static getPerformanceStats(): {
    cacheSize: number;
    childrenCacheSize: number;
    orderNumCacheSize: number;
    hitRate: number;
  } {
    return {
      cacheSize: this.treeCache.size,
      childrenCacheSize: this.childrenCache.size,
      orderNumCacheSize: 0, // orderNum 캐시는 현재 별도로 관리되지 않음
      hitRate: 0, // TODO: 히트율 계산 로직 추가
    };
  }

  /**
   * 요소를 특정 위치에 삽입하기 위한 order_num 재계산 (최적화됨)
   */
  static calculateOrderNumsForInsertion(
    parentId: string | null,
    insertIndex: number,
    elements: Element[],
  ): { [elementId: string]: number } {
    const siblings = this.getOrderedChildren(parentId, elements);
    const orderNumMap: { [elementId: string]: number } = {};

    // 삽입 위치 이후의 모든 요소들의 order_num을 1씩 증가
    siblings.forEach((sibling, index) => {
      if (index >= insertIndex) {
        orderNumMap[sibling.id] = (sibling.order_num || 0) + 1;
      }
    });

    return orderNumMap;
  }

  /**
   * 요소 이동을 위한 order_num 재계산 (최적화됨)
   */
  static calculateMoveOrderNums(
    elementId: string,
    newParentId: string | null,
    newIndex: number,
    elements: Element[],
  ): { [elementId: string]: number } {
    const element = elements.find((el) => el.id === elementId);
    if (!element) return {};

    const orderNumMap: { [elementId: string]: number } = {};

    // 기존 부모의 자식들에서 제거
    const oldSiblings = this.getOrderedChildren(
      element.parent_id ?? null,
      elements,
    );
    const oldIndex = oldSiblings.findIndex(
      (sibling) => sibling.id === elementId,
    );

    if (oldIndex !== -1) {
      // 기존 위치 이후의 요소들을 앞으로 이동
      oldSiblings.slice(oldIndex + 1).forEach((sibling) => {
        orderNumMap[sibling.id] = (sibling.order_num || 0) - 1;
      });
    }

    // 새 부모의 자식들에 삽입
    const newSiblings = this.getOrderedChildren(newParentId ?? null, elements);
    newSiblings.slice(newIndex).forEach((sibling) => {
      orderNumMap[sibling.id] = (sibling.order_num || 0) + 1;
    });

    return orderNumMap;
  }

  /**
   * 특수 컴포넌트의 자식 요소들 반환 (최적화됨)
   */
  static getSpecialComponentChildren(
    parentId: string | null,
    elements: Element[],
  ): Element[] {
    const parent = elements.find((el) => el.id === parentId);
    if (!parent) return [];

    const children = this.getOrderedChildren(parentId, elements);

    switch (parent.type) {
      case "Tabs": {
        // ADR-066: Tab element 소멸. TabList + TabPanels만 자식으로 반환.
        return children.filter(
          (child) => child.type === "TabList" || child.type === "TabPanels",
        );
      }

      case "Tree": {
        // TreeItem들만 반환
        return children.filter((child) => child.type === "TreeItem");
      }

      case "ToggleButtonGroup": {
        // ToggleButton들만 반환
        return children.filter((child) => child.type === "ToggleButton");
      }

      case "CheckboxGroup": {
        // Checkbox들만 반환
        return children.filter((child) => child.type === "Checkbox");
      }

      case "RadioGroup": {
        // Radio들만 반환
        return children.filter((child) => child.type === "Radio");
      }

      case "Select": {
        // ADR-073: SelectItem element 소멸. Label + SelectTrigger 만 자식으로 반환.
        return children.filter(
          (child) => child.type === "Label" || child.type === "SelectTrigger",
        );
      }

      case "ComboBox": {
        // ADR-073: ComboBoxItem element 소멸. Label + ComboBoxWrapper 만 자식으로 반환.
        return children.filter(
          (child) => child.type === "Label" || child.type === "ComboBoxWrapper",
        );
      }

      case "ListBox": {
        // ADR-076 P6: dead code 가능성 — 본 함수의 호출처 grep 0건(2026-04-18 확인).
        // 실제 레이어 패널 virtual children 생성은 `useLayerTreeData.ts:213-218` 경로
        // 에서 `props.items` 기반으로 수행. 본 case 는 최소 영향 정책(기존 로직 유지)
        // 으로 보존. 템플릿 모드(Field 자식 보유) 부모는 여기서 ListBoxItem 자식을
        // 반환해야 하나, items SSOT 하에서 정적 모드 부모는 ListBoxItem 자식이 0개.
        return children.filter((child) => child.type === "ListBoxItem");
      }

      case "GridList": {
        // GridListItem들만 반환
        return children.filter((child) => child.type === "GridListItem");
      }

      case "TagGroup": {
        // Tag들만 반환
        return children.filter((child) => child.type === "Tag");
      }

      default:
        return children;
    }
  }

  /**
   * 계층 구조 통계 반환 (최적화됨)
   */
  static getHierarchyStats(elements: Element[]): HierarchyStats {
    const tree = this.buildElementTree(elements);
    const depths: number[] = [];
    let maxDepth = 0;
    const orphanedElements: Element[] = [];

    const calculateDepth = (node: ElementNode, depth: number) => {
      node.depth = depth;
      depths.push(depth);
      maxDepth = Math.max(maxDepth, depth);

      node.children.forEach((child) => {
        calculateDepth(child, depth + 1);
      });
    };

    tree.roots.forEach((root) => {
      calculateDepth(root, 0);
    });

    // 고아 요소 찾기
    elements.forEach((element) => {
      if (element.parent_id && !tree.elementMap.has(element.parent_id)) {
        orphanedElements.push(element);
      }
    });

    const averageDepth =
      depths.length > 0
        ? depths.reduce((sum, depth) => sum + depth, 0) / depths.length
        : 0;

    return {
      totalElements: elements.length,
      maxDepth,
      averageDepth: Math.round(averageDepth * 100) / 100,
      orphanedElements,
    };
  }

  /**
   * 계층 구조 유효성 검사 (최적화됨)
   */
  static validateHierarchy(elements: Element[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const elementIds = new Set(elements.map((el) => el.id));
    const parentChildMap = new Map<string, string[]>();

    // 부모-자식 관계 맵 생성
    elements.forEach((element) => {
      if (element.parent_id) {
        if (!parentChildMap.has(element.parent_id)) {
          parentChildMap.set(element.parent_id, []);
        }
        parentChildMap.get(element.parent_id)!.push(element.id);
      }
    });

    // 순환 참조 검사
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (elementId: string): boolean => {
      if (recursionStack.has(elementId)) {
        return true;
      }
      if (visited.has(elementId)) {
        return false;
      }

      visited.add(elementId);
      recursionStack.add(elementId);

      const children = parentChildMap.get(elementId) || [];
      for (const childId of children) {
        if (hasCycle(childId)) {
          return true;
        }
      }

      recursionStack.delete(elementId);
      return false;
    };

    // 각 요소에 대해 순환 참조 검사
    elements.forEach((element) => {
      if (hasCycle(element.id)) {
        errors.push(
          `Circular reference detected involving element: ${element.id}`,
        );
      }
    });

    // 고아 요소 검사
    elements.forEach((element) => {
      if (element.parent_id && !elementIds.has(element.parent_id)) {
        errors.push(
          `Orphaned element found: ${element.id} (parent: ${element.parent_id} not found)`,
        );
      }
    });

    // order_num 중복 검사
    const orderNumMap = new Map<string, Set<number>>();
    elements.forEach((element) => {
      const parentId = element.parent_id || "root";
      if (!orderNumMap.has(parentId)) {
        orderNumMap.set(parentId, new Set());
      }
      const orderNum = element.order_num || 0;
      if (orderNumMap.get(parentId)!.has(orderNum)) {
        warnings.push(
          `Duplicate order_num found: ${orderNum} for parent ${parentId}`,
        );
      }
      orderNumMap.get(parentId)!.add(orderNum);
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * 캐시 키 생성 (최적화됨)
   */
  private static generateCacheKey(elements: Element[]): string {
    // 요소가 많을 때는 해시 기반 키 생성
    if (elements.length > 100) {
      const hash = elements
        .map((el) => `${el.id}:${el.parent_id}:${el.order_num}`)
        .join("|")
        .split("")
        .reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
      return `hash:${hash}:${elements.length}`;
    }

    // 요소가 적을 때는 전체 키 사용
    return elements
      .map((el) => `${el.id}:${el.parent_id}:${el.order_num}`)
      .sort()
      .join("|");
  }

  /**
   * 노드 source order 보존. 재귀만 수행해 child cache shape 를 유지한다.
   */
  private static sortNodesByOrder(nodes: ElementNode[]): void {
    nodes.forEach((node) => this.sortNodesByOrder(node.children));
  }

  /**
   * 모든 캐시 클리어
   */
  static clearCache(): void {
    this.treeCache.clear();
    this.elementMap.clear();
    this.childrenCache.clear();
  }

  /**
   * 특정 캐시만 클리어
   */
  static clearSpecificCache(type: "tree" | "children" | "all"): void {
    switch (type) {
      case "tree":
        this.treeCache.clear();
        this.elementMap.clear();
        break;
      case "children":
        this.childrenCache.clear();
        break;
      case "all":
        this.clearCache();
        break;
    }
  }
}
