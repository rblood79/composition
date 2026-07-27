/**
 * SSOT (직접 편집 정본) — theme rule base D3 시각 SSOT (ADR-912 ②-6-A).
 *
 * **위상 전환 (ADR-912 1A-(a), 2026-06-03)**: 본 테이블은 더 이상 build-time 자동 생성물이 아니다.
 * `generate-rules.ts`(spec→table) 가 1회 생성한 결과를 **freeze 하여 직접 편집 정본으로 승격**했다
 * (build chain `pnpm generate:rules` step 제거됨 — `packages/specs/package.json`). 이후 컴포넌트 시각
 * 규칙(variants/sizes/fill) 변경은 **본 파일을 직접 편집**한다. 생성기 `generate-rules.ts` +
 * `generate:rules` script 는 ADR-912 단계 5 step 3 에서 물리 삭제됨(본 테이블이 독립 정본). 입력이던
 * 124 spec 은 단계 5 step 4 에서 삭제 예정.
 *
 * **소비자**: DOM(generated CSS — `generate-css` 가 본 테이블의 variant 색상 주입) / Skia(runtime
 * `resolveComponentRule`) / Properties·Style Panel — 모두 본 테이블 단일 source 파생(DOM/Skia 시각 대칭).
 * TokenRef(`{color.X}`)는 string 그대로 — runtime resolveCanonicalToken/resolveToken 이 변환.
 */
import type { ComponentRulesTable } from "../../types/composition-document.types";

