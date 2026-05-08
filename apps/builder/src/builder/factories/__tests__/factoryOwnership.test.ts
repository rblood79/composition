/**
 * ADR-903 P3-D-1 + P3-D-2 TDD
 *
 * P3-D-1 범위: factory definition 함수들이 ownerFields(page_id/layout_id) 없이
 *              parentElement.id → element.parent_id 를 반영하는지 검증.
 *
 * 옵션 B 명세:
 *  - case 1: parentElement.id 가 element.parent_id 에 반영된다
 *  - case 2: ownerFields spread 제거 → element 에 page_id / layout_id 필드 없다
 *  - case 3: parentElement 미전달 시 element.parent_id = null
 *
 * 참조:
 * - docs/adr/design/903-phase3d-runtime-breakdown.md §4.1 §4.2
 * - docs/adr/design/903-p3d1-p3d2-inventory.md
 *
 * 실행: pnpm vitest run apps/builder/src/builder/factories/__tests__/factoryOwnership.test.ts
 */

import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { Element } from "../../../types/core/store.types";
import {
  registerCanonicalMutationStoreActions,
  resetCanonicalMutationStoreActions,
} from "@/adapters/canonical/canonicalMutations";

vi.mock("../utils/dbPersistence", () => ({
  saveElementsToDb: vi.fn(async () => undefined),
  saveElementsInBackground: vi.fn(),
}));

vi.mock("../../../lib/db", () => ({
  getDB: vi.fn(async () => ({
    elements: {
      insertMany: vi.fn(async () => undefined),
    },
  })),
}));

// P3-D-1 대상 factory 임포트
import {
  createAvatarDefinition,
  createAvatarGroupDefinition,
  createAccordionDefinition,
  createProgressBarDefinition,
} from "../definitions/DisplayComponents";
import {
  createTextFieldDefinition,
  createFormDefinition,
} from "../definitions/FormComponents";
import {
  createCheckboxGroupDefinition,
  createRadioGroupDefinition,
} from "../definitions/GroupComponents";
import {
  createSelectDefinition,
  createComboBoxDefinition,
} from "../definitions/SelectionComponents";
import { createTable, createColumnGroup } from "../definitions/TableComponents";
import { ComponentCreationContext } from "../types";

// ─── 헬퍼 ─────────────────────────────────────────────────────────────────────

