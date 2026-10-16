/**
 * GridTracksSection — Layout 탭의 「열」 · 「행」 절 (Figma grid 의 track list).
 *
 * 2026-10-16 사용자 지시: 열 · 행 수를 미리 알 수 없어 Layout 절 아래로 늘어놓으면 보기 불편하다 —
 * Design 패널 Layout 탭의 절 (`Section`) 로 「열」 · 「행」 을 나눈다. 한 줄에 하나: 번호 · 크기
 * (Fixed `px` · Fill `fr` 가중치 · Hug `fit`) · 「−」. 헤더 「+」 가 Fill 1 을 끝에 붙인다.
 * grid 가 아니면 절이 없다. 목록이 보여 줄 수 없는 템플릿은 글자 칸 하나로 남는다.
 */

import { memo, useMemo, type ComponentType } from "react";
import { Minus } from "lucide-react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { ActionIconButton, SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import { useStyleActions } from "../hooks/useStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useFlexDirectionKeys } from "../hooks/useLayoutAuxiliary";
import { useStylesHost, useStylesSelectedId } from "../stylesHost";
import {
  gridTemplateOf,
  gridTrackList,
  gridTrackListResized,
  gridTrackListTemplate,
  gridTrackOfValue,
  gridTrackValue,
  type GridTrack,
} from "../utils/gridTracks";

const AddIcon = ACTION_ICONS.add;

type Axis = "column" | "row";

const AXIS = {
  column: {
    id: "grid-columns",
    title: "Columns",
    track: "Column track",
    add: "Add column",
    remove: "Remove column",
    key: "gridTemplateColumns",
  },
  row: {
    id: "grid-rows",
    title: "Grid rows",
    track: "Row track",
    add: "Add row",
    remove: "Remove row",
    key: "gridTemplateRows",
  },
} as const;

/** The track's number as the field's label glyph (the field's `icon` slot — 「1 ▸ 120 PX」). */
const indexGlyphs = new Map<number, ComponentType>();
function indexGlyph(index: number): ComponentType {
  let glyph = indexGlyphs.get(index);
  if (!glyph) {
    glyph = function TrackIndex() {
      return (
        <span className="grid-track-index" aria-hidden="true">
          {index + 1}
        </span>
      );
    };
    indexGlyphs.set(index, glyph);
  }
  return glyph;
}

const GridTrackRows = memo(function GridTrackRows({ axis }: { axis: Axis }) {
  const localize = useSemanticLabel();
  const selectedId = useStylesSelectedId();
  const { updateStyles } = useStyleActions();
  const values = useLayoutValues(selectedId);
  const spec = AXIS[axis];
  const value = values?.[spec.key] ?? "";
  const host = useStylesHost();
  const commit = (template: string) => updateStyles({ [spec.key]: template });
  const tracks = gridTrackList(value);
  if (tracks === null)
    return (
      <PropertyInput
        label={localize(spec.title)}
        value={value}
        onChange={(next) => commit(gridTemplateOf(next))}
      />
    );
  const set = (index: number, next: string) => {
    const track = gridTrackOfValue(next);
    if (!track) return;
    const list: GridTrack[] = tracks.slice();
    list[index] = track;
    commit(gridTrackListTemplate(list));
  };
  // The items in the removed track move with it (Figma — `applyGridTracks`).
  const remove = (index: number) => {
    const template = gridTrackListTemplate(
      tracks.filter((_, at) => at !== index),
    );
    if (host.applyGridTracks)
      host.applyGridTracks(selectedId, axis, template, [index]);
    else commit(template);
  };
  return (
    <>
      {tracks.map((track, index) => (
        <div key={index} className="fieldset-row grid-track-row" data-wide>
          <PropertyUnitInput
            label={`${localize(spec.track)} ${index + 1}`}
            labelMode="icon"
            icon={indexGlyph(index)}
            className="grid-track-size"
            value={gridTrackValue(track)}
            units={["px", "fr", "fit-content"]}
            onChange={(next) => set(index, next)}
            min={track.kind === "fill" ? 1 : 0}
            max={track.kind === "fill" ? 100 : 9999}
          />
          <div className="fieldset-actions actions-icon">
            <SwatchIconButton
              aria-label={`${localize(spec.remove)} ${index + 1}`}
              onPress={() => remove(index)}
            >
              <Minus
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
      ))}
    </>
  );
});

const GridTrackSection = memo(function GridTrackSection({
  axis,
}: {
  axis: Axis;
}) {
  const localize = useSemanticLabel();
  const selectedId = useStylesSelectedId();
  const { updateStyles } = useStyleActions();
  const values = useLayoutValues(selectedId);
  const isGrid = useFlexDirectionKeys(selectedId)[0] === "grid";
  const spec = AXIS[axis];
  const tracks = gridTrackList(values?.[spec.key] ?? "");
  const actions = useMemo(
    () =>
      tracks === null ? undefined : (
        <ActionIconButton
          aria-label={localize(spec.add)}
          onPress={() =>
            updateStyles({
              [spec.key]: gridTrackListTemplate(
                gridTrackListResized(tracks, tracks.length + 1),
              ),
            })
          }
        >
          <AddIcon
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        </ActionIconButton>
      ),
    [localize, spec, tracks, updateStyles],
  );
  if (!isGrid) return null;
  return (
    <PropertySection id={spec.id} title={spec.title} actions={actions}>
      <GridTrackRows axis={axis} />
    </PropertySection>
  );
});

export const GridColumnsSection = memo(function GridColumnsSection() {
  return <GridTrackSection axis="column" />;
});

export const GridRowsSection = memo(function GridRowsSection() {
  return <GridTrackSection axis="row" />;
});
