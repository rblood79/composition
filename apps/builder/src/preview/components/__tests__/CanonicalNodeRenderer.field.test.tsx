import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * ADR-142 family ②(fields) — TextField/Form cutover DOM 경로 검증.
 *
 * field 는 RAC-controller-backed leaf primitive(inventory §2-1). cutover 시 generic 경로가
 * `toRacProps` → RAC `<TextField>`/`<Form>` 으로 렌더하고, 자식 Element(Label/Input)는
 * canonical children 트리로 재귀된다(RAC 가 Label/Input slot 으로 합성, D1).
 */

// 자식 재귀가 rendererMap 위임 경로를 타지 않도록(FormRenderers 의존 회피),
// 본 테스트는 자식 없는 field(racChildren fallback) + props→data-* 라우팅을 검증한다.
// 자식 합성(slot)의 실동작은 Chrome MCP cross-check(Skia + Properties Panel)로 별도 확증.
const ctx = {} as unknown as RenderContext;

describe("CanonicalNodeRenderer — ADR-142 family ② fields cutover", () => {
  it("cutover 된 TextField 를 RAC TextField 로 렌더 (data-size + 마커)", () => {
    const node: ResolvedNode = {
      id: "tf-1",
      type: "TextField",
      props: { label: "Email", size: "lg", labelPosition: "side" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["TextField"])}
      />,
    );

    // RAC TextField → <div class="react-aria-TextField"> (group role)
    const tf = container.querySelector(".react-aria-TextField");
    expect(tf).not.toBeNull();
    // size → data-size (theme 가 값 적용)
    expect(tf?.getAttribute("data-size")).toBe("lg");
    // TextField 는 DELEGATING(f556385db) — labelPosition="side" 를 grid→flex-row 로 통일하면서
    //   self-compose 위임 렌더러(FormRenderers)가 primitive 를 합성한다. canonical marker
    //   (data-canonical-id)는 delegating wrapper(display:contents)에 부착되고, RAC primitive 에는
    //   data-element-id 만 남는다 — Tabs/ProgressBar/Slider 등 위임 컴포넌트 공통 패턴.
    expect(tf?.getAttribute("data-element-id")).toBe("tf-1");
    expect(
      container.querySelector("[data-canonical-id='tf-1']"),
    ).not.toBeNull();
  });

  it("cutover 된 Form 을 RAC Form 으로 렌더 (data-variant + 마커)", () => {
    const node: ResolvedNode = {
      id: "form-1",
      type: "Form",
      props: { variant: "outlined" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Form"])}
      />,
    );

    const form = container.querySelector("form, .react-aria-Form");
    expect(form).not.toBeNull();
    expect(form?.getAttribute("data-variant")).toBe("outlined");
    expect(form?.getAttribute("data-canonical-id")).toBe("form-1");
  });

  it("cutover 미포함 field 는 generic/legacy 경로 (RAC primitive 미진입)", () => {
    const node: ResolvedNode = {
      id: "tf-2",
      type: "TextField",
      props: { label: "X" },
    };
    // cutoverPrimitives 에 TextField 없음 → catalog generic 경로 미진입
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );
    // catalog 경로가 아니므로 react-aria-TextField data-canonical-id 직접 부착 안 됨
    const tf = container.querySelector(
      ".react-aria-TextField[data-canonical-id]",
    );
    expect(tf).toBeNull();
  });

  /**
   * 회귀 가드 (2026-06-17): `props.type`(HTML `<input type>` 속성)이 element ComponentTag
   * 로 오인되어 type 복원이 "text" 로 평가 → generic fallthrough 에서 `<text>` raw tag
   * 렌더 → React "The tag <text> is unrecognized" 경고.
   *
   * TextField/Input factory 는 `props.type: "text"` 를 보유한다. type 복원이 `node.type`
   * (canonical ComponentTag SSOT) 을 쓰고 `props.type`(D2 HTML 속성)을 쓰지 않아야 한다.
   * 기존 테스트는 `props.type` 없이 통과했어 본 버그를 못 잡았다(live DOM 에서만 적발).
   */
  it("props.type='text' 가 있어도 TextField 가 <text> 가 아닌 RAC TextField 로 렌더", () => {
    const node: ResolvedNode = {
      id: "tf-3",
      type: "TextField",
      props: { label: "Email", type: "text", size: "md" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["TextField"])}
      />,
    );

    // `<text>` raw tag 가 0개여야 한다 (props.type 오인 회귀 가드)
    expect(container.querySelectorAll("text")).toHaveLength(0);
    // node.type(TextField) 으로 복원되어 cutover RAC 경로 진입
    const tf = container.querySelector(".react-aria-TextField");
    expect(tf).not.toBeNull();
    // DELEGATING(f556385db) — marker 는 wrapper, primitive 엔 data-element-id (위 tf-1 참조)
    expect(tf?.getAttribute("data-element-id")).toBe("tf-3");
    expect(
      container.querySelector("[data-canonical-id='tf-3']"),
    ).not.toBeNull();
  });

  it("props.type='text' 를 가진 Input(generic) 이 <text> 가 아닌 <input> 으로 렌더", () => {
    const node: ResolvedNode = {
      id: "input-1",
      type: "Input",
      props: { type: "text", placeholder: "Enter text..." },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );

    // `<text>` raw tag 0개 + Input 은 <input> 으로 (props.type 오인 시 <text> 가 나옴)
    expect(container.querySelectorAll("text")).toHaveLength(0);
    expect(container.querySelector("input")).not.toBeNull();
  });
});
