import { afterEach, describe, expect, it } from "vitest";

import type { CSSProperties } from "react";

import { darkShadows, lightShadows } from "@composition/specs";

import { adaptElementStyle, fillsToCssBackgroundStyle } from "../fillAdapter";
import { setAssetUrlResolver, type AssetUrlResolver } from "../assetRef";

describe("fillAdapter", () => {
  it("color fill 을 backgroundColor 로 변환한다", () => {
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "color",
          enabled: true,
          color: "#112233FF",
        },
      ]),
    ).toEqual({
      backgroundColor: "#112233",
    });
  });

  it("color fill 의 hex alpha 를 rgba() 로 보존한다 (alpha 절단 회귀)", () => {
    // 회귀(2026-07-15): toHex6 절단으로 alpha 16% fill 이 불투명 렌더 —
    // Skia(fillToSkia)는 alpha 를 적용해 DOM↔Skia 대칭 위반이기도 했다.
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "color",
          enabled: true,
          opacity: 1,
          color: "#86326329", // alpha 0x29 = 41/255
        },
      ]),
    ).toEqual({
      backgroundColor: "rgba(134, 50, 99, 0.161)",
    });
  });

  it("color fill 의 fill-level opacity 를 alpha 에 합성한다", () => {
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "color",
          enabled: true,
          opacity: 0.5,
          color: "#FF0000FF",
        },
      ]),
    ).toEqual({
      backgroundColor: "rgba(255, 0, 0, 0.5)",
    });
  });

  it("gradient stop 의 hex alpha 를 rgba() stop 으로 보존한다", () => {
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "linear-gradient",
          enabled: true,
          opacity: 1,
          rotation: 90,
          stops: [
            { color: "#FF000080", position: 0 }, // alpha 0x80 ≈ 0.502
            { color: "#00FF00FF", position: 1 },
          ],
        },
      ]),
    ).toEqual({
      backgroundImage:
        "linear-gradient(90deg, rgba(255, 0, 0, 0.502) 0%, #00FF00 100%)",
    });
  });

  it("radial fill 의 radius 를 ellipse 크기로 반영한다 (radius 소거 회귀)", () => {
    // 회귀(2026-07-15): `circle`(farthest-corner) 고정 출력이 radius 를 소거해
    // Skia(radius 소비)와 falloff 크기가 어긋나던 결함.
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "radial-gradient",
          enabled: true,
          opacity: 1,
          center: { x: 0.3, y: 0.3 },
          radius: { width: 0.6, height: 0.5 },
          stops: [
            { color: "#FFD700FF", position: 0 },
            { color: "#8A2BE2FF", position: 1 },
          ],
        },
      ]),
    ).toEqual({
      backgroundImage:
        "radial-gradient(60% 50% at 30% 30%, #FFD700 0%, #8A2BE2 100%)",
    });
  });

  it("radial fill 의 radius 가 없으면 기존 circle 출력을 보존한다", () => {
    expect(
      fillsToCssBackgroundStyle([
        {
          type: "radial-gradient",
          enabled: true,
          opacity: 1,
          center: { x: 0.5, y: 0.5 },
          stops: [
            { color: "#000000FF", position: 0 },
            { color: "#FFFFFFFF", position: 1 },
          ],
        },
      ]),
    ).toEqual({
      backgroundImage:
        "radial-gradient(circle at 50% 50%, #000000 0%, #FFFFFF 100%)",
    });
  });

  it("fills 가 있으면 기존 background 필드를 지우고 파생 CSS 로 치환한다", () => {
    const adapted = adaptElementStyle({
      id: "el-1",
      type: "Box",
      fills: [
        {
          type: "linear-gradient",
          enabled: true,
          rotation: 90,
          stops: [
            { color: "#FF0000FF", position: 0 },
            { color: "#00FF00FF", position: 1 },
          ],
        },
      ],
      props: {
        style: {
          backgroundColor: "#ffffff",
          borderRadius: "12px",
        },
      },
    });

    expect(adapted.props?.style).toEqual({
      borderRadius: "12px",
      backgroundImage: "linear-gradient(90deg, #FF0000 0%, #00FF00 100%)",
    });
  });

  it("빈 fills 배열은 fills 없음과 동일 — style.background* 를 보존한다", () => {
    // 회귀(2026-07-15): truthy 빈 배열이 delete 만 수행해 canonical Preview 의
    // fills:[] 하드코딩과 결합, 사용자 style 배경을 능동 소거하던 결함.
    const adapted = adaptElementStyle({
      id: "el-2",
      type: "Box",
      fills: [],
      props: {
        style: {
          backgroundColor: "#ffffff",
          backgroundImage: "linear-gradient(0deg, #000 0%, #fff 100%)",
        },
      },
    });

    expect(adapted.props?.style).toEqual({
      backgroundColor: "#ffffff",
      backgroundImage: "linear-gradient(0deg, #000 0%, #fff 100%)",
    });
  });
});

