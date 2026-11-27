import type { ReactNode } from "react";
import { Meter } from "react-aria-components/Meter";
import { Slider, SliderThumb, SliderTrack } from "react-aria-components/Slider";
import { useLocale } from "react-aria-components/I18nProvider";

// (This chunk imports RAC only: a shared catalog module imported here as well as by the first load
//  is split into a chunk of its own — the star count · track come as props, ADR-320 Phase 4's lesson.)

/** The name a Rating without an authored `label` reads as (RAC needs one — no visible label). */
const NAME: Readonly<Record<string, string>> = { en: "Rating", ko: "별점" };
/** A display-only Rating's announced value — the stars, not a percentage (ADR-321 F12). */
const VALUE_LABEL: Readonly<
  Record<string, (value: string, count: number) => string>
> = {
  en: (value, count) => `${value} of ${count} stars`,
  ko: (value, count) => `${count}점 만점에 ${value}점`,
};

export interface CatalogRatingDomProps {
  /** The root element's marker · class · style (`delegatedDom.runtime.ts`). */
  readonly root: Readonly<Record<string, unknown>>;
  /** Display only — a RAC Meter (사용자 결정 7); else the input, a RAC Slider. */
  readonly readOnly: boolean;
  /** The Slider's state props (`value` + `onChange`, or `defaultValue`) · the Meter's `value`. */
  readonly state: Readonly<Record<string, unknown>>;
  readonly value: number;
  /** The star count (사용자 결정 6 — `RATING_STAR_COUNT`). */
  readonly count: number;
  readonly label: string;
  readonly name?: string;
  readonly isDisabled?: true;
  /** The track box (`catalogRatingTrack`). */
  readonly track: { readonly width: number; readonly left: number };
  readonly stars: readonly ReactNode[];
}

/**
 * ADR-321 Phase 5 — a running Rating (a lazy chunk: the first Rating a Preview draws loads it). Input
 * = RAC `Slider > SliderTrack (the stars) + SliderThumb`, 0 ~ 5 by whole stars — a press on a star
 * is the track press RAC rounds (`catalogRatingTrack`), arrows move a star, 0 clears; the thumb's
 * range input carries `name` into the form (사용자 결정 5). Display only = RAC `Meter` with the
 * value announced as stars.
 */
export default function CatalogRatingDom({
  onChange,
  onChangeEnd,
  ...props
}: CatalogRatingDomProps & {
  /** A rule's · named state's handlers (`withRuntime`) — after the state's own. */
  readonly onChange?: (value: number) => void;
  readonly onChangeEnd?: (value: number) => void;
}) {
  const own = props.state.onChange as ((value: number) => void) | undefined;
  // (S2 intl — the strings by language, English otherwise — `localizedStrings.ts`'s reading.)
  const { locale } = useLocale();
  const language = locale.split("-")[0]!;
  const label = props.label || (NAME[language] ?? NAME.en!);
  const valueLabel = VALUE_LABEL[language] ?? VALUE_LABEL.en!;
  if (props.readOnly)
    return (
      <Meter
        {...props.root}
        minValue={0}
        maxValue={props.count}
        value={props.value}
        valueLabel={valueLabel(
          // (The locale's digits — 3.5 · 3,5.)
          new Intl.NumberFormat(locale).format(props.value),
          props.count,
        )}
        aria-label={label}
      >
        {props.stars}
      </Meter>
    );
  return (
    <Slider
      {...props.root}
      {...props.state}
      onChange={(value: number) => {
        own?.(value);
        onChange?.(value);
      }}
      onChangeEnd={onChangeEnd}
      minValue={0}
      maxValue={props.count}
      step={1}
      isDisabled={props.isDisabled}
      aria-label={label}
    >
      <SliderTrack
        className="rating-track"
        style={{
          width: props.track.width,
          marginLeft: -props.track.left,
          paddingLeft: props.track.left,
        }}
      >
        {props.stars}
        <SliderThumb className="rating-thumb" name={props.name} />
      </SliderTrack>
    </Slider>
  );
}
