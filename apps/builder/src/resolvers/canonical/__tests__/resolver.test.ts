/**
 * @fileoverview resolveCanonicalDocument 단위 테스트 — ADR-903 P2 Stream C
 *
 * Stream A (index.ts) 의 contract 를 검증한다.
 * Stream A/B 가 contract 를 어기면 이 파일의 vitest 가 fail 하여 즉시 드러난다.
 *
 * 처리 순서 계약 (ADR-903 Hard Constraint #3):
 *   ref resolve → descendants apply → slot contract validate → resolved tree
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CanonicalNode,
  CompositionDocument,
  FrameNode,
  RefNode,
  ResolvedNode,
  ResolverCache,
} from "@composition/shared";
import { resolveCanonicalDocument, type ImportResolverContext } from "../index";
import { createResolverCache } from "../cache";

// ──────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ──────────────────────────────────────────────────────────────────────────────

function makeDoc(children: CanonicalNode[]): CompositionDocument {
  return { version: "composition-1.0", children };
}

function makeReusable(
  id: string,
  type: CanonicalNode["type"],
  children?: CanonicalNode[],
): CanonicalNode {
  const node: CanonicalNode = { id, type, reusable: true };
  if (children !== undefined) node.children = children;
  return node;
}

function makeRef(id: string, ref: string, extras?: Partial<RefNode>): RefNode {
  return { id, type: "ref", ref, ...extras } as RefNode;
}

function makeFrame(id: string, extras?: Partial<FrameNode>): FrameNode {
  return { id, type: "frame", ...extras } as FrameNode;
}

function makePlain(
  id: string,
  type: CanonicalNode["type"],
  extras?: Partial<CanonicalNode>,
): CanonicalNode {
  return { id, type, ...extras };
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("resolveCanonicalDocument", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  // ────────────────────────────────────────────
  // TC1: 빈 문서
  // ────────────────────────────────────────────

  it("TC1: 빈 문서는 빈 배열을 반환한다", () => {
    // Arrange
    const doc = makeDoc([]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    expect(result).toEqual([]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────
  // TC2: 단일 reusable + ref 매칭
  // ────────────────────────────────────────────

  it("TC2: ref 노드가 master 에 매칭되면 _resolvedFrom 이 master id 와 동일하다", () => {
    // Arrange
    const labelChild = makePlain("label", "Label");
    const master = makeReusable("btn", "Button", [labelChild]);
    const ref = makeRef("i1", "btn");
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert — ref resolve 결과 노드
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    expect(resolvedRef).toBeDefined();
    expect(resolvedRef._resolvedFrom).toBe("btn");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("TC2b: ref 가 reusable master name 을 가리켜도 master id 로 resolve 된다", () => {
    // Arrange
    const master = {
      ...makeReusable("btn", "Button"),
      name: "PrimaryButton",
    } as CanonicalNode;
    const ref = makeRef("i1", "PrimaryButton");
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    expect(resolvedRef).toBeDefined();
    expect(resolvedRef._resolvedFrom).toBe("btn");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────
  // TC3: broken ref
  // ────────────────────────────────────────────

  it("TC3: broken ref 는 console.warn 1회 + 원본 ref 노드 반환 (_resolvedFrom 미주입)", () => {
    // Arrange
    const ref = makeRef("orphan", "missing-master");
    const doc = makeDoc([ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/broken ref/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/missing-master/);

    const returned = result[0] as ResolvedNode;
    expect(returned.id).toBe("orphan");
    expect(returned._resolvedFrom).toBeUndefined();
  });

  // ────────────────────────────────────────────
  // TC4: mode A — 속성 patch
  // ────────────────────────────────────────────

  it("TC4: descendants mode A — override 속성이 child 에 머지된다", () => {
    // Arrange
    const labelChild: CanonicalNode = {
      id: "label",
      type: "Label",
      props: { text: "OK" },
    };
    const master = makeReusable("btn", "Button", [labelChild]);
    const ref = makeRef("i1", "btn", {
      descendants: {
        label: { text: "Cancel" } as Record<string, unknown>,
      },
    });
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    expect(resolvedRef._resolvedFrom).toBe("btn");

    const resolvedLabel = resolvedRef.children?.find(
      (c) => c.id === "label",
    ) as ResolvedNode;
    expect(resolvedLabel).toBeDefined();
    // mode A 적용 결과: props 에 머지된 text
    expect(resolvedLabel.props?.text).toBe("Cancel");
  });

  // ────────────────────────────────────────────
  // TC5: mode B — node replacement (type 존재)
  // ────────────────────────────────────────────

  it("TC5: descendants mode B — 해당 path 가 새 노드 서브트리로 교체된다", () => {
    // Arrange
    // NOTE: replacementNode 는 mode B (type 존재) 이므로 children 없이 단순 교체.
    // children 이 있으면 현재 Stream A 구현이 hasType && hasChildren → throw.
    // mode B 에서 sub-children 포함 교체가 필요한 경우는 TC7 참고 (throw 검증).
    const labelChild = makePlain("label", "Label");
    const master = makeReusable("btn", "Button", [labelChild]);
    const replacementNode: CanonicalNode = {
      id: "new-label",
      type: "Heading",
      // children 없음 — mode B 단순 교체
    };
    const ref = makeRef("i1", "btn", {
      descendants: {
        label: replacementNode,
      },
    });
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    const replacedChild = resolvedRef.children?.find(
      (c) => c.id === "new-label",
    );
    expect(replacedChild).toBeDefined();
    expect(replacedChild?.type).toBe("Heading");
    // 원래 label 노드는 사라짐
    expect(resolvedRef.children?.find((c) => c.id === "label")).toBeUndefined();
  });

  // ────────────────────────────────────────────
  // TC6: mode C — children replacement
  // ────────────────────────────────────────────

  it("TC6: descendants mode C — slot frame 의 children 배열이 교체되고 _overrides 에 children 이 포함된다", () => {
    // Arrange
    const slotFrame = makeFrame("main-slot", { slot: ["card"], children: [] });
    const master = makeReusable("layout", "frame", [slotFrame]);
    const newCard = makePlain("c1", "Card");
    const ref = makeRef("page-1", "layout", {
      descendants: {
        "main-slot": { children: [newCard] } as {
          children: CanonicalNode[];
        },
      },
    });
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedPage = result.find((n) => n.id === "page-1") as ResolvedNode;
    const resolvedSlot = resolvedPage.children?.find(
      (c) => c.id === "main-slot",
    ) as ResolvedNode;
    expect(resolvedSlot).toBeDefined();
    expect(resolvedSlot.children).toHaveLength(1);
    expect(resolvedSlot.children?.[0].type).toBe("Card");
    expect(resolvedSlot._overrides).toContain("children");
  });

  // ────────────────────────────────────────────
  // TC7: 3-mode 복수 조건 throw
  // ────────────────────────────────────────────

  it("TC7: descendants 에 type + children 동시 존재 시 throw 한다", () => {
    // Arrange
    const labelChild = makePlain("label", "Label");
    const master = makeReusable("btn", "Button", [labelChild]);
    const violatingOverride = {
      id: "new-label",
      type: "Heading",
      children: [makePlain("h", "Label")],
    } as CanonicalNode;
    const ref = makeRef("i1", "btn", {
      descendants: { label: violatingOverride },
    });
    const doc = makeDoc([master, ref]);

    // Act & Assert
    expect(() => resolveCanonicalDocument(doc)).toThrowError(
      /3-mode discriminator/,
    );
  });

  // ────────────────────────────────────────────
  // TC8: nested ref 재귀 resolve
  // ────────────────────────────────────────────

  it("TC8: master 안에 또 다른 ref 가 있으면 재귀적으로 resolve 된다", () => {
    // Arrange
    const innerMaster = makeReusable("icon", "Icon");
    const iconRef = makeRef("icon-instance", "icon");
    const outerMaster = makeReusable("btn", "Button", [iconRef]);
    const outerRef = makeRef("btn-i1", "btn");
    const doc = makeDoc([innerMaster, outerMaster, outerRef]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedOuter = result.find((n) => n.id === "btn-i1") as ResolvedNode;
    expect(resolvedOuter._resolvedFrom).toBe("btn");

    // 내부 icon ref 도 재귀 resolve 됨 (ADR-903 STREAM A 수정 완료 / ADR-142 #6 확인):
    // applyDescendantsToTree 가 non-matching child 중 type==="ref" 를 resolveRefNode
    // 로 dispatch (index.ts:251-253) → 모든 depth 의 nested ref 에 _resolvedFrom 주입.
    const resolvedIcon = resolvedOuter.children?.find(
      (c) => c.id === "icon-instance",
    ) as ResolvedNode;
    expect(resolvedIcon).toBeDefined();
    expect(resolvedIcon._resolvedFrom).toBe("icon");
  });

  it("TC8b: ref instance 의 직접 children 을 origin children 과 함께 resolve 한다", () => {
    const itemOrigin = makeReusable(
      "component-listbox-item-default",
      "ListBoxItem",
    );
    const listBoxOrigin = {
      ...makeReusable("component-listbox", "ListBox"),
      slot: ["component-listbox-item-default"],
    } as CanonicalNode;
    const listBoxRef = makeRef("listbox-instance", "component-listbox", {
      children: [
        makeRef("template-anchor", "component-listbox-item-default", {
          metadata: {
            type: "legacy-element-props",
            templateRole: "listbox-item-template-anchor",
            originRef: "component-listbox-item-default",
          },
        }),
      ],
      props: {
        items: [{ id: "aardvark", label: "Aardvark" }],
      },
    });
    const doc = makeDoc([itemOrigin, listBoxOrigin, listBoxRef]);

    const result = resolveCanonicalDocument(doc);

    const resolvedListBox = result.find(
      (node) => node.id === "listbox-instance",
    ) as ResolvedNode;
    expect(resolvedListBox).toMatchObject({
      id: "listbox-instance",
      type: "ListBox",
      _resolvedFrom: "component-listbox",
    });
    expect(resolvedListBox.children?.[0]).toMatchObject({
      id: "template-anchor",
      type: "ListBoxItem",
      _resolvedFrom: "component-listbox-item-default",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ────────────────────────────────────────────
  // TC9: slot contract validate — warning + 계속 진행
  // ────────────────────────────────────────────

  it("TC9: slot 범위 밖 자식이 들어오면 console.warn 1회 후 tree 가 그대로 반환된다", () => {
    // Arrange
    const slotFrame = makeFrame("main-slot", {
      slot: ["allowed-card"],
      children: [],
    });
    const master = makeReusable("layout", "frame", [slotFrame]);
    const forbiddenButton = makePlain("b1", "Button");
    const ref = makeRef("page-1", "layout", {
      descendants: {
        "main-slot": {
          children: [forbiddenButton],
        } as { children: CanonicalNode[] },
      },
    });
    const doc = makeDoc([master, ref]);

    // Act — throw 없이 정상 완료
    let result: ResolvedNode[];
    expect(() => {
      result = resolveCanonicalDocument(doc);
    }).not.toThrow();

    // Assert: warn 1회 (ADR-903 STREAM A 수정 완료 / ADR-142 #6 확인):
    // applyOverrideToNode mode C(hasChildren) 분기가 hasSlotContract(child) →
    // validateSlotContract 호출 (index.ts:306-308) → slot 범위 밖 자식 경고.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/slot contract/);

    // tree 는 그대로: Button 자식이 들어 있음
    // result = [resolved_layout(master), resolved_page-1(ref)] — id 로 page 노드 검색
    const resolvedPage = result!.find((n) => n.id === "page-1") as ResolvedNode;
    expect(resolvedPage).toBeDefined();
    const resolvedSlot = resolvedPage.children?.find(
      (c) => c.id === "main-slot",
    );
    expect(resolvedSlot?.children?.[0].type).toBe("Button");
  });

  it("TC9b: slot recommendation 이 reusable master name 을 가리키면 경고하지 않는다", () => {
    // Arrange
    const allowedCard = {
      ...makeReusable("allowed-card", "Card"),
      name: "AllowedCard",
    } as CanonicalNode;
    const slotFrame = makeFrame("main-slot", {
      slot: ["AllowedCard"],
      children: [],
    });
    const master = makeReusable("layout", "frame", [slotFrame]);
    const allowedRef = makeRef("slot-card", "allowed-card");
    const ref = makeRef("page-1", "layout", {
      descendants: {
        "main-slot": {
          children: [allowedRef],
        } as { children: CanonicalNode[] },
      },
    });
    const doc = makeDoc([allowedCard, master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    expect(warnSpy).not.toHaveBeenCalled();
    const resolvedPage = result.find((n) => n.id === "page-1") as ResolvedNode;
    const resolvedSlot = resolvedPage.children?.find(
      (c) => c.id === "main-slot",
    );
    expect(resolvedSlot?.children?.[0]._resolvedFrom).toBe("allowed-card");
  });

  it("TC9c: CardContent 같은 내부 slot host 도 mode C children 교체 시 contract 를 검증한다", () => {
    const cardContent = makePlain("content", "CardContent", {
      slot: ["allowed-card"],
      children: [],
    });
    const master = makeReusable("card", "Card", [cardContent]);
    const forbiddenButton = makePlain("b1", "Button");
    const ref = makeRef("card-instance", "card", {
      descendants: {
        content: {
          children: [forbiddenButton],
        } as { children: CanonicalNode[] },
      },
    });
    const doc = makeDoc([master, ref]);

    const result = resolveCanonicalDocument(doc);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/slot contract/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/host "content"/);
    const resolvedInstance = result.find(
      (n) => n.id === "card-instance",
    ) as ResolvedNode;
    const resolvedContent = resolvedInstance.children?.find(
      (c) => c.id === "content",
    );
    expect(resolvedContent?.children?.[0].type).toBe("Button");
  });

  // ────────────────────────────────────────────
  // TC10: _overrides 추적 — mode A patch 필드
  // ────────────────────────────────────────────

  it("TC10: mode A override 된 descendants key 가 ref 노드의 _overrides 에 포함된다", () => {
    // Arrange
    const labelChild: CanonicalNode = {
      id: "label",
      type: "Label",
      props: { text: "OK" },
    };
    const master = makeReusable("btn", "Button", [labelChild]);
    const ref = makeRef("i1", "btn", {
      descendants: {
        label: { text: "Cancel" } as Record<string, unknown>,
      },
    });
    const doc = makeDoc([master, ref]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    // ref 노드 자체의 _overrides 에는 descendants key 경로 기록
    expect(resolvedRef._overrides).toBeDefined();
    expect(resolvedRef._overrides).toContain("descendants.label");
  });

  // ────────────────────────────────────────────
  // TC11: cache 미전달 시 정상 동작
  // ────────────────────────────────────────────

  it("TC11: cache 인자 없이 호출해도 정상 resolve 된다", () => {
    // Arrange
    const master = makeReusable("btn", "Button");
    const ref = makeRef("i1", "btn");
    const doc = makeDoc([master, ref]);

    // Act — cache undefined (기본값)
    const result = resolveCanonicalDocument(doc);

    // Assert
    expect(result.find((n) => n.id === "i1")?._resolvedFrom).toBe("btn");
  });

  // ────────────────────────────────────────────
  // TC12: cache 전달 시 두 번째 호출에서 cache hit
  // ────────────────────────────────────────────

  it("TC12: cache 전달 시 같은 문서 두 번 호출 → 두 번째 호출에서 cache.stats().hits 증가", () => {
    // Arrange
    const master = makeReusable("btn", "Button");
    const ref = makeRef("i1", "btn");
    const doc = makeDoc([master, ref]);
    const cache: ResolverCache = createResolverCache();

    // Act
    resolveCanonicalDocument(doc, cache); // 첫 번째 — miss
    const statsAfterFirst = cache.stats();

    resolveCanonicalDocument(doc, cache); // 두 번째 — hit (같은 key)
    const statsAfterSecond = cache.stats();

    // Assert
    expect(statsAfterFirst.misses).toBe(1);
    expect(statsAfterSecond.hits).toBe(1);
    // 두 번째 호출은 새 miss 없음 (hit 만 증가)
    expect(statsAfterSecond.misses).toBe(1);
  });

  it("TC12b: import namespace ref 는 loaded import document 의 reusable node 로 resolve 된다", () => {
    // Arrange
    const importedButton = makeReusable(
      "round-button",
      "Button",
    ) as CanonicalNode;
    importedButton.props = { label: "Imported" };
    const importedDoc = makeDoc([importedButton]);
    const imports: ImportResolverContext = {
      resolveImportDocument: vi.fn(() => importedDoc),
    };
    const ref = makeRef("i1", "kit:round-button");
    const doc: CompositionDocument = {
      version: "composition-1.0",
      imports: { kit: "./kit.pen" },
      children: [ref],
    };

    // Act
    const result = resolveCanonicalDocument(doc, undefined, imports);

    // Assert
    const resolvedRef = result.find((n) => n.id === "i1") as ResolvedNode;
    expect(resolvedRef).toEqual(
      expect.objectContaining({
        id: "i1",
        type: "Button",
        props: { label: "Imported" },
        _resolvedFrom: "kit:round-button",
      }),
    );
    expect(resolvedRef.metadata).toEqual(
      expect.objectContaining({
        importedFrom: "kit:round-button",
        importKey: "kit",
        importNodeId: "round-button",
        importSource: "./kit.pen",
      }),
    );
    expect(imports.resolveImportDocument).toHaveBeenCalledWith(
      "kit",
      "./kit.pen",
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("TC12b-1: invalid import namespace ref 는 import resolver 를 호출하지 않는다", () => {
    // Arrange
    const importedButton = makeReusable(
      "round-button",
      "Button",
    ) as CanonicalNode;
    const importedDoc = makeDoc([importedButton]);
    const imports: ImportResolverContext = {
      resolveImportDocument: vi.fn(() => importedDoc),
    };
    const doc: CompositionDocument = {
      version: "composition-1.0",
      imports: { "bad:key": "./bad.pen" },
      children: [makeRef("i1", "bad:key:round-button")],
    };

    // Act
    const result = resolveCanonicalDocument(doc, undefined, imports);

    // Assert
    expect(result[0]).toEqual(
      expect.objectContaining({ id: "i1", type: "ref" }),
    );
    expect(imports.resolveImportDocument).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('master "bad:key:round-button" not found'),
    );
  });

  it("TC12c: import document version change invalidates resolver cache key", () => {
    // Arrange
    const makeImportedDoc = (
      version: string,
      label: string,
    ): CompositionDocument => {
      const button = makeReusable("round-button", "Button") as CanonicalNode;
      button.props = { label };
      return { version, children: [button] };
    };
    let importedDoc = makeImportedDoc("composition-1.0", "First");
    const imports: ImportResolverContext = {
      resolveImportDocument: vi.fn(() => importedDoc),
    };
    const cache: ResolverCache = createResolverCache();
    const doc: CompositionDocument = {
      version: "composition-1.0",
      imports: { kit: "./kit.pen" },
      children: [makeRef("i1", "kit:round-button")],
    };

    // Act
    const first = resolveCanonicalDocument(doc, cache, imports);
    importedDoc = makeImportedDoc("composition-1.1", "Second");
    const second = resolveCanonicalDocument(doc, cache, imports);

    // Assert
    expect(first.find((node) => node.id === "i1")?.props).toEqual({
      label: "First",
    });
    expect(second.find((node) => node.id === "i1")?.props).toEqual({
      label: "Second",
    });
    expect(cache.stats()).toEqual({ hits: 0, misses: 2, size: 2 });
  });

  // ────────────────────────────────────────────
  // TC13: 비-ref 일반 노드는 그대로 통과
  // ────────────────────────────────────────────

  it("TC13: type=frame 일반 노드는 _resolvedFrom 없이 그대로 반환된다", () => {
    // Arrange
    const plainFrame = makePlain("section-1", "frame");
    const doc = makeDoc([plainFrame]);

    // Act
    const result = resolveCanonicalDocument(doc);

    // Assert
    expect(result).toHaveLength(1);
    const node = result[0] as ResolvedNode;
    expect(node.id).toBe("section-1");
    expect(node._resolvedFrom).toBeUndefined();
  });
});
