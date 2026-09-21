import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  convertNewOriginChildrenToRefs,
  diffPropsAgainstOrigin,
  toOriginChildSeed,
  type OriginChildRefDiagnostic,
} from "../originChildRefs";
import { buildCatalogOrigin } from "../catalogOrigins";
import { ensureReusableCompositeOrigins } from "../reusableCompositeOrigins";
import { FORM_ORIGIN_ID } from "../form/formTemplateOrigins";
import { TOOLBAR_ORIGIN_ID } from "../toolbar/toolbarTemplateOrigins";
import { ICONBUTTON_ORIGIN_ID } from "../iconbutton/iconButtonTemplateOrigins";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

/**
 * ADR-229 Phase 2 — 저작 조합층 자식의 ref 화.
 *
 * 규칙 하나 (`toOriginChildSeed`): reusable origin 이 있는 type 의 자식은 sub-part 가 아니면
 * `type:"ref"` 로 바꾸고 props 는 origin 과 다른 키만 (228 명시 initialProps 규칙), 자기 subtree
 * 가 origin subtree 와 갈리는 부분은 `descendants` patch 로 옮긴다. 표현 못 하는 차이 · origin
 * 부재 · 순환은 진단하고 그 자식은 plain 으로 둔다 (조용한 대체 금지).
 */

const BUTTON_ORIGIN = buildCatalogOrigin("Button");
const TEXTFIELD_ORIGIN = buildCatalogOrigin("TextField");
const BUTTONGROUP_ORIGIN = buildCatalogOrigin("ButtonGroup");

function originIndex(...origins: CanonicalNode[]): Map<string, CanonicalNode> {
  return new Map(origins.map((origin) => [origin.id, origin]));
}

function makeDocument(children: CanonicalNode[] = []): CompositionDocument {
  return { version: "composition-1.0", children };
}

function findNode(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(node.children ?? [], id);
    if (found) return found;
  }
  return undefined;
}

function componentsBody(document: CompositionDocument): CanonicalNode {
  const body = findNode(document.children, COMPONENTS_SYSTEM_BODY_ID);
  if (!body) throw new Error("Components body 없음");
  return body;
}

describe("ADR-229 Phase 2 — diffPropsAgainstOrigin (228 명시 initialProps 규칙)", () => {
  it("origin 과 같은 키는 지우고 다른 키만 남긴다 — style 은 키 단위", () => {
    expect(
      diffPropsAgainstOrigin(
        {
          children: "Action 1",
          variant: "default",
          size: "sm",
          isDisabled: false,
          style: { width: "fit-content", gap: 4 },
        },
        { ...BUTTON_ORIGIN.props, style: { gap: 4 } },
      ),
    ).toEqual({
      children: "Action 1",
      variant: "default",
      size: "sm",
      style: { width: "fit-content" },
    });
  });

  it("전부 같으면 빈 patch", () => {
    expect(
      diffPropsAgainstOrigin(
        { ...BUTTON_ORIGIN.props },
        BUTTON_ORIGIN.props ?? {},
      ),
    ).toEqual({});
  });
});

