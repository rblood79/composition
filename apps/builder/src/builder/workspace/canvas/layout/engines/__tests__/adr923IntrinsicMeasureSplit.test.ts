import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INLINE_BLOCK_TAGS,
  INLINE_BLOCK_TAG_CLASSIFICATION,
  INTRINSIC_MEASURE_TAGS,
  enrichWithIntrinsicSize,
} from "../utils";
import { resolveDefaultDisplay } from "../defaultDisplay";
import { resolveContainerStylesFallback } from "../implicitStyles";
import { getElementDisplay } from "../taffyDisplayAdapter";
import {
  CONTROL_TAGS,
  enrichFingerprints,
  fixtureNode,
} from "./adr923IntrinsicMeasureFixtures";

/**
 * ADR-923 Phase 4 — G5: `INLINE_BLOCK_TAGS` 24 항목이 default-display / intrinsic capability 로 전부
 * 분류되고, `INTRINSIC_MEASURE_TAGS` 분리 전후 `enrichWithIntrinsicSize` 출력이 diff 0.
 *
 * baseline 은 **분리 전 커밋** (`ee4bd0b9d`, needsWidth 가 INLINE_BLOCK_TAGS 를 읽던 코드) 에서 같은
 * fixture 로 캡처해 파일로 고정했다 — 이 테스트는 그 파일과 현재 출력을 대조한다. 분류표에서 항목
 * 하나를 빼면 그 tag 의 width 주입이 사라져 즉시 RED (측정 capability 가 곧 출력이다).
 */
const styleOf = (n: { props?: { style?: unknown } }): Record<string, unknown> =>
  (n.props?.style ?? {}) as Record<string, unknown>;

const BASELINE = JSON.parse(
  readFileSync(
    resolve(__dirname, "__fixtures__/adr923IntrinsicMeasureBaseline.json"),
    "utf8",
  ),
) as {
  tags: string[];
  fingerprints: Record<string, Record<string, unknown>>;
};

