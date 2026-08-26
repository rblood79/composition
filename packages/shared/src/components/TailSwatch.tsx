import type {
  ColorAreaProps,
  ColorSliderProps,
  ColorSwatchPickerProps,
} from "react-aria-components";
import {
  ColorArea as AriaColorArea,
  ColorSlider as AriaColorSlider,
  SliderTrack,
  ColorThumb,
} from "react-aria-components";

import {
  MyColorSwatchPicker,
  MyColorSwatchPickerItem,
} from "./ColorSwatchPicker";
import { composeTailwindRenderProps } from "./utils";
import { TAILWIND_PALETTE } from "@composition/specs";

export type MyColorAreaProps = ColorAreaProps;

const tailwindColorNames = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "purple",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "stone",
] as const;

type TailwindColorName = (typeof tailwindColorNames)[number];

export interface TailwindSwatch {
  name: TailwindColorName;
  value: string;
}

/**
 * 500 단계 hex — 설치된 tailwindcss/theme.css 에서 생성한 `TAILWIND_PALETTE` (ADR-191) 파생.
 * React Aria `parseColor` 가 oklch 를 받지 못하므로 hex 산출물을 쓴다 (손 복사 v3 표 제거, R8).
 */
const TAILWIND_HEX_COLORS: Record<TailwindColorName, string> =
  Object.fromEntries(
    tailwindColorNames.map((name) => [name, TAILWIND_PALETTE[name][500]]),
  ) as Record<TailwindColorName, string>;

function getTailwindColorValue(name: TailwindColorName): string {
  // Use predefined hex values for React Aria compatibility
  return TAILWIND_HEX_COLORS[name];
}

const DEFAULT_TAILWIND_SWATCHES: TailwindSwatch[] = tailwindColorNames.map(
  (name) => ({
    name,
    value: getTailwindColorValue(name),
  }),
);

const SLIDER_GRADIENT = `linear-gradient(to right, ${DEFAULT_TAILWIND_SWATCHES.map(
  (swatch) => swatch.value,
).join(", ")})`;

const THUMB_CLASSNAMES =
  "absolute box-border h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-white/0 shadow-[0_0_0_1px_rgba(0,0,0,0.45),inset_0_0_0_1px_rgba(0,0,0,0.45)] data-[focus-visible=true]:h-6 data-[focus-visible=true]:w-6 group-data-[orientation=horizontal]:top-1/2 group-data-[orientation=vertical]:left-1/2";

export function MyColorArea({ className, ...props }: MyColorAreaProps) {
  return (
    <AriaColorArea
      {...props}
      className={composeTailwindRenderProps(
        className,
        "relative aspect-square w-full min-w-[12rem] max-w-[18rem] rounded-xl border border-slate-200 bg-transparent shadow-sm data-[disabled=true]:opacity-40",
      )}
    >
      <ColorThumb className={THUMB_CLASSNAMES} />
    </AriaColorArea>
  );
}

export type MyColorSliderProps = ColorSliderProps;

export function MyColorSlider({ className, ...props }: MyColorSliderProps) {
  return (
    <AriaColorSlider
      {...props}
      className={composeTailwindRenderProps(
        className,
        "group grid gap-2 text-sm data-[orientation=vertical]:grid-rows-[auto_1fr]",
      )}
    >
      <SliderTrack
        className="relative flex h-4 w-full items-center overflow-hidden rounded-full border border-slate-200 bg-slate-200/60 group-data-[orientation=vertical]:h-full group-data-[orientation=vertical]:w-4"
        style={{ backgroundImage: SLIDER_GRADIENT }}
      >
        <ColorThumb className={THUMB_CLASSNAMES} />
      </SliderTrack>
    </AriaColorSlider>
  );
}

export interface MyColorSwatchesProps {
  areaProps?: MyColorAreaProps;
  sliderProps?: MyColorSliderProps;
  swatchPickerProps?: ColorSwatchPickerProps;
  swatches?: TailwindSwatch[];
  className?: string;
}

function toTitle(name: string): string {
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} 500`;
}

export function MyColorSwatches({
  areaProps,
  sliderProps,
  swatchPickerProps,
  swatches = DEFAULT_TAILWIND_SWATCHES,
  className,
}: MyColorSwatchesProps) {
  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <MyColorArea
        colorSpace="hsb"
        xChannel="saturation"
        yChannel="brightness"
        {...areaProps}
      />
      <MyColorSlider colorSpace="hsb" channel="hue" {...sliderProps} />
      <MyColorSwatchPicker {...swatchPickerProps}>
        {swatchPickerProps?.children ??
          swatches.map((swatch) => (
            <MyColorSwatchPickerItem
              key={swatch.name}
              color={swatch.value}
              aria-label={toTitle(swatch.name)}
            />
          ))}
      </MyColorSwatchPicker>
    </div>
  );
}

export { MyColorSwatchPicker, MyColorSwatchPickerItem };
