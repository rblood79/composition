import { describe, expect, it } from "vitest";

import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import {
  resolveContainingBlockWidth,
  resolvePercentBoxEdgesForRender,
  resolvePercentBoxEdgesStyle,
} from "./resolvePercentBoxEdges";

const layout = (width: number): ComputedLayout =>
  ({ x: 0, y: 0, width, height: 100 }) as unknown as ComputedLayout;

describe("resolvePercentBoxEdgesStyle", () => {
  it("`%` 가 없으면 같은 참조", () => {
    const style = { padding: "10px", marginLeft: 4 };
    expect(resolvePercentBoxEdgesStyle(style, 400)).toBe(style);
  });

  it("padding shorthand `%` → 네 longhand px, shorthand 삭제 (세로도 폭 기준)", () => {
    expect(resolvePercentBoxEdgesStyle({ padding: "10%" }, 400)).toEqual({
      paddingTop: 40,
      paddingRight: 40,
      paddingBottom: 40,
      paddingLeft: 40,
    });
  });

  it("longhand `%` 만 px — px longhand 는 그대로, shorthand 에서 오는 변은 채운다", () => {
    expect(
      resolvePercentBoxEdgesStyle(
        { padding: "5%", paddingLeft: "25%", paddingTop: 8 },
        400,
      ),
    ).toEqual({
      paddingTop: 8,
      paddingRight: 20,
      paddingBottom: 20,
      paddingLeft: 100,
    });
  });

  it("margin: `%` 와 auto 혼재 — auto 변은 문자열 유지", () => {
    expect(
      resolvePercentBoxEdgesStyle({ margin: "5% auto", marginTop: "10%" }, 400),
    ).toEqual({
      marginTop: 40,
      marginRight: "auto",
      marginBottom: 20,
      marginLeft: "auto",
    });
  });

  it("containing 폭을 모르면 손대지 않는다", () => {
    const style = { padding: "10%" };
    expect(resolvePercentBoxEdgesStyle(style, undefined)).toBe(style);
  });
});

describe("resolveContainingBlockWidth · resolvePercentBoxEdgesForRender", () => {
  const body = {
    id: "body",
    parent_id: null,
    props: { style: { padding: "10%" } },
  };
  const frame = {
    id: "frame",
    parent_id: "body",
    props: {
      style: { paddingLeft: "10px", borderWidth: 2, borderStyle: "solid" },
    },
  };
  const text = {
    id: "text",
    parent_id: "frame",
    props: { style: { padding: "10%" } },
  };
  const elementsMap = new Map<string, typeof body | typeof frame | typeof text>(
    [
      ["body", body],
      ["frame", frame],
      ["text", text],
    ],
  );
  const layoutMap = new Map<string, ComputedLayout>([
    ["body", layout(400)],
    ["frame", layout(320)], // 400 − 40 − 40
    ["text", layout(304)],
  ]);

  it("부모 사슬로 containing block 폭 — 부모의 `%` padding 은 조부모 기준", () => {
    // frame: body 400 − body padding 10% (of body's containing = 자기 layout 400 → 40) × 2 = 320
    expect(resolveContainingBlockWidth(frame, elementsMap, layoutMap)).toBe(
      320,
    );
    // text: frame 320 − paddingLeft 10 − border 2×2 = 306
    expect(resolveContainingBlockWidth(text, elementsMap, layoutMap)).toBe(306);
  });

  it("렌더 입력의 `%` padding 이 containing 폭 (306) 기준 px 로", () => {
    const out = resolvePercentBoxEdgesForRender(text, elementsMap, layoutMap);
    expect(out).not.toBe(text);
    expect(out.props.style).toEqual({
      paddingTop: 30.6,
      paddingRight: 30.6,
      paddingBottom: 30.6,
      paddingLeft: 30.6,
    });
    // `%` 없는 요소는 같은 참조 (재빌드 비용 0)
    expect(resolvePercentBoxEdgesForRender(frame, elementsMap, layoutMap)).toBe(
      frame,
    );
  });
});
