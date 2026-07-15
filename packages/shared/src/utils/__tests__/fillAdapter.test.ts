import { describe, expect, it } from "vitest";

import {
  adaptElementFillStyle,
  fillsToCssBackgroundStyle,
} from "../fillAdapter";

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

  it("fills 가 있으면 기존 background 필드를 지우고 파생 CSS 로 치환한다", () => {
    const adapted = adaptElementFillStyle({
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
    const adapted = adaptElementFillStyle({
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
