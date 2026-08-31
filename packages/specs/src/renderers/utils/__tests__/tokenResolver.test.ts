import { describe, it, expect } from "vitest";
import {
  tokenToCSSVar,
  resolveToken,
  resolveColor,
  hexStringToNumber,
} from "../tokenResolver";

// 2026-07-20 (Selected variant 배선) — origin props.style 의 var() 리터럴이 Skia fill 로
//   도달하는 경로. 역변환 가능한 단순 var() 는 토큰 해석 (theme 정합), 불가하면 passthrough.
describe("resolveColor — var(--xxx) 시맨틱 변수 역변환", () => {
  it("var(--accent-subtle) → {color.accent-subtle} 토큰 해석 (검정 붕괴 방지)", () => {
    const light = resolveColor("var(--accent-subtle)", "light");
    expect(light).toBe(resolveToken("{color.accent-subtle}", "light"));
    expect(light).not.toBe("var(--accent-subtle)");
    // dark theme 도 토큰 테이블 정합.
    expect(resolveColor("var(--accent-subtle)", "dark")).toBe(
      resolveToken("{color.accent-subtle}", "dark"),
    );
  });

  it("역변환 불가한 var() 는 passthrough (기존 동작 보존)", () => {
    expect(resolveColor("var(--unknown-thing)", "light")).toBe(
      "var(--unknown-thing)",
    );
  });

  it("hex/token 입력 동작 불변", () => {
    expect(resolveColor("#ff0000", "light")).toBe("#ff0000");
    expect(resolveColor("{color.accent}", "light")).toBe(
      resolveToken("{color.accent}", "light"),
    );
  });

  it("{color.raised} Skia 색 해석 (ADR-071 토큰 — lightColors/darkColors 등재)", () => {
    // 과거 Skia 색맵에 raised 미등재 → undefined → 투명 (collection/popover 컨테이너 배경 소실).
    //   --bg-raised = gray-50(light) / zinc-850(dark) 로 등재해 catalog·projection 양쪽 배경 복원.
    expect(resolveColor("{color.raised}", "light")).toBe("#f9fafb");
    expect(resolveColor("{color.raised}", "dark")).toBe("#202023");
  });
});

describe("tokenResolver — surface elevation", () => {
  it("{color.raised} maps to var(--bg-raised)", () => {
    expect(tokenToCSSVar("{color.raised}")).toBe("var(--bg-raised)");
  });

  it("{color.base} maps to var(--bg) (baseline)", () => {
    expect(tokenToCSSVar("{color.base}")).toBe("var(--bg)");
  });

  it("{color.layer-1} maps to var(--bg-overlay) (baseline)", () => {
    expect(tokenToCSSVar("{color.layer-1}")).toBe("var(--bg-overlay)");
  });
});

describe("tokenResolver — spacing 2xs primitive", () => {
  it("{spacing.2xs} resolves to 2 (px)", () => {
    expect(resolveToken("{spacing.2xs}")).toBe(2);
  });

  it("{spacing.2xs} maps to var(--spacing-2xs)", () => {
    expect(tokenToCSSVar("{spacing.2xs}")).toBe("var(--spacing-2xs)");
  });

  it("{spacing.xs} still resolves to 4 (baseline unaffected)", () => {
    expect(resolveToken("{spacing.xs}")).toBe(4);
  });
});

/**
 * ADR-913 slice 5 (2026-06-19) — radius xs/2xl primitive 누락 회귀 게이트.
 *
 * **갭**: shared-tokens.css 가 `--radius-xs:0.125rem`(2px) / `--radius-2xl:1rem`(16px) 를
 * 정의하고 catalog COMPONENT_RULES_TABLE 가 `{radius.xs}` 10회 / `{radius.2xl}` 3회
 * (Dialog lg/xl + Form + ComboBox/DatePicker/Table/Tree/Breadcrumbs 등) 참조하는데,
 * primitives `radius` 객체 + `RadiusTokens` 타입에 두 키가 없어 → resolveToken 이
 * undefined 반환 → specShapeConverter `parseFloat(String(undefined))||0` = 0px.
 * DOM 은 16px/2px 모서리, Skia 는 0px → D3 symmetric(Skia↔CSS) 위반.
 *
 * **fix**: radius.ts 에 xs:2 / 2xl:16 추가(shared-tokens.css 값 1:1) + RadiusTokens
 * 인터페이스에 두 키 추가(RadiusTokenRef 템플릿이 {radius.xs}/{radius.2xl} 를 type-valid 화).
 * 3xl/4xl 은 CSS 정의는 있으나 catalog 미사용 → 추가 안 함(0 drift). 토큰 *정의* 불변,
 * 신규 키만 추가 = R2 re-scale 없음.
 */
describe("tokenResolver — radius xs/2xl primitive (ADR-913 slice 5 — Skia↔CSS 대칭)", () => {
  it("{radius.xs} resolves to 2 (px) — was undefined→0px in Skia", () => {
    expect(resolveToken("{radius.xs}")).toBe(2);
  });

  it("{radius.2xl} resolves to 16 (px) — was undefined→0px in Skia", () => {
    expect(resolveToken("{radius.2xl}")).toBe(16);
  });

  it("{radius.xs} maps to var(--radius-xs) (shared-tokens.css 0.125rem=2px)", () => {
    expect(tokenToCSSVar("{radius.xs}")).toBe("var(--radius-xs)");
  });

  it("{radius.2xl} maps to var(--radius-2xl) (shared-tokens.css 1rem=16px)", () => {
    expect(tokenToCSSVar("{radius.2xl}")).toBe("var(--radius-2xl)");
  });

  it("기존 radius 키 baseline 불변 (sm=4/md=6/lg=8/xl=12)", () => {
    expect(resolveToken("{radius.sm}")).toBe(4);
    expect(resolveToken("{radius.md}")).toBe(6);
    expect(resolveToken("{radius.lg}")).toBe(8);
    expect(resolveToken("{radius.xl}")).toBe(12);
  });
});

