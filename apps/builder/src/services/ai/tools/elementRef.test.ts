import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetCreatedElements,
  rememberCreatedElement,
  resolveElementRef,
} from "./elementRef";

const els = new Map<string, { id: string; type: string }>([
  [
    "a1b2c3d4-0000-4000-8000-000000000001",
    { id: "a1b2c3d4-0000-4000-8000-000000000001", type: "Button" },
  ],
  [
    "a1b2c3d4-0000-4000-8000-000000000002",
    { id: "a1b2c3d4-0000-4000-8000-000000000002", type: "Table" },
  ],
]);
const REAL = "a1b2c3d4-0000-4000-8000-000000000001";
const TABLE = "a1b2c3d4-0000-4000-8000-000000000002";

beforeEach(() => forgetCreatedElements());

describe("실제 id", () => {
  it("존재하는 id 는 그대로 통과한다", () => {
    expect(
      resolveElementRef(REAL, { selectedElementId: null, elementsById: els }),
    ).toEqual({ id: REAL });
  });
});

describe('"selected"', () => {
  it("선택 요소로 해석한다", () => {
    expect(
      resolveElementRef("selected", {
        selectedElementId: TABLE,
        elementsById: els,
      }),
    ).toEqual({ id: TABLE });
  });

  it("선택이 없으면 그 사실을 말한다", () => {
    const r = resolveElementRef("selected", {
      selectedElementId: null,
      elementsById: els,
    });
    expect("error" in r && r.error).toContain("선택된 요소가 없습니다");
  });
});

describe('"last-created" — UUID 를 이어 나르지 않아도 되는 손잡이', () => {
  it("방금 만든 요소를 가리킨다", () => {
    rememberCreatedElement(TABLE);
    expect(
      resolveElementRef("last-created", {
        selectedElementId: null,
        elementsById: els,
      }),
    ).toEqual({ id: TABLE });
  });

  it("가장 마지막 것을 가리킨다", () => {
    rememberCreatedElement(TABLE);
    rememberCreatedElement(REAL);
    expect(
      resolveElementRef("last-created", {
        selectedElementId: null,
        elementsById: els,
      }),
    ).toEqual({ id: REAL });
  });

  it("그 요소가 사라졌으면 기억을 쓰지 않는다", () => {
    rememberCreatedElement("사라진-id");
    const r = resolveElementRef("last-created", {
      selectedElementId: null,
      elementsById: els,
    });
    expect("error" in r).toBe(true);
  });

  it("만든 것이 없으면 그 사실을 말한다", () => {
    const r = resolveElementRef("last-created", {
      selectedElementId: null,
      elementsById: els,
    });
    expect("error" in r && r.error).toContain("아직 만든 요소가 없습니다");
  });
});

describe("모르는 id — 실측된 실패 (qwen3:14b 3/3 재현)", () => {
  it("지어낸 id 는 복구 경로를 알려 준다", () => {
    const r = resolveElementRef("created-element-id", {
      selectedElementId: null,
      elementsById: els,
    });
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("created-element-id");
    expect(r.error).toContain("지어내지");
    expect(r.error).toContain("last-created");
    expect(r.error).toContain("search_elements");
  });

  it("방금 만든 것이 있으면 그 id 를 함께 준다 — 다음 시도가 바로 맞는다", () => {
    rememberCreatedElement(TABLE);
    const r = resolveElementRef("gridListId", {
      selectedElementId: null,
      elementsById: els,
    });
    expect("error" in r && r.error).toContain(TABLE);
  });

  it("빈 문자열도 거른다", () => {
    expect(
      "error" in
        resolveElementRef("", { selectedElementId: null, elementsById: els }),
    ).toBe(true);
  });
});
