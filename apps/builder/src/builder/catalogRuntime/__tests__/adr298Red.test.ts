import { describe, expect, it } from "vitest";
import {
  darkShadows,
  lightShadows,
  normalizeShadowForTheme,
} from "@composition/rendering";
import { catalogAuthoredDomStyle } from "../../../../../../packages/shared/src/catalog/runtime/authoredStyle";
import { getPresetCommitValue } from "../../components/property/PropertyUnitInput.runtime";
import { BORDER_RADIUS_PRESET_OPTIONS } from "../../components/property/propertyUnitPresets";
import { catalogStyleView, catalogStyleWrites } from "../styleFields";

/**
 * ADR-298 Phase 0 (G0) — 노드 값의 토큰 참조가 지금 끊기는 자리를 RED (`it.fails`) 로 고정한다. 각 phase 가
 * 자기 몫의 `it.fails` 를 `it` 으로 바꾼다. 준비 단계가 실패하면 `it.fails` 가 거짓으로 통과하므로, 준비가 맞다는
 * 사실은 GREEN `it` 으로 따로 둔다.
 *
 * - ① (F5, Phase 2) 패널 preset 이 px 리터럴로 commit 된다 — Radius 「M」 이 `visual.radius = 8` 이 되어
 *   테마 · 색 모드를 바꿔도 따라오지 않는다.
 * - ② (F6, Phase 2) 패널 읽기 `catalogStyleView` 가 TokenUse 객체를 건너뛴다 — 토큰 gap 이 패널에 안 보인다.
 * - ③ (F11, 사용자 결정 7 = 선행 /fix — 수정 뒤 GREEN) 패널이 기록한 그림자 preset 리터럴을 Canvas 는 색 모드로 되돌리지만
 *   (`normalizeShadowForTheme` — `applyCatalogAuthoredPaint` 가 `root.colorMode` 로 부른다) DOM inline
 *   (`catalogAuthoredDomStyle`) 은 리터럴 그대로라 dark 에서 두 consumer 가 다른 그림자를 그린다.
 */
const radiusM = BORDER_RADIUS_PRESET_OPTIONS.find((preset) => preset.id === "md")!;

describe("ADR-298 Phase 0 — 준비 (GREEN)", () => {
  it("Radius preset M 의 commit 값은 활성 snapshot 의 px 리터럴이다 (ADR-295 Decision 5)", () => {
    expect(getPresetCommitValue(radiusM)).toMatch(/^\d+(?:\.\d+)?px$/);
  });
  it("Canvas 는 light preset 그림자 리터럴을 dark 에서 dark 값으로 되돌린다 (F11 의 한쪽)", () => {
    expect(normalizeShadowForTheme(lightShadows.sm, "dark")).toBe(darkShadows.sm);
    expect(darkShadows.sm).not.toBe(lightShadows.sm);
  });
});

describe("ADR-298 결정 7 선행 /fix — GREEN", () => {
  // (Phase 0 RED ③ — `catalogAuthoredDomStyle` 이 `shadowLiteralToCssVar` 를 부른 뒤 GREEN.)
  it("③ DOM inline 그림자가 Canvas 와 같은 판정으로 색 모드를 따른다 (preset 리터럴 → `var(--shadow-*)`)", () => {
    for (const shadows of [lightShadows, darkShadows])
      for (const key of ["sm", "md", "lg"] as const)
        expect(
          catalogAuthoredDomStyle({
            visual: { boxShadow: shadows[key] },
            fills: undefined,
          } as never).boxShadow,
        ).toBe(`var(--shadow-${key})`);
    // preset 이 아닌 값 · inset 토글 · none 은 원문 — Canvas 도 그대로 둔다 (대칭).
    const custom = "0 1px 2px red";
    for (const raw of [custom, `inset ${lightShadows.sm}`, "none", lightShadows.inset])
      expect(
        catalogAuthoredDomStyle({ visual: { boxShadow: raw }, fills: undefined } as never)
          .boxShadow,
      ).toBe(normalizeShadowForTheme(raw, "dark") === raw ? raw : "unreachable");
  });
});

describe("ADR-298 Phase 0 — RED", () => {
  it.fails("① preset M commit 이 노드에 토큰 참조 (TokenUse) 로 저장된다 — 지금은 px 숫자", () => {
    const writes = catalogStyleWrites("borderRadius", getPresetCommitValue(radiusM));
    const radius = (writes.visual as Record<string, { kind: string; value?: unknown }>)
      .radius;
    expect(radius?.kind).toBe("set");
    expect(radius?.value).toMatchObject({ kind: "token" });
  });

  it.fails("② catalogStyleView 가 토큰 gap 을 패널에 보인다 — 지금은 건너뛴다", () => {
    const style = catalogStyleView({
      visual: { gap: { kind: "token", tokenId: "lib:token:radius_md_light" } },
      layout: {},
      sizing: {},
    } as never);
    expect(style.gap).toBeDefined();
  });

});
