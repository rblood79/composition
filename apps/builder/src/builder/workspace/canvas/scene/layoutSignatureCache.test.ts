// @vitest-environment node
/**
 * layout 시그니처 style 축 캐시 — 정확성 + 작업량 회귀.
 *
 * 편집 프레임 실측(2026-07-30)에서 layout signature 가 편집 1회당 27.9ms 였고,
 * 그 대부분이 요소마다 `LAYOUT_STYLE_KEYS` 73키를 문자열로 잇는 비용이다.
 * `createStyleAxisSignature` 가 style 객체 identity 를 키로 그 결과를 재사용한다.
 *
 * 벽시계가 아니라 **작업량**으로 단언한다 (ADR-172 `panFrameScale.test.ts` 와 동일
 * 방식) — style 을 Proxy 로 감싸 프로퍼티 접근 횟수를 세고, 2회차 접근이 0 인지 본다.
 * 0 은 요소 수·머신 속도와 무관한 유일한 값이라 flaky 하지 않다.
 */
import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../layout/layoutNode";
import { createPageLayoutSignature } from "./layoutCache";

interface TouchCounter {
  count: number;
}

/** style 객체를 Proxy 로 감싸 프로퍼티 읽기 횟수를 계측 */
function traceStyle(
  style: Record<string, unknown>,
  counter: TouchCounter,
): Record<string, unknown> {
  return new Proxy(style, {
    get(target, prop, receiver) {
      counter.count += 1;
      return Reflect.get(target, prop, receiver) as unknown;
    },
  });
}

function makeElement(
  id: string,
  style: Record<string, unknown>,
): CanvasLayoutNode {
  return {
    id,
    type: "Button",
    parent_id: "body-1",
    props: { children: `Node ${id}`, style },
  } as unknown as CanvasLayoutNode;
}

const BASE_STYLE = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  height: "40px",
  padding: "12px",
  width: "120px",
};

describe("layout 시그니처 — style 축 캐시", () => {
  it("같은 style 객체를 다시 넘기면 style 을 한 번도 읽지 않는다", () => {
    const counter: TouchCounter = { count: 0 };
    const style = traceStyle({ ...BASE_STYLE }, counter);
    const elements = [makeElement("el-1", style)];

    const first = createPageLayoutSignature(null, elements);
    const touchesAfterFirst = counter.count;
    expect(touchesAfterFirst).toBeGreaterThan(0); // 계측이 살아 있다는 대조군

    counter.count = 0;
    const second = createPageLayoutSignature(null, elements);

    expect(counter.count).toBe(0);
    expect(second).toBe(first);
  });

  it("편집 1회 — 바뀐 요소의 style 만 읽는다", () => {
    const counters = Array.from({ length: 20 }, () => ({ count: 0 }));
    const styles = counters.map((counter) =>
      traceStyle({ ...BASE_STYLE }, counter),
    );
    const elements = styles.map((style, index) =>
      makeElement(`el-${index}`, style),
    );

    createPageLayoutSignature(null, elements);
    for (const counter of counters) counter.count = 0;

    // 불변 업데이트 1회 — 요소 하나만 새 style 객체로 교체
    const editedCounter: TouchCounter = { count: 0 };
    const editedStyle = traceStyle(
      { ...BASE_STYLE, width: "999px" },
      editedCounter,
    );
    const nextElements = elements.map((element, index) =>
      index === 7 ? makeElement("el-7", editedStyle) : element,
    );

    createPageLayoutSignature(null, nextElements);

    // 미변경 19개는 style 접근 0
    const untouched = counters.filter((c) => c.count === 0).length;
    expect(untouched).toBe(20);
    // 바뀐 요소만 읽힌다
    expect(editedCounter.count).toBeGreaterThan(0);
  });

  it("내용이 같아도 객체가 다르면 같은 시그니처를 낸다 (캐시가 결과를 바꾸지 않음)", () => {
    const a = createPageLayoutSignature(null, [
      makeElement("el-1", { ...BASE_STYLE }),
    ]);
    const b = createPageLayoutSignature(null, [
      makeElement("el-1", { ...BASE_STYLE }),
    ]);

    expect(b).toBe(a);
  });

  it("style 값이 바뀌면 시그니처가 달라진다", () => {
    const before = createPageLayoutSignature(null, [
      makeElement("el-1", { ...BASE_STYLE }),
    ]);
    const after = createPageLayoutSignature(null, [
      makeElement("el-1", { ...BASE_STYLE, width: "999px" }),
    ]);

    expect(after).not.toBe(before);
  });

  it("style 없는 요소들이 공유 상수로 수렴한다 (전량 미스 방지)", () => {
    const elements = Array.from(
      { length: 5 },
      (_, index) =>
        ({
          id: `el-${index}`,
          type: "Button",
          parent_id: "body-1",
          props: { children: "x" },
        }) as unknown as CanvasLayoutNode,
    );

    const first = createPageLayoutSignature(null, elements);
    const second = createPageLayoutSignature(null, elements);

    expect(second).toBe(first);
    // style 축은 전 요소가 동일 (id/type/parent_id 만 다름)
    expect(first.split("||")).toHaveLength(5);
  });

  it("props 축은 style 캐시와 무관하게 반영된다", () => {
    const style = { ...BASE_STYLE };
    const withText = {
      id: "el-1",
      type: "Text",
      parent_id: "body-1",
      props: { children: "before", style },
    } as unknown as CanvasLayoutNode;
    const withOtherText = {
      id: "el-1",
      type: "Text",
      parent_id: "body-1",
      props: { children: "after", style },
    } as unknown as CanvasLayoutNode;

    const before = createPageLayoutSignature(null, [withText]);
    const after = createPageLayoutSignature(null, [withOtherText]);

    // 같은 style 객체를 공유하지만 props 축(children)이 달라 시그니처는 갈린다
    expect(after).not.toBe(before);
  });
});