// ADR-166 후속 — 패널이 기록한 그림자 리터럴은 저장 시점 theme 이 굳는다. DOM 은 theme 배선
//   없이 CSS 변수로 내보내 브라우저가 전환하게 한다 (Skia 는 theme 리터럴, 판정은 동일).
describe("adaptElementStyle — 그림자 리터럴 → CSS 변수", () => {
  it("light / dark 프리셋 리터럴이 같은 CSS 변수로 간다", () => {
    for (const [key, css] of [
      ["md", lightShadows.md],
      ["lg", darkShadows.lg],
    ] as const) {
      const adapted = adaptElementStyle({
        id: "el-shadow",
        type: "Box",
        props: { style: { boxShadow: css } },
      });
      expect(adapted.props?.style?.boxShadow, key).toBe(`var(--shadow-${key})`);
    }
  });

  it("fills 가 없는 요소도 정규화된다", () => {
    // 종전 `adaptElementFillStyle` 은 fills 부재 시 즉시 반환해 style 을 통째로 건너뛰었다 —
    //   그 조기 반환을 그대로 뒀으면 그림자 축이 대다수 요소에서 무반영이었다.
    const adapted = adaptElementStyle({
      id: "el-no-fills",
      type: "Box",
      props: { style: { boxShadow: lightShadows.sm } },
    });
    expect("fills" in adapted).toBe(false);
    expect(adapted.props?.style?.boxShadow).toBe("var(--shadow-sm)");
  });

  it("fills 변환과 그림자 정규화가 함께 적용된다", () => {
    const adapted = adaptElementStyle({
      id: "el-both",
      type: "Box",
      fills: [{ type: "color", enabled: true, color: "#FF0000FF" }],
      // fills 파생 키가 추가되므로 style 을 CSSProperties 로 넓힌다 (리터럴 추론이면
      //   backgroundColor 접근이 타입 에러).
      props: { style: { boxShadow: lightShadows.md } as CSSProperties },
    });
    expect(adapted.props?.style?.boxShadow).toBe("var(--shadow-md)");
    expect(adapted.props?.style?.backgroundColor).toBe("#FF0000");
  });

  it("정규화 대상이 아니면 원문 보존 + 참조도 유지한다", () => {
    // 적용 범위 밖(none / 임의 CSS)에서 새 객체를 만들면 React memo 가 매 렌더 깨진다.
    const element = {
      id: "el-custom",
      type: "Box",
      props: { style: { boxShadow: "0 1px 2px rgba(255, 0, 0, 0.5)" } },
    };
    expect(adaptElementStyle(element)).toBe(element);

    const none = { id: "el-none", type: "Box", props: { style: {} } };
    expect(adaptElementStyle(none)).toBe(none);
  });
});

