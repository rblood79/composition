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
  Accordion: {
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
        height: 0,
      },
    },
  },
  Autocomplete: {
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
        borderRadius: "{radius.md}",
        height: 28,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
      },
    },
  },
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
        borderWidth: 1,
        height: 0,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
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
  },
  Button: {
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
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: "{typography.text-2xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        iconSize: 12,
        paddingX: 4,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
        iconSize: 14,
        paddingX: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
        iconSize: 16,
        paddingX: 12,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
        iconSize: 20,
        paddingX: 16,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        borderWidth: 1,
        height: 0,
        iconSize: 24,
        paddingX: 24,
      },
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
    sizes: {
      sm: {
        paddingX: 4,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: 20,
      },
      md: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 26,
      },
      lg: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 32,
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
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
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
  },
  Card: {
    defaultSize: "md",
    variants: {},
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
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
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
  CheckboxItems: {
    defaultSize: "md",
    variants: {},
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
      xs: {
        paddingX: 6,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 28,
        iconSize: 18,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 32,
        iconSize: 20,
      },
      md: {
        paddingX: 10,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
        iconSize: 26,
      },
      lg: {
        paddingX: 12,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 48,
        iconSize: 32,
      },
      xl: {
        paddingX: 14,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 56,
        iconSize: 36,
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
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 20,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 28,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 36,
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
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
      },
    },
  },
  DateField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: 22,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: 30,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: 0,
        height: 42,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: 0,
        height: 54,
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
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 16,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 20,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 52,
        iconSize: 24,
      },
    },
  },
  DateRangePicker: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 16,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 20,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 52,
        iconSize: 24,
      },
    },
  },
  DateSegment: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-2}",
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
            base: "{color.accent-subtle}",
            hover: "{color.accent-subtle}",
            pressed: "{color.accent-subtle}",
          },
        },
        colors: {
          text: "{color.neutral}",
          border: "{color.accent}",
          borderHover: "{color.accent}",
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
          borderHover: "{color.negative}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 24,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 40,
      },
    },
  },
  Description: {
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
      xs: {
        paddingX: 2,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      sm: {
        paddingX: 4,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      md: {
        paddingX: 8,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      lg: {
        paddingX: 12,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.2xl}",
        height: 0,
      },
      xl: {
        paddingX: 16,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.2xl}",
        height: 0,
      },
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
  },
  Disclosure: {
    defaultSize: "md",
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
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  DisclosureGroup: {
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
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        // height 30 = spec rowHeight(fontSize 14 + paddingY 8*2). box(height>0)로 판정 →
        //   text baseline:middle + leading icon y=height/2 정렬(spec parity). 이전 height:0(inline)
        //   은 leading icon 동반 시 baseline drift → 30 보강.
        height: 30,
        // paddingX 12 = spec chevron/text x base. iconSize 15 = spec chevronSize(round(14*1.1)).
        paddingX: 12,
        iconSize: 15,
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
    sizes: {
      sm: {
        paddingX: 16,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        borderWidth: 2,
        height: 80,
        iconSize: 24,
      },
      md: {
        paddingX: 24,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        borderWidth: 2,
        height: 120,
        iconSize: 32,
      },
      lg: {
        paddingX: 32,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        borderWidth: 2,
        height: 160,
        iconSize: 40,
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
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 32,
        iconSize: 14,
      },
      md: {
        paddingX: 24,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 40,
        iconSize: 16,
      },
      lg: {
        paddingX: 32,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 48,
        iconSize: 20,
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
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        paddingX: 20,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      lg: {
        paddingX: 28,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      xl: {
        paddingX: 36,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.2xl}",
        height: 0,
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
  GridListItem: {
    defaultSize: "md",
    variants: {},
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.lg}",
        height: 0,
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
  Header: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  Heading: {
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
        // ADR-912 위험군 해소(2026-06-04): Heading spec render.shapes fontWeight 700 ↔
        //   buildCatalogShapes fallback 500 drift 차단. variant.textWeight=700 명시.
        textWeight: 700,
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
    sizes: {
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: "auto",
      },
      md: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: "auto",
      },
      lg: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: "auto",
      },
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
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        paddingX: 4,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        paddingX: 8,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        paddingX: 12,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        paddingX: 16,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        paddingX: 24,
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
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
    textDecoration: "underline",
  },
  List: {
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
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
        iconSize: 16,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
        iconSize: 20,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 24,
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
    sizes: {
      md: {
        paddingX: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
  },
  ListBoxItem: {
    defaultSize: "md",
    variants: {},
    sizes: {
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.xs}",
        height: 0,
      },
    },
  },
  MaskedFrame: {
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
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 80,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 120,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 200,
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
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.md}",
        height: 32,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.lg}",
        height: 40,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.xl}",
        height: 48,
      },
    },
  },
  Meter: {
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
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.sm}",
        height: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.lg}",
        height: 16,
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
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
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
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 48,
      },
      md: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 56,
      },
      lg: {
        paddingX: 20,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 64,
      },
    },
  },
  NumberField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
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
  },
  Paragraph: {
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
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      lg: {
        paddingX: 20,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
    },
  },
  ProgressBar: {
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
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.sm}",
        height: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.md}",
        height: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.md}",
        height: 16,
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
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
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
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  RadioItems: {
    defaultSize: "md",
    variants: {},
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
        iconSize: 26,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
        iconSize: 32,
      },
    },
  },
  SearchField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
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
      sm: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      md: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
    },
  },
  Select: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
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
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.none}",
        height: 10,
        iconSize: 10,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 14,
        iconSize: 14,
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
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 18,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 22,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
        iconSize: 28,
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
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
      },
      md: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
      },
      lg: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
      },
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
  },
  Slider: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        height: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        height: 8,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        height: 12,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        height: 16,
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
  },
  SliderThumb: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 16,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 20,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 24,
      },
    },
  },
  SliderTrack: {
    defaultSize: "md",
    variants: {},
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
  },
  Slot: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.md}",
        height: 40,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 60,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 80,
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
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 24,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 28,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.none}",
        height: 32,
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
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.full}",
        height: 0,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.full}",
        height: 0,
      },
    },
  },
  Switcher: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          border: "{color.border}",
        },
      },
      accent: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
            pressed: "{color.neutral-subtle}",
          },
        },
        colors: {
          text: "{color.neutral-subdued}",
          border: "{color.accent}",
        },
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 32,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 40,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 48,
      },
    },
  },
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
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
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
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
  Table: {
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
      },
    },
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        height: 18,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        height: 20,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.md}",
        height: 28,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.lg}",
        height: 40,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.lg}",
        height: 52,
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
  },
  TagList: {
    defaultVariant: "default",
    defaultSize: "md",
    variants: {
      default: {
        fill: {
          default: {
            base: "{color.layer-2}",
            hover: "{color.layer-1}",
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
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 32,
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
  },
  Text: {
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
  },
  TextArea: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        paddingX: 10,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.sm}",
        height: 64,
      },
      md: {
        paddingX: 14,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 80,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.md}",
        height: 120,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-xl}",
        borderRadius: "{radius.lg}",
        height: 160,
      },
    },
  },
  TextField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.sm}",
        height: 18,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 54,
      },
    },
  },
  TimeField: {
    defaultSize: "md",
    variants: {},
    sizes: {
      sm: {
        fontSize: "{typography.text-sm}",
        borderRadius: 0,
        height: 22,
      },
      md: {
        fontSize: "{typography.text-base}",
        borderRadius: 0,
        height: 30,
      },
      lg: {
        fontSize: "{typography.text-lg}",
        borderRadius: 0,
        height: 42,
      },
      xl: {
        fontSize: "{typography.text-xl}",
        borderRadius: 0,
        height: 54,
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
  },
  ToggleButton: {
    defaultVariant: "default",
    defaultSize: "md",
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
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        borderWidth: 1,
        height: 0,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.md}",
        borderWidth: 1,
        height: 0,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: 28,
        borderRadius: "{radius.lg}",
        borderWidth: 1,
        height: 0,
      },
    },
  },
  ToggleButtonGroup: {
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
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.lg}",
        height: 0,
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
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      md: {
        paddingX: 10,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 0,
      },
      lg: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
    },
  },
  Tree: {
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
      },
    },
    sizes: {
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.none}",
        height: 0,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.none}",
        height: 0,
      },
    },
  },
};
