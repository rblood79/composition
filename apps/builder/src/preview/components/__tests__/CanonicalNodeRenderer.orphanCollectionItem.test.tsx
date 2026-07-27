import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * orphan collection item — **컬렉션 밖 item 이 preview 를 죽이던 결함** 회귀 차단 (2026-07-27).
 *
 * RAC 는 collection item 을 자기 collection 안에서만 렌더할 수 있다 (D1 계약). 밖에서 그리면
 * `"ListBoxItem cannot be rendered outside a collection"` 을 **throw** 하고, React 는 그 위 트리를
 * 통째로 언마운트하므로 **preview 전체가 빈 화면**이 된다.
 *
 * 그런데 컴포넌트 쇼케이스 페이지는 item variant 를 **body 직계에 단독 배치**한다 — 실측
 * (`page-components` body 직계): `ListBoxItem#component-listbox-item-default` /
 * `#component-listbox-item-selected` / `GridListItem#component-gridlist-item-default` /
 * `MenuItem#component-menu-item-default`. Skia 캔버스는 RAC 를 쓰지 않아 그대로 그렸고 DOM 만
 * 죽어서, **D3 대칭이 "한쪽은 그림 / 한쪽은 크래시" 로 깨져 있었다.**
 *
 * 그래서 `CanonicalNodeRenderer` 가 orphan item 을 만나면 최소 RAC collection 을 씌운다.
 * 문서(데이터)는 건드리지 않는다 — 단독 배치는 쇼케이스 의도이고, 데이터를 고치면 사용자가
 * 손질한 페이지를 바꾸는 일이 된다.
 */

const ctx = {
  childrenByParent: new Map(),
  renderElement: () => null,
} as unknown as RenderContext;

function renderNode(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={new Set()}
    />,
  );
}

function itemNode(id: string, type: string, label: string): ResolvedNode {
  return {
    id,
    type: type as ResolvedNode["type"],
    props: { label, children: label },
  } as ResolvedNode;
}

describe("CanonicalNodeRenderer — 컬렉션 밖 collection item", () => {
  // 이 3종이 실측에서 실제로 body 직계에 놓여 있던 type 이다.
  const cases: Array<[string, string, string]> = [
    ["ListBoxItem", "listbox", "목록 항목"],
    ["GridListItem", "grid", "그리드 항목"],
    ["MenuItem", "menu", "메뉴 항목"],
  ];

  for (const [type, hostRole, label] of cases) {
    it(`${type} 이 컬렉션 밖이어도 throw 하지 않는다`, () => {
      // throw 하면 render 자체가 실패한다 — 그게 이 테스트의 본체다.
      expect(() =>
        renderNode(itemNode(`orphan-${type}`, type, label)),
      ).not.toThrow();
    });

    it(`${type} 이 host collection(role=${hostRole}) 안에서 렌더된다`, () => {
      const { container } = renderNode(itemNode(`host-${type}`, type, label));
      const host = container.querySelector(`[role="${hostRole}"]`);
      expect(host, `${type} 의 host collection 미생성`).not.toBeNull();
      // 감싸기만 하고 사라지면 안 된다 — 내용이 남아야 쇼케이스로 쓸모가 있다.
      expect(container.textContent).toContain(label);
    });

    it(`${type} 의 host 는 display:contents — 레이아웃에 개입하지 않는다`, () => {
      // 호스트가 박스를 만들면 Skia 가 그리는 단독 item 과 크기·위치가 어긋난다 (D3 대칭).
      const { container } = renderNode(itemNode(`layout-${type}`, type, label));
      const host = container.querySelector(
        `[role="${hostRole}"]`,
      ) as HTMLElement | null;
      expect(host).not.toBeNull();
      expect(host?.style.display).toBe("contents");
    });
  }

  it("컬렉션 **안**의 item 은 host 를 덧씌우지 않는다 (이중 래핑 금지)", () => {
    // ListBox > ListBoxItem — 이미 collection 안이므로 listbox role 은 1개여야 한다.
    const child = itemNode("nested-item", "ListBoxItem", "안쪽 항목");
    const listBox: ResolvedNode = {
      id: "host-listbox",
      type: "ListBox" as ResolvedNode["type"],
      props: {},
      children: [child],
    } as ResolvedNode;

    const { container } = render(
      <CanonicalNodeRenderer
        node={listBox}
        renderContext={
          {
            childrenByParent: new Map([["host-listbox", [child]]]),
            renderElement: () => null,
          } as unknown as RenderContext
        }
        cutoverPrimitives={new Set()}
      />,
    );
    expect(container.querySelectorAll('[role="listbox"]').length).toBe(1);
  });

  it("collection item 이 아닌 type 은 감싸지 않는다", () => {
    const { container } = renderNode(itemNode("plain", "frame", "일반 프레임"));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