describe("ADR-923 Phase 4 G5 — INLINE_BLOCK_TAGS 분류표 + INTRINSIC_MEASURE_TAGS 분리", () => {
  it("24 항목 전부 분류돼 있고 (measure 전부 true), hand 항목은 값·사유를 가진다", () => {
    const classified = Object.keys(INLINE_BLOCK_TAG_CLASSIFICATION).sort();
    expect(classified).toEqual([...INLINE_BLOCK_TAGS].sort());
    expect(classified).toHaveLength(24);
    for (const [tag, c] of Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION)) {
      expect(c.measure, tag).toBe(true);
      expect(c.reason.length, tag).toBeGreaterThan(10);
      if (c.display === "hand") {
        expect(typeof c.handDisplay, tag).toBe("string");
        // r29m2: handDisplay 는 현재 동작 값 하나만 뜻한다 (= getElementDisplay 의 오늘 값). DOM 정합
        //   후보는 domDisplay 로 분리하고, 후보를 적으면 측정 근거 (domEvidence) 가 따라야 한다.
        expect(c.handDisplay, tag).toBe(
          getElementDisplay({ type: tag, props: {} }),
        );
        if (c.domDisplay !== undefined) {
          expect(
            c.domEvidence?.length ?? 0,
            `${tag} domEvidence`,
          ).toBeGreaterThan(20);
        }
      } else {
        expect(c.handDisplay, tag).toBeUndefined();
        expect(c.domDisplay, tag).toBeUndefined();
      }
    }
    // Phase 0 §B 집계: AB 11 · B 6 · ? 7 (evidence/923-phase0-inventory.md §B-2)
    const byRole = (r: string) =>
      Object.values(INLINE_BLOCK_TAG_CLASSIFICATION).filter((c) => c.role === r)
        .length;
    expect([byRole("AB"), byRole("B"), byRole("?")]).toEqual([11, 6, 7]);
    for (const [tag, c] of Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION)) {
      if (c.role === "AB") expect(c.display, tag).toBe("catalog");
    }
    const hand = Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION)
      .filter(([, c]) => c.display === "hand")
      .map(([tag]) => tag)
      .sort();
    expect(hand).toEqual(
      [
        "calendargrid",
        "chip",
        "dateinput",
        "fancybutton",
        "linkbutton",
        "submitbutton",
        "type",
      ].sort(),
    );
  });

  it("Phase 4: INTRINSIC_MEASURE_TAGS 멤버십 == INLINE_BLOCK_TAGS (Phase 5 가 후자를 삭제할 때까지)", () => {
    expect([...INTRINSIC_MEASURE_TAGS].sort()).toEqual(
      [...INLINE_BLOCK_TAGS].sort(),
    );
  });

  it("분리 전 baseline 과 enrichWithIntrinsicSize 출력 diff 0 (24 + 대조군 7, width 4 변형)", () => {
    const tags = [...INLINE_BLOCK_TAGS, ...CONTROL_TAGS];
    expect(tags).toEqual(BASELINE.tags);
    const now = enrichFingerprints(tags);
    expect(Object.keys(now)).toEqual(Object.keys(BASELINE.fingerprints));
    for (const key of Object.keys(now)) {
      expect(now[key], key).toEqual(BASELINE.fingerprints[key]);
    }
  });

  it("정적: needsWidth 게이트는 INTRINSIC_MEASURE_TAGS 를 읽고 INLINE_BLOCK_TAGS 를 읽지 않는다 (멤버십이 같아 기능 게이트로는 구분 불가)", () => {
    const src = readFileSync(resolve(__dirname, "../utils.ts"), "utf8");
    const start = src.indexOf("  const needsWidth =");
    const end = src.indexOf(";", start);
    expect(start).toBeGreaterThan(0);
    const block = src.slice(start, end);
    expect(block).toMatch(/INTRINSIC_MEASURE_TAGS\.has\(type\)/);
    expect(block).not.toMatch(/INLINE_BLOCK_TAGS\.has\(type\)/);
  });

  it("needsWidth 는 INTRINSIC_MEASURE_TAGS 만 읽는다 — 목록 밖 컨테이너는 width 부재를 유지", () => {
    // 빈 fixture 에서 콘텐츠 폭이 0 인 합성 컨테이너(togglebuttongroup: 자식 합산) 는 needsWidth 여도
    //   `baseContentWidth > 0` 게이트로 주입이 없다 — baseline 이 그 사실을 들고 있으므로 baseline 기준.
    let numeric = 0;
    for (const tag of INTRINSIC_MEASURE_TAGS) {
      const enriched = enrichWithIntrinsicSize(
        fixtureNode(tag, {}),
        400,
        0,
        undefined,
        [],
        () => [],
      );
      const expectNumeric =
        typeof BASELINE.fingerprints[`${tag} @absent`]?.width === "number";
      if (expectNumeric) numeric++;
      expect(typeof styleOf(enriched).width === "number", tag).toBe(
        expectNumeric,
      );
    }
    expect(numeric).toBe(23);
    const div = enrichWithIntrinsicSize(
      fixtureNode("div", {}),
      400,
      0,
      undefined,
      [],
      () => [],
    );
    expect(styleOf(div).width).toBeUndefined();
  });
});