describe("fillAdapter — 다층 fill (2026-09-15)", () => {
  it("enabled fill 2개 이상이면 background-image 층으로 전부 그린다 (맨 위가 목록 첫 항목, 단색은 linear-gradient(c, c))", () => {
    expect(
      fillsToCssBackgroundStyle([
        { type: "color", enabled: true, opacity: 1, color: "#FF0000FF" },
        {
          type: "linear-gradient",
          enabled: true,
          opacity: 1,
          rotation: 90,
          stops: [
            { color: "#0000FFFF", position: 0 },
            { color: "#00FF00FF", position: 1 },
          ],
        },
        { type: "color", enabled: true, opacity: 0.5, color: "#2563EBFF" },
      ]),
    ).toEqual({
      backgroundImage:
        "linear-gradient(rgba(37, 99, 235, 0.5), rgba(37, 99, 235, 0.5)), linear-gradient(90deg, #0000FF 0%, #00FF00 100%), linear-gradient(#FF0000, #FF0000)",
    });
  });

  it("이미지 층이 섞이면 background-size 를 층 수만큼 낸다 (이미지만 자기 크기)", () => {
    expect(
      fillsToCssBackgroundStyle([
        { type: "image", enabled: true, opacity: 1, url: "a.png", mode: "fit" },
        { type: "color", enabled: true, opacity: 0.25, color: "#000000FF" },
      ]),
    ).toEqual({
      backgroundImage:
        "linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url(a.png)",
      backgroundSize: "auto, contain",
      backgroundPosition: "0% 0%, center",
      backgroundRepeat: "repeat, no-repeat",
    });
  });

  describe("ADR-235 image fill — 자산 참조 · 기하", () => {
    afterEach(() => setAssetUrlResolver(null));

    const resolverWith = (urls: Record<string, string>): AssetUrlResolver => ({
      resolveSync: (ref) => urls[ref] ?? null,
      ensure: async () => {},
      subscribe: () => () => {},
    });
    const REF = `asset:sha256-${"a".repeat(64)}`;

    it("단층 image fill 은 중앙 · 반복 없음 (Skia image shader 기하)", () => {
      expect(
        fillsToCssBackgroundStyle([
          {
            type: "image",
            enabled: true,
            opacity: 1,
            url: "a.png",
            mode: "fit",
          },
        ]),
      ).toEqual({
        backgroundImage: "url(a.png)",
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      });
    });

    it("준비된 asset: 참조는 해석기 URL 로 그린다", () => {
      setAssetUrlResolver(resolverWith({ [REF]: "blob:http://x/1" }));
      expect(
        fillsToCssBackgroundStyle([
          { type: "image", enabled: true, opacity: 1, url: REF, mode: "fill" },
        ]).backgroundImage,
      ).toBe("url(blob:http://x/1)");
    });

    it("준비 전 asset: 참조는 층을 만들지 않는다 (요청 0)", () => {
      setAssetUrlResolver(resolverWith({}));
      expect(
        fillsToCssBackgroundStyle([
          { type: "image", enabled: true, opacity: 1, url: REF, mode: "fill" },
        ]),
      ).toEqual({});
    });

    it("해석기가 없어도 dataURL · http 는 그대로 (dual-read)", () => {
      expect(
        fillsToCssBackgroundStyle([
          {
            type: "image",
            enabled: true,
            opacity: 1,
            url: "data:image/png;base64,AA",
            mode: "stretch",
          },
        ]).backgroundImage,
      ).toBe("url(data:image/png;base64,AA)");
    });
  });

  it("disabled 층은 빠지고 하나만 남으면 단층 출력 그대로", () => {
    expect(
      fillsToCssBackgroundStyle([
        { type: "color", enabled: false, opacity: 1, color: "#FF0000FF" },
        { type: "color", enabled: true, opacity: 1, color: "#2563EBFF" },
      ]),
    ).toEqual({ backgroundColor: "#2563EB" });
  });
});
