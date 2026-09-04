import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  BUTTON_CHILD_HOST_TAGS,
  buildButtonChild,
  findFirstIconChild,
  findFirstTextChild,
} from "./ButtonChildSection";

describe("ButtonChildSection gate", () => {
  it("Button/ToggleButton 만 host 대상", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("Button")).toBe(true);
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButton")).toBe(true);
  });

  it("ToggleButtonGroup / 비-button 은 host 아님", () => {
    expect(BUTTON_CHILD_HOST_TAGS.has("ToggleButtonGroup")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Text")).toBe(false);
    expect(BUTTON_CHILD_HOST_TAGS.has("Frame")).toBe(false);
  });
});

describe("findFirstIconChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstIconChild([])).toBeUndefined();
  });

  it("Icon 자식 없으면 undefined", () => {
    expect(
      findFirstIconChild([
        { id: "t1", type: "Text" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Icon 자식 반환", () => {
    const result = findFirstIconChild([
      { id: "t1", type: "Text" },
      { id: "i1", type: "Icon" },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i1");
  });

  it("삭제된 Icon 은 건너뛴다", () => {
    const result = findFirstIconChild([
      { id: "i1", type: "Icon", deleted: true },
      { id: "i2", type: "Icon" },
    ]);
    expect(result?.id).toBe("i2");
  });
});

describe("findFirstTextChild", () => {
  it("자식 없으면 undefined", () => {
    expect(findFirstTextChild([])).toBeUndefined();
  });

  it("Text 자식 없으면 undefined", () => {
    expect(
      findFirstTextChild([
        { id: "i1", type: "Icon" },
        { id: "f1", type: "Frame" },
      ]),
    ).toBeUndefined();
  });

  it("첫 비삭제 Text 자식 반환", () => {
    const result = findFirstTextChild([
      { id: "i1", type: "Icon" },
      { id: "t1", type: "Text" },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t1");
  });

  it("삭제된 Text 는 건너뛴다", () => {
    const result = findFirstTextChild([
      { id: "t1", type: "Text", deleted: true },
      { id: "t2", type: "Text" },
    ]);
    expect(result?.id).toBe("t2");
  });
});

/**
 * buildButtonChild 생성 시점 size 주입 회귀 (2026-06-28).
 *
 * **버그**: 부모 XL ToggleButton 에 icon 추가 시 Icon 자식은 size:xl 을 받는데 Text 자식은
 *   size prop 이 누락돼 getDefaultProps("Text").size(md)로 고정 → 형제 size 불일치(Icon xl /
 *   Text md). 사용자: "부모 XL 자식 icon 추가 시 자식 text size 가 XL 이 아닌 M".
 * **수정**: Text 생성 propsOverride 에 size 주입(Icon 동형). 시각은 inline fontSize/lineHeight 가
 *   Text.css [data-size] 보다 우선이라 버튼 척도 유지.
 */
describe("buildButtonChild 생성 시점 size 주입", () => {
  it("Text 자식 propsOverride 의 size 가 생성 element.props.size 로 반영된다", () => {
    const el = buildButtonChild("Text", "parent-1", "page-1", [], {
      children: "Toggle 2",
      size: "xl",
      style: { fontSize: 18, lineHeight: "28px" },
    });
    expect(el.type).toBe("Text");
    expect((el.props as { size?: unknown }).size).toBe("xl");
    // 시각 inline 도 보존
    const style = (el.props as { style?: Record<string, unknown> }).style;
    expect(style?.fontSize).toBe(18);
    expect(style?.lineHeight).toBe("28px");
  });

  it("Icon 자식도 propsOverride size 반영 (Text 와 동형)", () => {
    const el = buildButtonChild("Icon", "parent-1", "page-1", [], {
      iconName: "a-arrow-down",
      size: "lg",
      style: { fontSize: 24, height: 24 },
    });
    expect((el.props as { size?: unknown }).size).toBe("lg");
  });
});

/**
 * Icon 셀렉트 조작은 store write 가 여러 갈래(생성 2 + props 비우기 / 복구 1 + 삭제 2)지만
 * 사용자에겐 셀렉트 1회다. 되돌리기 단위를 1회로 유지하는 계약을 소스에서 고정한다 —
 * 이 파일은 렌더 하네스가 없어 정적 계약이 비용 대비 가장 정확한 가드다.
 */
describe("Icon 셀렉트 다중 write 의 history 단일 엔트리 계약", () => {
  it("두 핸들러가 동기 history 트랜잭션으로 감싸고 꼬리는 창 밖에서 기다린다", async () => {
    const source = await readFile(
      resolve(__dirname, "./ButtonChildSection.tsx"),
      "utf-8",
    );

    // 아이콘 생성 경로와 아이콘 제거 경로 = 창 2개
    const windows = source.match(/historyManager\.runInTransaction\(/g);
    expect(windows).toHaveLength(2);

    // 여닫기는 runInTransaction 가 담당 (finally 누락으로 창이 남는 사고 차단)
    expect(source).not.toContain("historyManager.beginTransaction(");
    expect(source).not.toContain("historyManager.commitTransaction(");

    // 꼬리는 창 밖에서 — 창 안 await 는 곧 무관한 mutation 병합 지점
    expect(source.match(/await Promise\.all\(pendingWrites\);/g)).toHaveLength(
      2,
    );
  });

  it("트랜잭션 창은 동기 블록이다 (await·async 없음)", async () => {
    const source = await readFile(
      resolve(__dirname, "./ButtonChildSection.tsx"),
      "utf-8",
    );

    let cursor = 0;
    const slices: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      const begin = source.indexOf("historyManager.runInTransaction(", cursor);
      const end = source.indexOf("return writes;", begin);
      expect(begin).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(begin);
      slices.push(source.slice(begin, end));
      cursor = end;
    }

    for (const slice of slices) {
      expect(slice).not.toMatch(/\bawait\b/);
      expect(slice).not.toMatch(/\basync\b/);
      // 노드 생성(순수 계산)은 창 밖에서 끝낸다
      expect(slice).not.toContain("buildButtonChild(");
      expect(slice).not.toContain("crypto.randomUUID()");
    }
  });

  it("write 가 1개인 분기(아이콘 → 다른 아이콘)는 창을 열지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "./ButtonChildSection.tsx"),
      "utf-8",
    );

    // 되돌리기 단위가 이미 1개라 트랜잭션이 불필요하다 — 빈/단일 창을 만들지 않는다
    const singleWrite = source.indexOf(
      "return updateElementProps(currentExistingIcon.id, { iconName });",
    );
    const firstWindow = source.indexOf("historyManager.runInTransaction(");
    expect(singleWrite).toBeGreaterThan(0);
    expect(singleWrite).toBeLessThan(firstWindow);
  });

  it("origin impact 확인은 Icon 추가·제거 mutation보다 먼저 끝낸다", async () => {
    const source = await readFile(
      resolve(__dirname, "./ButtonChildSection.tsx"),
      "utf-8",
    );

    const selectStart = source.indexOf("const handleSelectIcon");
    const clearStart = source.indexOf("const handleClearIcon");
    const selectSlice = source.slice(selectStart, clearStart);
    const clearSlice = source.slice(clearStart);

    for (const handler of [selectSlice, clearSlice]) {
      const gate = handler.indexOf("prepareButtonChildMutation(elementId)");
      const revalidate = handler.indexOf(
        "resolveApprovedButtonChildMutation(approved)",
      );
      const transaction = handler.indexOf("historyManager.runInTransaction(");
      expect(gate).toBeGreaterThan(0);
      expect(revalidate).toBeGreaterThan(gate);
      expect(transaction).toBeGreaterThan(revalidate);
      const compoundPreparation = handler
        .slice(revalidate, transaction)
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(compoundPreparation).not.toMatch(/\bawait\b/);
    }
  });

  it("customId seed는 canonical node index에서 읽고 Element[] projection을 만들지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "./ButtonChildSection.tsx"),
      "utf-8",
    );

    expect(source).toContain("getNodeMap().values()");
    expect(source).toContain("collectCanonicalCustomIdCandidates");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
  });
});