describe("ADR-229 Phase 2 — toOriginChildSeed", () => {
  it("leaf 자식 (Toolbar 의 Button) → ref + diff props, id/name/metadata 보존, children 없음", () => {
    const diagnostics: OriginChildRefDiagnostic[] = [];
    const seed = toOriginChildSeed(
      {
        id: `${TOOLBAR_ORIGIN_ID}__button-1`,
        type: "Button",
        name: "Button/Action 1",
        props: {
          children: "Action 1",
          variant: "default",
          size: "sm",
          isDisabled: false,
        },
        metadata: { type: "toolbar-origin-child", systemOwned: true },
      } as CanonicalNode,
      {
        originsById: originIndex(BUTTON_ORIGIN),
        parentType: "Toolbar",
        grandparentType: null,
        ownerChain: new Set([TOOLBAR_ORIGIN_ID]),
        diagnostics,
      },
    );
    expect(seed).toEqual({
      id: `${TOOLBAR_ORIGIN_ID}__button-1`,
      type: "ref",
      ref: BUTTON_ORIGIN.id,
      name: "Button/Action 1",
      props: { children: "Action 1", variant: "default", size: "sm" },
      metadata: { type: "toolbar-origin-child", systemOwned: true },
    });
    expect(diagnostics).toEqual([]);
  });

  it("subtree 가 있는 자식 (Form 의 TextField) → 전파로 설명되는 차이는 patch 0, 나머지는 descendants", () => {
    const diagnostics: OriginChildRefDiagnostic[] = [];
    const seed = toOriginChildSeed(
      {
        id: `${FORM_ORIGIN_ID}__field-2`,
        type: "TextField",
        name: "TextField/Email",
        props: {
          ...TEXTFIELD_ORIGIN.props,
          label: "Email",
          placeholder: "Enter your email",
          type: "email",
          isRequired: true,
        },
        children: [
          {
            id: `${FORM_ORIGIN_ID}__field-2-label`,
            type: "Label",
            props: {
              children: "Email",
              style: { width: "fit-content", fontWeight: 600 },
            },
          },
          {
            id: `${FORM_ORIGIN_ID}__field-2-input`,
            type: "Input",
            props: {
              type: "email",
              placeholder: "Enter your email",
              // 저작이 origin 과 다른 자식 style — 전파 규칙 밖이라 descendants patch 로.
              style: { width: "100%", minWidth: 120 },
            },
          },
          {
            id: `${FORM_ORIGIN_ID}__field-2-error`,
            type: "FieldError",
            props: { children: "", style: { display: "none" } },
          },
        ],
        metadata: { type: "form-origin-child", systemOwned: true },
      } as CanonicalNode,
      {
        originsById: originIndex(TEXTFIELD_ORIGIN),
        parentType: "Form",
        grandparentType: null,
        ownerChain: new Set([FORM_ORIGIN_ID]),
        diagnostics,
      },
    );
    expect(diagnostics).toEqual([]);
    expect(seed.type).toBe("ref");
    expect((seed as { ref?: string }).ref).toBe(TEXTFIELD_ORIGIN.id);
    expect(seed.props).toEqual({
      label: "Email",
      placeholder: "Enter your email",
      type: "email",
      isRequired: true,
    });
    expect(seed.children).toBeUndefined();
    // label/placeholder/type → 자식은 전파 규칙이 설명한다. Input 의 minWidth 만 patch.
    expect((seed as { descendants?: unknown }).descendants).toEqual({
      [`${TEXTFIELD_ORIGIN.id}__2`]: { style: { minWidth: 120 } },
    });
  });

  it("sub-part (TextField 의 Label/Input/FieldError) 는 변환하지 않는다 — 술어는 isDelegatedSubpartChild", () => {
    const diagnostics: OriginChildRefDiagnostic[] = [];
    const label = {
      id: "x-label",
      type: "Label",
      props: { children: "Name" },
    } as CanonicalNode;
    const seed = toOriginChildSeed(label, {
      originsById: originIndex(buildCatalogOrigin("Checkbox")),
      parentType: "TextField",
      grandparentType: "Form",
      ownerChain: new Set([FORM_ORIGIN_ID]),
      diagnostics,
    });
    expect(seed).toBe(label);
  });

  it("origin 부재 · 순환 · 표현 불가 subtree 는 진단하고 plain 으로 둔다", () => {
    const diagnostics: OriginChildRefDiagnostic[] = [];
    const missing = toOriginChildSeed(
      { id: "c1", type: "Button", props: { children: "A" } } as CanonicalNode,
      {
        originsById: originIndex(),
        parentType: "Toolbar",
        grandparentType: null,
        ownerChain: new Set([TOOLBAR_ORIGIN_ID]),
        diagnostics,
      },
    );
    expect(missing.type).toBe("Button");

    const cyclic = toOriginChildSeed(
      { id: "c2", type: "Button", props: { children: "A" } } as CanonicalNode,
      {
        originsById: originIndex(BUTTON_ORIGIN),
        parentType: "ButtonGroup",
        grandparentType: null,
        ownerChain: new Set([BUTTON_ORIGIN.id]),
        diagnostics,
      },
    );
    expect(cyclic.type).toBe("Button");

    const mismatch = toOriginChildSeed(
      {
        id: "c3",
        type: "ButtonGroup",
        props: { ...BUTTONGROUP_ORIGIN.props },
        // origin 은 Button 2 — 저작 자식이 3 이면 origin 기본 subtree 로 조용히 대체하지 않는다.
        children: [
          { id: "c3-1", type: "Button", props: { children: "A" } },
          { id: "c3-2", type: "Button", props: { children: "B" } },
          { id: "c3-3", type: "Button", props: { children: "C" } },
        ],
      } as CanonicalNode,
      {
        originsById: originIndex(BUTTONGROUP_ORIGIN, BUTTON_ORIGIN),
        parentType: "Form",
        grandparentType: null,
        ownerChain: new Set([FORM_ORIGIN_ID]),
        diagnostics,
      },
    );
    // 자신은 plain 으로 남되 그 plain 자식 (Button) 은 규칙대로 ref.
    expect(mismatch.type).toBe("ButtonGroup");
    expect(mismatch.children?.map((child) => child.type)).toEqual([
      "ref",
      "ref",
      "ref",
    ]);
    expect(diagnostics.map((d) => [d.childId, d.reason])).toEqual([
      ["c1", "missing-origin"],
      ["c2", "cycle"],
      ["c3", "subtree-mismatch"],
    ]);
  });
});

