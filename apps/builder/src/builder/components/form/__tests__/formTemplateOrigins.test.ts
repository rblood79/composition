import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";

import {
  ensureFormTemplateOrigins,
  FORM_ORIGIN_ID,
} from "../formTemplateOrigins";
import {
  REUSABLE_ORIGIN_ENSURERS,
  ensureReusableCompositeOrigins,
  getReusableCompositeOriginId,
  isReusableCompositeType,
} from "../../reusableCompositeOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

describe("ADR-912 R-5 Form reusable composite origin (2단 중첩)", () => {
  it("bootstraps the Form origin under the Components page with Heading + Description + FormField×2", () => {
    const doc = ensureFormTemplateOrigins(makeDocument());

    // Components system page 가 보장됨
    const componentsPage = findById(doc.children, "page-components");
    expect(componentsPage).toMatchObject({
      name: "Components",
      metadata: expect.objectContaining({ pageRole: "components" }),
    });

    // Form origin = reusable composite (direct children, slot 없음)
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    expect(origin).toMatchObject({
      id: FORM_ORIGIN_ID,
      type: "Form",
      reusable: true,
      metadata: expect.objectContaining({
        componentFamily: "Form",
        systemOwned: true,
      }),
    });

    // ADR-171 Phase 6: 조합 자식 = TextField×2 + ButtonGroup (RAC/RSP Form 예제 1:1).
    //   구 트리(Heading + Description + FormField×2)의 FormField 는 어느 레퍼런스에도 없는
    //   composition 자체 추상이었고, Label 요소와 TextField.label 이 둘 다 렌더돼 라벨이
    //   두 겹이었다. 레퍼런스는 필드를 Form 직계 자식으로 두고 Label 은 필드가 소유한다.
    const children = origin?.children ?? [];
    expect(children.map((c) => c.type)).toEqual([
      "TextField",
      "TextField",
      "ButtonGroup",
    ]);
  });

  it("FieldError 자식에 인라인 fontSize 를 두지 않는다 (D3 = parent rule delegation)", () => {
    // ADR-923 후속 r2 feh1 (2026-09-03): origin 이 인라인 12 를 심으면 catalog delegation
    //   (TextField md = 14) 을 우회해 Canvas·DOM 이 저작 시점 값으로 굳는다.
    const doc = ensureFormTemplateOrigins(makeDocument());
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    const collect = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
      nodes.flatMap((n) => [n, ...collect(n.children ?? [])]);
    const fieldErrors = collect(origin?.children ?? []).filter(
      (n) => (n.type as string) === "FieldError",
    );
    expect(fieldErrors.length).toBeGreaterThan(0);
    for (const fe of fieldErrors) {
      const style = (fe.props as { style?: Record<string, unknown> })?.style;
      expect(style?.display, `${fe.id} display`).toBe("none");
      expect(style?.fontSize, `${fe.id} 인라인 fontSize`).toBeUndefined();
    }
  });

  it("라벨은 TextField.label 이 소유하고 별도 Label 요소를 두지 않는다", () => {
    const doc = ensureFormTemplateOrigins(makeDocument());
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    const fields = (origin?.children ?? []).filter(
      (c) => (c.type as string) === "TextField",
    );
    expect(fields.map((f) => (f.props as { label?: string }).label)).toEqual([
      "Name",
      "Email",
    ]);
    // TextField 는 leaf 가 아니라 Label + Input(+FieldError) 를 자식 Element 로 갖는 조합이다
    //   (`createTextFieldDefinition` 미러). 자식 없이 저작하면 캔버스에 라벨만 그려지고 입력
    //   박스가 없다 — 구 origin 이 그 상태였고, FormField 안의 별도 Label 이 그것을 가렸다.
    for (const f of fields) {
      expect((f.children ?? []).map((c) => c.type)).toEqual([
        "Label",
        "Input",
        "FieldError",
      ]);
    }
    // 라벨 문구는 TextField.label 과 자식 Label 이 같은 값 — 구 트리처럼 서로 다른 문구가
    //   두 겹으로 보이지 않는다("Field Label" 위에 "Text Field").
    for (const f of fields) {
      const inner = (f.children ?? []).find((c) => c.type === "Label");
      expect((inner?.props as { children?: string }).children).toBe(
        (f.props as { label?: string }).label,
      );
    }
  });

  it("버튼 행은 ButtonGroup(Cancel/Save)이 맡는다 — RAC 예제의 <div> 자리", () => {
    const doc = ensureFormTemplateOrigins(makeDocument());
    const origin = findById(doc.children, FORM_ORIGIN_ID);
    const group = (origin?.children ?? []).find(
      (c) => (c.type as string) === "ButtonGroup",
    );
    expect(group?.children?.map((c) => c.type)).toEqual(["Button", "Button"]);
    expect(
      group?.children?.map((c) => (c.props as { children?: string }).children),
    ).toEqual(["Cancel", "Save"]);
  });

  it("is idempotent — re-running produces identical content (no duplicate origins)", () => {
    const once = ensureFormTemplateOrigins(makeDocument());
    const twice = ensureFormTemplateOrigins(once);
    expect(twice).toEqual(once);

    // origin 이 중복 seed 되지 않음 (strip + re-add 멱등)
    const componentsBody = findById(twice.children, "page-components-body");
    const formOrigins = (componentsBody?.children ?? []).filter(
      (c) => c.id === FORM_ORIGIN_ID,
    );
    expect(formOrigins).toHaveLength(1);
  });

  it("preserves user edits to an existing origin (repair-not-overwrite)", () => {
    const seeded = ensureFormTemplateOrigins(makeDocument());
    // 사용자가 origin children 을 편집 (FormField 하나 제거)
    const edited: CompositionDocument = JSON.parse(JSON.stringify(seeded));
    const origin = findById(edited.children, FORM_ORIGIN_ID);
    if (origin) origin.children = (origin.children ?? []).slice(0, 2);

    const reEnsured = ensureFormTemplateOrigins(edited);
    const reOrigin = findById(reEnsured.children, FORM_ORIGIN_ID);
    // children 은 사용자 편집 보존 (createFormOrigin 으로 덮어쓰지 않음)
    expect(reOrigin?.children?.length).toBe(2);
    // system metadata 는 회복
    expect(reOrigin?.metadata).toMatchObject({
      systemOwned: true,
      componentFamily: "Form",
    });
  });
});

describe("ADR-912 R-5 reusable composite registry — Form 합류 (코드 변경 0)", () => {
  it("maps Form to its origin id without touching factory code", () => {
    // ADR-148 Phase 1: 하드코딩 맵 → catalog reusable entry 파생 (id parity = seed 상수).
    expect(getReusableCompositeOriginId("Form")).toBe(FORM_ORIGIN_ID);
    expect(isReusableCompositeType("Form")).toBe(true);
    expect(REUSABLE_ORIGIN_ENSURERS[FORM_ORIGIN_ID]).toBeTypeOf("function");
  });

  it("ensureReusableCompositeOrigins seeds both Toolbar and Form origins", () => {
    const doc = ensureReusableCompositeOrigins(makeDocument());
    expect(findById(doc.children, FORM_ORIGIN_ID)).toBeDefined();
    expect(findById(doc.children, "component-toolbar")).toBeDefined();
  });
});
