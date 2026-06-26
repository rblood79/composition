// ADR-912 6 registry collapse §2-5 #3 — factory default props oracle
//
// deriveDefaultPropsFromCatalog(type) 가 만들어야 할 목표값(factory ∪ catalog-bindingOnly).
//
// 옵션 B(정합 보강, 사용자 결정 2026-06-11): 현 createDefault*Props 반환값에 더해, factory 가
// 누락하던 catalog binding.default(Button fillStyle/type, Badge fillStyle, Link staticColor,
// Icon variant)를 포함. catalog SSOT 가 권위 source 이므로 파생 시 보강.
//
// Icon.iconName 은 POPULAR_ICONS random placeholder(비결정적) → oracle 에서 제외, 별도 검증.
//
// AUTO-CAPTURED 기준: 현 unified.types.ts createDefault*Props(2026-06-11) + 각 binding accepts.default.
// 의도적 변경 시에만 재생성.

export interface DefaultPropsOracleItem {
  type: string;
  /** 파생 목표 props (factory ∪ catalog). Icon 은 iconName 제외. */
  props: Record<string, unknown>;
  /** 파생 후 factory 가 별도 합성하는 비결정적 키(Icon.iconName 등) — oracle 비교 제외. */
  nonDeterministicKeys?: readonly string[];
}

export const DEFAULT_PROPS_ORACLE: readonly DefaultPropsOracleItem[] = [
  {
    type: "Button",
    props: {
      // catalog base
      variant: "primary",
      size: "md",
      fillStyle: "fill", // catalog bindingOnly — factory 누락분 보강(옵션 B)
      type: "button", // catalog bindingOnly — factory 누락분 보강(옵션 B)
      // builder-local overlay
      children: "Button",
      name: "",
      isDisabled: false,
      isPending: false,
      // layout overlay — CSS↔Skia display 정합(2026-06-27). RAC inline-flex/center/gap
      //   ↔ Skia INLINE_BLOCK 발산 차단. builder-local overlay 한정(catalog base 아님).
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        width: "fit-content",
      },
    },
  },
  {
    type: "Badge",
    props: {
      variant: "accent",
      size: "sm",
      fillStyle: "bold", // catalog bindingOnly 보강
      children: "Badge",
      isDot: false,
      isPulsing: false,
    },
  },
  {
    type: "Link",
    props: {
      variant: "primary",
      size: "md",
      staticColor: "auto", // catalog bindingOnly 보강
      children: "Link",
      href: "#",
      isDisabled: false,
      isExternal: false,
      showExternalIcon: true,
    },
  },
  {
    type: "ToggleButton",
    props: {
      size: "md",
      children: "Toggle Button",
      isEmphasized: false,
      isQuiet: false,
      isSelected: false,
      isDisabled: false,
      // layout overlay — Button 동일 발산 차단(2026-06-27). builder-local overlay 한정.
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        width: "fit-content",
      },
    },
  },
  {
    type: "Text",
    props: {
      size: "md",
      children: "Text",
    },
  },
  {
    type: "Icon",
    props: {
      variant: "default", // catalog bindingOnly 보강(factory 미설정)
      size: "md",
      strokeWidth: 2,
      iconFontFamily: "lucide",
      // iconName 은 random → nonDeterministicKeys
    },
    nonDeterministicKeys: ["iconName"],
  },
];