/** 테스트용 mock parentElement */
function makeMockParent(id = "parent-id-123"): Element {
  return {
    id,
    customId: "mock-parent",
    type: "Section",
    props: {},
    parent_id: null,
    order_num: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as Element;
}

/** parentElement 있는 context */
function makeContext(
  parentElement: Element | null = null,
): ComponentCreationContext {
  return {
    parentElement,
    pageId: "page-abc",
    elements: [],
    layoutId: null,
  };
}

/**
 * element 또는 ChildDefinition 에 page_id / layout_id 필드가 없는지 재귀 검증.
 * P3-D-1 contract: ownerFields spread 완전 제거.
 */
function assertNoOwnerFields(
  obj: Record<string, unknown>,
  path = "root",
): void {
  expect(
    Object.prototype.hasOwnProperty.call(obj, "page_id"),
    `${path} 에 page_id 필드가 존재함 (P3-D-1 위반)`,
  ).toBe(false);
  expect(
    Object.prototype.hasOwnProperty.call(obj, "layout_id"),
    `${path} 에 layout_id 필드가 존재함 (P3-D-1 위반)`,
  ).toBe(false);

  const children = obj.children as Record<string, unknown>[] | undefined;
  if (Array.isArray(children)) {
    children.forEach((child, i) => {
      assertNoOwnerFields(
        child as Record<string, unknown>,
        `${path}.children[${i}]`,
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// P3-D-1: factory ownership 제거
// 범위: factories/definitions/ 10 파일 (287 ownerFields ref)
// 목표: ownerFields spread 제거 후 element 에 page_id / layout_id 필드 없음
// ─────────────────────────────────────────────────────────────────────────────

describe("P3-D-1: factory ownership 제거", () => {
  beforeEach(() => {
    registerCanonicalMutationStoreActions({
      getCurrentLegacySnapshot: () => ({
        elements: [],
        pages: [],
        layouts: [],
      }),
      getCurrentProjectId: () => null,
    });
  });

  afterEach(() => {
    resetCanonicalMutationStoreActions();
  });

  // ── DisplayComponents ──────────────────────────────────────────────────────

  describe("createAvatarDefinition", () => {
    it("parentElement.id 가 element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("avatar-parent-001");
      const ctx = makeContext(parent);

      // Act
      const def = createAvatarDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("avatar-parent-001");
    });

    it("ownerFields spread 제거 후 element 에 page_id 필드가 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createAvatarDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
    });

    it("parentElement 미전달 시 element.parent_id 가 null 이다", () => {
      // Arrange
      const ctx = makeContext(null);

      // Act
      const def = createAvatarDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBeNull();
    });
  });

  describe("createAvatarGroupDefinition", () => {
    it("parentElement.id 가 parent element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("avatargroup-parent-001");
      const ctx = makeContext(parent);

      // Act
      const def = createAvatarGroupDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("avatargroup-parent-001");
    });

    it("children Avatar 들에 page_id / layout_id 필드가 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createAvatarGroupDefinition(ctx);

      // Assert
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("parentElement 미전달 시 parent_id 가 null 로 fallback 된다", () => {
      // Arrange
      const ctx = makeContext(null);

      // Act
      const def = createAvatarGroupDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBeNull();
    });
  });

  describe("createProgressBarDefinition", () => {
    it("Label / ProgressBarValue / ProgressBarTrack 자식 모두 ownership 필드 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createProgressBarDefinition(ctx);

      // Assert
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("grid layout props (gridTemplateColumns 등) 는 변환 후에도 보존된다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createProgressBarDefinition(ctx);

      // Assert — P3-D-1 은 ownerFields 만 제거, layout props 보존 확인
      const style = def.parent.props.style as Record<string, unknown>;
      expect(style).toBeDefined();
      expect(style.display).toBe("grid");
      expect(style.gridTemplateColumns).toBe("1fr auto");
    });

    it("parentElement 있을 때 parent element 의 parent_id 가 반영된다", () => {
      // Arrange
      const parent = makeMockParent("progressbar-parent-xyz");
      const ctx = makeContext(parent);

      // Act
      const def = createProgressBarDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("progressbar-parent-xyz");
    });
  });

  describe("createAccordionDefinition", () => {
    it("3-depth 중첩 자식(Disclosure > DisclosureHeader/Content) 에도 ownership 필드 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createAccordionDefinition(ctx);

      // Assert — 재귀적으로 모든 depth 검증
      assertNoOwnerFields(
        def as unknown as Record<string, unknown>,
        "accordion",
      );
    });

    it("부모 Accordion element 에 page_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createAccordionDefinition(ctx);

      // Assert
      expect(Object.prototype.hasOwnProperty.call(def.parent, "page_id")).toBe(
        false,
      );
    });

    it("부모 Accordion element 에 layout_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createAccordionDefinition(ctx);

      // Assert
      expect(
        Object.prototype.hasOwnProperty.call(def.parent, "layout_id"),
      ).toBe(false);
    });
  });

  // ── FormComponents ─────────────────────────────────────────────────────────

  describe("createTextFieldDefinition", () => {
    it("Label / Input / FieldError 자식 모두 page_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createTextFieldDefinition(ctx);

      // Assert
      def.children.forEach((child, i) => {
        expect(
          Object.prototype.hasOwnProperty.call(child, "page_id"),
          `children[${i}] 에 page_id 존재`,
        ).toBe(false);
      });
    });

    it("Label / Input / FieldError 자식 모두 layout_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createTextFieldDefinition(ctx);

      // Assert
      def.children.forEach((child, i) => {
        expect(
          Object.prototype.hasOwnProperty.call(child, "layout_id"),
          `children[${i}] 에 layout_id 존재`,
        ).toBe(false);
      });
    });

    it("부모 TextField ownership 필드 제거 후 type 속성 등 나머지 props 는 보존된다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createTextFieldDefinition(ctx);

      // Assert — ownership 필드 없음 + 핵심 props 보존
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      expect(def.parent.type).toBe("TextField");
      expect(def.parent.props).toMatchObject({ label: "Text Field" });
    });
  });

  describe("createFormDefinition", () => {
    it("다수 자식(FormField 등) 모두 ownership 필드 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createFormDefinition(ctx);

      // Assert — 재귀 포함
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("parentElement 전달 시 Form parent element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("form-parent-777");
      const ctx = makeContext(parent);

      // Act
      const def = createFormDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("form-parent-777");
    });

    it("Form 내부 children 의 order_num 은 보존된다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createFormDefinition(ctx);

      // Assert — children 이 order_num 을 보유하고 있어야 함
      expect(def.children.length).toBeGreaterThan(0);
      def.children.forEach((child) => {
        expect(typeof (child as { order_num: unknown }).order_num).toBe(
          "number",
        );
      });
    });
  });

  // ── GroupComponents ────────────────────────────────────────────────────────

  describe("createCheckboxGroupDefinition", () => {
    it("CheckboxGroup + 중첩 자식 모두 page_id / layout_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createCheckboxGroupDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("parentElement 로 전달된 id 가 CheckboxGroup element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("cbg-parent-999");
      const ctx = makeContext(parent);

      // Act
      const def = createCheckboxGroupDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("cbg-parent-999");
    });

    it("parentElement 미전달 시 CheckboxGroup parent_id 가 null 이다", () => {
      // Arrange
      const ctx = makeContext(null);

      // Act
      const def = createCheckboxGroupDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBeNull();
    });
  });

  describe("createRadioGroupDefinition", () => {
    it("RadioGroup + Radio 자식들 모두 ownership 필드 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createRadioGroupDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("ownership 제거 후 ComponentDefinition 구조(parent/children/type) 는 유지된다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createRadioGroupDefinition(ctx);

      // Assert
      expect(def).toHaveProperty("type");
      expect(def).toHaveProperty("parent");
      expect(def).toHaveProperty("children");
      expect(Array.isArray(def.children)).toBe(true);
    });

    it("parentElement 미전달(null) 시 RadioGroup parent_id 가 null 이다", () => {
      // Arrange
      const ctx = makeContext(null);

      // Act
      const def = createRadioGroupDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBeNull();
    });
  });

  // ── SelectionComponents ────────────────────────────────────────────────────

  describe("createSelectDefinition", () => {
    it("Select + 내부 자식(Label, SelectTrigger 등) 모두 page_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createSelectDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("Select + 내부 자식 모두 layout_id 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createSelectDefinition(ctx);

      // Assert
      expect(
        Object.prototype.hasOwnProperty.call(def.parent, "layout_id"),
      ).toBe(false);
      def.children.forEach((child, i) => {
        expect(
          Object.prototype.hasOwnProperty.call(child, "layout_id"),
          `children[${i}] 에 layout_id 존재`,
        ).toBe(false);
      });
    });

    it("parentElement 전달 시 Select element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("select-parent-abc");
      const ctx = makeContext(parent);

      // Act
      const def = createSelectDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("select-parent-abc");
    });
  });

  describe("createComboBoxDefinition", () => {
    it("ComboBox 컴포넌트 자식들 ownership 필드 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createComboBoxDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      def.children.forEach((child, i) => {
        assertNoOwnerFields(
          child as unknown as Record<string, unknown>,
          `children[${i}]`,
        );
      });
    });

    it("parentElement 로 전달된 id 가 ComboBox element.parent_id 에 반영된다", () => {
      // Arrange
      const parent = makeMockParent("combobox-parent-xyz");
      const ctx = makeContext(parent);

      // Act
      const def = createComboBoxDefinition(ctx);

      // Assert
      expect(def.parent.parent_id).toBe("combobox-parent-xyz");
    });

    it("ownership 제거 후 props (size, label 등) 는 변경 없이 보존된다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const def = createComboBoxDefinition(ctx);

      // Assert
      assertNoOwnerFields(
        def.parent as unknown as Record<string, unknown>,
        "parent",
      );
      expect(def.parent.type).toBe("ComboBox");
      expect(def.parent.props).toMatchObject({ label: "Combo Box" });
    });
  });

  // ── TableComponents (async 변종) ────────────────────────────────────────────

  describe("createTable (async)", () => {
    it("Promise<ComponentCreationResult> 반환 유지 + 결과 parent 에 page_id 없다", async () => {
      // Arrange
      const parent = makeMockParent("table-parent-001");
      const ctx = makeContext(parent);

      // Act
      const result = await createTable(ctx);

      // Assert
      expect(result).toHaveProperty("parent");
      expect(result).toHaveProperty("children");
      expect(result).toHaveProperty("allElements");
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "page_id"),
      ).toBe(false);
    });

    it("await createTable(context) 결과 parent 에 page_id 없다", async () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const result = await createTable(ctx);

      // Assert
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "page_id"),
      ).toBe(false);
    });

    it("await createTable(context) 결과 parent 에 layout_id 없다", async () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const result = await createTable(ctx);

      // Assert
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "layout_id"),
      ).toBe(false);
    });
  });

  describe("createColumnGroup (async)", () => {
    it("Promise<ComponentCreationResult> 반환 유지 + ColumnGroup 에 ownership 필드 없다", async () => {
      // Arrange
      const parent = makeMockParent("colgroup-parent-001");
      const ctx = makeContext(parent);

      // Act
      const result = await createColumnGroup(ctx);

      // Assert
      expect(result).toHaveProperty("parent");
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "page_id"),
      ).toBe(false);
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "layout_id"),
      ).toBe(false);
    });

    it("await createColumnGroup(context) 결과 parent 에 layout_id 없다", async () => {
      // Arrange
      const ctx = makeContext(makeMockParent());

      // Act
      const result = await createColumnGroup(ctx);

      // Assert
      expect(
        Object.prototype.hasOwnProperty.call(result.parent, "layout_id"),
      ).toBe(false);
    });

    it("parentElement 전달 시 ColumnGroup parent_id 에 parentElement.id 가 반영된다", async () => {
      // Arrange
      const parent = makeMockParent("colgroup-parent-777");
      const ctx = makeContext(parent);

      // Act
      const result = await createColumnGroup(ctx);

      // Assert
      expect(result.parent.parent_id).toBe("colgroup-parent-777");
    });
  });

  // ── 공통 sweep 검증 ─────────────────────────────────────────────────────────

  describe("전수 sweep 검증", () => {
    it("모든 factory definition 함수가 ownerFields 없는 parent 를 반환한다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent("sweep-parent-001"));
      const syncFactories = [
        createAvatarDefinition,
        createAvatarGroupDefinition,
        createProgressBarDefinition,
        createAccordionDefinition,
        createTextFieldDefinition,
        createFormDefinition,
        createCheckboxGroupDefinition,
        createRadioGroupDefinition,
        createSelectDefinition,
        createComboBoxDefinition,
      ];

      // Act + Assert
      syncFactories.forEach((factory) => {
        const def = factory(ctx);
        assertNoOwnerFields(
          def.parent as unknown as Record<string, unknown>,
          `${factory.name}.parent`,
        );
      });
    });

    it("모든 factory definition 함수의 children 에도 ownership 필드가 없다", () => {
      // Arrange
      const ctx = makeContext(makeMockParent("sweep-parent-002"));
      const syncFactories = [
        createAvatarGroupDefinition,
        createProgressBarDefinition,
        createAccordionDefinition,
        createTextFieldDefinition,
        createFormDefinition,
        createCheckboxGroupDefinition,
        createRadioGroupDefinition,
        createSelectDefinition,
        createComboBoxDefinition,
      ];

      // Act + Assert
      syncFactories.forEach((factory) => {
        const def = factory(ctx);
        def.children.forEach((child, i) => {
          assertNoOwnerFields(
            child as unknown as Record<string, unknown>,
            `${factory.name}.children[${i}]`,
          );
        });
      });
    });

    it("async factory (createTable, createColumnGroup) 도 결과 parent 에 ownership 필드 없다", async () => {
      // Arrange
      const ctx = makeContext(makeMockParent("sweep-parent-003"));

      // Act
      const [tableResult, colGroupResult] = await Promise.all([
        createTable(ctx),
        createColumnGroup(ctx),
      ]);

      // Assert
      assertNoOwnerFields(
        tableResult.parent as unknown as Record<string, unknown>,
        "createTable.parent",
      );
      assertNoOwnerFields(
        colGroupResult.parent as unknown as Record<string, unknown>,
        "createColumnGroup.parent",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// P3-D-2: elementCreation.ts 히스토리 조건 교체
// 범위: elementCreation.ts L71 + L191 + L108-126 (7 ref)
// 목표: layout_id 기반 조건 → canonical parent context 기반 조건
// ─────────────────────────────────────────────────────────────────────────────

describe("P3-D-2: elementCreation 히스토리 조건 교체 (RED phase)", () => {
  describe("createAddElementAction — 히스토리 조건", () => {
    it.todo(
      "canonical parent 가 page context(metadata.type=page) 면 historyManager.addEntry 호출된다",
    );
    it.todo(
      "canonical parent 가 reusable frame context(reusable=true) 면 historyManager.addEntry 호출된다",
    );
    it.todo(
      "parent 가 orphan (canonical tree 에 없음) 시 historyManager.addEntry 호출되지 않는다",
    );
    it.todo("page context + layout_id undefined 조합에서도 히스토리 기록된다");
  });

  describe("createAddComplexElementAction — 히스토리 조건", () => {
    it.todo(
      "canonical parent 가 page context 면 부모+자식 모두 포함한 historyManager.addEntry 호출된다",
    );
    it.todo(
      "canonical parent 가 reusable frame context 면 historyManager.addEntry 호출된다",
    );
    it.todo("orphan parent 시 historyManager.addEntry 호출되지 않는다");
  });

  describe("order_num 재정렬 — reusable frame 기반", () => {
    it.todo(
      "reusable frame 자식 추가 시 해당 frame 의 siblings 대상으로 재정렬된다",
    );
    it.todo(
      "page element 추가 시 기존 currentPageId 기반 재정렬 경로가 동작한다",
    );
    it.todo("orphan element 추가 시 재정렬 호출되지 않는다");
    it.todo(
      "layout_id 기반 elementsMap.forEach 순회 코드가 제거된다 (dead code 없음)",
    );
  });

  describe("P3-D-1 후 통합 — ownership 없는 element 처리", () => {
    it.todo(
      "page_id / layout_id 필드 없는 element 추가 시 히스토리 조건이 canonical parent 기반으로만 판정된다",
    );
    it.todo(
      "P3-A dev-only assert(ownership 없음 경고) 가 P3-D-2 에서 제거된다",
    );
    it.todo(
      "ownership 제거 후 IndexedDB 저장(sanitizeElement) 은 정상 동작한다",
    );
  });
});