export const COMPONENT_RULES_TABLE: ComponentRulesTable = {
  Avatar: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.full}",
        height: 24,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 28,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 40,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 48,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  AvatarGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.full}",
        height: 24,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 28,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 40,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 48,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  Badge: {
    defaultVariant: "accent",
    defaultSize: "sm",
    variants: {
      accent: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent}",
            pressed: "{color.accent}",
          },
        },
        colors: {
          text: "{color.on-accent}",
        },
      },
      informative: {
        fill: {
          default: {
            base: "{color.informative}",
            hover: "{color.informative}",
            pressed: "{color.informative}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.neutral}",
            hover: "{color.neutral}",
            pressed: "{color.neutral}",
          },
        },
        colors: {
          text: "{color.base}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.positive}",
            hover: "{color.positive}",
            pressed: "{color.positive}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      notice: {
        fill: {
          default: {
            base: "{color.notice}",
            hover: "{color.notice}",
            pressed: "{color.notice}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative}",
            hover: "{color.negative}",
            pressed: "{color.negative}",
          },
        },
        colors: {
          text: "{color.on-negative}",
        },
      },
      gray: {
        fill: {
          default: {
            base: "{color.gray}",
            hover: "{color.gray}",
            pressed: "{color.gray}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      red: {
        fill: {
          default: {
            base: "{color.red}",
            hover: "{color.red}",
            pressed: "{color.red}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      orange: {
        fill: {
          default: {
            base: "{color.orange}",
            hover: "{color.orange}",
            pressed: "{color.orange}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      yellow: {
        fill: {
          default: {
            base: "{color.yellow}",
            hover: "{color.yellow}",
            pressed: "{color.yellow}",
          },
        },
        colors: {
          text: "{color.black}",
        },
      },
      green: {
        fill: {
          default: {
            base: "{color.green-named}",
            hover: "{color.green-named}",
            pressed: "{color.green-named}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      blue: {
        fill: {
          default: {
            base: "{color.blue}",
            hover: "{color.blue}",
            pressed: "{color.blue}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      purple: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple}",
            pressed: "{color.purple}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      indigo: {
        fill: {
          default: {
            base: "{color.indigo}",
            hover: "{color.indigo}",
            pressed: "{color.indigo}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      cyan: {
        fill: {
          default: {
            base: "{color.cyan}",
            hover: "{color.cyan}",
            pressed: "{color.cyan}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      pink: {
        fill: {
          default: {
            base: "{color.pink}",
            hover: "{color.pink}",
            pressed: "{color.pink}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      turquoise: {
        fill: {
          default: {
            base: "{color.turquoise}",
            hover: "{color.turquoise}",
            pressed: "{color.turquoise}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      fuchsia: {
        fill: {
          default: {
            base: "{color.fuchsia}",
            hover: "{color.fuchsia}",
            pressed: "{color.fuchsia}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      magenta: {
        fill: {
          default: {
            base: "{color.magenta}",
            hover: "{color.magenta}",
            pressed: "{color.magenta}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      chartreuse: {
        fill: {
          default: {
            base: "{color.chartreuse}",
            hover: "{color.chartreuse-hover}",
            pressed: "{color.chartreuse-pressed}",
          },
        },
        colors: {
          text: "{color.black}",
        },
      },
      celery: {
        fill: {
          default: {
            base: "{color.celery}",
            hover: "{color.celery-hover}",
            pressed: "{color.celery-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      seafoam: {
        fill: {
          default: {
            base: "{color.seafoam}",
            hover: "{color.seafoam-hover}",
            pressed: "{color.seafoam-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      brown: {
        fill: {
          default: {
            base: "{color.brown}",
            hover: "{color.brown-hover}",
            pressed: "{color.brown-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      cinnamon: {
        fill: {
          default: {
            base: "{color.cinnamon}",
            hover: "{color.cinnamon-hover}",
            pressed: "{color.cinnamon-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
        },
      },
      silver: {
        fill: {
          default: {
            base: "{color.silver}",
            hover: "{color.silver-hover}",
            pressed: "{color.silver-pressed}",
          },
        },
        colors: {
          text: "{color.black}",
        },
      },
    },
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 0, // ADR-151 B12: 전 variant border 색 부재 — DOM border:none 인데 Skia layout 만 +2px 소비하던 dead 값
        height: 0,
        paddingY: 1,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 0,
        height: 0,
        paddingY: 2,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 0,
        height: 0,
        paddingY: 4,
        gap: 4,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 0,
        height: 0,
        paddingY: 8,
        gap: 6,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 0,
        height: 0,
        paddingY: 12,
        gap: 8,
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  // ADR-912 container shell 3 (2026-06-04): 키를 PascalCase "Body" → lowercase "body" 로 정합.
  //   canonical element.type 은 일관되게 lowercase "body"(elementUtils/pageFrameBinding/App.tsx)
  //   이고 resolveComponentRule 은 type 직접 조회(정규화 없음) → catalog generic 경로의 게이트
  //   type("body")와 일치해야 visual 해소. frame(L2426 lowercase) 선례와 동일 정합. PascalCase
  //   "Body" 키 참조 코드 0건(BodySpec 심볼만 PascalCase, element.type 미사용).
  body: {
    defaultVariant: "default",
    defaultSize: "md",
    // 페이지 body 기본 overflow = auto (스크롤). D3 SSOT 단일 기본값 source — 시스템 페이지
    //   (Components / fallback Home)는 systemComponentsPage.ts 가 props:{} 로 생성해 factory
    //   createDefaultBodyProps(overflow:auto)를 우회하므로 catalog 를 안 두면 CSS 기본 visible 로
    //   떨어진다(패널 specPresetResolver fallback 도 "visible"). top-level containerStyles.overflow
    //   를 두면 3 소비자(패널 resolveCatalogContainerBase / layout resolveContainerStylesFallback
    //   경로 A / 렌더)가 동일 fallback 을 읽어 모든 page 가 auto. 사용자 페이지는 factory 명시
    //   prop 우선(동일 auto). overflow 는 CONTAINER_STYLES_FALLBACK_KEYS whitelist 멤버.
    //   (2026-07-21 사용자 요청: 모든 page 기본 overflow=auto, Components 페이지가 visible 이었음)
    containerStyles: {
      overflow: "auto",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-md}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "body",
      containerStyles: undefined,
    },
  },
  Breadcrumb: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          textHover: "{color.neutral}",
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 24,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 24,
      },
    },
    structure: {
      archetype: "simple",
      element: "li",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  Breadcrumbs: {
    defaultVariant: "default",
    defaultSize: "M",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          textHover: "{color.neutral}",
        },
      },
    },
    sizes: {
      S: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      M: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 24,
      },
      L: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 24,
      },
    },
    structure: {
      archetype: "simple",
      element: "nav",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        alignItems: "center",
      },
      states: {
        hover: {},
        disabled: {
          opacity: 1,
          pointerEvents: "auto",
          cursor: "default",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  Button: {
    defaultVariant: "primary",
    defaultSize: "md",
    // top-level containerStyles — Skia layout fallback(resolveContainerStylesFallback 경로 A,
    //   rule.containerStyles 직접 조회) + dirty baseline(resolveCatalogContainerBase line 3 last-wins)
    //   + 스타일 패널 Layout Direction(useLayoutValues specPreset.display) 양쪽이 읽는 단일 layout
    //   정본. structure.containerStyles 는 경로 A 가 못 읽어(top-level 만 조회) Skia 가
    //   INLINE_BLOCK_TAGS("button") → block 으로 자식(Icon/Text)을 세로로 쌓았다(CSS↔Skia 발산,
    //   2026-06-27). display 는 `flex` — Direction selector 항목이 block/flex-row/flex-column 만
    //   인식하고 inline-flex 항목은 없어서, inline-flex 면 Direction 이 block 으로 표시·활성된다
    //   (사용자 지적 2026-06-27). gap 은 size 별(sizes[size].gap 4~12px)이라 여기 두지 않음.
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    variants: {
      accent: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent-hover}",
            pressed: "{color.accent-pressed}",
          },
          // outline fillStyle — 투명 배경(Button.css 수동 override 의 단일 소스화, 2026-06-27).
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.on-accent}",
          border: "{color.accent}",
          borderHover: "{color.accent-hover}",
          outlineText: "{color.accent}",
          outlineBorder: "{color.border-hover}",
        },
      },
      primary: {
        fill: {
          default: {
            base: "{color.neutral}",
            hover: "{color.neutral-hover}",
            pressed: "{color.neutral-pressed}",
          },
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.base}",
          border: "{color.neutral}",
          borderHover: "{color.neutral-hover}",
          outlineText: "{color.neutral}",
          outlineBorder: "{color.border-hover}",
        },
      },
      secondary: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          outlineText: "{color.neutral}",
          outlineBorder: "{color.border-hover}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative}",
            hover: "{color.negative-hover}",
            pressed: "{color.negative-pressed}",
          },
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.on-negative}",
          border: "{color.negative}",
          borderHover: "{color.negative-hover}",
          outlineText: "{color.negative}",
          outlineBorder: "{color.border-hover}",
        },
      },
      premium: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple-hover}",
            pressed: "{color.purple-pressed}",
          },
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.white}",
          border: "{color.purple}",
          borderHover: "{color.purple-hover}",
          outlineText: "{color.purple}",
          outlineBorder: "{color.border-hover}",
        },
      },
      genai: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple-hover}",
            pressed: "{color.purple-pressed}",
          },
          outline: { base: "{color.transparent}" },
        },
        colors: {
          text: "{color.white}",
          border: "{color.purple}",
          borderHover: "{color.purple-hover}",
          outlineText: "{color.purple}",
          outlineBorder: "{color.border-hover}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        iconSize: 14,
        paddingX: 4,
        paddingY: 1,
        gap: 4,
        iconGap: 4,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        iconSize: 16,
        paddingX: 8,
        paddingY: 2,
        gap: 6,
        iconGap: 6,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
        iconSize: 18,
        paddingX: 12,
        paddingY: 4,
        gap: 8,
        iconGap: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
        iconSize: 24,
        paddingX: 16,
        paddingY: 8,
        gap: 10,
        iconGap: 10,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        borderWidth: 1,
        height: 0,
        iconSize: 28,
        paddingX: 24,
        paddingY: 12,
        gap: 12,
        iconGap: 12,
      },
    },
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      states: {
        hover: {},
        pressed: {
          scale: 0.95,
        },
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      cssEmitMode: "button-base",
    },
  },
  ButtonGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  Calendar: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    // 2026-07-07 전수조사 fix: top-level containerStyles 추가 — Calendar 는 spec 삭제(ADR-912
    //   cutover) + structure.composition 부재(archetype "calendar") 라, layout 이
    //   structure.containerStyles(아래)에만 있으면 resolveContainerStylesFallback("calendar") 이
    //   경로 A(top-level rule.containerStyles)·경로 B(structure.composition) 둘 다 미도달 → {}
    //   반환 → 부모 flex-column 에서 align-items:stretch 로 Calendar 가 부모 폭 전체로 stretch
    //   (Skia 350px vs CSS .react-aria-Calendar { width: fit-content } 256px 발산).
    //   TabPanel/Tree 선례처럼 top-level containerStyles 로 승격해 경로 A 가 Skia layout 에 공급.
    //   structure.containerStyles(아래)는 dirty baseline(resolveCatalogContainerBase)용 유지 —
    //   동일값이라 baseline drift 0.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "fit-content",
      // ADR-151 B1 (2026-07-16): generated Calendar.css 의 `border: 1px solid` 를 layout 이
      //   미반영해 border-box 총폭 2px 발산 — layout fallback 채널(top-level)로 공급.
      //   CSS 는 structure.containerStyles 채널이라 generated CSS diff 0.
      borderWidth: "1px",
    },
    sizes: {
      // ADR-912 단계5 step4 date-color (2026-06-16): paddingY/gap 보강 —
      //   Calendar.spec.ts 삭제 대비 generated Calendar.css(padding NNpx NNpx / gap NNpx) diff-0 유지.
      //   값은 (구) CalendarSpec.sizes 와 동일 (paddingX==paddingY, gap sm:4/md:6/lg:8).
      sm: {
        paddingX: 4,
        paddingY: 4,
        gap: 4,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: 20,
      },
      md: {
        paddingX: 8,
        paddingY: 8,
        gap: 6,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 26,
      },
      lg: {
        paddingX: 12,
        paddingY: 12,
        gap: 8,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 32,
      },
    },
    structure: {
      archetype: "calendar",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  CalendarGrid: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        iconSize: 20,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        iconSize: 26,
        gap: 6,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        iconSize: 32,
        gap: 8,
      },
    },
  },
  CalendarHeader: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      // ADR-912 (B+icon): inline_icon_text replace — 좌 chevron + center text + 우 chevron.
      //   leadingIcon/trailingIcon name 은 spec render.shapes 의 chevron-left/right 보존, color 는
      //   spec 의 variant.text({color.neutral}) 동형. textAlign center 는 spec text align:"center".
      //   gap(icon↔text)은 spec 의 cellSize(iconSize+4) 흡수라 leadingIcon.gap 은 width 폴백용 0.
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        leadingIcon: { name: "chevron-left", gap: 0, color: "{color.neutral}" },
        trailingIcon: {
          name: "chevron-right",
          gap: 0,
          color: "{color.neutral}",
        },
        textAlign: "center",
      },
      accent: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        leadingIcon: { name: "chevron-left", gap: 0, color: "{color.neutral}" },
        trailingIcon: {
          name: "chevron-right",
          gap: 0,
          color: "{color.neutral}",
        },
        textAlign: "center",
      },
    },
    sizes: {
      // ADR-912 (B+icon): iconSize/gap 은 spec CALENDAR_HEADER_DIMS(sm{20,4}/md{26,6}/lg{32,8}) 동형.
      //   cellSize = iconSize + 4 (inline_icon_text 좌표 base). gap 은 width 폴백(cellSize*7+gap*6)용.
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 24,
        iconSize: 20,
        gap: 4,
        paddingX: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 30,
        iconSize: 26,
        gap: 6,
        paddingX: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 36,
        iconSize: 32,
        gap: 8,
        paddingX: 0,
      },
    },
    // 2026-07-02: CalendarHeader 는 DOM `<header>`(CalendarCommon.css: display:flex, align-items:center,
    //   Heading flex:1 center)가 이미 flex 컨테이너다. Skia inline_icon_text + DOM `<header>` 양쪽이
    //   동일 layout 을 소비하도록 flex 기본값을 structure.containerStyles baseline 으로 공급 →
    //   Style 패널 Transform/Layout 에 표시되고 편집이 양쪽 동기화(DisclosureHeader 동형). justify-content
    //   space-between = prev chevron 좌 / heading 중앙(flex:1) / next chevron 우. element="header"(시맨틱).
    //   verticalAlign:"middle" = Style 패널 Typography Vertical Align:center 기본값(dirty baseline +
    //   synthetic). Skia inline_icon_text center text 의 실제 세로 중앙 렌더는 primitive text shape 의
    //   verticalAlign:"middle" + specShapeConverter 전달로 처리(structure.containerStyles 는 Skia
    //   primitive 에 직접 안 흐름 — 패널 표시/baseline 전용).
    structure: {
      archetype: "simple",
      element: "header",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        verticalAlign: "middle",
      },
    },
  },
  // ADR-912 R6 (2026-06-15): Card 본체 S2 재설계 catalog cutover. 구 Card.spec 의 비표준
  //   `isQuiet` boolean 분기(transparent vs layer-2)를 S2 정본 variant 모델(primary/secondary/
  //   tertiary/quiet)로 흡수 — quiet = base transparent. isSelected 2px accent border 는
  //   `selectedBorder: accent`(border 색 전환, ADR-142 §3 데이터 분기)로 대체. 4 variant 의
  //   fill.default 만 다르고 hover/pressed/selected 는 공통(neutral-subtle/accent-subtle).
  //   ToggleButton variant fill 구조 동형. layout(flex/gap/padding)은 factory props.style SSOT
  //   (ADR-907 Layer B) — sizes 의 paddingX/gap 은 DOM base fallback + Skia shell 메트릭.
  Card: {
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      // primary — 기본 표면(구 spec 의 비-quiet 기본값 보존: layer-2/layer-1/neutral-subtle).
      primary: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.neutral-subtle}",
            selected: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
          selectedBorder: "{color.accent}",
        },
      },
      // secondary — 약한 elevation(layer-1 base). S2 secondary 대응.
      secondary: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
            selected: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
          selectedBorder: "{color.accent}",
        },
      },
      // tertiary — outline 형(transparent base + 가시 border). S2 tertiary 대응.
      tertiary: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
            selected: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          selectedBorder: "{color.accent}",
        },
      },
      // quiet — 무배경(hover 시만 표시). 구 spec 의 isQuiet=true 흡수.
      quiet: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
            selected: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
          selectedBorder: "{color.accent}",
        },
      },
    },
    sizes: {
      // paddingX=paddingY 균일(구 Card.spec.sizes 보존). layout 실 SSOT 는 factory props.style
      //   (ADR-907 Layer B) — rule padding 은 DOM base fallback + Skia shell 메트릭.
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        paddingX: 4,
        paddingY: 4,
        gap: 4,
        borderWidth: 1,
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        paddingX: 8,
        paddingY: 8,
        gap: 8,
        borderWidth: 1,
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        borderWidth: 1,
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        borderWidth: 1,
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        paddingX: 32,
        paddingY: 32,
        gap: 20,
        borderWidth: 1,
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      // 2026-06-24 잔존 catalog 이관 — RSP Card 정본(preview/content/footer 세로 스택)에 맞춰
      //   containerStyles 신설. archetype "default" base CSS 는 display:inline-flex 였는데 factory/
      //   Taffy 는 flex/column → generated CSS(Preview)↔Skia 비대칭(D3 위반)이었음. containerStyles
      //   명시로 generate-css 가 flex/column/width:100% 재생성 → CSS=Skia=factory 3자 정합.
      // overflow:hidden — S2 Card 정본(root overflow:clip + radius.lg 가 자식을 단일 radius 로 clip).
      //   CardPreview 상단 모서리를 root clip 이 처리 → CardPreview 자체 borderRadius 불필요(2026-06-24).
      //   sizes.md.borderRadius={radius.lg}=12px 과 결합해 CSS Preview 가 둥근 상단 이미지 clip.
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        overflow: "hidden",
      },
    },
  },
  CardContent: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
      },
    },
  },
  CardFooter: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        width: "100%",
      },
    },
  },
  CardHeader: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
      },
    },
  },
  CardPreview: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
      },
    },
  },
  CardView: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: "auto",
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: "auto",
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: "auto",
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  Checkbox: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-912 단계 5 step 2: replace-primitive(checkbox indicator) measurement 를 generic
    //   (buildCatalogShapes) 으로 전환하기 위해 label fontWeight 를 rule variant 에 명시한다.
    //   Checkbox.spec.render.shapes 의 label text 는 fontWeight 미emit(→ 측정 fallback 400)
    //   이고 실제 label(자식 Label element)도 400 이므로, generic 측정의 fallback 500 과의
    //   drift 를 차단하려면 variant.textWeight=400 이 필요하다 (Badge 는 spec/generic 둘 다 500
    //   이라 불필요 — Checkbox/Radio/Switch 만 명시). textWeight 는 ComponentRuleVariant 필드.
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
            selected: "{color.neutral}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          selectedBorder: "{color.neutral}",
        },
        textWeight: 400,
      },
      emphasized: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
            selected: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          selectedBorder: "{color.accent}",
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Checkbox.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강 (Checkbox.css size 별 gap 6/8/10 + padding 0px 0px 정합). indicator(boxSize/
      //   boxRadius)는 generated CSS 미emit(수동/React) → rule 불요.
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 6,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 8,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 10,
      },
    },
    structure: {
      archetype: "toggle-indicator",
      element: "label",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  CheckboxGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS root `gap: Npx`
      //   재생성용 (CheckboxGroup.spec.sizes 미러). 자식 .checkbox-items gap 은 composition
      //   containerVariants.size 의 --cb-items-gap 별도 경로. padding 미emit(ownsContainerBox).
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 8,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 12,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 16,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): CheckboxGroup.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제(91c2be0dd) 시 resolveActiveContainerVariants 가
    //   spec-only 라 side variant(flex-direction:row) 가 Skia layout 에서 회귀했다(side variant
    //   test FAIL). catalog fallback 메커니즘 + 본 필드로 복구. CSS 변수(--cb-items-gap)/orientation
    //   nested 는 DOM generated CSS 전용(Skia 무관)이라 이관 제외 — Skia 가 읽는 styles 만.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          color: "var(--fg)",
          "--label-font-size": "var(--text-sm)",
          "--label-line-height": "var(--text-sm--line-height)",
          "--cb-items-gap": "12px",
          "--cb-hint-size": "var(--text-xs)",
        },
        containerVariants: {
          size: {
            sm: {
              styles: {
                "--label-font-size": "var(--text-xs)",
                "--label-line-height": "var(--text-xs--line-height)",
                "--cb-items-gap": "8px",
              },
            },
            lg: {
              styles: {
                "--label-font-size": "var(--text-base)",
                "--label-line-height": "var(--text-base--line-height)",
                "--cb-items-gap": "16px",
              },
            },
          },
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          orientation: {
            vertical: {
              nested: [
                {
                  selector: ".checkbox-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "column",
                    gap: "var(--cb-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
            horizontal: {
              nested: [
                {
                  selector: ".checkbox-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "row",
                    "align-items": "center",
                    gap: "var(--cb-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--cb-hint-size)",
            },
          },
        ],
      },
    },
  },
  Code: {
    defaultVariant: "default",
    defaultSize: "sm",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-pressed}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 위험군 해소(2026-06-04): Code catalog 측정/렌더 drift 차단. spec render.shapes
        //   fontFamily.mono + fontWeight 400 ↔ buildCatalogShapes fallback sans/500.
        //   rule fontFamily(mono) + textWeight(400) 명시(buildCatalogShapes visual.fontFamily 읽음).
        fontFamily: "JetBrains Mono, Consolas, monospace",
        textWeight: 400,
      },
    },
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.xs}",
        height: 18,
      },
      sm: {
        paddingX: 6,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 22,
      },
      md: {
        paddingX: 8,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.sm}",
        height: 26,
      },
      lg: {
        paddingX: 10,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: 32,
      },
    },
    structure: {
      archetype: "simple",
      element: "code",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  ColorArea: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 120,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 180,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 240,
        iconSize: 22,
      },
    },
  },
  ColorField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (ColorField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      xs: {
        paddingX: 6,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 28,
        gap: 6,
        iconSize: 18,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 32,
        gap: 6,
        iconSize: 20,
      },
      md: {
        paddingX: 10,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
        gap: 8,
        iconSize: 26,
      },
      lg: {
        paddingX: 12,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 48,
        gap: 10,
        iconSize: 32,
      },
      xl: {
        paddingX: 14,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 56,
        gap: 12,
        iconSize: 36,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/TextField/NumberField/SearchField/TextArea 동형). field family side SSOT 일원화
    //   (generate-css.ts STRUCTURE_META 도 동시 flex-row 전환). Skia sideMode 트리거 styles 만.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        // layout:flex-row + width:100% — factory(DateColorComponents) 정본. ColorField 는 Label·hex
        //   입력(80px)·ColorSwatch(24) 를 가로 배치(row/center)하는 composition 특화 디자인. 기존
        //   flex-column/fit-content 는 일반 field archetype default 를 답습해 CSS Preview(column) ≠
        //   Skia(row) 시각 비대칭 + Style Panel false dirty 였음 (2026-06-23 layout 방향 정정, 사용자
        //   결정 = factory 정본). CSS 재생성 시 .react-aria-ColorField flex-direction:row 로 정합.
        layout: "flex-row",
        gap: "var(--spacing-xs)",
        containerStyles: {
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          "label-align": {
            center: {
              styles: {
                "--form-label-align": "center",
              },
            },
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Input",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector: ".react-aria-Input:where([data-focused])",
                  styles: {
                    outline: "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-Input:where([data-invalid])",
                  styles: {
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "cf-label",
            variables: {
              xs: {
                "--cf-label-size": "var(--text-2xs)",
              },
              sm: {
                "--cf-label-size": "var(--text-xs)",
              },
              md: {
                "--cf-label-size": "var(--text-sm)",
              },
              lg: {
                "--cf-label-size": "var(--text-base)",
              },
              xl: {
                "--cf-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--cf-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".react-aria-Input",
            prefix: "cf-input",
            variables: {
              xs: {
                "--cf-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
                "--cf-input-size": "var(--text-2xs)",
                "--cf-input-line-height": "var(--text-2xs--line-height)",
                "--cf-input-max-width": "9ch",
              },
              sm: {
                "--cf-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
                "--cf-input-size": "var(--text-xs)",
                "--cf-input-line-height": "var(--text-xs--line-height)",
                "--cf-input-max-width": "10ch",
              },
              md: {
                "--cf-input-padding": "var(--spacing-xs) var(--spacing-md)",
                "--cf-input-size": "var(--text-sm)",
                "--cf-input-line-height": "var(--text-sm--line-height)",
                "--cf-input-max-width": "12ch",
              },
              lg: {
                "--cf-input-padding": "var(--spacing-sm) var(--spacing-lg)",
                "--cf-input-size": "var(--text-base)",
                "--cf-input-line-height": "var(--text-base--line-height)",
                "--cf-input-max-width": "14ch",
              },
              xl: {
                "--cf-input-padding": "var(--spacing-md) var(--spacing-xl)",
                "--cf-input-size": "var(--text-lg)",
                "--cf-input-line-height": "var(--text-lg--line-height)",
                "--cf-input-max-width": "16ch",
              },
            },
            bridges: {
              "--input-padding": "var(--cf-input-padding)",
              "--input-font-size": "var(--cf-input-size)",
              "--input-line-height": "var(--cf-input-line-height)",
              "border-radius": "var(--radius-sm)",
              "max-width": "var(--cf-input-max-width)",
              "box-sizing": "border-box",
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "cf-hint",
            variables: {
              xs: {
                "--cf-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--cf-hint-size": "var(--text-2xs)",
              },
              md: {
                "--cf-hint-size": "var(--text-xs)",
              },
              lg: {
                "--cf-hint-size": "var(--text-sm)",
              },
              xl: {
                "--cf-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--cf-hint-size)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--cf-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  ColorPicker: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      compact: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      expanded: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border-hover}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
  },
  ColorSlider: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 16,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 20,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 24,
        iconSize: 22,
      },
    },
  },
  ColorSwatch: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      selected: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      // 2026-06-22 reference 정합(ADR-914 Tier1): reference ColorSwatch.css:6 `border-radius: 9999px`
      //   (정사각 box → 완전한 원형/pill). 기존 {radius.sm}/{radius.md} 는 둥근 사각 → 형태 범주 발산.
      //   {radius.full}(=9999) 는 Skia 측 nodeRendererClip 의 `Math.min(borderRadius, min(w,h)/2)` clamp 로
      //   box half-size 까지 자동 축소 → CSS border-radius:9999px 와 동일 시각(양방향 자동, segmented radius 동형).
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 20,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 28,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 36,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  ColorSwatchPicker: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: 20,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 28,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 36,
      },
    },
  },
  ColorWheel: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 120,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 180,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 240,
        iconSize: 22,
      },
    },
  },
  ComboBox: {
    defaultSize: "md",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): ComboBoxSpec.spec 삭제 대비 — generate-css virtual emit 이
    //   base/size block 의 `gap: Npx` 를 byte-identical 재현하려면 gap 필수(Select 동형). paddingY 는
    //   미보충(padding 은 composition.delegation .combobox-container --combo-container-padding 가 담당).
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 14,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 16,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
        gap: 6,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
        gap: 8,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
        gap: 10,
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DateField/TimeField 동형
    //   (flex-direction:row). ADR-912 단계5 step4 누락분(measure gap[4]). generated
    //   ComboBox.css:326-329 side 블록과 byte-identical. Skia sideMode 트리거 styles 만 —
    //   quiet nested(.react-aria-Button)는 DOM generated CSS 전용 제외.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Button",
                  styles: {
                    background: "transparent",
                    "box-shadow": "none",
                    outline: "none",
                    "border-color": "transparent",
                  },
                },
                {
                  selector: ".react-aria-Button[data-hovered]",
                  styles: {
                    background: "transparent",
                    "box-shadow": "none",
                    outline: "none",
                    "border-color": "transparent",
                  },
                },
                {
                  selector: ".react-aria-Button[data-pressed]",
                  styles: {
                    background: "transparent",
                    "box-shadow": "none",
                    outline: "none",
                    "border-color": "transparent",
                  },
                },
                {
                  selector: ".react-aria-Button[data-focus-visible]",
                  styles: {
                    background: "transparent",
                    "box-shadow": "none",
                    outline: "none",
                    "border-color": "transparent",
                  },
                },
                {
                  selector: ".combobox-container",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled])) .combobox-container",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Button[data-hovered]:not([data-disabled])) .combobox-container",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-focused]:not([data-disabled])) .combobox-container",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-focus-within]:not([data-disabled])) .combobox-container",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Button[data-focus-visible]:not([data-disabled])) .combobox-container",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Button[data-pressed]:not([data-disabled])) .combobox-container",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--accent)",
                  },
                },
              ],
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="ComboBox"]',
            styles: {
              width: "var(--trigger-width)",
              "max-width": "none",
              "max-height": "300px",
              overflow: "auto",
              "box-sizing": "border-box",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-raised)",
              "box-shadow": "var(--shadow-lg)",
              contain: "layout style",
            },
            nested: [
              {
                selector: ".react-aria-ListBox",
                styles: {
                  border: "none",
                  background: "transparent",
                  "max-height": "none",
                  "min-height": "24px",
                },
              },
            ],
          },
        ],
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "combo-label",
            variables: {
              xs: {
                "--combo-label-size": "var(--text-2xs)",
              },
              sm: {
                "--combo-label-size": "var(--text-xs)",
              },
              md: {
                "--combo-label-size": "var(--text-sm)",
              },
              lg: {
                "--combo-label-size": "var(--text-base)",
              },
              xl: {
                "--combo-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--combo-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".combobox-container",
            prefix: "combo-container",
            variables: {
              xs: {
                "--combo-container-padding":
                  "var(--spacing-3xs) var(--spacing-xs)",
                "--combo-container-padding-right": "var(--spacing-3xs)",
              },
              sm: {
                "--combo-container-padding":
                  "var(--spacing-2xs) var(--spacing-sm)",
                "--combo-container-padding-right": "var(--spacing-2xs)",
              },
              md: {
                "--combo-container-padding":
                  "var(--spacing-xs) var(--spacing-md)",
                "--combo-container-padding-right": "var(--spacing-xs)",
              },
              lg: {
                "--combo-container-padding":
                  "var(--spacing-sm) var(--spacing-lg)",
                "--combo-container-padding-right": "var(--spacing-sm)",
              },
              xl: {
                "--combo-container-padding":
                  "var(--spacing-md) var(--spacing-xl)",
                "--combo-container-padding-right": "var(--spacing-md)",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              gap: "var(--btn-gap, var(--spacing-xs))",
              width: "100%",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-inset)",
              overflow: "hidden",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
              padding: "var(--combo-container-padding)",
              "padding-right": "var(--combo-container-padding-right)",
            },
            states: {
              ":has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled]))":
                {
                  "border-color": "var(--border-hover)",
                  background: "var(--bg-overlay)",
                },
              ":has(.react-aria-Button[data-hovered]:not([data-disabled]))": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              ":has(.react-aria-Input[data-focused])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has(.react-aria-Input[data-focus-within])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has(.react-aria-Button[data-focus-visible])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has([data-invalid])": {
                "border-color": "var(--negative)",
              },
              ":has([data-disabled])": {
                background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                "border-color":
                  "color-mix(in srgb, var(--fg) 12%, transparent)",
                opacity: "0.38",
              },
            },
          },
          {
            childSelector: ".react-aria-Input",
            prefix: "combo-input",
            variables: {
              xs: {
                "--combo-input-padding": "0",
                "--combo-input-font-size": "var(--text-2xs)",
                "--combo-input-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--combo-input-padding": "0",
                "--combo-input-font-size": "var(--text-xs)",
                "--combo-input-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--combo-input-padding": "0",
                "--combo-input-font-size": "var(--text-sm)",
                "--combo-input-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--combo-input-padding": "0",
                "--combo-input-font-size": "var(--text-base)",
                "--combo-input-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--combo-input-padding": "0",
                "--combo-input-font-size": "var(--text-lg)",
                "--combo-input-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              flex: "1 1 auto",
              "min-width": "0",
              border: "none",
              "border-radius": "0",
              background: "transparent",
              outline: "none",
              "forced-color-adjust": "none",
              padding: "0",
              "font-size": "var(--combo-input-font-size)",
              "line-height": "var(--combo-input-line-height)",
              "--input-padding": "var(--combo-input-padding)",
              "--input-font-size": "var(--combo-input-font-size)",
              "--input-line-height": "var(--combo-input-line-height)",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "combo-btn",
            variables: {
              xs: {
                "--combo-btn-size": "10px",
              },
              sm: {
                "--combo-btn-size": "14px",
              },
              md: {
                "--combo-btn-size": "18px",
              },
              lg: {
                "--combo-btn-size": "22px",
              },
              xl: {
                "--combo-btn-size": "28px",
              },
            },
            bridges: {
              position: "static",
              flex: "0 0 auto",
              padding: "0",
              "border-width": "0",
              width: "var(--combo-btn-size)",
              height: "var(--combo-btn-size)",
              background: "var(--bg-overlay)",
              color: "var(--fg)",
              "forced-color-adjust": "none",
              "box-shadow": "var(--shadow-sm)",
            },
            states: {
              "[data-hovered]:not([data-disabled])": {
                background: "var(--accent-subtle)",
              },
              "[data-pressed]:not([data-disabled])": {
                background:
                  "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "2px",
              },
              "[data-disabled]": {
                background: "color-mix(in srgb, var(--fg) 12%, transparent)",
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "combo-hint",
            variables: {
              xs: {
                "--combo-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--combo-hint-size": "var(--text-xs)",
              },
              md: {
                "--combo-hint-size": "var(--text-xs)",
              },
              lg: {
                "--combo-hint-size": "var(--text-sm)",
              },
              xl: {
                "--combo-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--combo-hint-size)",
              "--error-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--combo-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  DateField: {
    // ADR-912 단계5 step4 (2026-06-17): DateField.spec.ts 삭제 — gap 은 base/size block byte-identical
    //   (composition flex-column → CSSGenerator size.gap emit), intrinsicHeight 는 layout-only
    //   (CSS 미emit, utils.ts calculateContentHeight datefield 분기가 resolveSkiaRule read-through).
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: 22,
        gap: 4,
        intrinsicHeight: 32,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: 30,
        gap: 6,
        intrinsicHeight: 40,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: 0,
        height: 42,
        gap: 8,
        intrinsicHeight: 48,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: 0,
        height: 54,
        gap: 10,
        intrinsicHeight: 62,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): DateField.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제 회귀. DatePicker/TimeField 동형
    //   (flex-direction:row). resolveActiveContainerVariants 가 spec→catalog fallback 으로 읽음.
    //   Skia sideMode 트리거 styles 만 — quiet nested(.react-aria-DateInput)는 DOM generated CSS 전용 제외.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-DateInput",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector: ".react-aria-DateInput:where([data-focused])",
                  styles: {
                    outline: "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-DateInput:where([data-invalid])",
                  styles: {
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "df-label",
            variables: {
              xs: {
                "--df-label-size": "var(--text-2xs)",
              },
              sm: {
                "--df-label-size": "var(--text-xs)",
              },
              md: {
                "--df-label-size": "var(--text-sm)",
              },
              lg: {
                "--df-label-size": "var(--text-base)",
              },
              xl: {
                "--df-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--df-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".react-aria-DateInput",
            prefix: "df-input",
            variables: {
              xs: {
                "--df-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
                "--df-input-size": "var(--text-2xs)",
                "--df-input-line-height": "var(--text-2xs--line-height)",
                "--df-input-min-width": "100px",
              },
              sm: {
                "--df-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
                "--df-input-size": "var(--text-xs)",
                "--df-input-line-height": "var(--text-xs--line-height)",
                "--df-input-min-width": "120px",
              },
              md: {
                "--df-input-padding": "var(--spacing-xs) var(--spacing-md)",
                "--df-input-size": "var(--text-sm)",
                "--df-input-line-height": "var(--text-sm--line-height)",
                "--df-input-min-width": "150px",
              },
              lg: {
                "--df-input-padding": "var(--spacing-sm) var(--spacing-lg)",
                "--df-input-size": "var(--text-base)",
                "--df-input-line-height": "var(--text-base--line-height)",
                "--df-input-min-width": "180px",
              },
              xl: {
                "--df-input-padding": "var(--spacing-md) var(--spacing-xl)",
                "--df-input-size": "var(--text-lg)",
                "--df-input-line-height": "var(--text-lg--line-height)",
                "--df-input-min-width": "220px",
              },
            },
            bridges: {
              display: "inline-flex",
              padding: "var(--df-input-padding)",
              background: "var(--bg-inset)",
              border: "1px solid",
              "border-radius": "var(--border-radius)",
              width: "100%",
              "min-width": "var(--df-input-min-width)",
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              "font-size": "var(--df-input-size)",
              "line-height": "var(--df-input-line-height)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
            },
          },
          {
            childSelector: ".react-aria-DateSegment",
            prefix: "df-segment",
            variables: {
              xs: {
                "--df-segment-size": "var(--text-2xs)",
              },
              sm: {
                "--df-segment-size": "var(--text-xs)",
              },
              md: {
                "--df-segment-size": "var(--text-sm)",
              },
              lg: {
                "--df-segment-size": "var(--text-base)",
              },
              xl: {
                "--df-segment-size": "var(--text-lg)",
              },
            },
            bridges: {
              padding: "0 2px",
              border: "none",
              background: "transparent",
              height: "auto",
              "font-variant-numeric": "tabular-nums",
              "text-align": "end",
              color: "var(--fg)",
              "border-radius": "var(--radius-xs)",
              "font-size": "var(--df-segment-size)",
              transition: "all 150ms ease",
            },
            states: {
              '[data-type="literal"]': {
                padding: "0",
              },
              "[data-placeholder]": {
                color: "var(--fg-muted)",
                "font-style": "italic",
                opacity: "0.6",
              },
              ":focus": {
                color: "var(--fg)",
                background: "var(--accent-subtle)",
                outline: "none",
                "border-radius": "var(--radius-xs)",
                "caret-color": "transparent",
              },
              "[data-invalid]": {
                color: "var(--negative)",
              },
              // 2026-06-22 reference 정합(ADR-914 Tier1): reference DateField.css:62-64 의
              //   [data-invalid]:focus 는 solid `--highlight-background-invalid` + `--highlight-foreground`(흰)
              //   = 전경/배경 전체 반전. 기존 15% 반투명 tint + 적색 전경(반전 없음)은 가독성/대비 약화.
              //   filled bg → 전경 동반(on-negative=--color-white) 패턴은 Table 선택행 fix 와 동축.
              //   DateSegment 단일 시각 contract — DateField/DatePicker/DateRangePicker/TimeField 4곳 동일 정합.
              "[data-invalid]:focus": {
                background: "var(--negative)",
                color: "var(--color-white)",
              },
              "[data-disabled]": {
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "df-hint",
            variables: {
              xs: {
                "--df-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--df-hint-size": "var(--text-xs)",
              },
              md: {
                "--df-hint-size": "var(--text-xs)",
              },
              lg: {
                "--df-hint-size": "var(--text-sm)",
              },
              xl: {
                "--df-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--df-hint-size)",
              "--error-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--df-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  DateInput: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          borderHover: "{color.border-hover}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
          borderHover: "{color.accent-hover}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
          borderHover: "{color.negative-hover}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.sm}",
        height: 20,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
      },
    },
  },
  DatePicker: {
    defaultSize: "md",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): gap 보강 — spec.sizes(DATE_PICKER_SIZES) 의 gap 을 rule 로 이관
    //   (DatePicker.spec 삭제 시 virtual STRUCTURE_META 가 rule.sizes 에서 gap emit). Calendar/Section 동일 패턴.
    // height 키 제거 (2026-06-23): DatePicker 는 컨테이너(Label 행 + gap + 입력 box[SelectTrigger>DateInput]
    //   + Calendar)라 height 는 자식 합산 auto(md=54) 여야 한다 — CSS preview 동일(.react-aria-DatePicker
    //   height 미지정 → 54). 기존 height(30) 는 입력 box height 인 척하던 잘못된 결합으로, 입력 box height 는
    //   SelectTrigger.sizes.height(md=30) 가 SSOT(implicitStyles datepicker 분기가 specSizeField("selecttrigger")
    //   로 읽음). Select/ComboBox/NumberField/SearchField 가 TRACK_HEIGHT_TYPES 로 패널 height 축 제외된 것과 동형.
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        iconSize: 10,
        gap: 2,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        iconSize: 14,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        iconSize: 16,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        iconSize: 20,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        iconSize: 24,
        gap: 8,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): DatePicker.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제(daaae6b82) 회귀. TagGroup/Checkbox 동형
    //   (flex-direction:row, Group 보정은 datepicker 분기 별도). Skia sideMode 트리거 styles 만.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Group",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    ".react-aria-Group[data-hovered]:not([data-focus-within]):not([data-focused])",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector: ".react-aria-Group[data-focus-within]",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-Group[data-invalid]",
                  styles: {
                    "border-color": "transparent",
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="DatePicker"]',
            styles: {
              "max-width": "unset",
            },
            nested: [
              {
                selector: ".react-aria-Dialog .react-aria-Calendar",
                styles: {
                  background: "transparent",
                  border: "none",
                  padding: "0",
                },
              },
            ],
          },
          {
            selector: ".react-aria-DatePicker-time-field",
            styles: {
              width: "100%",
            },
          },
        ],
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "dp-label",
            variables: {
              xs: {
                "--dp-label-size": "var(--text-2xs)",
                "--dp-label-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--dp-label-size": "var(--text-xs)",
                "--dp-label-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--dp-label-size": "var(--text-sm)",
                "--dp-label-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--dp-label-size": "var(--text-base)",
                "--dp-label-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--dp-label-size": "var(--text-lg)",
                "--dp-label-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              "--label-font-size": "var(--dp-label-size)",
              "--label-line-height": "var(--dp-label-line-height)",
              "--label-font-weight": "600",
            },
          },
          {
            childSelector: ".react-aria-Group",
            prefix: "dp-group",
            variables: {
              xs: {
                "--dp-group-padding":
                  "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
                "--dp-group-font-size": "var(--text-2xs)",
                "--dp-group-line-height": "var(--text-2xs--line-height)",
                "--dp-group-gap": "var(--spacing-2xs)",
              },
              sm: {
                "--dp-group-padding":
                  "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
                "--dp-group-font-size": "var(--text-xs)",
                "--dp-group-line-height": "var(--text-xs--line-height)",
                "--dp-group-gap": "var(--spacing-xs)",
              },
              md: {
                "--dp-group-padding":
                  "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
                "--dp-group-font-size": "var(--text-sm)",
                "--dp-group-line-height": "var(--text-sm--line-height)",
                "--dp-group-gap": "var(--spacing-xs)",
              },
              lg: {
                "--dp-group-padding":
                  "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
                "--dp-group-font-size": "var(--text-base)",
                "--dp-group-line-height": "var(--text-base--line-height)",
                "--dp-group-gap": "var(--spacing-xs)",
              },
              xl: {
                "--dp-group-padding":
                  "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
                "--dp-group-font-size": "var(--text-lg)",
                "--dp-group-line-height": "var(--text-lg--line-height)",
                "--dp-group-gap": "var(--spacing-sm)",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              width: "100%",
              gap: "var(--dp-group-gap)",
              padding: "var(--dp-group-padding)",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-inset)",
              color: "var(--fg)",
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              "font-size": "var(--dp-group-font-size)",
              "line-height": "var(--dp-group-line-height)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
              cursor: "text",
            },
            states: {
              "[data-hovered]": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              "[data-focus-within]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
                "border-color": "var(--accent)",
                background: "var(--bg-overlay)",
              },
              "[data-invalid]": {
                "border-color": "var(--negative)",
              },
              "[data-disabled]": {
                opacity: "0.38",
                cursor: "not-allowed",
                background: "var(--bg-muted)",
              },
            },
          },
          {
            childSelector: ".react-aria-DateInput",
            prefix: "dp-input",
            bridges: {
              display: "inline-flex",
              flex: "1",
              "min-width": "0",
              padding: "0",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--fg)",
              "font-size": "var(--dp-group-font-size)",
              "white-space": "nowrap",
            },
          },
          {
            childSelector: ".react-aria-DateSegment",
            prefix: "dp-segment",
            variables: {
              xs: {
                "--dp-segment-size": "var(--text-2xs)",
              },
              sm: {
                "--dp-segment-size": "var(--text-xs)",
              },
              md: {
                "--dp-segment-size": "var(--text-sm)",
              },
              lg: {
                "--dp-segment-size": "var(--text-base)",
              },
              xl: {
                "--dp-segment-size": "var(--text-lg)",
              },
            },
            bridges: {
              padding: "0 2px",
              border: "none",
              background: "transparent",
              height: "auto",
              "font-variant-numeric": "tabular-nums",
              "text-align": "end",
              color: "var(--fg)",
              "border-radius": "var(--radius-xs)",
              "font-size": "var(--dp-segment-size)",
              transition: "all 150ms ease",
            },
            states: {
              '[data-type="literal"]': {
                padding: "0",
              },
              "[data-placeholder]": {
                color: "var(--fg-muted)",
                opacity: "0.6",
              },
              ":focus": {
                color: "var(--fg)",
                background: "var(--accent-subtle)",
                outline: "none",
                "border-radius": "var(--radius-xs)",
                "caret-color": "transparent",
              },
              "[data-invalid]": {
                color: "var(--negative)",
              },
              // 2026-06-22 reference 정합(ADR-914 Tier1): reference DateField.css:62-64 의
              //   [data-invalid]:focus 는 solid `--highlight-background-invalid` + `--highlight-foreground`(흰)
              //   = 전경/배경 전체 반전. 기존 15% 반투명 tint + 적색 전경(반전 없음)은 가독성/대비 약화.
              //   filled bg → 전경 동반(on-negative=--color-white) 패턴은 Table 선택행 fix 와 동축.
              //   DateSegment 단일 시각 contract — DateField/DatePicker/DateRangePicker/TimeField 4곳 동일 정합.
              "[data-invalid]:focus": {
                background: "var(--negative)",
                color: "var(--color-white)",
              },
              "[data-disabled]": {
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "dp-btn",
            // 트리거 아이콘 크기 = **아이콘 스케일** (Select 의 `.select-chevron` 과 동일:
            //   14/16/18/22/28, `SelectIcon.sizes[*].iconSize` 정합).
            //   **typography 토큰(`--text-*`) 사용 금지 (2026-07-14)**: 폰트 크기 스케일은
            //   아이콘 박스 스케일이 아니다 — `--text-xl`(20) / `--text-2xl`(24) / `--text-3xl`(30)
            //   을 쓰면 Skia(`SelectIcon.iconSize` 18/22/28)와 md/lg/xl 전부 어긋난다
            //   (실측 md: DOM 버튼 20 vs Skia 18). Select 는 처음부터 px 아이콘 스케일이라
            //   정합이었고, DatePicker/DateRangePicker 만 typography 스케일을 쓰던 예외였다.
            variables: {
              xs: {
                "--dp-btn-width": "14px",
                "--dp-btn-height": "14px",
              },
              sm: {
                "--dp-btn-width": "16px",
                "--dp-btn-height": "16px",
              },
              md: {
                "--dp-btn-width": "18px",
                "--dp-btn-height": "18px",
              },
              lg: {
                "--dp-btn-width": "22px",
                "--dp-btn-height": "22px",
              },
              xl: {
                "--dp-btn-width": "28px",
                "--dp-btn-height": "28px",
              },
            },
            bridges: {
              background: "transparent",
              color: "var(--fg-muted)",
              "forced-color-adjust": "none",
              border: "none",
              width: "var(--dp-btn-width)",
              height: "var(--dp-btn-height)",
              padding: "0",
              cursor: "default",
              "flex-shrink": "0",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
            },
            states: {
              "[data-pressed]": {
                "box-shadow": "none",
                background: "var(--bg-muted)",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "2px",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "dp-hint",
            variables: {
              xs: {
                "--dp-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--dp-hint-size": "var(--text-xs)",
              },
              md: {
                "--dp-hint-size": "var(--text-xs)",
              },
              lg: {
                "--dp-hint-size": "var(--text-sm)",
              },
              xl: {
                "--dp-hint-size": "var(--text-sm)",
              },
            },
            bridges: {
              "--error-font-size": "var(--dp-hint-size)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--dp-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  DateRangePicker: {
    defaultSize: "md",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): gap 보강 — spec.sizes(DATE_PICKER_SIZES 공유) 의 gap 이관 (DatePicker 동일).
    // height 키 제거 (2026-06-23): DatePicker 동형 — 컨테이너 height 는 자식 합산 auto, 입력 box height 는
    //   SelectTrigger.sizes.height(md=30) SSOT. 상세는 DatePicker entry 주석 참조.
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        iconSize: 10,
        gap: 2,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        iconSize: 14,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        iconSize: 16,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        iconSize: 20,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        iconSize: 24,
        gap: 8,
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DatePicker 동형
    //   (flex-direction:row). DatePicker entry 는 containerVariants 보유하나 DateRangePicker 누락
    //   (measure gap[9]/gap[10] — 두 컴포넌트 rule 비대칭). generated DateRangePicker.css:370-373
    //   side 블록과 byte-identical. Skia sideMode 트리거 styles 만 — quiet nested(.react-aria-Group)
    //   는 DOM generated CSS 전용 제외.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Group",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    ".react-aria-Group[data-hovered]:not([data-focus-within]):not([data-focused])",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector: ".react-aria-Group[data-focus-within]",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-Group[data-invalid]",
                  styles: {
                    "border-color": "transparent",
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="DateRangePicker"]',
            styles: {
              "max-width": "unset",
            },
            nested: [
              {
                selector: ".react-aria-Dialog .react-aria-RangeCalendar",
                styles: {
                  background: "transparent",
                  border: "none",
                  padding: "0",
                },
              },
            ],
          },
          {
            selector: ".react-aria-DateRangePicker-start-time",
            styles: {
              width: "100%",
            },
          },
          {
            selector: ".react-aria-DateRangePicker-end-time",
            styles: {
              width: "100%",
            },
          },
        ],
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "drp-label",
            variables: {
              xs: {
                "--drp-label-size": "var(--text-2xs)",
                "--drp-label-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--drp-label-size": "var(--text-xs)",
                "--drp-label-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--drp-label-size": "var(--text-sm)",
                "--drp-label-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--drp-label-size": "var(--text-base)",
                "--drp-label-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--drp-label-size": "var(--text-lg)",
                "--drp-label-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              "--label-font-size": "var(--drp-label-size)",
              "--label-line-height": "var(--drp-label-line-height)",
              "--label-font-weight": "600",
            },
          },
          {
            childSelector: ".react-aria-Group",
            prefix: "drp-group",
            variables: {
              xs: {
                "--drp-group-padding":
                  "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
                "--drp-group-font-size": "var(--text-2xs)",
                "--drp-group-line-height": "var(--text-2xs--line-height)",
                "--drp-group-gap": "var(--spacing-2xs)",
              },
              sm: {
                "--drp-group-padding":
                  "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
                "--drp-group-font-size": "var(--text-xs)",
                "--drp-group-line-height": "var(--text-xs--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              md: {
                "--drp-group-padding":
                  "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
                "--drp-group-font-size": "var(--text-sm)",
                "--drp-group-line-height": "var(--text-sm--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              lg: {
                "--drp-group-padding":
                  "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
                "--drp-group-font-size": "var(--text-base)",
                "--drp-group-line-height": "var(--text-base--line-height)",
                "--drp-group-gap": "var(--spacing-xs)",
              },
              xl: {
                "--drp-group-padding":
                  "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
                "--drp-group-font-size": "var(--text-lg)",
                "--drp-group-line-height": "var(--text-lg--line-height)",
                "--drp-group-gap": "var(--spacing-sm)",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              width: "100%",
              gap: "var(--drp-group-gap)",
              padding: "var(--drp-group-padding)",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-inset)",
              color: "var(--fg)",
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              "font-size": "var(--drp-group-font-size)",
              "line-height": "var(--drp-group-line-height)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
            },
            states: {
              "[data-hovered]": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              "[data-focus-within]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
                "border-color": "var(--accent)",
                background: "var(--bg-overlay)",
              },
              "[data-invalid]": {
                "border-color": "var(--negative)",
              },
              "[data-disabled]": {
                opacity: "0.38",
                cursor: "not-allowed",
                background: "var(--bg-muted)",
              },
            },
          },
          {
            childSelector: ".react-aria-DateInput",
            bridges: {
              width: "unset",
              "min-width": "unset",
              padding: "unset",
              border: "unset",
              background: "transparent",
              outline: "unset",
              "font-size": "var(--drp-group-font-size)",
            },
            states: {
              "[data-focus-within]": {
                outline: "0px solid transparent",
              },
            },
          },
          {
            childSelector: ".react-aria-DateSegment",
            prefix: "drp-segment",
            variables: {
              xs: {
                "--drp-segment-size": "var(--text-2xs)",
              },
              sm: {
                "--drp-segment-size": "var(--text-xs)",
              },
              md: {
                "--drp-segment-size": "var(--text-sm)",
              },
              lg: {
                "--drp-segment-size": "var(--text-base)",
              },
              xl: {
                "--drp-segment-size": "var(--text-lg)",
              },
            },
            bridges: {
              padding: "0 2px",
              border: "none",
              background: "transparent",
              height: "auto",
              "font-variant-numeric": "tabular-nums",
              "text-align": "end",
              color: "var(--fg)",
              "border-radius": "var(--radius-xs)",
              "font-size": "var(--drp-segment-size)",
              transition: "all 150ms ease",
            },
            states: {
              '[data-type="literal"]': {
                padding: "0",
              },
              "[data-placeholder]": {
                color: "var(--fg-muted)",
                opacity: "0.6",
              },
              ":focus": {
                color: "var(--fg)",
                background: "var(--accent-subtle)",
                outline: "none",
                "border-radius": "var(--radius-xs)",
                "caret-color": "transparent",
              },
              "[data-invalid]": {
                color: "var(--negative)",
              },
              // 2026-06-22 reference 정합(ADR-914 Tier1): reference DateField.css:62-64 의
              //   [data-invalid]:focus 는 solid `--highlight-background-invalid` + `--highlight-foreground`(흰)
              //   = 전경/배경 전체 반전. 기존 15% 반투명 tint + 적색 전경(반전 없음)은 가독성/대비 약화.
              //   filled bg → 전경 동반(on-negative=--color-white) 패턴은 Table 선택행 fix 와 동축.
              //   DateSegment 단일 시각 contract — DateField/DatePicker/DateRangePicker/TimeField 4곳 동일 정합.
              "[data-invalid]:focus": {
                background: "var(--negative)",
                color: "var(--color-white)",
              },
              "[data-disabled]": {
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: '[slot="start"] + span',
            bridges: {
              padding: "0 4px",
              color: "var(--fg-muted)",
            },
          },
          {
            childSelector: '[slot="end"]',
            bridges: {
              flex: "1",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "drp-btn",
            // 트리거 아이콘 크기 = 아이콘 스케일 (dp-btn 과 동일 근거 — 위 DatePicker 주석 참조).
            variables: {
              xs: {
                "--drp-btn-width": "14px",
                "--drp-btn-height": "14px",
              },
              sm: {
                "--drp-btn-width": "16px",
                "--drp-btn-height": "16px",
              },
              md: {
                "--drp-btn-width": "18px",
                "--drp-btn-height": "18px",
              },
              lg: {
                "--drp-btn-width": "22px",
                "--drp-btn-height": "22px",
              },
              xl: {
                "--drp-btn-width": "28px",
                "--drp-btn-height": "28px",
              },
            },
            bridges: {
              background: "transparent",
              color: "var(--fg-muted)",
              "forced-color-adjust": "none",
              border: "none",
              width: "var(--drp-btn-width)",
              height: "var(--drp-btn-height)",
              padding: "0",
              cursor: "default",
              "flex-shrink": "0",
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
            },
            states: {
              "[data-pressed]": {
                "box-shadow": "none",
                background: "var(--bg-muted)",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "2px",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "drp-hint",
            variables: {
              xs: {
                "--drp-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--drp-hint-size": "var(--text-xs)",
              },
              md: {
                "--drp-hint-size": "var(--text-xs)",
              },
              lg: {
                "--drp-hint-size": "var(--text-sm)",
              },
              xl: {
                "--drp-hint-size": "var(--text-sm)",
              },
            },
            bridges: {
              "--error-font-size": "var(--drp-hint-size)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--drp-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  Description: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 fit-content 80 vs CSS 350 실측). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
        },
        // ADR-912 위험군 해소 (선행-6 field/form Description catalog 등록, 2026-06-04):
        //   spec render.shapes 기본 fontWeight=400(Description.spec.ts:111-116, fwRaw 미지정 시 400)
        //   → variant.textWeight=400 명시. 누락 시 catalog 가 default weight 로 drift. Label(600) 과 달리
        //   Description 은 보조 설명 텍스트라 normal weight 400 이 정본.
        textWeight: 400,
      },
    },
    sizes: {
      // lineHeight 보강: catalog generic 의 getLabelLineHeight(fontSize) fallback 과 동일 typography
      //   토큰을 명시 → drift 0 (sm/md: text-xs=12 → text-xs--line-height=16, lg: text-sm=14 →
      //   text-sm--line-height=20). 실측 2026-06-04 (typography.ts:89-90 FONT_SIZE_TO_LINE_HEIGHT).
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "span",
      containerStyles: {
        display: "block",
        width: "100%",
      },
    },
  },
  Dialog: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 (2026-06-16): paddingY/gap 보강 — generated CSS 의 `padding: {Y}px {X}px`
      //   + `gap: {gap}px` 가 rule 에서 emit 되도록(DialogSpec.sizes 미러, paddingX==paddingY).
      //   spec 삭제 후 STRUCTURE_META virtual override 가 동일 padding/gap 재생성 → diff 0.
      // 2026-06-22 reference 정합(ADR-914 Tier1): reference Dialog.css:8 `padding: var(--spacing-10)`
      //   = 40px(단일). composition size variant 체계는 보존하되 md(default)를 reference 40px 에 정합,
      //   xs~xl 을 비례 재설정(16/24/40/48/56). 기존 2~16px 은 dialog content inset 이 5배 부족했음.
      xs: {
        paddingX: 16,
        paddingY: 16,
        gap: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      sm: {
        paddingX: 24,
        paddingY: 24,
        gap: 8,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      md: {
        paddingX: 40,
        paddingY: 40,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      lg: {
        paddingX: 48,
        paddingY: 48,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.2xl}",
        height: 0,
      },
      xl: {
        paddingX: 56,
        paddingY: 56,
        gap: 20,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.2xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "overlay",
      element: "div",
      containerStyles: undefined,
      states: {},
    },
  },
  DialogFooter: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: undefined,
    },
  },
  Disclosure: {
    defaultSize: "md",
    // ADR-151 Phase 6 정정 (2026-07-16): B22 가 추가했던 containerStyles.width="100%" 철회 —
    //   generated Disclosure.css 에는 base width 규칙이 없다 (width:100% 는 DisclosureHeader
    //   의 것 — B22 전제 착오). DOM 정본 = flex 부모에서 fit-content (실측 168.2 vs Skia
    //   강제 350 역방향 발산). block 부모 정합은 §5.5 IFC 주입이 담당 (390=390 유지).
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
        iconSize: 16,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
        iconSize: 20,
      },
    },
    // ADR-912 후속 (2026-06-25): Disclosure generated CSS 는 spec 삭제(4a703828c) 후 virtual emit
    //   대상에서 빠져(structure 부재) stale 고아 파일로 방치 → DOM(stale leaf CSS) ↔ Skia(rule shell)
    //   ↔ 레퍼런스(starter) 3경로 발산. structure 추가로 generate-css buildVirtualSpecs 의 virtual
    //   spec 재생성 대상에 편입 → catalog rule SSOT 단일 소스로 3경로 동시 구동.
    //   레퍼런스 정합(packages/react-aria-starter/src/Disclosure.css):
    //   루트=블록 컨테이너(padding 0), 헤더 버튼=flex+font-weight 600+hover bg, chevron rotate,
    //   패널 콘텐츠 div padding. composition.containerStyles 보유 → compositionOwnsContainerBox=true
    //   로 sizes.padding/height 의 컨테이너 leaf emit skip(이전 inline-flex+center+padding 발산 해소).
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "block",
      },
      states: {
        hover: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        containerStyles: {
          display: "block",
        },
        staticSelectors: {
          ".react-aria-Heading": {
            margin: "0",
            // `<Heading>` 은 `<h3>` 로 렌더돼 **브라우저 기본 h3 font-size(16px)** 를 갖는다 →
            //   `.react-aria-Disclosure[data-size]` 의 font-size 상속 체인을 여기서 끊는다.
            //   아래 trigger 버튼의 `font-size: inherit` 는 **직계 부모**(= 이 Heading)를 따르므로,
            //   Heading 이 먼저 inherit 하지 않으면 버튼이 h3 기본 16px 을 물려받는다
            //   (sm 실측: Disclosure 12px → Heading 16px → Button 16px, 기대 12px).
            "font-size": "inherit",
          },
          // 헤더 trigger 버튼 — starter `.disclosure-button` 정합 (flex + font-weight 600 + hover bg).
          //   composition <Disclosure> 는 <Heading><Button slot="trigger"> 구조라 RAC 기본 .react-aria-Button.
          ".react-aria-Button[slot='trigger']": {
            background: "none",
            border: "none",
            "box-shadow": "none",
            width: "100%",
            color: "var(--fg)",
            "font-weight": "600",
            display: "flex",
            "align-items": "center",
            "text-align": "start",
            // RAC .react-aria-Button 기본 CSS 가 justify-content:center 를 주므로(Button.css:13/25)
            //   명시 flex-start 로 override — starter .disclosure-button(text-align:start, 기본
            //   justify normal=flex-start) 정합. 누락 시 헤더 chevron+title 이 중앙 정렬로 발산.
            "justify-content": "flex-start",
            // RAC `.react-aria-Button` base 가 `font-size: var(--text-sm)`(14) 를 **자기 값으로
            //   선언**해(Button.css:35) 부모 `.react-aria-Disclosure[data-size]` 의 font-size
            //   상속을 차단한다 → trigger 헤더가 전 size 14px 고정(사용자 적발 2026-07-15:
            //   "Disclosure size 변경 시 DisclosureHeader 변경 안 됨(css, skia)").
            //   Skia 는 `DisclosureHeader.sizes.fontSize`(sm 12 / md 14 / lg 16)를 그리므로
            //   sm/lg 에서 DOM↔Skia 비대칭. `inherit` 로 부모 size 폰트를 받는다 — 위
            //   justify-content 와 **동일한 "Button base 가 부모를 덮는다"** 함정.
            //   대칭 근거: `Disclosure.sizes.fontSize` = `DisclosureHeader.sizes.fontSize`
            //   (둘 다 text-xs/text-sm/text-base) → inherit 값이 Skia 가 읽는 값과 일치.
            "font-size": "inherit",
            gap: "var(--spacing-xs)",
            padding: "var(--spacing-sm) var(--spacing-md)",
            "border-radius": "var(--radius-md)",
            transition: "all 200ms",
            outline: "none",
          },
          ".react-aria-Button[slot='trigger'][data-hovered]": {
            background: "var(--bg-muted)",
            color: "var(--fg-emphasis)",
          },
          ".react-aria-Button[slot='trigger'][data-pressed]": {
            background: "var(--bg-muted)",
            scale: "0.97",
          },
          ".react-aria-Button[slot='trigger'][data-focus-visible]": {
            outline: "var(--focus-ring-width) solid var(--focus-ring)",
          },
          // chevron rotate (ADR-141 — 삭제된 spec composition.staticSelectors 복원).
          ".disclosure-chevron": {
            width: "var(--icon-size)",
            height: "var(--icon-size)",
            "flex-shrink": "0",
            fill: "none",
            stroke: "currentColor",
            "stroke-width": "2",
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            rotate: "0deg",
            transition: "rotate 200ms",
          },
          // 패널 콘텐츠 div — starter `.react-aria-DisclosurePanel div { padding }` 정합.
          //   starter 8px 16px = composition --spacing-sm --spacing-lg.
          ".react-aria-DisclosurePanel > div": {
            padding: "var(--spacing-sm) var(--spacing-lg)",
            color: "var(--fg)",
          },
        },
        rootSelectors: {
          "&[data-expanded]": {
            nested: {
              ".disclosure-chevron": {
                rotate: "90deg",
              },
            },
          },
        },
        // generateCompositionCSS 가 comp.delegation 을 무조건 iterate (CSSGenerator:1218) —
        //   composition 보유 시 delegation 필수(빈 배열 허용). 삭제된 spec 도 delegation:[] 였음.
        delegation: [],
      },
    },
  },
  DisclosureContent: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 box+text 변환 군 발효 (2026-06-10): spec render.shapes 기본 fontWeight=400
        //   (DisclosureContent.spec.ts:123) → variant.textWeight=400 명시. 누락 시 buildCatalogShapes
        //   generic default weight 로 drift (Description 동형 — 보조 콘텐츠 normal weight 정본).
        textWeight: 400,
      },
    },
    // lineHeight 보강 (Description 동형): DOM(renderDisclosureContent <div>)은 fontSize 별 CSS
    //   line-height 토큰 상속 / Skia measure 는 rule.sizes.lineHeight 소비 → 동일 typography 토큰
    //   명시로 DOM↔Skia drift 0 (누락 시 measure fontSize*1.5 fallback ↔ DOM 토큰 불일치).
    //   paddingX 는 의도적 미정의(=0) — padding 단일 source = element.props.style (사용자 "spec
    //   기본 padding 제거" 정합, spec sizes.paddingX 12 의 Skia-only 비대칭 해소).
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  DisclosureGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 Phase 6 정정 (2026-07-16): B22 의 containerStyles.width="100%" 철회 —
    //   generated DisclosureGroup.css 에 base width 규칙 없음 (Disclosure 동형 착오).
    //   DOM 정본 = flex 부모에서 fit-content (실측 106.9 vs Skia 강제 350 역방향 발산).
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
    // ADR-912 후속 (2026-06-25): DisclosureGroup generated CSS 도 spec 삭제 후 virtual emit 제외 →
    //   stale 고아. structure 추가로 catalog rule SSOT 파생 복원 (삭제된 DisclosureGroup.spec.ts
    //   composition.layout="flex-column" + containerStyles 그대로 이전 — flex column 컨테이너,
    //   border-radius/overflow:hidden. variant border 는 Skia render.shapes 전용이라 DOM CSS 미emit
    //   유지 = spec 시절 동작 보존, byte-diff 0 목표).
    structure: {
      archetype: "default",
      element: "div",
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        containerStyles: {
          "font-size": "var(--text-base)",
          "border-radius": "var(--radius-md)",
          overflow: "hidden",
        },
        delegation: [],
      },
    },
  },
  DisclosureHeader: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 (B+icon): leading chevron (DisclosureHeader.spec render.shapes 의 chevron-right
        //   이전). color 는 spec 의 {color.neutral-subdued} 보존. gap 6 = spec text x offset(+6).
        leadingIcon: {
          name: "chevron-right",
          gap: 6,
          color: "{color.neutral-subdued}",
        },
      },
    },
    sizes: {
      // ADR-912 (B+icon) cutover 시 md 만 정의 → sm/lg 는 leading_icon primitive 의
      //   round(fontSize*1.1) fallback(sm13/lg18)이 DOM chevron 과 어긋났다.
      // 2026-07-02 CSS cascade 실측 (live getComputedStyle): DOM chevron 은 **전 size 18px 고정**.
      //   Disclosure trigger `<Button slot="trigger">` 는 data-size 를 안 받아 `.react-aria-Button`
      //   기본 `--icon-size: 18px`(Button.css:40)이 적용된다. `.react-aria-Disclosure[data-size]`
      //   --icon-size(14/16/20)는 조상 Heading 까지만 내려오고 Button 이 자기 기본 18 로 재선언해 덮음
      //   → dead. `.disclosure-chevron { width/height: var(--icon-size) }` 가 상속받는 값 = Button 18.
      //   따라서 TagGroup remove X / CalendarHeader chevron 과 동일한 **DOM 고정-크기 컨벤션**(값만 18).
      //   iconSize 전 size 18 통일 → leading_icon glyph = iconSize = 18 로 DOM 18 과 대칭.
      //   fontSize/height/paddingX 는 Skia leaf 메트릭(text baseline·좌표 base) — size 별 유지.
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        // height = line-height 16 + trigger paddingY 8*2 (generated Disclosure.css
        //   `.react-aria-Button[slot='trigger'] padding: var(--spacing-sm) ...` — 전 size 고정 8).
        //   구 28/30/32 는 fontSize 기준 산술로 CSS 실측(32/36/40)과 -4~-8 drift (2026-07-14 sweep).
        height: 32,
        paddingX: 12,
        iconSize: 18,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        // height 36 = line-height 20 + trigger paddingY 8*2. box(height>0)로 판정 → text
        //   baseline:middle + leading icon y=height/2 정렬. iconSize 18 = DOM Button 기본 --icon-size.
        height: 36,
        paddingX: 12,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        // height = line-height 24 + trigger paddingY 8*2.
        height: 40,
        paddingX: 12,
        iconSize: 18,
      },
    },
    // 2026-06-25: factory(NavigationComponents) DisclosureHeader child 가 레퍼런스 정합으로
    //   width:100% + flex(row, justify flex-start, align center) inline 을 주입한다. 이 값들이
    //   catalog rule baseline(resolveCatalogContainerBase → resolveLayoutSpecPreset/resolveSpecPreset)
    //   에 없으면 Style 패널 Transform/Layout reset 버튼이 활성화되고 Modify 내역에 false dirty 로
    //   등록된다(Card 2026-06-24 선례 동형). structure.containerStyles 로 동일 값을 baseline 공급해
    //   factory inline == baseline → dirty 0. element="h3"(헤더 시맨틱), archetype="simple"(삭제된
    //   DisclosureHeader.spec 보존). DOM 은 self-compose 흡수라 generated CSS 미사용(Skia=leadingIcon
    //   leaf) — structure 는 dirty baseline + virtual CSS 재생성 용도.
    structure: {
      archetype: "simple",
      element: "h3",
      containerStyles: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
      },
    },
  },
  DropZone: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          textHover: "{color.accent}",
          border: "{color.border}",
          borderHover: "{color.accent}",
        },
        borderStyle: "dashed",
        textWeight: 400,
      },
    },
    // ADR-912 단계5 step4 Phase 1 batch 2 (2026-06-16): paddingY + gap 보강 (Nav 선례 정렬).
    //   DropZone 은 _hasChildren 컨테이너 — DOM(generated CSS)이 padding 세로축 + gap 을 emit 해야
    //   size 변경 시 자동 추종. paddingY/gap 미보유면 virtual CSS 가 `padding: X 0` + gap 소실 →
    //   diff 발생. spec.sizes 미러(sm 16/8, md 24/12, lg 32/16). Skia/Taffy 컨테이너 배치는 factory
    //   props.style 이 SSOT(ADR-907 Layer B — layout 엔진 rule import 0건), rule 의 paddingY/gap 은
    //   generated CSS emit 전용(Nav 동형).
    sizes: {
      sm: {
        paddingX: 16,
        paddingY: 16,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        borderWidth: 2,
        height: 80,
        iconSize: 24,
      },
      md: {
        paddingX: 24,
        paddingY: 24,
        gap: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: 2,
        height: 120,
        iconSize: 32,
      },
      lg: {
        paddingX: 32,
        paddingY: 32,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        borderWidth: 2,
        height: 160,
        iconSize: 40,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        rootSelectors: {
          "&[data-drop-target]": {
            styles: {
              background: "var(--bg-inset)",
              color: "var(--accent)",
            },
          },
        },
        delegation: [],
      },
    },
  },
  Field: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
    },
  },
  FieldError: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          // 에러 메시지 — negative(빨강) 텍스트. Description(neutral-subdued)/Label(neutral) 과 색만 다름.
          text: "{color.negative}",
        },
        // ADR-912 위험군 해소 (선행-6 field/form FieldError catalog 등록, 2026-06-04):
        //   spec render.shapes 기본 fontWeight=400(FieldError.spec.ts:106-111, fwRaw 미지정 시 400)
        //   → variant.textWeight=400 명시. 누락 시 catalog 가 default weight(500) 로 drift.
        //   FieldError 는 보조 에러 텍스트라 normal weight 400 이 정본(Description 동형).
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 선행-6 (2026-06-04): height 를 0 으로 정본화 (spec sizes 14/16/20 → 0).
      //   buildCatalogShapes 의 isInlineText=(size.height===0 && !hasOpaqueBg) 게이트가 height>0 이면
      //   box 텍스트(baseline middle/align center)로 그려 spec render.shapes(baseline top/align left)와
      //   drift. Description/Label 과 동일하게 height:0 → isInlineText=true(top/left) 정렬 정합.
      //   measure(부모 height 분기 utils.ts:2298-2308)는 childStyle.height/lineHeight 를 읽고 rule
      //   height 미참조 → height:0 변경은 측정 무영향(spec render.shapes 도 size.height 미사용).
      // lineHeight 보강: catalog generic 의 getLabelLineHeight(fontSize) fallback 과 동일 typography
      //   토큰을 명시 → drift 0 (sm/md: text-xs=12 → text-xs--line-height=16, lg: text-sm=14 →
      //   text-sm--line-height=20). 실측 2026-06-04 (typography.ts:89-90 FONT_SIZE_TO_LINE_HEIGHT).
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  FileTrigger: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent-hover}",
            pressed: "{color.accent-pressed}",
          },
        },
        colors: {
          text: "{color.on-accent}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (FileTrigger.spec.sizes 미러). padding 은 composition.containerStyles inline-block
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만). iconSize 는 이미 존재.
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 32,
        gap: 6,
        iconSize: 14,
      },
      md: {
        paddingX: 24,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 40,
        gap: 8,
        iconSize: 16,
      },
      lg: {
        paddingX: 32,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 48,
        gap: 10,
        iconSize: 20,
      },
    },
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      states: {
        hover: {},
        pressed: {
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
        },
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        containerStyles: {
          display: "inline-block",
        },
        staticSelectors: {
          "input[type='file']": {
            position: "absolute",
            width: "1px",
            height: "1px",
            padding: "0",
            margin: "-1px",
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            "white-space": "nowrap",
            border: "0",
          },
        },
        delegation: [],
      },
    },
  },
  Form: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      outlined: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (Form.spec.sizes 미러). padding 은 composition.layout=flex-column + containerStyles
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 12,
      },
      md: {
        paddingX: 20,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        gap: 16,
      },
      lg: {
        paddingX: 28,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
        gap: 20,
      },
      xl: {
        paddingX: 36,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.2xl}",
        height: 0,
        gap: 24,
      },
    },
    structure: {
      archetype: "default",
      element: "form",
      containerStyles: undefined,
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {},
      },
      composition: {
        layout: "flex-column",
        gap: "16px",
        containerStyles: {
          "align-items": "start",
          "--form-label-width": "auto",
          "--form-label-align": "start",
          "--form-field-gap": "var(--spacing-md)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "--form-label-width": "11rem",
              },
            },
          },
          "label-align": {
            center: {
              styles: {
                "--form-label-align": "center",
              },
            },
            end: {
              styles: {
                "--form-label-align": "end",
              },
            },
          },
        },
        delegation: [],
      },
    },
  },
  FormField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: undefined,
    },
  },
  frame: {
    defaultSize: "md",
    variants: {},
    sizes: {
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  GridList: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: 0,
      },
    },
  },
  /* ADR-913 slice 4 (2026-06-19): selected 카드 accent border — GridListItem rule colors 에
     selectedBorder 공급 → gridListCard(skiaPrimitives) 가 isSelected 시 visual.selectedBorder
     소비. DOM(builder GridList.css [data-selected] accent 2px)과 대칭. schema 기존 보유. */
  GridListItem: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-912 Phase 3-A-3b (2026-06-20): collection-item base-axis 를 catalog SSOT 로 도달.
    //   카드 컨테이너 flex-column layout(권위 source = starter GridList.css:112
    //   `.react-aria-GridListItem { display:flex; flex-direction:column; min-width:0 }`).
    //   gap 은 sizes.md.gap(2) 경유라 containerStyles 에 중복 미선언. implicitStyles
    //   gridlistitem 분기 인라인(display/flexDirection/minWidth)을 본 source 로 대체.
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      },
    },
    // ADR-912 collection sub-part cutover (2026-06-14, TreeItem escape 선례 동형):
    //   GridListItem.spec.render.shapes(카드 box layer-1 + border + label fw600 +
    //   description neutral-subdued)를 rule + buildCatalogShapes(box+label) +
    //   card_description skiaPrimitive(append, 2번째 줄)로 이전. 카드 box border 는
    //   colors.border(TableRow 와 달리 GridListItem 은 카드 테두리 의도됨).
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          // ADR-913 slice 4: selected 카드 테두리 (DOM [data-selected] accent 정합).
          selectedBorder: "{color.accent}",
        },
        // 카드 label 굵기 (spec fontWeight 600). buildCatalogShapes 가 visual.textWeight 소비.
        textWeight: 600,
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.lg}",
        // height 0 = content-fit (카드 시각 = label + description 합산 + padding).
        height: 0,
        // spec.sizes.md 이전: paddingX 16 / paddingY 12 (수동 CSS spacing-md/lg 정합).
        paddingX: 16,
        paddingY: 12,
        // label↔description 수직 간격 (spec gap 2 + descGap, card_description 이 소비).
        gap: 2,
        borderWidth: 1,
      },
    },
  },
  Group: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  // ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 삭제 — Section Header 시각 SSOT.
  //   paddingX/paddingY/fontWeight 보강(구 HeaderSpec.sizes 미러). 현재 CSS source 는 ListBox.spec
  //   inline child spec(childSpecs emit); 본 rule 은 SSOT 정합용(향후 rule 직접 source 전환 대비).
  Header: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 12,
        paddingY: 4,
        fontWeight: 700,
      },
      md: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 12,
        paddingY: 6,
        fontWeight: 700,
      },
      lg: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 16,
        paddingY: 8,
        fontWeight: 700,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        position: "sticky",
        background: "{color.raised}",
        text: "{color.neutral-subdued}",
      },
      states: {},
    },
  },
  Heading: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 Skia 80 vs CSS 350 실측). layout fallback
    //   채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // 2026-06-24: textWeight 700 → 600 (Heading 시각 정본 정합). standalone/Toast/Card/Dialog
        //   Heading factory inline 이 fontWeight 600 으로 일관(4곳) — Skia(style.fontWeight 600 우선)
        //   ·CSS(inline 600) 둘 다 600 렌더라 catalog 700 은 dead 였고, dirty baseline 만 700 으로
        //   잡혀 false dirty. 600 흡수로 baseline=시각 정본. InlineAlert Heading 은 InlineAlert.sizes
        //   .headingFontWeight=700 별도 경로(StoreRenderBridge/fullTreeLayout)라 무영향.
        //   (이전: buildCatalogShapes fallback 500 drift 차단용 700 명시 — 정본 재판정으로 600)
        textWeight: 600,
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "2xl": {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "3xl": {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
    },
  },
  Icon: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 16,
        iconSize: 16,
      },
      sm: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 18,
        iconSize: 18,
      },
      md: {
        fontSize: "{typography.text-2xl}",
        borderRadius: "{radius.none}",
        height: 24,
        iconSize: 24,
      },
      lg: {
        fontSize: "{typography.text-4xl}",
        borderRadius: "{radius.none}",
        height: 36,
        iconSize: 36,
      },
      xl: {
        fontSize: "{typography.text-5xl}",
        borderRadius: "{radius.none}",
        height: 48,
        iconSize: 48,
      },
    },
    structure: {
      archetype: "simple",
      element: "span",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
        },
        focusVisible: {},
      },
    },
  },
  IllustratedMessage: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-16): IllustratedMessage.spec.ts catalog cutover 삭제 대비 —
    //   paddingX/paddingY/gap (root padding + 자식 간격) + headingFontSize (.alert-heading 자식 CSS)
    //   를 rule.sizes 로 보강. alert archetype(composition 없음 → padding emit). generate-css virtual
    //   이 spec.sizes 대신 본 rule 에서 동일 CSS 재생성 (diff 0).
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: "auto",
        paddingX: 16,
        paddingY: 16,
        gap: 8,
        headingFontSize: "{typography.text-base}",
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: "auto",
        paddingX: 24,
        paddingY: 24,
        gap: 12,
        headingFontSize: "{typography.text-lg}",
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: "auto",
        paddingX: 32,
        paddingY: 32,
        gap: 16,
        headingFontSize: "{typography.text-xl}",
      },
    },
    structure: {
      archetype: "alert",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      },
      states: {},
    },
  },
  Image: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 120,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 200,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 320,
      },
    },
  },
  InlineAlert: {
    defaultVariant: "info",
    defaultSize: "md",
    variants: {
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.neutral-subdued}",
        },
      },
      info: {
        fill: {
          default: {
            base: "{color.informative-subtle}",
            hover: "{color.informative-subtle}",
            pressed: "{color.informative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.informative}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.positive-subtle}",
            hover: "{color.positive-subtle}",
            pressed: "{color.positive-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.positive}",
        },
      },
      notice: {
        fill: {
          default: {
            base: "{color.notice-subtle}",
            hover: "{color.notice-subtle}",
            pressed: "{color.notice-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.notice}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative-subtle}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): InlineAlert spec 삭제 대비 containerStyles 보충.
    //   factory createDefaultInlineAlertProps()={} 라 InlineAlert 컨테이너 base layout 이 100%
    //   spec.containerStyles 의존 → spec 삭제 시 resolveContainerStylesFallback("inlinealert")가
    //   {} 반환 → Skia/Taffy flexDirection:column 소실(자식 Heading/Description 가로 배치 회귀,
    //   DOM generated CSS 는 flex/column emit → D3 대칭 위반). builder LOWERCASE_COMPONENT_RULE_CONTAINER
    //   fallback 이 본 필드를 읽어 복구(ListBox/Menu/TagGroup 동형). STRUCTURE_META.containerStyles(CSS emit)와
    //   별개 역할 — 둘 다 동일 4필드 보유 필수.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      width: "100%",
    },
    sizes: {
      // ADR-912 단계5 step4 (2026-06-17): InlineAlert spec 삭제 대비 sizes 보충.
      //   paddingY/gap = generated CSS base block(`padding`/`gap`) emit + layout consumer
      //   (implicitStyles/StoreRenderBridge/fullTreeLayout) resolveSkiaRule read-through.
      //   headingFontSize/headingFontWeight/descFontSize/descFontWeight = `.alert-heading` +
      //   `.react-aria-Description` 자식 CSS emit (CSSGenerator.generateChildFontStyles).
      //   accentWidth(3/4/4)는 generated CSS/Skia 미emit dead 필드 → 미이관.
      sm: {
        paddingX: 8,
        paddingY: 8,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: "auto",
        headingFontSize: 14,
        headingFontWeight: 700,
        descFontSize: 12,
        descFontWeight: 400,
      },
      md: {
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: "auto",
        headingFontSize: 16,
        headingFontWeight: 700,
        descFontSize: 14,
        descFontWeight: 400,
      },
      lg: {
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: "auto",
        headingFontSize: 18,
        headingFontWeight: 700,
        descFontSize: 16,
        descFontWeight: 400,
      },
    },
    structure: {
      archetype: "alert",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        width: "100%",
      },
      states: {},
    },
  },
  Input: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          borderHover: "{color.border-hover}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
          borderHover: "{color.accent-hover}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
          borderHover: "{color.negative-hover}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 (2026-06-17): paddingY/gap 보강 — InputSpec.spec 삭제 대비
      //   generate-css virtual emit(padding: {paddingY}px {paddingX}px + gap)이 기존 Input.css
      //   (padding 1px 4px~12px 24px / gap 2~10) byte-identical 재현하려면 필수. InputSpec.sizes 미러.
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        paddingX: 4,
        paddingY: 1,
        gap: 2,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        paddingX: 8,
        paddingY: 2,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        paddingX: 12,
        paddingY: 4,
        gap: 6,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        paddingX: 16,
        paddingY: 8,
        gap: 8,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        paddingX: 24,
        paddingY: 12,
        gap: 10,
      },
    },
  },
  Kbd: {
    defaultVariant: "default",
    defaultSize: "sm",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.neutral-pressed}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
        // ADR-912 위험군 해소(2026-06-04): Kbd catalog 측정/렌더 drift 차단. spec render.shapes
        //   fontFamily.mono + fontWeight 500(키 표시 약간 굵게, Kbd.spec L153) ↔ buildCatalogShapes
        //   fallback sans/500. fontFamily(mono) 명시 + textWeight 500(spec 일치).
        fontFamily: "JetBrains Mono, Consolas, monospace",
        textWeight: 500,
      },
    },
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.xs}",
        borderWidth: 1,
        height: 18,
      },
      sm: {
        paddingX: 6,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 22,
      },
      md: {
        paddingX: 8,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 26,
      },
      lg: {
        paddingX: 10,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 32,
      },
    },
    structure: {
      archetype: "simple",
      element: "kbd",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  Label: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 위험군 해소(선행-6, 2026-06-04): Label catalog 측정/렌더 fontWeight drift 차단.
        //   buildCatalogShapes fallback 500 ↔ Label spec render.shapes 600(Label.spec L130-134
        //   기본값) → variant.textWeight=600 명시(TEXT_LEAF Text 선례 동형). 누락 시 catalog
        //   전환으로 Label 이 600→500 가늘어짐.
        textWeight: 600,
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  Link: {
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      primary: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.accent}",
          textHover: "{color.accent-hover}",
        },
      },
      secondary: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
          textHover: "{color.accent}",
        },
      },
    },
    sizes: {
      // ADR-151 B4 (2026-07-16): lineHeight 토큰 pair 명시 — 미정의 시 DOM 은 상속 1.5(md 21px),
      //   Skia layout 은 estimateTextHeight fallback(md 16px) 으로 3자 발산. Description/Button 동형.
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    textDecoration: "underline",
    structure: {
      archetype: "button",
      element: "a",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      composition: {
        rootSelectors: {
          "&": {
            styles: {
              "text-decoration": "underline",
            },
          },
          "&[data-hovered]": {
            styles: {
              "text-decoration-thickness": "1.5px",
            },
          },
        },
        delegation: [],
      },
    },
  },
  ListBox: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.raised}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.raised}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): ListBox.spec.containerStyles 의 layout primitive 8필드 이관
    //   (Menu/TagGroup 선례). spec 삭제 후 builder resolveContainerStylesFallback 의 catalog 합성이
    //   본 필드를 읽어 Skia/Taffy layout(column-flex/gap/padding/maxHeight)을 보강 — 누락 시
    //   resolveContainerStylesFallback("listbox") 가 {} 반환 → column-flex 붕괴(DOM 정상=비대칭 회귀).
    //   색상(background/border)은 fallback KEYS 비대상 → Skia render shell variant 가 담당. gap 은
    //   spec `{spacing.2xs}`(=2), padding 은 `{spacing.xs}`(=4) 동일.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      gap: "{spacing.2xs}",
      padding: "{spacing.xs}",
      width: "100%",
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
    },
    sizes: {
      md: {
        paddingX: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        background: "{color.raised}",
        text: "{color.neutral}",
        border: "{color.border}",
        borderWidth: 1,
        borderRadius: "{radius.lg}",
        padding: "{spacing.xs}",
        gap: "{spacing.2xs}",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  ListBoxItem: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-912 collection sub-part cutover (2026-06-14, gridlist_card escape 선례 동형):
    //   ListBoxItem.spec.render.shapes(selection/hover row-bg + icon + label fw600 +
    //   description neutral-subdued + check)를 rule + listbox_item skiaPrimitive(replace)로
    //   이전. 기본 행은 배경 없음(transparent) — selection(accent-subtle)/hover(layer-1)만
    //   row-bg 그림(escape 가 props.isSelected/state 보편 축으로 판정).
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.layer-1}",
            selected: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // label 굵기 (spec fontWeight 600).
        textWeight: 600,
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.xs}",
        // height 0 = content-fit (행 시각 = label(+description) + padding).
        height: 0,
        // minHeight 미정의 (2026-07-22): CSS `min-height: 20px` 는 flex column collection item 의
        //   자동 min-content(= min-height:auto) 보호를 덮어써, 컨테이너 고정 높이일 때 각 item 이 내용
        //   (label+description) 아래로 축소·겹치고 scrollHeight 가 clientHeight 를 못 넘겨 스크롤이 안 생김.
        //   Skia resolveListBoxItemRowHeight 는 element style.minHeight ?? 20 을 읽어(catalog 미참조)
        //   무회귀. min-content(≥ line-height 20)가 이미 하한 역할이라 명시 floor 불필요.
        // label 두께 (spec.sizes.md.fontWeight 600 — semibold). generate-css virtual 이
        //   `font-weight: 600` emit (기존 generated childSpec block 동형 복원). 수동 ListBox.css
        //   `[slot="label"] { font-weight: 600 }` 와 중복이나 description slot 상속분까지 보장.
        fontWeight: 600,
        // spec.sizes.md 이전: paddingX 12 / paddingY 4 (수동 CSS spacing-md/sm 정합).
        paddingX: 12,
        paddingY: 4,
        // label↔description 수직 간격 (spec gap 2).
        gap: 2,
        // selection indicator / icon glyph 크기 (spec iconSize 16).
        iconSize: 16,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
      },
      states: {
        hover: {
          background: "{color.layer-1}",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
      },
    },
  },
  Menu: {
    defaultVariant: "primary",
    defaultSize: "md",
    variants: {
      accent: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent-hover}",
            pressed: "{color.accent-pressed}",
          },
        },
        colors: {
          text: "{color.on-accent}",
          border: "{color.accent}",
          borderHover: "{color.accent-hover}",
        },
      },
      primary: {
        fill: {
          default: {
            base: "{color.neutral}",
            hover: "{color.neutral-hover}",
            pressed: "{color.neutral-pressed}",
          },
        },
        colors: {
          text: "{color.base}",
          border: "{color.neutral}",
          borderHover: "{color.neutral-hover}",
        },
      },
      secondary: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative}",
            hover: "{color.negative-hover}",
            pressed: "{color.negative-pressed}",
          },
        },
        colors: {
          text: "{color.on-negative}",
          border: "{color.negative}",
          borderHover: "{color.negative-hover}",
        },
      },
      premium: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple-hover}",
            pressed: "{color.purple-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
          border: "{color.purple}",
          borderHover: "{color.purple-hover}",
        },
      },
      genai: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple-hover}",
            pressed: "{color.purple-pressed}",
          },
        },
        colors: {
          text: "{color.white}",
          border: "{color.purple}",
          borderHover: "{color.purple-hover}",
        },
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): Menu.spec.containerStyles 의 layout primitive 8필드 이관
    //   (ListBox 동형). Menu.spec 은 별도 세션(a53cc0f5c)에서 삭제됐으나 rule containerStyles 보충이
    //   누락 → resolveContainerStylesFallback("menu") 가 {} 반환 → column-flex 붕괴(Skia/Taffy 만,
    //   DOM 은 generated Menu.css 정상 = 비대칭 회귀). builder resolveContainerStylesFallback 의
    //   LOWERCASE_COMPONENT_RULE_CONTAINER catalog 합성이 본 필드를 layout 보강으로 읽음. 색상
    //   (background/border)은 fallback KEYS 비대상 → Skia render shell variant 담당. gap 은
    //   spec `{spacing.2xs}`(=2), padding 은 `{spacing.xs}`(=4). CSS emit 무관(STRUCTURE_META Menu
    //   entry 의 containerStyles 만 emit → generated Menu.css diff-0).
    // ADR-151 B7 (2026-07-16 사용자 결정): 캔버스 Menu 표현 = 트리거 버튼 통일 — top-level
    //   containerStyles(layout 채널)를 구 목록 panel 메트릭(flex/column/gap2/pad4/width:100%/
    //   maxH300/overflow)에서 트리거 박스(fit-content)로 전환. DOM 목록 panel 규칙은 structure
    //   채널(generated Menu.css)이라 무변. DOM 캔버스 표현은 MenuTrigger 버튼(fit-content×30).
    containerStyles: {
      display: "inline-flex",
      alignItems: "center",
      width: "fit-content",
    },
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        borderWidth: 1,
        height: 0,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        background: "{color.raised}",
        text: "{color.neutral}",
        border: "{color.border}",
        borderWidth: 1,
        borderRadius: "{radius.md}",
        padding: "{spacing.xs}",
        gap: "{spacing.2xs}",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxHeight: "300px",
        overflow: "auto",
        outline: "none",
      },
      states: {
        hover: {},
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
    },
  },
  MenuItem: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 24,
        paddingX: 9,
        paddingY: 2,
        gap: 6,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        height: 32,
        paddingX: 12,
        paddingY: 4,
        gap: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        height: 40,
        paddingX: 15,
        paddingY: 8,
        gap: 10,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        height: 48,
        paddingX: 18,
        paddingY: 12,
        gap: 12,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {
          background: "{color.layer-1}",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
    },
  },
  Meter: {
    defaultVariant: "informative",
    defaultSize: "md",
    // ADR-913 동형: label-position:side (Skia resolveActiveContainerVariants 소비 — 부모 flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 order 는 implicitStyles.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    variants: {
      informative: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      warning: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      critical: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 4,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 8,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: 12,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.lg}",
        height: 16,
        gap: 4,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label value" "bar bar"',
        gridTemplateColumns: "1fr auto",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {},
      },
      composition: {
        layout: "grid",
        containerStyles: {
          "box-sizing": "border-box",
          "row-gap": "var(--spacing-xs)",
          "column-gap": "var(--spacing-md)",
          width: "100%",
          color: "var(--fg)",
          "font-size": "var(--text-sm)",
          "--label-font-size": "var(--text-sm)",
          "--fill-color": "var(--color-info-600)",
        },
        staticSelectors: {
          ".react-aria-Label": {
            "grid-area": "label",
            "white-space": "nowrap",
          },
          ".value": {
            "grid-area": "value",
            "font-size": "var(--text-sm)",
            color: "var(--fg-muted)",
            "white-space": "nowrap",
          },
          ".bar": {
            "grid-area": "bar",
            "box-shadow": "var(--inset-shadow-xs)",
            "forced-color-adjust": "none",
            height: "var(--spacing-sm)",
            "border-radius": "var(--radius-sm)",
            overflow: "hidden",
            background: "var(--accent-subtle)",
          },
          ".fill": {
            background: "var(--fill-color)",
            height: "100%",
            transition: "width 200ms ease-out",
            "forced-color-adjust": "auto",
          },
        },
        containerVariants: {
          // ADR-913 동형: label-position:side — progress 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간, value 끝) + track flex:1. Skia 자식 order 는
          //   implicitStyles ProgressBar/Meter 분기가 동일 값 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                { selector: ".bar", styles: { order: "1", flex: "1" } },
                { selector: ".value", styles: { order: "2" } },
              ],
            },
          },
          variant: {
            informative: {
              styles: {
                "--fill-color": "var(--color-info-600)",
              },
            },
            positive: {
              styles: {
                "--fill-color": "var(--color-green-600)",
              },
            },
            warning: {
              styles: {
                "--fill-color": "var(--color-warning-600)",
              },
            },
            critical: {
              styles: {
                "--fill-color": "var(--negative)",
              },
            },
          },
          size: {
            sm: {
              styles: {
                "--label-font-size": "var(--text-xs)",
              },
            },
            md: {
              styles: {
                "--label-font-size": "var(--text-sm)",
              },
            },
            lg: {
              styles: {
                "--label-font-size": "var(--text-base)",
              },
            },
            xl: {
              styles: {
                "--label-font-size": "var(--text-lg)",
              },
            },
          },
          disabled: {
            true: {
              styles: {
                opacity: "0.38",
                cursor: "not-allowed",
                "pointer-events": "none",
              },
            },
          },
        },
        sizeSelectors: {
          sm: {
            ".bar": {
              height: "var(--spacing-xs)",
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-xs)",
            },
          },
          md: {
            ".bar": {
              height: "var(--spacing-sm)",
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-sm)",
            },
          },
          lg: {
            ".bar": {
              height: "var(--spacing-md)",
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-base)",
            },
          },
          xl: {
            ".bar": {
              height: "var(--spacing-lg)",
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        delegation: [],
      },
    },
  },
  MeterTrack: {
    defaultVariant: "informative",
    defaultSize: "md",
    variants: {
      // ADR-912 선행-2: track 배경(fill.base = neutral-subtle) 위에 value_fill_bar escape 가
      //   variant 별 fillBar 색으로 진행 막대를 덧그린다(Meter 상태 색 — METER_FILL_COLORS 정합).
      informative: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        fillBar: "{color.informative}",
      },
      positive: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        fillBar: "{color.positive}",
      },
      warning: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        fillBar: "{color.notice}",
      },
      critical: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        fillBar: "{color.negative}",
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 16,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {},
      },
    },
  },
  MeterValue: {
    defaultVariant: "informative",
    defaultSize: "md",
    variants: {
      informative: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      warning: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      critical: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.none}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.none}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.none}",
        height: 24,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.none}",
        height: 28,
      },
    },
    structure: {
      archetype: "progress",
      element: "output",
      containerStyles: {
        display: "grid",
      },
    },
  },
  Modal: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {
        paddingX: 24,
        // ADR-912 단계5 step4 small-B (2026-06-16): paddingY/gap 보강 — spec 삭제 후 generated CSS
        //   `padding: 24px 24px` + `gap: 8px` 재생성용 (ruleSizeToSizeSpec paddingY 기본 0/gap 미emit
        //   회피, Nav/DropZone 선례). layout 컨테이너 배치 SSOT 는 factory props.style(ADR-907 Layer B).
        paddingY: 24,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "overlay",
      element: "div",
      // 2026-07-25 overlay elevation SSOT: **Modal 이 모달 elevation 을 소유**한다.
      //   근거 = RAC starter `Modal.css` (`box-shadow: 0 8px 32px rgba(0 0 0 / .2)`) +
      //   `Dialog.css` 그림자 부재 — Dialog 는 Modal 안이라 자체 elevation 이 불필요.
      //   기존 `overlays.css` 선언은 `var(--drop-shadow-md)`(= drop-shadow() **filter 함수**)
      //   를 box-shadow 에 쓴 타입 오용이라 계산값이 `none` 으로 죽어 있었다(live 실측).
      //   ADR-166 Phase 2: 값 언어를 TokenRef 로 통일. 구 `0 8px 32px color-mix(--fg 20%)` 는
      //   ① Skia 파서가 `color-mix(` 를 못 읽고 ② dark 에서 `--fg` 가 밝아져 그림자가 흰 후광이
      //   됐다. `{shadow.lg}` = SP2 `dragged`. **elevation 서열 (Tooltip < Popover < Modal) 은
      //   sm < md < lg 로 그대로 보존**되나, blur 32 는 Spectrum 이 발행하는 어느 값보다 넓어
      //   대응이 없다 — Modal 그림자가 눈에 띄게 옅어진다(잉크 ×0.62, Gate G2 제시 대상).
      containerStyles: {
        boxShadow: "{shadow.lg}",
      },
      states: {},
    },
  },
  Nav: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        paddingX: 12,
        paddingY: 8,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 48,
      },
      md: {
        paddingX: 16,
        paddingY: 12,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 56,
      },
      lg: {
        paddingX: 20,
        paddingY: 16,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 64,
      },
    },
    structure: {
      archetype: "default",
      element: "nav",
      containerStyles: undefined,
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
    },
  },
  NumberField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (NumberField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        gap: 2,
        iconSize: 10,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        gap: 4,
        iconSize: 14,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        gap: 6,
        iconSize: 18,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        gap: 8,
        iconSize: 22,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        gap: 10,
        iconSize: 28,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField 동형). 기존 grid 정의는 CSS 만 grid 였고 Skia getSideLabelParentStyle 은 flex-row
    //   시뮬레이션이라 CSS↔Skia 비대칭이었다(+ factory inline flexDirection:column 이 CSS specificity
    //   로 grid selector 를 이겨 실제로는 양쪽 다 column 으로 무력화). flex-row 로 통일하면 generated
    //   CSS = Skia(getSideLabelParentStyle) 대칭 + Label fit-content 옆 정렬. Skia 는 styles 만 사용
    //   (nested DOM selector 는 generated CSS 전용 제외).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          disabled: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Group",
                  styles: {
                    background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                    "border-color":
                      "color-mix(in srgb, var(--fg) 12%, transparent)",
                    opacity: "0.38",
                  },
                },
              ],
            },
          },
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Group",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled])) .react-aria-Group",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Button[data-hovered]:not([data-disabled])) .react-aria-Group",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-focused]:not([data-disabled])) .react-aria-Group",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Input[data-focus-within]:not([data-disabled])) .react-aria-Group",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    "&:has(.react-aria-Button[data-focus-visible]:not([data-disabled])) .react-aria-Group",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: "&[data-invalid] .react-aria-Group",
                  styles: {
                    "border-color": "transparent",
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "nf-label",
            variables: {
              xs: {
                "--nf-label-size": "var(--text-2xs)",
              },
              sm: {
                "--nf-label-size": "var(--text-xs)",
              },
              md: {
                "--nf-label-size": "var(--text-sm)",
              },
              lg: {
                "--nf-label-size": "var(--text-base)",
              },
              xl: {
                "--nf-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--nf-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".react-aria-Group",
            prefix: "nf-group",
            bridges: {
              display: "flex",
              "align-items": "center",
              gap: "var(--spacing-xs)",
              width: "100%",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-inset)",
              overflow: "hidden",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
              padding:
                "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
            },
            states: {
              ":has(.react-aria-Input[data-hovered]:not([data-focused]):not([data-disabled]))":
                {
                  "border-color": "var(--border-hover)",
                  background: "var(--bg-overlay)",
                },
              ":has(.react-aria-Button[data-hovered]:not([data-disabled]))": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              ":has(.react-aria-Input[data-focused])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has(.react-aria-Input[data-focus-within])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has(.react-aria-Button[data-focus-visible])": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              ":has([data-invalid])": {
                "border-color": "var(--negative)",
              },
            },
          },
          {
            childSelector: ".react-aria-Input",
            prefix: "nf-input",
            variables: {
              xs: {
                "--nf-input-font-size": "var(--text-2xs)",
                "--nf-input-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--nf-input-font-size": "var(--text-xs)",
                "--nf-input-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--nf-input-font-size": "var(--text-sm)",
                "--nf-input-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--nf-input-font-size": "var(--text-base)",
                "--nf-input-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--nf-input-font-size": "var(--text-lg)",
                "--nf-input-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              flex: "1 1 auto",
              "min-width": "0",
              border: "none",
              "border-radius": "0",
              background: "transparent",
              outline: "none",
              "forced-color-adjust": "none",
              padding: "0",
              "font-size": "var(--nf-input-font-size)",
              "line-height": "var(--nf-input-line-height)",
              "--input-padding": "0",
              "--input-font-size": "var(--nf-input-font-size)",
              "--input-line-height": "var(--nf-input-line-height)",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "nf-btn",
            variables: {
              xs: {
                "--nf-btn-size": "10px",
                "--nf-btn-icon-size": "10px",
              },
              sm: {
                "--nf-btn-size": "14px",
                "--nf-btn-icon-size": "12px",
              },
              md: {
                "--nf-btn-size": "18px",
                "--nf-btn-icon-size": "16px",
              },
              lg: {
                "--nf-btn-size": "22px",
                "--nf-btn-icon-size": "18px",
              },
              xl: {
                "--nf-btn-size": "28px",
                "--nf-btn-icon-size": "22px",
              },
            },
            bridges: {
              position: "static",
              flex: "0 0 auto",
              padding: "0",
              border: "none",
              "border-radius": "var(--radius-xs)",
              width: "var(--nf-btn-size)",
              height: "var(--nf-btn-size)",
              "min-width": "unset",
              "min-height": "unset",
              background: "var(--bg-overlay)",
              color: "var(--fg)",
              "forced-color-adjust": "none",
              "box-shadow": "var(--shadow-sm)",
            },
            states: {
              "[data-hovered]:not([data-disabled])": {
                background: "var(--accent-subtle)",
              },
              "[data-pressed]:not([data-disabled])": {
                background:
                  "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "2px",
              },
              "[data-disabled]": {
                background: "color-mix(in srgb, var(--fg) 12%, transparent)",
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-Button svg",
            bridges: {
              width: "var(--nf-btn-icon-size)",
              height: "var(--nf-btn-icon-size)",
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "nf-hint",
            variables: {
              xs: {
                "--nf-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--nf-hint-size": "var(--text-xs)",
              },
              md: {
                "--nf-hint-size": "var(--text-xs)",
              },
              lg: {
                "--nf-hint-size": "var(--text-sm)",
              },
              xl: {
                "--nf-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--nf-hint-size)",
              "--error-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--nf-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  Pagination: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent-hover}",
            pressed: "{color.accent-pressed}",
          },
        },
        colors: {
          text: "{color.on-accent}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 28,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 36,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 44,
      },
    },
    structure: {
      archetype: "default",
      element: "nav",
      containerStyles: undefined,
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
      composition: {
        containerStyles: {
          "--btn-radius": "var(--radius-md)",
          "--btn-font-size": "var(--text-base)",
          "--btn-transition": "background-color 200ms, opacity 200ms",
        },
        staticSelectors: {
          ".pagination-controls": {
            display: "flex",
            "align-items": "center",
            gap: "6px",
          },
          ".pagination-info": {
            "font-size": "var(--text-base)",
            color: "var(--fg-muted)",
            "text-align": "center",
          },
          ".pagination-ellipsis": {
            color: "var(--fg-muted)",
          },
          '.react-aria-Button[data-current="true"]': {
            "background-color": "var(--accent)",
            color: "var(--fg-on-accent)",
          },
          '.react-aria-Button:not([data-current="true"])': {
            "background-color": "var(--bg-overlay)",
            color: "var(--fg)",
          },
          '.react-aria-Button:not([data-current="true"]):hover:not(:disabled)':
            {
              "background-color":
                "color-mix(in srgb, var(--bg-overlay) 92%, black)",
            },
          ".react-aria-Button:disabled": {
            opacity: "0.38",
          },
        },
        delegation: [],
      },
    },
  },
  Paragraph: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 B22 잔여 (2026-07-16): Text 동형 — generated CSS base `width: 100%` 를
    //   layout 이 미소비 (flex 부모에서 fit-content 80 vs CSS 350 실측). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 위험군 해소(2026-06-04): Paragraph spec render.shapes fontWeight 400 ↔
        //   buildCatalogShapes fallback 500 drift 차단. variant.textWeight=400 명시.
        textWeight: 400,
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "2xl": {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "3xl": {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
    },
  },
  Popover: {
    defaultVariant: "surface",
    defaultSize: "md",
    variants: {
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.neutral-subtle}",
        },
      },
      surface: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 Popover 단건 (2026-06-16): paddingY/gap 보강 —
      //   Popover.spec.ts 삭제 대비 generated Popover.css(padding: NNpx NNpx / gap: NNpx) diff-0 유지.
      //   값은 (구) PopoverSpec.sizes 와 동일 (paddingX==paddingY, gap sm:8/md:12/lg:16).
      sm: {
        paddingX: 12,
        paddingY: 12,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      lg: {
        paddingX: 20,
        paddingY: 20,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "overlay",
      element: "div",
      // 2026-07-25: overlay elevation 정본 이관. 값은 수동 `Popover.css` 의 실효값
      //   (index.css 로드 순서상 마지막이라 승리하던 선언) 그대로 — 시각 불변.
      //   **Why**: 그림자 정본이 수동 CSS 에만 있어 catalog 를 읽는 Style Panel 이
      //   Appearance → Box Shadow 를 "none" 으로 표시했다(D3 위반 — 수동 CSS 독립 정의).
      //   ADR-166 Phase 2: `{shadow.md}` = SP2 `elevated`. 구 값의 기하(0 4px 12px)가 SP2
      //   `elevated` 최상위 레이어와 정확히 일치하므로 근사가 아니라 **출처 복귀**다(ADR §9-4).
      //   ADR-166 Phase 4: 구 `popover_shadow` primitive(테마 무관 상수, 실측 결과 캔버스 출력
      //   0)를 은퇴시켜, 이 값이 DOM·Skia 양쪽의 유일한 그림자 소스가 됐다.
      containerStyles: {
        boxShadow: "{shadow.md}",
      },
      states: {},
    },
  },
  ProgressBar: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-913 동형: label-position:side (Skia resolveActiveContainerVariants 소비 — 부모 flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 order 는 implicitStyles.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 4,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 8,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: 12,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: 16,
        gap: 4,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label value" "bar bar"',
        gridTemplateColumns: "1fr auto",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {},
      },
      composition: {
        layout: "grid",
        containerStyles: {
          "box-sizing": "border-box",
          "row-gap": "var(--spacing-xs)",
          "column-gap": "var(--spacing-md)",
          width: "100%",
          color: "var(--fg)",
          "font-size": "var(--text-sm)",
          "--label-font-size": "var(--text-sm)",
          "--fill-color": "var(--accent)",
          "--track-color": "var(--accent-subtle)",
        },
        staticSelectors: {
          ".react-aria-Label": {
            "grid-area": "label",
            "white-space": "nowrap",
          },
          ".value": {
            "grid-area": "value",
            "font-size": "var(--text-sm)",
            color: "var(--fg-muted)",
            "white-space": "nowrap",
          },
          ".bar": {
            "grid-area": "bar",
            "box-shadow": "var(--inset-shadow-xs)",
            "forced-color-adjust": "none",
            height: "var(--spacing-sm)",
            "border-radius": "var(--radius-sm)",
            overflow: "hidden",
            "will-change": "transform",
            background: "var(--track-color)",
          },
          ".fill": {
            "border-radius": "var(--radius-sm)",
            background: "var(--fill-color)",
            height: "100%",
            transition: "width 200ms ease-out",
          },
        },
        containerVariants: {
          // ADR-913 동형: label-position:side — progress 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간, value 끝) + track flex:1. Skia 자식 order 는
          //   implicitStyles ProgressBar/Meter 분기가 동일 값 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                { selector: ".bar", styles: { order: "1", flex: "1" } },
                { selector: ".value", styles: { order: "2" } },
              ],
            },
          },
          variant: {
            default: {
              styles: {
                "--fill-color": "var(--accent)",
                "--track-color": "var(--accent-subtle)",
              },
            },
            accent: {
              styles: {
                "--fill-color": "var(--accent)",
                "--track-color": "var(--accent-subtle)",
              },
            },
            neutral: {
              styles: {
                "--fill-color": "var(--fg-muted)",
                "--track-color": "var(--bg-muted)",
              },
            },
          },
          indeterminate: {
            true: {
              nested: [
                {
                  selector: ".fill",
                  styles: {
                    width: "120px",
                    "border-radius": "inherit",
                    animation:
                      "ProgressBar-indeterminate 1.5s infinite ease-in-out",
                    "will-change": "transform",
                  },
                },
              ],
            },
          },
          disabled: {
            true: {
              styles: {
                opacity: "0.38",
                cursor: "not-allowed",
                "pointer-events": "none",
              },
            },
          },
          size: {
            sm: {
              styles: {
                "--label-font-size": "var(--text-xs)",
              },
            },
            md: {
              styles: {
                "--label-font-size": "var(--text-sm)",
              },
            },
            lg: {
              styles: {
                "--label-font-size": "var(--text-base)",
              },
            },
            xl: {
              styles: {
                "--label-font-size": "var(--text-lg)",
              },
            },
          },
        },
        sizeSelectors: {
          sm: {
            ".bar": {
              height: "var(--spacing-xs)",
              "border-radius": "var(--radius-sm)",
            },
            ".fill": {
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-xs)",
            },
          },
          md: {
            ".bar": {
              height: "var(--spacing-sm)",
              "border-radius": "var(--radius-sm)",
            },
            ".fill": {
              "border-radius": "var(--radius-sm)",
            },
            ".value": {
              "font-size": "var(--text-sm)",
            },
          },
          lg: {
            ".bar": {
              height: "var(--spacing-md)",
              "border-radius": "var(--radius-lg)",
            },
            ".fill": {
              "border-radius": "var(--radius-md)",
            },
            ".value": {
              "font-size": "var(--text-base)",
            },
          },
          xl: {
            ".bar": {
              height: "var(--spacing-lg)",
              "border-radius": "var(--radius-lg)",
            },
            ".fill": {
              "border-radius": "var(--radius-lg)",
            },
            ".value": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        animations: {
          indeterminate: {
            keyframes: {
              from: {
                transform: "translateX(-100%)",
              },
              to: {
                transform: "translateX(250px)",
              },
            },
            reducedMotion: {
              "transition-duration": "0s",
            },
          },
        },
        delegation: [],
      },
    },
  },
  ProgressBarTrack: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 선행-2: value 채움 막대 색 (value_fill_bar escape 가 읽음).
        //   track 배경(fill.base = neutral-subtle) 위에 덧그리는 진행 막대.
        fillBar: "{color.accent}",
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 16,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {},
      },
    },
  },
  ProgressBarValue: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.none}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.none}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.none}",
        height: 24,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.none}",
        height: 28,
      },
    },
    structure: {
      archetype: "progress",
      element: "output",
      containerStyles: {
        display: "grid",
      },
    },
  },
  ProgressCircle: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 24,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 64,
      },
    },
    structure: {
      archetype: "progress",
      element: "div",
      containerStyles: {
        display: "grid",
      },
    },
  },
  Radio: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-912 단계 5 step 2: replace-primitive measurement generic 전환 — variant.textWeight=400
    //   (Radio.spec label fontWeight 미emit → 측정 fallback 400 정합). [[Checkbox 참조]]
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
            selected: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border-hover}",
          selectedBorder: "{color.accent}",
        },
        textWeight: 400,
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
            selected: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border-hover}",
          selectedBorder: "{color.accent}",
        },
        textWeight: 400,
      },
      neutral: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
            selected: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border-hover}",
          selectedBorder: "{color.neutral-subtle}",
        },
        textWeight: 400,
      },
      negative: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
            selected: "{color.negative}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
          selectedBorder: "{color.negative}",
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Radio.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강 (Radio.css size 별 gap 6/8/10/12 + padding 0px 0px 정합). indicator(boxSize/
      //   dotSize)는 generated CSS 미emit(수동/React) → rule 불요.
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 6,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 8,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 10,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 12,
      },
    },
    structure: {
      archetype: "toggle-indicator",
      element: "label",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  RadioGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS root `gap: Npx`
      //   재생성용 (RadioGroup.spec.sizes 미러). 자식 .radio-items gap 은 composition
      //   containerVariants.size 의 --radio-items-gap 별도 경로. padding 미emit(ownsContainerBox).
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 8,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 12,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 16,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
        gap: 20,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): RadioGroup.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — CheckboxGroup 동형(spec 삭제 91c2be0dd 로 side variant 회귀).
    //   catalog fallback 메커니즘 + 본 필드. CSS 변수/orientation nested 는 DOM generated CSS 전용.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          color: "var(--fg)",
          "--label-font-size": "var(--text-sm)",
          "--label-line-height": "var(--text-sm--line-height)",
          "--radio-items-gap": "12px",
          "--rg-hint-size": "var(--text-xs)",
        },
        containerVariants: {
          size: {
            sm: {
              styles: {
                "--label-font-size": "var(--text-xs)",
                "--label-line-height": "var(--text-xs--line-height)",
                "--radio-items-gap": "8px",
              },
            },
            lg: {
              styles: {
                "--label-font-size": "var(--text-base)",
                "--label-line-height": "var(--text-base--line-height)",
                "--radio-items-gap": "16px",
              },
            },
          },
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          orientation: {
            vertical: {
              nested: [
                {
                  selector: ".radio-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "column",
                    gap: "var(--radio-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
            horizontal: {
              nested: [
                {
                  selector: ".radio-items",
                  styles: {
                    display: "flex",
                    "flex-direction": "row",
                    "align-items": "center",
                    gap: "var(--radio-items-gap, var(--spacing-md))",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--rg-hint-size)",
            },
          },
        ],
      },
    },
  },
  RangeCalendar: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    // 2026-07-07 전수조사 fix: top-level containerStyles 추가 — Calendar 동형(spec 삭제 +
    //   structure.composition 부재). structure.containerStyles(width:fit-content)가 layout
    //   fallback 경로 A·B 둘 다 미도달 → 부모 flex-column stretch 발산. top-level 승격으로 경로 A
    //   도달. 상세는 Calendar rule 주석 참조.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "fit-content",
      // ADR-151 B2 (2026-07-16): Calendar 동형 — generated RangeCalendar.css border 1px 의
      //   layout 미반영 2px 발산 보정 (top-level = layout 채널, CSS diff 0).
      borderWidth: "1px",
    },
    sizes: {
      // ADR-912 단계5 step4 date-color (2026-06-16): paddingX/paddingY/gap 보강 —
      //   RangeCalendar.spec(=...CalendarSpec spread) 삭제 대비 generated RangeCalendar.css
      //   (padding NNpx NNpx / gap NNpx) diff-0 유지. 값은 (구) CalendarSpec.sizes 와 동일
      //   (RangeCalendar 는 시각 = Calendar — selector 이름만 차이).
      sm: {
        paddingX: 4,
        paddingY: 4,
        gap: 4,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: 20,
      },
      md: {
        paddingX: 8,
        paddingY: 8,
        gap: 6,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 26,
      },
      lg: {
        paddingX: 12,
        paddingY: 12,
        gap: 8,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 32,
      },
    },
    structure: {
      archetype: "calendar",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "fit-content",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  SearchField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (SearchField.spec.sizes 미러). paddingY 는 composition.layout=flex-column root 가
      //   ownsContainerBox → padding 미emit 이라 보강 불요(gap 만).
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        gap: 6,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        gap: 8,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        gap: 10,
        iconSize: 22,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        gap: 10,
        iconSize: 28,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/NumberField 동형). 기존 grid 는 CSS 전용이고 Skia getSideLabelParentStyle 은 flex-row
    //   라 비대칭 + factory inline flexDirection:column 이 grid selector 를 specificity 로 이겨 무력화.
    //   flex-row 통일로 generated CSS = Skia 대칭 복원. Skia sideMode 트리거 styles 만.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: undefined,
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본, TextField 와 동형 정정).
          //   factory inline(width:100%, FormComponents) ↔ CSS Preview(fit-content) 시각 비대칭 +
          //   Style Panel false dirty 해소. CSS 재생성 시 .react-aria-SearchField width:100%.
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".searchfield-container",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    ".searchfield-container:hover:not(:has([data-disabled])):not(:has([data-focused]))",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector: ".searchfield-container:has([data-focused])",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".searchfield-container:has([data-invalid])",
                  styles: {
                    "border-color": "transparent",
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
          empty: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Button",
                  styles: {
                    display: "none",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "sf-label",
            variables: {
              xs: {
                "--sf-label-size": "var(--text-2xs)",
              },
              sm: {
                "--sf-label-size": "var(--text-xs)",
              },
              md: {
                "--sf-label-size": "var(--text-sm)",
              },
              lg: {
                "--sf-label-size": "var(--text-base)",
              },
              xl: {
                "--sf-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--sf-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "0",
            },
          },
          {
            childSelector: ".react-aria-Input",
            prefix: "sf-input",
            variables: {
              xs: {
                "--sf-input-size": "var(--text-2xs)",
                "--sf-input-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--sf-input-size": "var(--text-xs)",
                "--sf-input-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--sf-input-size": "var(--text-sm)",
                "--sf-input-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--sf-input-size": "var(--text-base)",
                "--sf-input-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--sf-input-size": "var(--text-lg)",
                "--sf-input-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              flex: "1",
              "min-width": "0",
              padding: "0",
              border: "none",
              outline: "none",
              background: "transparent",
              color: "var(--fg)",
              "font-size": "var(--sf-input-size)",
              "line-height": "var(--sf-input-line-height)",
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "sf-hint",
            variables: {
              xs: {
                "--sf-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--sf-hint-size": "var(--text-xs)",
              },
              md: {
                "--sf-hint-size": "var(--text-xs)",
              },
              lg: {
                "--sf-hint-size": "var(--text-sm)",
              },
              xl: {
                "--sf-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "font-size": "var(--sf-hint-size)",
              color: "var(--negative)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--sf-hint-size)",
              color: "var(--fg-muted)",
            },
          },
          {
            childSelector: ".search-icon",
            prefix: "sf-icon",
            variables: {
              xs: {
                "--sf-icon-size": "10px",
              },
              sm: {
                "--sf-icon-size": "12px",
              },
              md: {
                "--sf-icon-size": "16px",
              },
              lg: {
                "--sf-icon-size": "18px",
              },
              xl: {
                "--sf-icon-size": "22px",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              "flex-shrink": "0",
              color: "var(--fg-muted)",
            },
          },
          {
            childSelector: ".search-icon svg",
            bridges: {
              width: "var(--sf-icon-size)",
              height: "var(--sf-icon-size)",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "sf-btn",
            variables: {
              xs: {
                "--sf-btn-size": "10px",
              },
              sm: {
                "--sf-btn-size": "14px",
              },
              md: {
                "--sf-btn-size": "18px",
              },
              lg: {
                "--sf-btn-size": "22px",
              },
              xl: {
                "--sf-btn-size": "28px",
              },
            },
            bridges: {
              position: "static",
              flex: "0 0 auto",
              width: "var(--sf-btn-size)",
              height: "var(--sf-btn-size)",
              padding: "0",
              border: "none",
              background: "var(--bg-overlay)",
              color: "var(--fg)",
              "forced-color-adjust": "none",
              "box-shadow": "var(--shadow-sm)",
              cursor: "pointer",
            },
            states: {
              "[data-hovered]:not([data-disabled])": {
                background: "var(--accent-subtle)",
              },
              "[data-pressed]:not([data-disabled])": {
                background:
                  "color-mix(in srgb, var(--fg) 12%, var(--bg-overlay))",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "2px",
              },
              "[data-disabled]": {
                background: "color-mix(in srgb, var(--fg) 12%, transparent)",
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-Button svg",
            bridges: {
              width: "var(--sf-icon-size)",
              height: "var(--sf-icon-size)",
            },
          },
          {
            childSelector: ".searchfield-container",
            prefix: "sf-container",
            variables: {
              xs: {
                "--sf-container-padding":
                  "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
              },
              sm: {
                "--sf-container-padding":
                  "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
              },
              md: {
                "--sf-container-padding":
                  "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
              },
              lg: {
                "--sf-container-padding":
                  "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
              },
              xl: {
                "--sf-container-padding":
                  "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
              },
            },
            bridges: {
              display: "flex",
              "flex-direction": "row",
              "align-items": "center",
              width: "100%",
              gap: "var(--spacing-xs)",
              padding: "var(--sf-container-padding)",
              border: "1px solid var(--border)",
              "border-radius": "var(--radius-md)",
              background: "var(--bg-inset)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
              cursor: "text",
            },
            states: {
              ":hover:not(:has([data-disabled]))": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              ":has([data-focused])": {
                "border-color": "var(--accent)",
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
                background: "var(--bg-overlay)",
              },
              ":has([data-invalid])": {
                "border-color": "var(--negative)",
              },
              ":has([data-disabled])": {
                opacity: "0.38",
                cursor: "not-allowed",
                background: "var(--bg-muted)",
              },
            },
          },
        ],
      },
    },
  },
  Section: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      purple: {
        fill: {
          default: {
            base: "{color.purple-subtle}",
            hover: "{color.purple-subtle}",
            pressed: "{color.purple-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      surface: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      outlined: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): paddingY/gap 보강 — spec 삭제 후 generated CSS
      //   `padding: Ypx Xpx` + `gap: Npx` 재생성용 (Section.spec.sizes 미러, Nav/DropZone 선례).
      sm: {
        paddingX: 12,
        paddingY: 12,
        gap: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      md: {
        paddingX: 16,
        paddingY: 16,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        paddingX: 24,
        paddingY: 24,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "section",
      containerStyles: undefined,
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
    },
  },
  Select: {
    defaultSize: "md",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): SelectSpec.spec 삭제 대비 — generate-css virtual emit 이
    //   base/size block 의 `gap: Npx` 를 byte-identical 재현하려면 gap 필수(CSSGenerator.ts:983 size.gap
    //   → emit, composition.containerStyles.gap 미정의라 skipGap=false). paddingY 는 미보충(컨테이너
    //   box 가 ownsContainerBox=true → skipPadding, padding 은 composition.delegation --select-btn-padding
    //   가 담당, base block 미emit). Input 과 달리 padding 은 delegation 위임이라 paddingY 불요.
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 14,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 16,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
        gap: 6,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
        gap: 8,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
        gap: 10,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
          color: "var(--fg)",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          disabled: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Button",
                  styles: {
                    background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                    "border-color":
                      "color-mix(in srgb, var(--fg) 12%, transparent)",
                    color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                    cursor: "not-allowed",
                    opacity: "0.38",
                  },
                },
                {
                  selector: ".react-aria-Button .select-chevron",
                  styles: {
                    background:
                      "color-mix(in srgb, var(--fg) 12%, transparent)",
                    color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                  },
                },
              ],
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-Button",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector:
                    ".react-aria-Button[data-hovered]:not([data-pressed]):not([data-disabled])",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--border-hover)",
                  },
                },
                {
                  selector:
                    ".react-aria-Button[data-focus-visible]:not([data-disabled])",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    ".react-aria-Button[data-focused]:not([data-disabled])",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector:
                    ".react-aria-Button[data-pressed]:not([data-disabled])",
                  styles: {
                    outline: "none",
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: "&[data-invalid] .react-aria-Button",
                  styles: {
                    "border-color": "transparent",
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        externalStyles: [
          {
            selector: '.react-aria-Popover[data-trigger="Select"]',
            styles: {
              "min-width": "var(--trigger-width)",
              "max-height": "300px",
              overflow: "auto",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-raised)",
              "box-shadow": "var(--shadow-lg)",
              contain: "layout style",
            },
            nested: [
              {
                selector: ".react-aria-ListBox",
                styles: {
                  border: "none",
                  background: "transparent",
                  "max-height": "none",
                  "min-height": "24px",
                },
              },
            ],
          },
        ],
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "select-label",
            variables: {
              xs: {
                "--select-label-size": "var(--text-2xs)",
              },
              sm: {
                "--select-label-size": "var(--text-xs)",
              },
              md: {
                "--select-label-size": "var(--text-sm)",
              },
              lg: {
                "--select-label-size": "var(--text-base)",
              },
              xl: {
                "--select-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--select-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".react-aria-Button",
            prefix: "select-btn",
            variables: {
              xs: {
                "--select-btn-padding":
                  "var(--spacing-3xs) var(--spacing-3xs) var(--spacing-3xs) var(--spacing-xs)",
                "--select-btn-font-size": "var(--text-2xs)",
                "--select-btn-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--select-btn-padding":
                  "var(--spacing-2xs) var(--spacing-2xs) var(--spacing-2xs) var(--spacing-sm)",
                "--select-btn-font-size": "var(--text-xs)",
                "--select-btn-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--select-btn-padding":
                  "var(--spacing-xs) var(--spacing-xs) var(--spacing-xs) var(--spacing-md)",
                "--select-btn-font-size": "var(--text-sm)",
                "--select-btn-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--select-btn-padding":
                  "var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) var(--spacing-lg)",
                "--select-btn-font-size": "var(--text-base)",
                "--select-btn-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--select-btn-padding":
                  "var(--spacing-md) var(--spacing-md) var(--spacing-md) var(--spacing-xl)",
                "--select-btn-font-size": "var(--text-lg)",
                "--select-btn-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              width: "100%",
              padding: "var(--select-btn-padding)",
              "text-align": "left",
              border: "1px solid var(--border)",
              "border-radius": "var(--border-radius)",
              background: "var(--bg-inset)",
              color: "var(--fg)",
              "forced-color-adjust": "none",
              "font-size": "var(--select-btn-font-size)",
              "line-height": "var(--select-btn-line-height)",
            },
            states: {
              "[data-hovered]:not([data-pressed]):not([data-disabled])": {
                "border-color": "var(--border-hover)",
                background: "var(--bg-overlay)",
              },
              "[data-pressed]:not([data-disabled])": {
                background: "var(--accent-subtle)",
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              "[data-focus-visible]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
              },
              "[data-disabled]": {
                background: "color-mix(in srgb, var(--fg) 4%, transparent)",
                "border-color":
                  "color-mix(in srgb, var(--fg) 12%, transparent)",
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
                opacity: "0.38",
              },
            },
          },
          {
            childSelector: ".react-aria-SelectValue",
            bridges: {
              "font-size": "var(--select-btn-font-size)",
              color: "var(--fg)",
              flex: "1",
              display: "flex",
              "white-space": "nowrap",
              "text-overflow": "ellipsis",
              overflow: "hidden",
            },
            states: {
              "[data-placeholder]": {
                "font-style": "normal",
                color: "var(--fg-muted)",
                opacity: "0.6",
              },
            },
          },
          {
            childSelector: '.react-aria-SelectValue [slot="description"]',
            bridges: {
              display: "none",
            },
          },
          {
            childSelector: ".select-chevron",
            prefix: "select-chevron",
            variables: {
              xs: {
                "--select-chevron-size": "14px",
                "--select-chevron-margin": "var(--spacing-xs)",
              },
              sm: {
                "--select-chevron-size": "16px",
                "--select-chevron-margin": "var(--spacing-sm)",
              },
              md: {
                "--select-chevron-size": "18px",
                "--select-chevron-margin": "var(--spacing)",
              },
              lg: {
                "--select-chevron-size": "22px",
                "--select-chevron-margin": "var(--spacing-md)",
              },
              xl: {
                "--select-chevron-size": "28px",
                "--select-chevron-margin": "var(--spacing-lg)",
              },
            },
            bridges: {
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              width: "var(--select-chevron-size)",
              height: "var(--select-chevron-size)",
              "margin-left": "var(--select-chevron-margin)",
              "border-radius": "var(--radius-xs)",
              background: "var(--bg-overlay)",
              color: "var(--fg)",
              transition: "all 150ms ease",
              "forced-color-adjust": "none",
              "box-shadow": "var(--shadow-sm)",
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "select-hint",
            variables: {
              xs: {
                "--select-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--select-hint-size": "var(--text-2xs)",
              },
              md: {
                "--select-hint-size": "var(--text-xs)",
              },
              lg: {
                "--select-hint-size": "var(--text-sm)",
              },
              xl: {
                "--select-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--select-hint-size)",
              "--error-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--select-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  SelectIcon: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
        },
      },
    },
    // 아이콘 스케일 = 14/16/18/22/28 (Select `.select-chevron` / DatePicker `--dp-btn-*` 와 동일).
    //   `height === iconSize` 가 불변식 — SelectIcon 은 glyph 자체가 박스다.
    //   **2026-07-14 정정**: xs/sm 이 10/14 로 DOM(14/16)과 어긋나 있었다. `iconSize` 는 Skia 전용
    //   (`--icon-size` CSS 변수는 Disclosure 만 소비) 이라 DOM 폭발 반경 없음 → catalog 를 DOM 스케일로 수렴.
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.none}",
        height: 14,
        iconSize: 14,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 16,
        iconSize: 16,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 18,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 22,
        iconSize: 22,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 28,
        iconSize: 28,
      },
    },
  },
  SelectTrigger: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
          borderHover: "{color.border-hover}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
          borderHover: "{color.accent-hover}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
          borderHover: "{color.negative-hover}",
        },
      },
    },
    sizes: {
      // ADR-912 R1 (2026-06-12): paddingX/paddingY/borderWidth — SelectTrigger.spec.sizes 이전.
      //   layout contentHeight 유도(height - paddingY*2 - borderWidth*2)가 rule 만으로 가능해야
      //   spec 삭제 후 utils.ts/implicitStyles 가 rule 단일 source 로 측정.
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 14,
        paddingX: 4,
        paddingY: 1,
        borderWidth: 1,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 16,
        paddingX: 8,
        paddingY: 2,
        borderWidth: 1,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
        paddingX: 12,
        paddingY: 4,
        borderWidth: 1,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
        paddingX: 16,
        paddingY: 8,
        borderWidth: 1,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
        paddingX: 24,
        paddingY: 12,
        borderWidth: 1,
      },
    },
  },
  SelectValue: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.none}",
        height: 14,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 24,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 28,
      },
    },
  },
  Separator: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.border}",
          border: "{color.border}",
        },
      },
      solid: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.border}",
          border: "{color.border}",
        },
      },
      dashed: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.border}",
          border: "{color.border}",
        },
      },
      dotted: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.border}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.accent}",
          border: "{color.accent}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral-subtle}",
          border: "{color.neutral-subtle}",
        },
      },
      surface: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.base}",
            pressed: "{color.base}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.border-hover}",
          border: "{color.border-hover}",
        },
      },
    },
    sizes: {
      // paddingY 4/8/16 → 0 (2026-07-14): 간격은 margin(수동 Separator.css + Skia
      //   implicitStyles sep_margin) 소관 — padding 으로 emit 되면 border-box 하한이
      //   높이(1px)를 이겨 DOM 이 18px box 로 렌더 (Skia 390x1 과 발산 근본).
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 0,
      },
      md: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 0,
      },
      lg: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "hr",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {},
    },
  },
  Skeleton: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-2}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 24,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {},
    },
  },
  // ADR-912 단계5 step4 (2026-06-17): Slider.spec.ts 삭제 대비 시각/layout 값 SSOT 보강.
  //   containerStyles(grid) → resolveContainerStylesFallback 경유 Skia/Taffy grid 배치 fallback
  //   (spec.containerStyles 끊김 대체). sizes 의 gap/columnGap/indicator → generated CSS column-gap +
  //   track/thumb metric 재생성 (ruleSizeToSizeSpec passthrough) + implicitStyles specSizeField rule
  //   fallback (columnGap/indicator.thumbSize). Slider.spec.ts:100-160 SSOT 1:1 미러.
  Slider: {
    defaultSize: "md",
    variants: {},
    containerStyles: {
      display: "grid",
      gridTemplateAreas: '"label output" "track track"',
      gridTemplateColumns: "1fr auto",
    },
    // 2026-07-16: labelPosition="side" (Skia resolveActiveContainerVariants 소비 — 부모 grid→flex-row).
    //   CSS 대칭 = structure.composition.containerVariants["label-position"], 자식 재정렬(label→track→value)은
    //   implicitStyles Slider 분기 (ProgressBar/Meter side 선례 동형).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "flex",
            "flex-direction": "row",
            "align-items": "center",
          },
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        height: 4,
        gap: 4,
        columnGap: 16,
        indicator: { trackHeight: 4, thumbSize: 14 },
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        height: 8,
        gap: 4,
        columnGap: 16,
        indicator: { trackHeight: 8, thumbSize: 18 },
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        height: 12,
        gap: 4,
        columnGap: 20,
        indicator: { trackHeight: 12, thumbSize: 22 },
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        height: 16,
        gap: 4,
        columnGap: 20,
        indicator: { trackHeight: 16, thumbSize: 26 },
      },
    },
    structure: {
      archetype: "slider",
      element: "div",
      containerStyles: {
        display: "grid",
        gridTemplateAreas: '"label output" "track track"',
        gridTemplateColumns: "1fr auto",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        sizeSelectors: {
          sm: {
            ".react-aria-Label": {
              "font-size": "var(--text-xs)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-xs)",
            },
          },
          md: {
            ".react-aria-Label": {
              "font-size": "var(--text-sm)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-sm)",
            },
          },
          lg: {
            ".react-aria-Label": {
              "font-size": "var(--text-base)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-base)",
            },
          },
          xl: {
            ".react-aria-Label": {
              "font-size": "var(--text-lg)",
            },
            ".react-aria-SliderOutput": {
              "font-size": "var(--text-lg)",
            },
          },
        },
        containerVariants: {
          // 2026-07-16: labelPosition="side" — Slider 3요소(label/track/value) grid→flex-row.
          //   부모 flex-row + 자식 order(track 중간 flex:1, value 끝) → Label · Track · Value 가로 배치.
          //   Skia 자식 재정렬은 implicitStyles Slider 분기가 동일 시각 결과 주입 (D3 대칭).
          "label-position": {
            side: {
              styles: {
                display: "flex",
                "flex-direction": "row",
                "align-items": "center",
              },
              nested: [
                {
                  selector: ".react-aria-SliderTrack",
                  styles: { order: "1", flex: "1" },
                },
                {
                  selector: ".react-aria-SliderOutput",
                  styles: { order: "2" },
                },
              ],
            },
          },
        },
        delegation: [],
      },
    },
  },
  SliderOutput: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.none}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.none}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.none}",
        height: 24,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.none}",
        height: 28,
      },
    },
    structure: {
      archetype: "simple",
      element: "output",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
    },
  },
  // ADR-912 SliderThumb catalog cutover (2026-06-16): circle 핸들 leaf. slider_thumb escape 가
  //   circle fill = variant default fill.default.base({color.accent}) 를 읽는다. height = thumb 지름
  //   (Slider.spec.sizes.*.indicator.thumbSize SSOT 미러 14/18/22/26). 기존 16/20/24 는 stale 값으로
  //   spec(SliderThumb.spec.sizes 14/18/22/26)과 불일치였음 → SSOT 정합 + xl 추가.
  SliderThumb: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 22,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 26,
      },
    },
  },
  SliderTrack: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      // ADR-912 SliderTrack value-fill: track 배경(fill.base = neutral-subtle) 위에
      //   slider_fill_bar escape 가 value 채움 막대(fillBar) + thumb 핸들을 그린다.
      //   thumb 색 = fillBar(accent, SLIDER_FILL_COLORS.default.handle 정합). thumb border 는
      //   escape 가 {color.base} 하드코딩(spec 정합). ProgressBarTrack 동형 + thumb 채널.
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        fillBar: "{color.accent}",
      },
    },
    // height = trackHeight (visual 트랙 두께) / thumbSize = 핸들 지름 (layout box 높이, thumb 수용).
    //   Slider.spec.sizes.*.indicator SSOT 미러 (trackHeight 4/8/12/16, thumbSize 14/18/22/26).
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 4,
        thumbSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 8,
        thumbSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 12,
        thumbSize: 22,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 16,
        thumbSize: 26,
      },
    },
    structure: {
      archetype: "slider",
      element: "div",
      containerStyles: {
        display: "grid",
        position: "relative",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {},
      },
    },
  },
  // Slot 은 고유 높이가 없다 — 프레임 안에서 flex/grid 가 크기를 정하는 배치 자리다.
  //   그래서 `height: 0` (= 고유 높이 없음) 으로 둔다. 같은 composition-native 레이아웃
  //   컨테이너인 `body`/`frame` 과 동일한 표기다.
  //   **Why (2026-07-27 실측)**: 구 값 40/60/80 은 렌더·레이아웃 소비자가 **0건**인데
  //   (Skia box 는 layout 결과를, 레이아웃 분기는 type 별 명시 분기만 읽는다) Style 패널의
  //   Transform Height 가 inline 부재 시 catalog 로 fallback 하면서 **실제 1024px 인 슬롯을
  //   60px 로 표시**했다. 빈 슬롯이 보이게 하는 하한은 프리셋의 `minHeight` 가 담당한다.
  Slot: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
  },
  StatusLight: {
    defaultVariant: "neutral",
    defaultSize: "md",
    variants: {
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subdued}",
            hover: "{color.neutral-subdued}",
            pressed: "{color.neutral-subdued}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      informative: {
        fill: {
          default: {
            base: "{color.informative}",
            hover: "{color.informative}",
            pressed: "{color.informative}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.positive}",
            hover: "{color.positive}",
            pressed: "{color.positive}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      notice: {
        fill: {
          default: {
            base: "{color.notice}",
            hover: "{color.notice}",
            pressed: "{color.notice}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative}",
            hover: "{color.negative}",
            pressed: "{color.negative}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      celery: {
        fill: {
          default: {
            base: "{color.celery}",
            hover: "{color.celery}",
            pressed: "{color.celery}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      chartreuse: {
        fill: {
          default: {
            base: "{color.chartreuse}",
            hover: "{color.chartreuse}",
            pressed: "{color.chartreuse}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      cyan: {
        fill: {
          default: {
            base: "{color.cyan}",
            hover: "{color.cyan}",
            pressed: "{color.cyan}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      fuchsia: {
        fill: {
          default: {
            base: "{color.fuchsia}",
            hover: "{color.fuchsia}",
            pressed: "{color.fuchsia}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      indigo: {
        fill: {
          default: {
            base: "{color.indigo}",
            hover: "{color.indigo}",
            pressed: "{color.indigo}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      magenta: {
        fill: {
          default: {
            base: "{color.magenta}",
            hover: "{color.magenta}",
            pressed: "{color.magenta}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      purple: {
        fill: {
          default: {
            base: "{color.purple}",
            hover: "{color.purple}",
            pressed: "{color.purple}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      yellow: {
        fill: {
          default: {
            base: "{color.yellow}",
            hover: "{color.yellow}",
            pressed: "{color.yellow}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      seafoam: {
        fill: {
          default: {
            base: "{color.seafoam}",
            hover: "{color.seafoam}",
            pressed: "{color.seafoam}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      pink: {
        fill: {
          default: {
            base: "{color.pink}",
            hover: "{color.pink}",
            pressed: "{color.pink}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      turquoise: {
        fill: {
          default: {
            base: "{color.turquoise}",
            hover: "{color.turquoise}",
            pressed: "{color.turquoise}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      cinnamon: {
        fill: {
          default: {
            base: "{color.cinnamon}",
            hover: "{color.cinnamon}",
            pressed: "{color.cinnamon}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      brown: {
        fill: {
          default: {
            base: "{color.brown}",
            hover: "{color.brown}",
            pressed: "{color.brown}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      silver: {
        fill: {
          default: {
            base: "{color.silver}",
            hover: "{color.silver}",
            pressed: "{color.silver}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 20,
        gap: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 24,
        gap: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 28,
        gap: 8,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 32,
        gap: 8,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  Switch: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-912 단계 5 step 2: replace-primitive measurement generic 전환 — variant.textWeight=400
    //   (Switch.spec label fontWeight 미emit → 측정 fallback 400 정합). [[Checkbox 참조]]
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
            selected: "{color.neutral}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        textWeight: 400,
      },
      emphasized: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
            selected: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        textWeight: 400,
      },
    },
    sizes: {
      // ADR-912 단계5 step4 toggle-indicator 그룹 (2026-06-16): Switch.spec 삭제 대비 gap/paddingX/
      //   paddingY 보강. generate-css virtual 이 size 별 `gap`/`padding: 0px 0px` 를 emit (Switch.css
      //   정합). indicator(trackWidth/thumbSize)는 generated CSS 미emit(수동/React) → rule 불요.
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 10,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 0,
        paddingX: 0,
        paddingY: 0,
        gap: 14,
      },
    },
    structure: {
      archetype: "toggle-indicator",
      element: "label",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  // ADR-912 Switcher cleanup — Switcher rule 제거 (RAC ToggleButtonGroup 으로 대체, 노드 type
  // 자체가 hydration 으로 ToggleButtonGroup 변환되어 Switcher rule 소비 0).
  Tab: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          textHover: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 21,
        paddingX: 8,
        paddingY: 2,
        fontWeight: 500,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 29,
        paddingX: 12,
        paddingY: 4,
        fontWeight: 500,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 41,
        paddingX: 16,
        paddingY: 8,
        fontWeight: 500,
      },
    },
    structure: {
      archetype: "default",
      element: "button",
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  TabList: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 21,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 29,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 41,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "row",
      },
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
      composition: {
        layout: "flex-row",
        delegation: [],
      },
    },
  },
  TabPanel: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    // 2026-07-02 전수조사 fix: top-level containerStyles 추가 — TabPanel 은 spec 삭제(ADR-912
    //   cutover) + structure.composition 부재(archetype "collection") 라, layout 이
    //   structure.containerStyles 에만 있으면 resolveContainerStylesFallback("tabpanel") 이
    //   경로 A(top-level rule.containerStyles)·경로 B(structure.composition) 둘 다 미도달 → {}
    //   반환 → getElementDisplay 가 block 라우팅 → 패널 안 사용자 자식이 Skia 에서 block(flex
    //   gap/align/flexGrow 유실), DOM 은 generated CSS flex-column → Skia↔CSS 비대칭.
    //   ListBox/Menu/Tree 선례처럼 top-level containerStyles 로 승격해 경로 A 가 Skia 에 공급.
    //   structure.containerStyles(아래)는 dirty baseline(resolveCatalogContainerBase)용 유지 —
    //   display/flexDirection 동일값이라 baseline drift 0. padding 은 implicitStyles tabs/tabpanels
    //   분기가 size 별 주입하므로 top-level 미포함(surface-minimization).
    containerStyles: {
      display: "flex",
      flexDirection: "column",
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        paddingX: 8,
        paddingY: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        paddingX: 12,
        paddingY: 12,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        paddingX: 16,
        paddingY: 16,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  TabPanels: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 8,
        paddingY: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 12,
        paddingY: 12,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
        paddingX: 16,
        paddingY: 16,
      },
    },
    structure: {
      archetype: "collection",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
      },
    },
  },
  TableHeader: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "row",
    },
  },
  TableBody: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "column",
    },
  },
  Row: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {},
    },
    containerStyles: {
      display: "flex",
      flexDirection: "row",
    },
  },
  Column: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
        // textAlign left: react-aria-starter Table.css `.react-aria-Cell,.react-aria-Column
        //   { text-align: left }`(line 162) 정본. buildCatalogShapes 는 transparent-fill +
        //   size.height>0 인 Column/Cell 을 box 로 판정해 기본 center 로 그렸다(Skia=center,
        //   CSS Preview=left 발산). rule.textAlign 이 visual.textAlign(resolveSkiaVisualRule:56)로
        //   전달돼 box 기본 center 를 override → Skia 도 left. catalog SSOT 단일 결과.
        textAlign: "left",
      },
    },
    sizes: {
      md: {
        fontWeight: 600,
        // fontSize/lineHeight: CSS Preview(renderTableViewSubtree generic div)는 fontSize 미명시 →
        //   부모 body 상속 16px + line-height normal 24px. Skia 셀 height(calculateContentHeight)와
        //   텍스트 크기를 CSS 와 일치시키려면 catalog 가 동일 값을 명시해야 한다(미명시 시 Skia
        //   기본 14 + estimateTextHeight≈16 → 행 height 32 vs CSS 40 발산). 양쪽 모두 catalog 파생
        //   으로 SSOT 통일(CSS=상속 → catalog 명시 미러).
        fontSize: 16,
        lineHeight: 24,
        // paddingX/Y 8: buildCatalogShapes 의 textX = paddingX(= size.paddingX ?? 0)로 텍스트를
        //   셀 안쪽으로 민다. containerStyles.padding(8px)은 Taffy box / Preview CSS 용이고 leaf
        //   Column/Cell 의 Skia 텍스트 x offset 에는 도달 안 함(resolveMergedStyle base=sizes 만,
        //   containerStyles 미포함) → Skia paddingX=0 으로 텍스트가 좌측 가장자리 붙음(Skia=0,
        //   CSS=8px 발산). Button(sizes.paddingX:4) 동형 — box leaf 텍스트 padding 정본 채널=sizes.
        //   값 8 = {spacing.sm}(containerStyles.padding)과 동일 → 시각 일치.
        //   세로 정합: calculateContentHeight(utils.ts §1.56)가 estimateTextHeight(16,24)=24 +
        //   paddingY*2(16) = 40 = CSS border-box height. baseline middle 이 텍스트를 셀 세로 중앙 배치.
        paddingX: 8,
        paddingY: 8,
      },
    },
    containerStyles: {
      flex: "1",
      padding: "{spacing.sm}",
    },
  },
  Cell: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
          alpha: 0,
        },
        colors: {
          text: "{color.neutral}",
        },
        // textAlign left: starter Table.css 정본(Column 과 동일 규칙). box 기본 center override.
        textAlign: "left",
      },
    },
    sizes: {
      md: {
        // fontSize/lineHeight 16/24: Column 과 동형 — CSS Preview 상속값(16px/24px)과 Skia 텍스트·
        //   셀 height 정합(calculateContentHeight estimateTextHeight(16,24)=24 + paddingY*2=40).
        fontSize: 16,
        lineHeight: 24,
        // paddingX/Y 8: Column 과 동형 — containerStyles.padding 은 Skia 텍스트 x 에 미도달이라
        //   sizes.paddingX 가 텍스트 padding 정본 채널(buildCatalogShapes textX). 값 8={spacing.sm}.
        paddingX: 8,
        paddingY: 8,
      },
    },
    containerStyles: {
      flex: "1",
      padding: "{spacing.sm}",
    },
  },
  Table: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 B22 (2026-07-16): generated/수동 CSS 의 base `width: 100%` 를 layout 이
    //   미소비 — flex 부모에서 fit-content 붕괴 (block 부모는 IFC 주입이 가림). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      striped: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      bordered: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border-hover}",
        },
      },
    },
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 36,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 44,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 52,
      },
    },
  },
  TableView: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-pressed}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      quiet: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-pressed}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: "auto",
      },
    },
    // ADR-151 후속 (2026-07-17): alignItems stretch — CSS 채널 재배선(react-aria-TableView
    //   클래스 부착)으로 archetype default base 의 align-items:center 가 살아나 자식
    //   header/row 가 fit-content 로 수축(161/146 vs 350)·셀 줄바꿈. Skia(엔진 flex 기본
    //   stretch)와 대칭 위해 양 채널 명시. borderWidth 1 은 layout 채널 전용 — DOM 은
    //   variant border 1px(border-box +2)인데 엔진이 미합산해 dh 2 잔존(B8 Table 동형).
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      alignItems: "stretch",
      borderWidth: "1px",
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        alignItems: "stretch",
      },
    },
  },
  Tabs: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        // ADR-912 단계 4 C2 (rule fill 정렬, 2026-06-03): 컨테이너 `colors.border` 제거.
        //   `.react-aria-Tabs` 는 배경/박스 border 없음 — tab indicator `::before` 선만 있다(컨테이너
        //   border 아님). buildCatalogShapes 가 `visual.border`(=colors.border)를 컨테이너 박스 border 로
        //   그리면 legacy render.shapes `[]` 와 불일치(kill: "Tabs border 추가"). text/textHover 는 유지.
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          textHover: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 21,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 29,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 41,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        flexDirection: "column",
      },
      states: {
        hover: {},
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.inset}",
        },
      },
      composition: {
        layout: "flex-column",
        delegation: [
          {
            childSelector: ".react-aria-Tab",
            variables: {
              sm: {
                "--tab-padding": "var(--spacing-2xs) var(--spacing-sm)",
                "--tab-font-size": "var(--text-xs)",
              },
              md: {
                "--tab-padding": "var(--spacing-xs) var(--spacing-md)",
                "--tab-font-size": "var(--text-sm)",
              },
              lg: {
                "--tab-padding": "var(--spacing-sm) var(--spacing-lg)",
                "--tab-font-size": "var(--text-base)",
              },
            },
          },
        ],
      },
    },
  },
  Tag: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-1}",
            hover: "{color.layer-1}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
        // ADR-912 영역 B (A) Tag cutover (2026-06-12): allowsRemoving remove X 를
        //   trailing_icon(Lucide "x" glyph)으로 그린다 — buildCatalogShapes 가 showProp(allowsRemoving)
        //   true 일 때만 text 우측에 덧그림(SearchField clear / DOM Button slot=remove 와 동일 icon).
        //   color 는 variant text 와 동일(default=neutral). showProp = generic 렌더러가 Tag 전용
        //   prop 이름을 모르도록 데이터로 가시성 조건 격리(ADR-142 §3 컴포넌트 식별 분기 금지).
        trailingIcon: {
          name: "x",
          gap: 2,
          color: "{color.neutral}",
          showProp: "allowsRemoving",
          // remove X 우측 여백 = paddingY + insetRight. CSS 실측(md chip): icon 우측 → chip 경계 7px =
          //   paddingY(4) + .tag-remove-btn padding(2) + chip border(1). insetRight=3 으로 대칭.
          insetRight: 3,
        },
      },
      selected: {
        fill: {
          default: {
            base: "{color.accent}",
            hover: "{color.accent}",
            pressed: "{color.accent}",
          },
        },
        colors: {
          text: "{color.on-accent}",
          border: "{color.accent}",
        },
        // selected variant: remove X color = on-accent (text 와 동일).
        trailingIcon: {
          name: "x",
          gap: 2,
          color: "{color.on-accent}",
          showProp: "allowsRemoving",
          insetRight: 3,
        },
      },
    },
    sizes: {
      // ADR-912 영역 B (A) Tag cutover (2026-06-12): paddingX 보강 — buildCatalogShapes 가
      //   text x = paddingX 로 좌측 정렬. Tag.spec sizes.paddingX(xs4/sm8/md12/lg16/xl24) 이전.
      //   미보강 시 `?? 0` fallback 으로 text 가 box 좌측 끝(padding 없음)에 붙음(chip 시각 깨짐).
      // iconSize: remove X(trailing_icon) glyph 크기 = **전 size 14 고정** (2026-07-02). CSS(DOM)는
      //   TagGroup.tsx `<Button slot="remove"><X size={14} /></Button>` 로 모든 size 14px 고정 —
      //   Skia trailingIcon 도 동일 14 로 맞춰 CSS↔Skia 시각 대칭(D3). 구 `round(fontSize×0.75)`
      //   (xs8/sm9/md11/lg12/xl14)는 md 11 vs CSS 14 로 Skia X 가 작았다(사용자 관찰). Tag 는 leading
      //   icon 이 없어 iconSize=remove X 전용 → 14 통일 부작용 없음. layout chip width(resolveTagChipMetric)
      //   는 fontSize 로 remove 예약 폭을 잡아 iconSize 무관. Tag 는 generated CSS 없음(부모 self-compose).
      // ADR-912 단계5 step4 (2026-06-17): paddingY 보강 — layout TAG_SIZE_CONFIG 가 spec.sizes 대신
      //   ruleSizesToSizeSpecMap("Tag") 파생으로 이관(deriveSizeConfig 가 paddingY 소비 — allowsRemoving
      //   우측 패딩 축소 계산). Tag.spec paddingY(xs1/sm2/md4/lg8/xl12 = (height-lineHeight)/2 동일값) 이전.
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        height: 18,
        paddingX: 4,
        paddingY: 1,
        iconSize: 14,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        height: 20,
        paddingX: 8,
        paddingY: 2,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.md}",
        height: 28,
        paddingX: 12,
        paddingY: 4,
        iconSize: 14,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.lg}",
        height: 40,
        paddingX: 16,
        paddingY: 8,
        iconSize: 14,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.lg}",
        height: 52,
        paddingX: 24,
        paddingY: 12,
        iconSize: 14,
      },
    },
  },
  TagGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        // ADR-912 단계 4 C2 (rule fill 정렬, 2026-06-03): 컨테이너 fill base→transparent + `colors.border`
        //   제거. `.react-aria-TagGroup` 컨테이너는 transparent — 배경/border 는 Tag 자식 칩(별도 `Tag`
        //   entry: fill `{color.layer-1}` + border)이 담당한다. 발효 시 buildCatalogShapes 가 default
        //   variant 의 불투명 `{color.layer-2}` + border 를 컨테이너 박스로 그리면 legacy `[]` 와 불일치
        //   (kill: "TagGroup 배경+border 추가"). accent/neutral/negative variant(사용자 명시 강조)는 유지.
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.neutral-subtle}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative-subtle}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
        },
      },
    },
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 24,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
      },
    },
    // ADR-912 단계5 step4 (2026-06-17): TagGroup.spec.containerStyles 이관 — self-render 컨테이너
    //   base layout(Label↔TagList 세로 배치). spec 삭제 후 resolveContainerStylesFallback(builder
    //   catalog 합성)이 본 필드를 읽는다. gap 은 spec `{spacing.xs}` 동일.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      gap: "{spacing.xs}",
    },
    // ADR-912 단계5 step4 (2026-06-17): TagGroup.spec.composition.containerVariants 이관 —
    //   RSP TagGroup `labelPosition="side"` 정본(label 옆 가로 배치). spec 삭제 후
    //   resolveActiveContainerVariants(builder catalog fallback)이 Skia layout 에 적용.
    //   DOM 은 수동 TagGroup.css `[data-label-position="side"]` selector 가 담당(별도 축).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
  },
  // TagList — chip 컨테이너 shell (ADR-912 collection sub-part cutover, 2026-06-15). 시각 없음:
  //   chip 시각은 cutover 된 Tag(appendTagRowProjection → Tag SceneNode)가 단독 담당. TagList
  //   SceneNode 는 transparent box shell(rowsGroup projection owner). 기존 accent/neutral/negative
  //   variant 는 Tag chip semantic 이라 컨테이너 rule 에 dead → 단일 transparent default 로 정리.
  TagList: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
    },
    // gap = chip 간(inter-chip) 간격 — TagList(컨테이너) 소관 layout gap (ADR-912 cutover
    //   2026-06-15: TAG_CHIP_SIZES.gap 이관). chip 자체 치수(lineHeight/paddingX/fontSize/
    //   borderRadius/height)는 Tag rule 에 존재 — utils.ts calculateContentHeight 가 chip 치수=
    //   Tag rule, gap=본 TagList rule 로 분리 read. 값 보존: sm/md=4, lg=6.
    sizes: {
      sm: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 32,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 32,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 32,
        gap: 6,
      },
    },
  },
  TailSwatch: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
      },
      states: {},
    },
  },
  Text: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-151 B22 (2026-07-16): generated/수동 CSS 의 base `width: 100%` 를 layout 이
    //   미소비 — flex 부모에서 fit-content 붕괴 (block 부모는 IFC 주입이 가림). layout
    //   fallback 채널(top-level)로 공급. CSS 는 기존 규칙 그대로 — generated CSS diff 0.
    containerStyles: {
      width: "100%",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 위험군 해소(2026-06-04): TEXT_LEAF catalog 측정/렌더 fontWeight drift 차단.
        //   buildCatalogShapes fallback 500 ↔ Text spec render.shapes 400 → variant.textWeight=400
        //   명시(Checkbox/Radio step 2 선례 동형). 누락 시 catalog 전환으로 Text 가 400→500 굵어짐.
        textWeight: 400,
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        lineHeight: "{typography.text-xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "2xl": {
        fontSize: "{typography.text-2xl}",
        lineHeight: "{typography.text-2xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      "3xl": {
        fontSize: "{typography.text-3xl}",
        lineHeight: "{typography.text-3xl--line-height}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    structure: {
      archetype: "text",
      element: "p",
      containerStyles: {
        display: "block",
        width: "100%",
      },
    },
  },
  TextArea: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TextArea.spec.sizes 미러). padding 은 input-base archetype + composition
      //   ownsContainerBox → 미emit 이라 paddingX/paddingY 보강 불요(gap 만).
      sm: {
        paddingX: 10,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 64,
        gap: 4,
      },
      md: {
        paddingX: 14,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 80,
        gap: 6,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 120,
        gap: 8,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.lg}",
        height: 160,
        gap: 10,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/TextField/NumberField/SearchField/ColorField 동형). field family side SSOT
    //   일원화 (generate-css.ts STRUCTURE_META 도 동시 flex-row). Skia sideMode 트리거 styles 만.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "input-base",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본, TextField/SearchField 동형 정정).
          //   factory inline(width:100%, FormComponents createDefaultTextAreaProps) ↔ CSS Preview
          //   (fit-content) 시각 비대칭 + Style Panel false dirty 해소. CSS 재생성 시 width:100%.
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "ta-label",
            variables: {
              xs: {
                "--ta-label-size": "var(--text-2xs)",
                "--ta-label-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--ta-label-size": "var(--text-xs)",
                "--ta-label-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--ta-label-size": "var(--text-sm)",
                "--ta-label-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--ta-label-size": "var(--text-base)",
                "--ta-label-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--ta-label-size": "var(--text-lg)",
                "--ta-label-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              "--label-font-size": "var(--ta-label-size)",
              "--label-line-height": "var(--ta-label-line-height)",
            },
          },
        ],
      },
    },
  },
  TextField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TextField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만).
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.sm}",
        height: 18,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        gap: 6,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        gap: 8,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        gap: 10,
      },
    },
    // ADR-913 후속 fix (2026-06-19): label-position:side 를 grid → flex-row 로 통일 (DateField/
    //   TimeField/NumberField/SearchField 동형). TextField 는 별도 결함(DELEGATING 미등록 → generic
    //   경로 → data-label-position DOM 미emit → side selector 영원히 미매칭)도 함께 수정됨
    //   (CanonicalNodeRenderer DELEGATING_RAC_RENDERERS 등록). flex-row 통일로 emit 복원 후 generated
    //   CSS = Skia(getSideLabelParentStyle) 대칭. Skia sideMode 트리거 styles 만(nested DOM 제외).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-06-24: width fit-content → 100% (field 패밀리 정본). TextField/SearchField 만
          //   stale fit-content 가 남아 factory inline(width:100%, FormComponents) ↔ CSS Preview
          //   (fit-content) 시각 비대칭 + Style Panel false dirty 였다. NumberField/DateField/TimeField
          //   는 catalog 가 width 를 안 채워(factory 100% 가 baseline) 정합 — 같은 패밀리 outlier 정정.
          //   ColorField 가 이미 width:100% 정본(2026-06-23). CSS 재생성 시 .react-aria-TextField
          //   width:100% 로 Skia(factory) 대칭.
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              styles: {
                "--tf-border": "transparent",
                "--tf-bg": "transparent",
              },
              nested: [
                {
                  selector: ".react-aria-Input",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector: ".react-aria-Input:where([data-focused])",
                  styles: {
                    outline: "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-Input:where([data-invalid])",
                  styles: {
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "tf-label",
            variables: {
              xs: {
                "--tf-label-size": "var(--text-2xs)",
                "--tf-label-margin": "0px",
              },
              sm: {
                "--tf-label-size": "var(--text-xs)",
                "--tf-label-margin": "0px",
              },
              md: {
                "--tf-label-size": "var(--text-sm)",
                "--tf-label-margin": "2px",
              },
              lg: {
                "--tf-label-size": "var(--text-base)",
                "--tf-label-margin": "4px",
              },
              xl: {
                "--tf-label-size": "var(--text-lg)",
                "--tf-label-margin": "6px",
              },
            },
            bridges: {
              "--label-font-size": "var(--tf-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--tf-label-margin)",
            },
          },
          {
            childSelector: ".react-aria-Input",
            prefix: "tf-input",
            variables: {
              xs: {
                "--tf-input-padding": "var(--spacing-3xs) var(--spacing-xs)",
                "--tf-input-size": "var(--text-2xs)",
                "--tf-input-line-height": "var(--text-2xs--line-height)",
              },
              sm: {
                "--tf-input-padding": "var(--spacing-2xs) var(--spacing-sm)",
                "--tf-input-size": "var(--text-xs)",
                "--tf-input-line-height": "var(--text-xs--line-height)",
              },
              md: {
                "--tf-input-padding": "var(--spacing-xs) var(--spacing-md)",
                "--tf-input-size": "var(--text-sm)",
                "--tf-input-line-height": "var(--text-sm--line-height)",
              },
              lg: {
                "--tf-input-padding": "var(--spacing-sm) var(--spacing-lg)",
                "--tf-input-size": "var(--text-base)",
                "--tf-input-line-height": "var(--text-base--line-height)",
              },
              xl: {
                "--tf-input-padding": "var(--spacing-md) var(--spacing-xl)",
                "--tf-input-size": "var(--text-lg)",
                "--tf-input-line-height": "var(--text-lg--line-height)",
              },
            },
            bridges: {
              "--input-padding": "var(--tf-input-padding)",
              "--input-font-size": "var(--tf-input-size)",
              "--input-line-height": "var(--tf-input-line-height)",
            },
            states: {
              "[data-hovered]:not([data-focused]):not([data-disabled])": {
                "border-color": "var(--border-hover)",
              },
              "[data-focused]": {
                outline: "2px solid var(--accent)",
                "outline-offset": "-1px",
                "border-color": "var(--accent)",
              },
              "[data-invalid]": {
                "border-color": "var(--negative)",
              },
              "[data-invalid][data-focused]": {
                "outline-color": "var(--negative)",
              },
              "[data-disabled]": {
                "border-color":
                  "color-mix(in srgb, var(--fg) 12%, transparent)",
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
                opacity: "0.38",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "tf-hint",
            variables: {
              xs: {
                "--tf-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--tf-hint-size": "var(--text-xs)",
              },
              md: {
                "--tf-hint-size": "var(--text-sm)",
              },
              lg: {
                "--tf-hint-size": "var(--text-base)",
              },
              xl: {
                "--tf-hint-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--error-font-size": "var(--tf-hint-size)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--tf-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  TimeField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS `gap: Npx`
      //   재생성용 (TimeField.spec.sizes 미러). padding 은 composition.layout=flex-column root
      //   ownsContainerBox → 미emit 이라 보강 불요(gap 만). borderRadius:0 은 spec 일치.
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: 22,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: 30,
        gap: 6,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: 0,
        height: 42,
        gap: 8,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: 0,
        height: 54,
        gap: 10,
      },
    },
    // ADR-913 slice 2 (2026-06-18): label-position:side Skia 복구 — DateField/ComboBox 동형
    //   (flex-direction:row). ADR-912 단계5 step4 누락분(measure gap[7], breakdown §5 lock-in).
    //   generated TimeField.css:237-240 side 블록과 byte-identical. Skia sideMode 트리거 styles 만 —
    //   quiet nested(.react-aria-DateInput)는 DOM generated CSS 전용 제외.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
      },
      states: {
        hover: {},
        pressed: {},
        disabled: {
          opacity: 0.38,
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-column",
        gap: "var(--spacing-xs)",
        containerStyles: {
          // 2026-07-15: field 패밀리 root width catalog 정본 (fieldFamilyWidthContract.test.ts).
          //   패널 Transform width = toStr(inline, specDefault, "auto") 이고 specDefault 가 이 값 →
          //   부재 시 "auto" 로 떨어진다 (DatePicker 적발 지점).
          width: "100%",
        },
        containerVariants: {
          "label-position": {
            side: {
              styles: {
                "flex-direction": "row",
                "align-items": "flex-start",
              },
            },
          },
          quiet: {
            true: {
              nested: [
                {
                  selector: ".react-aria-DateInput",
                  styles: {
                    background: "transparent",
                    "border-color": "transparent",
                    "box-shadow": "none",
                    "border-radius": "0",
                    "border-bottom": "1px solid var(--border)",
                  },
                },
                {
                  selector: ".react-aria-DateInput:where([data-focused])",
                  styles: {
                    outline: "none",
                    "border-bottom-color": "var(--accent)",
                  },
                },
                {
                  selector: ".react-aria-DateInput:where([data-invalid])",
                  styles: {
                    "border-bottom-color": "var(--negative)",
                  },
                },
              ],
            },
          },
        },
        delegation: [
          {
            childSelector: ".react-aria-Label",
            prefix: "time-field-label",
            variables: {
              xs: {
                "--time-field-label-size": "var(--text-2xs)",
              },
              sm: {
                "--time-field-label-size": "var(--text-xs)",
              },
              md: {
                "--time-field-label-size": "var(--text-sm)",
              },
              lg: {
                "--time-field-label-size": "var(--text-base)",
              },
              xl: {
                "--time-field-label-size": "var(--text-lg)",
              },
            },
            bridges: {
              "--label-font-size": "var(--time-field-label-size)",
              "--label-font-weight": "600",
              "--label-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: ".react-aria-DateInput",
            prefix: "time-field-input",
            variables: {
              xs: {
                "--time-field-input-padding":
                  "var(--spacing-3xs) var(--spacing-xs)",
                "--time-field-input-size": "var(--text-2xs)",
                "--time-field-input-line-height":
                  "var(--text-2xs--line-height)",
                "--time-field-input-min-width": "100px",
              },
              sm: {
                "--time-field-input-padding":
                  "var(--spacing-2xs) var(--spacing-sm)",
                "--time-field-input-size": "var(--text-xs)",
                "--time-field-input-line-height": "var(--text-xs--line-height)",
                "--time-field-input-min-width": "120px",
              },
              md: {
                "--time-field-input-padding":
                  "var(--spacing-xs) var(--spacing-md)",
                "--time-field-input-size": "var(--text-sm)",
                "--time-field-input-line-height": "var(--text-sm--line-height)",
                "--time-field-input-min-width": "150px",
              },
              lg: {
                "--time-field-input-padding":
                  "var(--spacing-sm) var(--spacing-lg)",
                "--time-field-input-size": "var(--text-base)",
                "--time-field-input-line-height":
                  "var(--text-base--line-height)",
                "--time-field-input-min-width": "180px",
              },
              xl: {
                "--time-field-input-padding":
                  "var(--spacing-md) var(--spacing-xl)",
                "--time-field-input-size": "var(--text-lg)",
                "--time-field-input-line-height": "var(--text-lg--line-height)",
                "--time-field-input-min-width": "220px",
              },
            },
            bridges: {
              display: "inline-flex",
              padding: "var(--time-field-input-padding)",
              background: "var(--bg-inset)",
              border: "1px solid",
              "border-radius": "var(--border-radius)",
              width: "100%",
              "min-width": "var(--time-field-input-min-width)",
              "white-space": "nowrap",
              "forced-color-adjust": "none",
              "font-size": "var(--time-field-input-size)",
              "line-height": "var(--time-field-input-line-height)",
              transition:
                "border-color 200ms ease, background-color 200ms ease",
            },
          },
          {
            childSelector: ".react-aria-DateSegment",
            prefix: "time-field-segment",
            variables: {
              xs: {
                "--time-field-segment-size": "var(--text-2xs)",
              },
              sm: {
                "--time-field-segment-size": "var(--text-xs)",
              },
              md: {
                "--time-field-segment-size": "var(--text-sm)",
              },
              lg: {
                "--time-field-segment-size": "var(--text-base)",
              },
              xl: {
                "--time-field-segment-size": "var(--text-lg)",
              },
            },
            bridges: {
              padding: "0 2px",
              border: "none",
              background: "transparent",
              height: "auto",
              "font-variant-numeric": "tabular-nums",
              "text-align": "end",
              color: "var(--fg)",
              "border-radius": "var(--radius-xs)",
              "font-size": "var(--time-field-segment-size)",
              transition: "all 150ms ease",
            },
            states: {
              '[data-type="literal"]': {
                padding: "0",
              },
              "[data-placeholder]": {
                color: "var(--fg-muted)",
                opacity: "0.6",
              },
              ":focus": {
                color: "var(--fg)",
                background: "var(--accent-subtle)",
                outline: "none",
                "border-radius": "var(--radius-xs)",
                "caret-color": "transparent",
              },
              "[data-invalid]": {
                color: "var(--negative)",
              },
              // 2026-06-22 reference 정합(ADR-914 Tier1): reference DateField.css:62-64 의
              //   [data-invalid]:focus 는 solid `--highlight-background-invalid` + `--highlight-foreground`(흰)
              //   = 전경/배경 전체 반전. 기존 15% 반투명 tint + 적색 전경(반전 없음)은 가독성/대비 약화.
              //   filled bg → 전경 동반(on-negative=--color-white) 패턴은 Table 선택행 fix 와 동축.
              //   DateSegment 단일 시각 contract — DateField/DatePicker/DateRangePicker/TimeField 4곳 동일 정합.
              "[data-invalid]:focus": {
                background: "var(--negative)",
                color: "var(--color-white)",
              },
              "[data-disabled]": {
                color: "color-mix(in srgb, var(--fg) 38%, transparent)",
                cursor: "not-allowed",
              },
            },
          },
          {
            childSelector: ".react-aria-FieldError",
            prefix: "time-field-hint",
            variables: {
              xs: {
                "--time-field-hint-size": "var(--text-2xs)",
              },
              sm: {
                "--time-field-hint-size": "var(--text-xs)",
              },
              md: {
                "--time-field-hint-size": "var(--text-xs)",
              },
              lg: {
                "--time-field-hint-size": "var(--text-sm)",
              },
              xl: {
                "--time-field-hint-size": "var(--text-base)",
              },
            },
            bridges: {
              "--error-font-size": "var(--time-field-hint-size)",
              "--error-margin": "var(--spacing-xs)",
            },
          },
          {
            childSelector: '[slot="description"]',
            bridges: {
              "font-size": "var(--time-field-hint-size)",
              color: "var(--fg-muted)",
            },
          },
        ],
      },
    },
  },
  Toast: {
    defaultVariant: "info",
    defaultSize: "md",
    variants: {
      info: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.positive-subtle}",
            hover: "{color.positive-subtle}",
            pressed: "{color.positive-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.positive}",
        },
      },
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative-subtle}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.negative}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 40,
        iconSize: 16,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 48,
        iconSize: 20,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 56,
        iconSize: 24,
      },
    },
    structure: {
      archetype: "alert",
      element: "div",
      containerStyles: undefined,
      states: {
        disabled: {
          opacity: 0.38,
        },
      },
    },
  },
  ToggleButton: {
    defaultVariant: "default",
    defaultSize: "md",
    // top-level containerStyles — Button 동일 발산 차단(Skia INLINE_BLOCK_TAGS("togglebutton")
    //   → block). display 는 `flex`(Direction selector 가 inline-flex 미인식 → block 표시 회피).
    //   gap=sizes[size].
    containerStyles: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-hover}",
            pressed: "{color.neutral-pressed}",
            selected: "{color.neutral}",
            emphasizedSelected: "{color.accent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
          selectedText: "{color.base}",
          selectedBorder: "{color.neutral}",
          emphasizedSelectedText: "{color.on-accent}",
          emphasizedSelectedBorder: "{color.accent}",
        },
      },
    },
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        paddingY: 1,
        gap: 4,
        iconSize: 14,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        paddingY: 2,
        gap: 6,
        iconSize: 16,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
        paddingY: 4,
        gap: 8,
        iconSize: 18,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
        paddingY: 8,
        gap: 10,
        iconSize: 24,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
        paddingY: 12,
        gap: 12,
        iconSize: 28,
      },
    },
    structure: {
      archetype: "button",
      element: "button",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "fit-content",
      },
      states: {
        hover: {},
        pressed: {
          scale: 0.95,
        },
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      cssEmitMode: "button-base",
    },
  },
  ToggleButtonGroup: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-913 slice 1 (2026-06-18): Skia layout fallback (resolveContainerStylesFallback →
    //   LOWERCASE_COMPONENT_RULE_CONTAINER) 이 본 필드를 읽어 display:flex 주입. ADR-912 cutover 가
    //   STRUCTURE_META(generate-css 전용) 에만 containerStyles 를 넣고 rule entry 에는 누락시켜,
    //   spec 삭제 후 Skia 가 display 미주입 → 자식 세로 배치 회귀(starter ToggleButtonGroup.css line 4
    //   `display:flex` 정본 미반영). flexDirection 은 implicitStyles togglebuttongroup 분기가
    //   orientation(row/column)으로 처리 → base 는 display/alignItems 만(STRUCTURE_META 와 동일).
    containerStyles: {
      display: "flex",
      alignItems: "center",
      width: "fit-content",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
            hover: "{color.transparent}",
            pressed: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.transparent}",
        },
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
      },
      states: {
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        layout: "flex-row",
        containerStyles: {
          width: "fit-content",
        },
        delegation: [
          {
            childSelector: ".react-aria-ToggleButton",
            // --btn-border-radius: SelectionIndicator pill + segmented 코너 radius 공용.
            //   값은 ToggleButton.css 의 size별 border-radius 와 일치(xs/sm→sm, md→md,
            //   lg/xl→lg) — segmented containerVariants 의 first/last-child 코너가 이 변수를
            //   참조하여 size 분기 없이 size별 radius 정합(2026-06-22 segmented 추가).
            variables: {
              xs: {
                "--btn-border-radius": "var(--radius-sm)",
              },
              sm: {
                "--btn-border-radius": "var(--radius-sm)",
              },
              md: {
                "--btn-border-radius": "var(--radius-md)",
              },
              lg: {
                "--btn-border-radius": "var(--radius-lg)",
              },
              xl: {
                "--btn-border-radius": "var(--radius-lg)",
              },
            },
          },
        ],
        // ── segmented control border-radius (reference react-aria-starter
        //    ToggleButtonGroup.css:32-67 동형, 2026-06-22) ──
        //   그룹 안 ToggleButton 은 양끝만 바깥쪽 코너가 둥글고(--btn-border-radius, size별),
        //   중간은 0, 인접 버튼은 -1px margin 으로 border 겹침(double border 제거 = 단일 분할선).
        //   orientation × first/last/middle 조합. CSS: CSSGenerator containerVariants nested emit
        //   (root 인접 [data-orientation] + `> .react-aria-ToggleButton:first-child`).
        //   Skia: buildCatalogShapes 가 props._groupPosition 으로 four-corner radius 산출(대칭).
        //   nested(top-level 아님) 필수 — top-level containerVariants 는 Skia resolver 전용,
        //   CSS emit 은 structure.composition.containerVariants 만 소비
        //   (feedback-catalog-variant-toplevel-vs-nested-asymmetry).
        containerVariants: {
          orientation: {
            horizontal: {
              styles: {
                "flex-direction": "row",
              },
              // selector 가 `> * >` 로 marker div(display:contents) 를 경유하는 이유:
              //   빌더 preview(CanonicalNodeRenderer)는 delegating 컴포넌트의 각 자식을
              //   `<div style="display:contents">`(data-element-id marker, 보편 패턴) 로 감싼다.
              //   따라서 ToggleButton 은 group 의 직접 자식이 아니라 marker div 의 자식이라
              //   reference 의 `> .react-aria-ToggleButton` direct-child 결합이 깨진다.
              //   `:first-child`/`:last-child` 는 marker div(`> *:first-child`) 위치로 판정
              //   (각 marker 안 ToggleButton 은 유일 자식). display:contents 라 margin/radius 는
              //   marker div 가 아닌 ToggleButton 자신에 적용해야 시각 반영(box 미생성).
              //   reference 시각 규칙(양끝만 둥근 segmented bar)은 동일, selector 형태만 marker
              //   구조 적응(2026-06-22, Skia 는 marker 없어 _groupPosition 으로 직접 판정).
              nested: [
                {
                  selector: "> * > .react-aria-ToggleButton",
                  styles: {
                    "border-radius": "0",
                    "margin-inline-start": "-1px",
                  },
                },
                {
                  selector: "> *:first-child > .react-aria-ToggleButton",
                  styles: {
                    "border-radius":
                      "var(--btn-border-radius) 0 0 var(--btn-border-radius)",
                    "margin-inline-start": "0",
                  },
                },
                {
                  selector: "> *:last-child > .react-aria-ToggleButton",
                  styles: {
                    "border-radius":
                      "0 var(--btn-border-radius) var(--btn-border-radius) 0",
                  },
                },
              ],
            },
            vertical: {
              styles: {
                "flex-direction": "column",
                width: "fit-content",
              },
              // horizontal 동형 — marker div(display:contents) 경유 selector. 상세 위 주석.
              nested: [
                {
                  selector: "> * > .react-aria-ToggleButton",
                  styles: {
                    "border-radius": "0",
                    "margin-block-start": "-1px",
                  },
                },
                {
                  selector: "> *:first-child > .react-aria-ToggleButton",
                  styles: {
                    "border-radius":
                      "var(--btn-border-radius) var(--btn-border-radius) 0 0",
                    "margin-block-start": "0",
                  },
                },
                {
                  selector: "> *:last-child > .react-aria-ToggleButton",
                  styles: {
                    "border-radius":
                      "0 0 var(--btn-border-radius) var(--btn-border-radius)",
                  },
                },
              ],
            },
          },
        },
        // ── group-conditional pressed micro-interaction (reference react-aria-starter
        //    ToggleButtonGroup.css:6-19 동형, 2026-06-22) ──
        //   reference: 그룹 안 ToggleButton 은 pressed 시 버튼 box 는 축소 안 하고(scale:1, 단독
        //   ToggleButton 의 scale:0.95 override) 내부 콘텐츠(`> span`)만 0.9 로 축소 + 200ms
        //   transition. 버튼 box 축소를 막아야 -1px segmented 겹침이 흐트러지지 않는다(단일 bar 유지).
        //   reference 의 pressed-scale 블록은 base(orientation-independent) 영역(css:6-29)에 위치 →
        //   orientation gate 없는 staticSelectors 가 vehicle(Toolbar 선례 11822). containerVariants
        //   는 항상 [data-orientation] gate 를 붙여(CSSGenerator) horizontal+vertical 중복 강제 →
        //   부적합(feedback-catalog-variant-toplevel-vs-nested-asymmetry).
        //   transform vs scale 함정: 단독 ToggleButton 은 generated CSS 가 `transform: scale(0.95)`
        //   (states.pressed.scale → CSSGenerator transform 속성 변환)라 reference 의 `scale:1` 로는
        //   무력화 불가(서로 다른 합성 CSS 속성). 버튼 box 고정은 `transform: none` 으로 emit.
        //   staticSelectors 는 nested 미지원(Record<string,Record<string,string>>) → 3 top-level key.
        //   marker div(display:contents): staticSelectors 는 `${root} ${selector}` descendant 형식
        //   이라 marker 를 자동 통과(direct-child `>` 함정 없음). `> span` 은 ToggleButton 기준 직접
        //   자식이고 ToggleButton.tsx 가 group 멤버십(isGroupMember)일 때만 span 을 렌더하므로
        //   group-scoped selector 와 1:1 매칭. standalone(group 밖)은 span 미렌더+소비 CSS 없음이라
        //   양쪽 정합(span 조건부 렌더, 2026-06-27).
        //   Skia 는 transient pressed flag 가 파이프라인에 없어(resting-state 전용 렌더) scope 밖 —
        //   CSS-only(feedback-no-dormant-foundation-ahead-of-flip).
        staticSelectors: {
          ".react-aria-ToggleButton[data-pressed]": {
            transform: "none",
          },
          ".react-aria-ToggleButton > span": {
            // display:inherit → span 이 부모 ToggleButton 의 display(group=flex / standalone=
            //   inline-flex)를 상속한다. 미지정 시 span 은 기본 display:block 이라 아이콘+텍스트
            //   ToggleButton 의 자식(Icon div + Text span)이 세로로 쌓여(block flow) Skia(span 모름
            //   → ToggleButton flex 가 Icon/Text 를 가로 배치)와 비대칭이었다. inherit 로 span 이
            //   flex 가 되면 Icon/Text 가 가로 정렬돼 Skia 와 정합(2026-06-27). 텍스트-only 토글은
            //   위치 불변(이미 단일 자식 중앙). align/gap 은 flex 비상속이라 부모 정렬값을 명시.
            display: "inherit",
            "align-items": "center",
            "justify-content": "center",
            gap: "8px",
            transition: "scale 200ms",
          },
          ".react-aria-ToggleButton[data-pressed] > span": {
            scale: "0.9",
          },
        },
      },
      indicatorMode: {
        fill: {
          base: "{color.layer-1}",
        },
        selectedText: "{color.on-accent}",
        borderRadius: "{radius.sm}",
        boxShadow: "{shadow.sm}",
        transitionMs: 200,
      },
    },
  },
  Toolbar: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 small-B (2026-06-16): gap 보강 — spec 삭제 후 generated CSS [data-size]
      //   `gap: Npx` 재생성용 (Toolbar.spec.sizes 미러). base gap:8px 는 composition.containerStyles
      //   별도 경로. padding 미emit(ownsContainerBox).
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
        gap: 8,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
        gap: 10,
      },
    },
    structure: {
      archetype: "default",
      element: "div",
      containerStyles: {
        display: "flex",
        alignItems: "center",
        width: "fit-content",
      },
      states: {
        disabled: {
          opacity: 0.38,
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
      composition: {
        containerStyles: {
          display: "flex",
          "flex-wrap": "wrap",
          gap: "8px",
          width: "fit-content",
        },
        containerVariants: {
          orientation: {
            horizontal: {
              styles: {
                "flex-direction": "row",
              },
            },
            vertical: {
              styles: {
                "flex-direction": "column",
                "align-items": "start",
              },
            },
          },
        },
        staticSelectors: {
          ".react-aria-Group": {
            display: "contents",
          },
          ".react-aria-ToggleButton": {
            width: "32px",
          },
          ".react-aria-Separator": {
            "align-self": "stretch",
            "background-color": "var(--bg-muted)",
          },
          '.react-aria-Separator[aria-orientation="vertical"]': {
            width: "1px",
            margin: "0px 10px",
          },
          '.react-aria-Separator:not([aria-orientation="vertical"])': {
            border: "none",
            height: "1px",
            width: "100%",
            margin: "10px 0",
          },
        },
        delegation: [],
      },
    },
  },
  Tooltip: {
    defaultVariant: "neutral",
    defaultSize: "md",
    variants: {
      neutral: {
        fill: {
          default: {
            base: "{color.neutral-subtle}",
            hover: "{color.neutral-subtle}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      info: {
        fill: {
          default: {
            base: "{color.informative-subtle}",
            hover: "{color.informative-subtle}",
            pressed: "{color.informative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      positive: {
        fill: {
          default: {
            base: "{color.positive-subtle}",
            hover: "{color.positive-subtle}",
            pressed: "{color.positive-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
      negative: {
        fill: {
          default: {
            base: "{color.negative-subtle}",
            hover: "{color.negative-subtle}",
            pressed: "{color.negative-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      // ADR-912 단계5 step4 (2026-06-16): paddingY 보강 — generated CSS 의 `padding: {Y}px {X}px`
      //   Y값(sm:4/md:6/lg:8)이 rule 에서 emit 되도록(TooltipSpec.sizes.paddingY 미러). spec 삭제
      //   후 STRUCTURE_META virtual override 가 동일 padding 재생성 → diff 0. paddingX 와 대칭.
      sm: {
        paddingX: 8,
        paddingY: 4,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      md: {
        paddingX: 10,
        paddingY: 6,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      lg: {
        paddingX: 12,
        paddingY: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
    },
    structure: {
      archetype: "simple",
      element: "div",
      containerStyles: {
        display: "inline-flex",
        alignItems: "center",
        // 2026-07-25: overlay elevation 정본 이관 (Popover 동형). Popover 보다 한 단계 약한
        //   elevation. ADR-166 Phase 2: `{shadow.sm}` = SP2 `emphasized`. 구 값의 기하
        //   (0 2px 8px)가 SP2 `emphasized` 최상위 레이어와 정확히 일치 — 출처 복귀(ADR §9-4).
        boxShadow: "{shadow.sm}",
      },
      states: {
        disabled: {
          opacity: 0.38,
          cursor: "not-allowed",
          pointerEvents: "none",
        },
        focusVisible: {
          focusRing: "{focus.ring.default}",
        },
      },
    },
  },
  Tree: {
    defaultVariant: "default",
    defaultSize: "md",
    // ADR-913 slice 4 (2026-06-19): ListBox/Menu/TagGroup 동형 collection cutover 멤버인데
    //   ADR-912 단계5 step4 배치에서 containerStyles 이관 누락 → spec 삭제 후 Skia layout
    //   fallback(resolveContainerStylesFallback → LOWERCASE_COMPONENT_RULE_CONTAINER)이 빈
    //   객체 반환 → display 미주입 → Taffy block 처리 → TreeItem 세로 배치 안 됨. DOM 은
    //   starter Tree.css(flex column) 적용 → CSS↔Skia 비대칭(D3 G3 위반). ToggleButtonGroup
    //   slice 0 / ListBox 선례 동형 수정. 값 = starter Tree.css(:3-15) + Menu/ListBox 정합.
    containerStyles: {
      display: "flex",
      flexDirection: "column",
      // 실효 gap 0 — starter Tree.css `@supports selector(:has(.foo))` 블록이 gap:0 재선언
      //   (selected 행 이어붙임 디자인, 모던 브라우저 전부 매치). 2xs(2px)는 dead 값 (2026-07-14).
      gap: "0px",
      padding: "{spacing.xs}",
      width: "100%",
      maxHeight: "300px",
      overflow: "auto",
      outline: "none",
      // ADR-151 B5 (2026-07-16): 수동 Tree.css `border: 1px solid` 를 layout 이 미반영해
      //   세로 2px 발산 (Skia 72 vs CSS 74) — Calendar/RangeCalendar 동형 layout 채널 보정.
      borderWidth: "1px",
    },
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.layer-2}",
            pressed: "{color.layer-1}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.base}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.border}",
        },
      },
    },
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 28,
        iconSize: 14,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 36,
        iconSize: 16,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 44,
        iconSize: 20,
      },
    },
  },
  TreeItem: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
        // ADR-912 R1 후속 (2026-06-12): expand/collapse chevron (TreeItem.spec render.shapes 의
        //   chevron-right 이전, DisclosureHeader (B+icon) 동형). color 는 spec 의
        //   {color.neutral-subdued} 보존. leading_icon skiaPrimitive(append) 가 좌측에 그리고
        //   buildCatalogShapes 가 text 를 icon 폭 + gap 만큼 우측 shift. depth indent 는
        //   _treeLevel × indentPerLevel 로 icon/text 공통 base x 에 가산(buildCatalogShapes).
        leadingIcon: {
          name: "chevron-right",
          gap: 6,
          color: "{color.neutral-subdued}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        // height 24 = spec rowHeight(fontSize 12 + paddingY 6*2). box(height>0) → text
        //   baseline:middle + leading icon y=height/2 (DisclosureHeader parity). 이전 height:0
        //   (inline)은 leading icon 동반 시 baseline drift.
        height: 24,
        paddingX: 8,
        // iconSize = round(fontSize * 1.1) (spec chevronSize 공식).
        iconSize: 13,
        // indentPerLevel 16 = react-aria-starter Tree.css --spacing-4 + drop indicator 16px 정합.
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
      md: {
        // DOM(starter Tree.css)은 size 변형 없는 고정 메트릭: min-height 32(= paddingY 4*2 +
        //   line box 24) + font-size text-base(16) + chevron svg 16. 구 28/text-sm/15 는
        //   spec rowHeight 산술 잔존으로 CSS 실측 대비 -4~-8 drift (2026-07-14 sweep).
        fontSize: "{typography.text-base}",
        height: 32,
        paddingX: 8,
        iconSize: 16,
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
      lg: {
        fontSize: "{typography.text-base}",
        height: 32,
        paddingX: 12,
        iconSize: 18,
        indentPerLevel: 16,
        borderRadius: "{radius.none}",
      },
    },
  },
  // ADR-912 Pattern B (collection sub-part, 2026-06-13): TableCell catalog cutover.
  //   spec.render.shapes(header fw600 / data fw400 cell text) → rule + buildCatalogShapes generic(text).
  //   배경은 부모 TableRow 가 담당 → 셀 fill transparent(text-only). header/data 굵기·정렬은
  //   projection(appendTableRowProjection)이 style.fontWeight/textAlign 보편 D3 주입 → buildCatalogShapes
  //   보편 경로(컴포넌트 식별 분기 0, ADR-142 §3). 시각값 = TableCell.spec.sizes 이전.
  TableCell: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.transparent}",
          },
        },
        colors: {
          text: "{color.neutral}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        paddingX: 8,
        height: 36,
        borderRadius: "{radius.none}",
      },
      md: {
        fontSize: "{typography.text-base}",
        paddingX: 12,
        height: 44,
        borderRadius: "{radius.none}",
      },
      lg: {
        fontSize: "{typography.text-lg}",
        paddingX: 16,
        height: 52,
        borderRadius: "{radius.none}",
      },
    },
  },
  // ADR-912 Pattern B (collection sub-part, 2026-06-13): TableRow catalog cutover.
  //   spec.render.shapes(행 배경 rect + 하단 line) → rule fill base {color.base} + colors.border +
  //   buildCatalogShapes generic(bg box) + table_row_divider skiaPrimitive(append 하단 line).
  //   배경 분기(header/striped/selected)는 projection 이 style.backgroundColor 보편 D3 주입 →
  //   buildCatalogShapes style.backgroundColor 우선 경로(행 종류 모름, ADR-142 §3). rule fill base
  //   {color.base} 는 projection 미주입 시 fallback. divider 선색 = colors.border({color.border}).
  TableRow: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      // colors.border 미선언: spec TableRow.render.shapes 는 행 box 테두리를 그리지 않고
      //   하단 구분선(line)만 그린다. colors.border 를 두면 buildCatalogShapes 가 bg box 에
      //   border 를 덧그려 spec 비대칭(행 전체 테두리) → 미선언. 하단 line 선색은
      //   table_row_divider skiaPrimitive 가 style.borderColor → visual.border → `{color.border}`
      //   fallback 순으로 읽으므로 colors.border 없이도 `{color.border}` 로 정상 렌더된다.
      default: {
        fill: {
          default: {
            base: "{color.base}",
          },
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        height: 36,
        borderRadius: "{radius.none}",
      },
      md: {
        fontSize: "{typography.text-base}",
        height: 44,
        borderRadius: "{radius.none}",
      },
      lg: {
        fontSize: "{typography.text-lg}",
        height: 52,
        borderRadius: "{radius.none}",
      },
    },
  },
};