// ADR-166 Phase 5 — `{shadow.*}` 는 `{color.*}` 와 동일하게 theme 분기해야 한다. Phase 1 이전에는
//   flat map 단일 참조라 dark 에서도 light 그림자가 나왔다(빌더 dark 캔버스 = 흰 후광 원인).
//   `shadows.test.ts` 가 map 자체를 검증하고, 여기서는 **resolveToken 진입점**이 그 분기를
//   실제로 태우는지를 본다 — consumer 는 전부 이 함수를 거친다.
describe("resolveToken — {shadow.*} theme 분기 (ADR-166)", () => {
  const SCALE = ["sm", "md", "lg"] as const;

  it("3단계 전부 light ≠ dark (flat map 회귀 가드)", () => {
    for (const key of SCALE) {
      const ref = `{shadow.${key}}` as const;
      const light = resolveToken(ref, "light");
      const dark = resolveToken(ref, "dark");
      expect(typeof light, `${ref} light`).toBe("string");
      expect(dark, `${ref} dark ≠ light`).not.toBe(light);
    }
  });

  it("theme 미지정 기본값 = light", () => {
    expect(resolveToken("{shadow.md}")).toBe(resolveToken("{shadow.md}", "light"));
  });

  it("dark 는 기하 동일 + alpha 만 ×3 (Spectrum 규칙)", () => {
    const alphas = (v: string) =>
      [...v.matchAll(/rgba\([^)]*?([\d.]+)\)/g)].map((m) => Number(m[1]));
    const geometry = (v: string) => v.replace(/rgba\([^)]*\)/g, "rgba()");

    for (const key of SCALE) {
      const ref = `{shadow.${key}}` as const;
      const light = resolveToken(ref, "light") as string;
      const dark = resolveToken(ref, "dark") as string;
      expect(geometry(dark), `${ref} 기하`).toBe(geometry(light));

      const la = alphas(light);
      const da = alphas(dark);
      expect(da.length, `${ref} 레이어 수`).toBe(la.length);
      la.forEach((a, i) => {
        expect(da[i], `${ref} layer${i} alpha ×3`).toBeCloseTo(a * 3, 5);
      });
    }
  });

  it("해석 결과에 var( / color-mix( 미포함 — Skia parseOneShadow 계약", () => {
    // styleConverter 의 색 정규식은 rgb/rgba/hex 만 매칭한다. var()/color-mix() 가 섞이면
    //   불투명 검정으로 낙하하므로 토큰 전개 결과는 항상 리터럴이어야 한다.
    for (const key of SCALE) {
      for (const theme of ["light", "dark"] as const) {
        const v = resolveToken(`{shadow.${key}}` as const, theme) as string;
        expect(v, `${key}/${theme}`).not.toContain("var(");
        expect(v, `${key}/${theme}`).not.toContain("color-mix(");
      }
    }
  });
});

// ADR-198 (2026-08-31) — 반환값 소비처는 전부 이 숫자를 `0xRRGGBB` 로 읽는다
// (`hexToColor4fChannels` 가 16/8/0 마스크). `#RRGGBBAA` 를 그대로 parse 하면
// 채널이 한 바이트 밀려 빨강이 사라지고 알파가 파랑 자리에 앉았다 — 실측으로
// `#2F6FEDFF` 가 `(111,237,255)` 로 그려졌다. DOM 은 hex8 을 그대로 이해하므로
// 이 시프트는 Skia↔Preview 가 같은 값에서 다른 색을 내는 D3 발산이었다.
describe("hexStringToNumber — 표기별 채널 정합", () => {
  it("#RRGGBB 는 그대로", () => {
    expect(hexStringToNumber("#2F6FED")).toBe(0x2f6fed);
  });

  it("#RRGGBBAA 는 알파를 잘라내고 RGB 만 남긴다 (채널 시프트 회귀 차단)", () => {
    expect(hexStringToNumber("#2F6FEDFF")).toBe(0x2f6fed);
    // 알파가 FF 가 아니어도 색은 같아야 한다 — 알파는 다른 채널로 나른다.
    expect(hexStringToNumber("#2F6FED80")).toBe(0x2f6fed);
    // 시프트가 돌아오면 이 값이 된다.
    expect(hexStringToNumber("#2F6FEDFF")).not.toBe(0x6fedff);
  });

  it("#RGB / #RGBA 단축 표기를 확장한다", () => {
    expect(hexStringToNumber("#F0A")).toBe(0xff00aa);
    expect(hexStringToNumber("#F0A8")).toBe(0xff00aa);
  });

  it("0x 표기와 비-hex fallback 은 기존 동작 유지", () => {
    expect(hexStringToNumber("0x2F6FED")).toBe(0x2f6fed);
    expect(hexStringToNumber("transparent")).toBe(0x000000);
  });
});