describe("ADR-229 Phase 2 — 2단 seed (신규 origin 의 자식만 · 기존 origin 불변)", () => {
  it("빈 문서 → 손 seed + generic 이 plain 으로 보충된 뒤 조합 자식이 ref 로 바뀐다 · IconButton root 는 제외", () => {
    const seeded = ensureReusableCompositeOrigins(makeDocument());
    const body = componentsBody(seeded);
    const form = body.children?.find((node) => node.id === FORM_ORIGIN_ID);
    const toolbar = body.children?.find(
      (node) => node.id === TOOLBAR_ORIGIN_ID,
    );
    const iconButton = body.children?.find(
      (node) => node.id === ICONBUTTON_ORIGIN_ID,
    );
    const buttonGroup = body.children?.find(
      (node) => node.id === BUTTONGROUP_ORIGIN.id,
    );
    const pagination = body.children?.find(
      (node) => node.id === "component-pagination",
    );

    // Form: TextField 2 → ref(component-textfield) · ButtonGroup 은 origin 과 같은 subtree 라 ref.
    expect(
      form?.children?.map((child) => [
        child.type,
        (child as { ref?: string }).ref,
      ]),
    ).toEqual([
      ["ref", "component-textfield"],
      ["ref", "component-textfield"],
      ["ref", "component-buttongroup"],
    ]);
    expect(form?.children?.[0]?.props).toEqual({
      label: "Name",
      placeholder: "Enter your full name",
      isRequired: true,
    });
    expect(form?.children?.[1]?.props).toEqual({
      label: "Email",
      placeholder: "Enter your email",
      type: "email",
      isRequired: true,
    });
    expect(form?.children?.[0]?.children).toBeUndefined();
    // Toolbar: Button 3 → ref, Separator 는 reusable origin 이 없어 plain.
    expect(
      toolbar?.children?.map((child) => [
        child.type,
        (child as { ref?: string }).ref ?? null,
      ]),
    ).toEqual([
      ["ref", "component-button"],
      ["ref", "component-button"],
      ["Separator", null],
      ["ref", "component-button"],
    ]);
    expect(toolbar?.children?.[0]?.props).toEqual({
      children: "Action 1",
      variant: "default",
      size: "sm",
    });
    // generic seed: ButtonGroup/Pagination 의 Button 자식도 같은 규칙.
    expect(buttonGroup?.children?.map((c) => c.type)).toEqual(["ref", "ref"]);
    expect(buttonGroup?.children?.[0]?.props).toEqual({
      children: "Cancel",
      variant: "secondary",
      fillStyle: "outline",
    });
    expect(pagination?.children?.map((c) => c.type)).toEqual([
      "ref",
      "ref",
      "ref",
      "ref",
      "ref",
    ]);
    // IconButton origin 의 root 는 Button 이라 (자식이 아니라 root) 그대로.
    expect(iconButton?.type).toBe("Button");
  });

  it("재hydration 은 Δ0 · 기존 origin 의 plain 자식은 변환하지 않는다 (기존 + 신규 보충 혼재)", () => {
    const seeded = ensureReusableCompositeOrigins(makeDocument());
    const again = ensureReusableCompositeOrigins(seeded);
    expect(JSON.stringify(again)).toBe(JSON.stringify(seeded));

    // 사용자 문서: Toolbar origin 만 있고 (plain Button 자식 · 사용자가 바꾼 라벨) 나머지는 없음.
    const legacyToolbar: CanonicalNode = {
      id: TOOLBAR_ORIGIN_ID,
      type: "Toolbar",
      reusable: true,
      props: { "aria-label": "Toolbar" },
      children: [
        {
          id: `${TOOLBAR_ORIGIN_ID}__button-1`,
          type: "Button",
          props: { children: "My action", variant: "default", size: "sm" },
        },
      ],
      metadata: { type: "toolbar-origin", systemOwned: true },
    } as CanonicalNode;
    const mixed = ensureReusableCompositeOrigins(
      makeDocument([
        {
          id: "page-components",
          type: "frame",
          metadata: { type: "legacy-page", pageId: "page-components" },
          children: [
            {
              id: COMPONENTS_SYSTEM_BODY_ID,
              type: "body",
              children: [legacyToolbar],
            },
          ],
        } as unknown as CanonicalNode,
      ]),
    );
    const body = componentsBody(mixed);
    const toolbar = body.children?.find(
      (node) => node.id === TOOLBAR_ORIGIN_ID,
    );
    expect(toolbar?.children).toEqual(legacyToolbar.children);
    // 같은 실행에서 새로 보충된 Form 은 변환됐다 — 기존/신규 판정은 진입 시 id 존재.
    const form = body.children?.find((node) => node.id === FORM_ORIGIN_ID);
    expect(form?.children?.map((c) => c.type)).toEqual(["ref", "ref", "ref"]);
  });

  it("convertNewOriginChildrenToRefs 는 진단을 돌려주고 순회 순서와 무관하게 같은 결과", () => {
    const seeded = ensureReusableCompositeOrigins(makeDocument());
    const bodyChildren = componentsBody(seeded).children ?? [];
    // plain 상태의 문서를 손으로 만들어 (변환 전) 두 순서로 변환.
    const plainForm = {
      ...findNode(bodyChildren, FORM_ORIGIN_ID)!,
      children: [
        {
          id: `${FORM_ORIGIN_ID}__action-x`,
          type: "Button",
          props: { children: "Go", variant: "accent", size: "md" },
        },
      ],
    } as CanonicalNode;
    const build = (order: CanonicalNode[]) =>
      convertNewOriginChildrenToRefs(
        makeDocument([
          {
            id: "page-components",
            type: "frame",
            metadata: { type: "legacy-page", pageId: "page-components" },
            children: [
              { id: COMPONENTS_SYSTEM_BODY_ID, type: "body", children: order },
            ],
          } as unknown as CanonicalNode,
        ]),
        { existingOriginIds: new Set() },
      );
    const a = build([plainForm, BUTTON_ORIGIN]);
    const b = build([BUTTON_ORIGIN, plainForm]);
    const formA = findNode(a.document.children, FORM_ORIGIN_ID);
    const formB = findNode(b.document.children, FORM_ORIGIN_ID);
    expect(JSON.stringify(formA)).toBe(JSON.stringify(formB));
    expect(formA?.children?.[0]).toEqual({
      id: `${FORM_ORIGIN_ID}__action-x`,
      type: "ref",
      ref: BUTTON_ORIGIN.id,
      props: { children: "Go", variant: "accent" },
    });
    expect(a.diagnostics).toEqual([]);
  });
});
