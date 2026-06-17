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
        paddingY: 1,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        lineHeight: "{typography.text-xs--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
        paddingY: 2,
        gap: 4,
      },
      md: {
        paddingX: 12,
        fontSize: "{typography.text-sm}",
        lineHeight: "{typography.text-sm--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
        paddingY: 4,
        gap: 4,
      },
      lg: {
        paddingX: 16,
        fontSize: "{typography.text-base}",
        lineHeight: "{typography.text-base--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
        paddingY: 8,
        gap: 6,
      },
      xl: {
        paddingX: 24,
        fontSize: "{typography.text-lg}",
        lineHeight: "{typography.text-lg--line-height}",
        borderRadius: "{radius.full}",
        borderWidth: 1,
        height: 0,
        paddingY: 12,
        gap: 8,
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
        iconSize: 14,
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
        iconSize: 16,
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
        iconSize: 20,
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
        iconSize: 24,
        paddingX: 24,
        paddingY: 12,
        gap: 12,
        iconGap: 12,
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
    // ADR-912 단계5 step4 (2026-06-17): ComboBoxSpec.spec 삭제 대비 — generate-css virtual emit 이
    //   base/size block 의 `gap: Npx` 를 byte-identical 재현하려면 gap 필수(Select 동형). paddingY 는
    //   미보충(padding 은 composition.delegation .combobox-container --combo-container-padding 가 담당).
    sizes: {
      xs: {
        paddingX: 4,
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
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
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
        gap: 2,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 16,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 20,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 52,
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
  },
  DateRangePicker: {
    defaultSize: "md",
    variants: {},
    // ADR-912 단계5 step4 (2026-06-17): gap 보강 — spec.sizes(DATE_PICKER_SIZES 공유) 의 gap 이관 (DatePicker 동일).
    sizes: {
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
        gap: 2,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
        gap: 4,
      },
      md: {
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 30,
        iconSize: 16,
        gap: 4,
      },
      lg: {
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 42,
        iconSize: 20,
        gap: 4,
      },
      xl: {
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.xl}",
        height: 52,
        iconSize: 24,
        gap: 8,
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
      // ADR-912 단계5 step4 (2026-06-16): paddingY/gap 보강 — generated CSS 의 `padding: {Y}px {X}px`
      //   + `gap: {gap}px` 가 rule 에서 emit 되도록(DialogSpec.sizes 미러, paddingX==paddingY).
      //   spec 삭제 후 STRUCTURE_META virtual override 가 동일 padding/gap 재생성 → diff 0.
      xs: {
        paddingX: 2,
        paddingY: 2,
        gap: 4,
        fontSize: "{typography.text-sm}",
        borderRadius: "{radius.md}",
        height: 0,
      },
      sm: {
        paddingX: 4,
        paddingY: 4,
        gap: 8,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.lg}",
        height: 0,
      },
      md: {
        paddingX: 8,
        paddingY: 8,
        gap: 12,
        fontSize: "{typography.text-base}",
        borderRadius: "{radius.xl}",
        height: 0,
      },
      lg: {
        paddingX: 12,
        paddingY: 12,
        gap: 16,
        fontSize: "{typography.text-lg}",
        borderRadius: "{radius.2xl}",
        height: 0,
      },
      xl: {
        paddingX: 16,
        paddingY: 16,
        gap: 20,
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
    defaultVariant: "default",
    defaultSize: "md",
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
        // virtual/short 콘텐츠 시 축소 하한 (spec.sizes.md.minHeight 20 — line-box 최소).
        //   generate-css virtual 이 `min-height: 20px` emit (ADR-912 collection item leaf cutover).
        minHeight: 20,
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
    // ADR-912 단계5 step4 (2026-06-17): NumberField.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — spec 삭제(91c2be0dd) 로 side variant 회귀. Skia layout 은
    //   styles.display==="grid" 로 sideMode 판정 후 getSideLabelParentStyle(flex/row/wrap 하드코딩)
    //   적용 — styles 만 필요. nested(> .react-aria-Label DOM selector)는 generated CSS 전용 제외.
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns":
              "var(--form-label-width, max-content) minmax(0, 1fr)",
            "column-gap": "var(--form-field-gap, var(--spacing-md))",
            "row-gap": "var(--spacing-xs)",
            "align-items": "start",
            width: "100%",
          },
        },
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
        iconSize: 10,
        gap: 2,
      },
      sm: {
        paddingX: 8,
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
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
      // ADR-912 R1 (2026-06-12): paddingX/paddingY/borderWidth — SelectTrigger.spec.sizes 이전.
      //   layout contentHeight 유도(height - paddingY*2 - borderWidth*2)가 rule 만으로 가능해야
      //   spec 삭제 후 utils.ts/implicitStyles 가 rule 단일 source 로 측정.
      xs: {
        fontSize: "{typography.text-2xs}",
        borderRadius: "{radius.xs}",
        height: 20,
        iconSize: 10,
        paddingX: 4,
        paddingY: 1,
        borderWidth: 1,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.sm}",
        height: 22,
        iconSize: 14,
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
      sm: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 4,
      },
      md: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 8,
      },
      lg: {
        fontSize: "{typography.text-xs}",
        borderRadius: "{radius.none}",
        height: 1,
        paddingX: 0,
        paddingY: 16,
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
        },
      },
    },
    sizes: {
      // ADR-912 영역 B (A) Tag cutover (2026-06-12): paddingX 보강 — buildCatalogShapes 가
      //   text x = paddingX 로 좌측 정렬. Tag.spec sizes.paddingX(xs4/sm8/md12/lg16/xl24) 이전.
      //   미보강 시 `?? 0` fallback 으로 text 가 box 좌측 끝(padding 없음)에 붙음(chip 시각 깨짐).
      // iconSize: remove X(trailing_icon) glyph 크기 = round(fontSize × 0.75) (Tag.spec X 공식 동형).
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
        iconSize: 8,
      },
      sm: {
        fontSize: "{typography.text-xs}",
        lineHeight: 16,
        borderRadius: "{radius.sm}",
        height: 20,
        paddingX: 8,
        paddingY: 2,
        iconSize: 9,
      },
      md: {
        fontSize: "{typography.text-sm}",
        lineHeight: 20,
        borderRadius: "{radius.md}",
        height: 28,
        paddingX: 12,
        paddingY: 4,
        iconSize: 11,
      },
      lg: {
        fontSize: "{typography.text-base}",
        lineHeight: 24,
        borderRadius: "{radius.lg}",
        height: 40,
        paddingX: 16,
        paddingY: 8,
        iconSize: 12,
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
    // ADR-912 단계5 step4 (2026-06-17): TextArea.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — NumberField/TextField 동형(grid form-field layout). spec
    //   삭제(91c2be0dd) 회귀. Skia sideMode 트리거 styles 만(nested DOM selector 제외).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns":
              "var(--form-label-width, max-content) minmax(0, 1fr)",
            "column-gap": "var(--form-field-gap, var(--spacing-md))",
            "row-gap": "var(--spacing-xs)",
            "align-items": "start",
            width: "100%",
          },
        },
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
    // ADR-912 단계5 step4 (2026-06-17): TextField.spec.composition.containerVariants 의
    //   label-position:side Skia 복구 — NumberField/TextArea 동형(grid form-field layout). spec
    //   삭제(91c2be0dd) 회귀. Skia sideMode 트리거 styles 만(nested DOM selector 제외).
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            display: "grid",
            "grid-template-columns":
              "var(--form-label-width, max-content) minmax(0, 1fr)",
            "column-gap": "var(--form-field-gap, var(--spacing-md))",
            "row-gap": "var(--spacing-xs)",
            "align-items": "start",
            width: "100%",
          },
        },
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
        paddingY: 1,
        gap: 4,
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
        fontSize: "{typography.text-sm}",
        height: 28,
        paddingX: 8,
        iconSize: 15,
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