describe("ADR-923 Phase 4 — resolveDefaultDisplay(type) (미배선)", () => {
  it("catalog 파생 항목은 production fallback 의 display 를 그대로 돌려준다", () => {
    for (const [tag, c] of Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION)) {
      const derived = resolveContainerStylesFallback(tag, {}).display;
      if (c.display === "hand") {
        expect(derived, `${tag} 는 파생 원천이 없어야 hand`).toBeUndefined();
        expect(resolveDefaultDisplay(tag)).toBe(c.handDisplay);
      } else {
        expect(typeof derived, `${tag} catalog display`).toBe("string");
        expect(resolveDefaultDisplay(tag)).toBe(String(derived).toLowerCase());
        if (c.role === "B" && c.display === "catalog") {
          expect(["flex", "grid", "block"], tag).toContain(
            resolveDefaultDisplay(tag),
          );
        }
      }
    }
  });

  it("잔존 spec 3종 · PascalCase 입력 · 미등록 타입", () => {
    // Frame/Group/Slot spec 은 containerStyles 를 갖지 않는다 (Group.spec:111 / Frame.spec:200 의 flex 는
    //   Skia shape layout) → spec 경로 {} → canvas 기본 block = 현 getElementDisplay 와 동일.
    for (const t of ["frame", "group", "slot"]) {
      expect(resolveContainerStylesFallback(t, {}).display, t).toBeUndefined();
      expect(resolveDefaultDisplay(t), t).toBe("block");
      expect(getElementDisplay({ type: t, props: {} }), t).toBe("block");
    }
    expect(resolveDefaultDisplay("Button")).toBe(
      resolveDefaultDisplay("button"),
    );
    expect(resolveDefaultDisplay("no-such-type")).toBe("block");
    expect(resolveDefaultDisplay(undefined)).toBe("block");
  });

  it("hand 항목: resolveDefaultDisplay 는 현재 값 (inline-block) — DOM 정합 전환 후보 목록은 domDisplay 로 고정 (r29m2)", () => {
    const handEntries = Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION).filter(
      ([, c]) => c.display === "hand",
    );
    expect(handEntries).toHaveLength(7);
    for (const [tag, c] of handEntries) {
      expect(resolveDefaultDisplay(tag), tag).toBe(c.handDisplay);
      expect(resolveDefaultDisplay(tag), tag).toBe("inline-block");
    }
    // Phase 5 전환 후보 = domDisplay 가 있고 현재 값과 다른 항목 — Q4 근거 (browser 게이트
    //   adr923CalendarGridQ4 + evidence §9) 가 붙은 calendargrid 하나뿐. 후보를 늘리려면 근거부터.
    const candidates = handEntries
      .filter(
        ([, c]) => c.domDisplay !== undefined && c.domDisplay !== c.handDisplay,
      )
      .map(([tag, c]) => `${tag}: ${c.handDisplay} → ${c.domDisplay}`);
    expect(candidates).toEqual(["calendargrid: inline-block → block"]);
    expect(INLINE_BLOCK_TAG_CLASSIFICATION.calendargrid.domEvidence).toMatch(
      /adr923CalendarGridQ4/,
    );
  });

  it("Phase 4 동작 무변경 잠금 — getElementDisplay 는 아직 INLINE_BLOCK_TAGS → inline-block (Phase 5 가 뒤집는다)", () => {
    expect(getElementDisplay({ type: "Button", props: {} })).toBe(
      "inline-block",
    );
    expect(getElementDisplay({ type: "Badge", props: {} })).toBe(
      "inline-block",
    );
    expect(getElementDisplay({ type: "div", props: {} })).toBe("block");
    // 의도된 diff 목록 (Phase 5 배선 시 바뀌는 항목) = catalog 파생 17 전부, hand 7 은 0 — hand 는
    //   현재 값을 돌려주므로 배선만으로는 바뀌지 않는다 (r29m2). 목록 자체를 고정한다.
    const divergent = [...INLINE_BLOCK_TAGS]
      .filter(
        (t) =>
          resolveDefaultDisplay(t) !==
          getElementDisplay({ type: t, props: {} }),
      )
      .sort();
    const catalogTags = Object.entries(INLINE_BLOCK_TAG_CLASSIFICATION)
      .filter(([, c]) => c.display === "catalog")
      .map(([t]) => t)
      .sort();
    expect(divergent).toEqual(catalogTags);
    expect(divergent).toHaveLength(17);
    const src = readFileSync(
      resolve(__dirname, "../taffyDisplayAdapter.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/resolveDefaultDisplay/);
  });
});
