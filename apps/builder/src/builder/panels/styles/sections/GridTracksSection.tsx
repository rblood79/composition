/**
 * GridTracksSection — 「격자」 보기의 「열」 · 「행」 절 (Figma grid 의 track list).
 *
 * 2026-10-16 사용자 「Layout 탭 columns · rows 절은 제거 — Canvas 그리드에서 선택하면 들어가는 방식,
 * Figma 와 동일하게」: Layout 탭에는 두지 않고, Canvas 에서 열 · 행 머리를 고르면 Design 패널이 바뀌는
 * 「격자」 보기 (`panels/design/DesignPanel.tsx` GridTrackView) 만 이 절을 쓴다.
 *
 * 2026-10-16 사용자 지시: 열 · 행 수를 미리 알 수 없어 Layout 절 아래로 늘어놓으면 보기 불편하다 —
 * Design 패널 Layout 탭의 절 (`Section`) 로 「열」 · 「행」 을 나눈다. 한 줄에 하나: 번호 · 크기
 * (Fixed `px` · Fill `fr` 가중치 · Hug `fit`) · 행 메뉴 (최소 · 최대 크기 추가 · 제거). 헤더 「+」 가
 * Fill 1 을 끝에 붙인다. 최소 · 최대가 있는 줄은 아래에 그 칸을 둔다 (CSS 가 쓸 수 있는 것만 —
 * `GridTrackLimit`). grid 가 아니면 절이 없다. 목록이 보여 줄 수 없는 템플릿은 글자 칸 하나로 남는다.
 */

import { Fragment, memo, useMemo, useState, type ComponentType } from "react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyInput } from "../../../components/property/PropertyInput";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { ActionIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import { useStyleActions } from "../hooks/useStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useFlexDirectionKeys } from "../hooks/useLayoutAuxiliary";
import { useStylesHost, useStylesSelectedId } from "../stylesHost";
import { useGridTrackSelection } from "../../../stores/gridTrackSelection";
import {
  gridTemplateOf,
  gridTrackLimits,
  gridTrackList,
  gridTrackListResized,
  gridTrackListTemplate,
  gridTrackOfValue,
  gridTrackResized,
  gridTrackValue,
  gridTrackWithLimit,
  type GridTrack,
  type GridTrackLimit,
} from "../utils/gridTracks";

const AddIcon = ACTION_ICONS.add;
const RemoveIcon = ACTION_ICONS.delete;

const LIMIT_LABEL: Record<GridTrackLimit, string> = {
  min: "Min size",
  max: "Max size",
};
const ADD_LIMIT_LABEL: Record<GridTrackLimit, string> = {
  min: "Add minimum",
  max: "Add maximum",
};

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
  // Limits picked from the row menu before a value is typed (`"2:min"`).
  const [open, setOpen] = useState<string[]>([]);
  // The tracks selected on the Canvas (Figma — the Grid panel marks them).
  const selectedTracks = useGridTrackSelection((state) => state.tracks);
  const marked =
    selectedTracks?.identity === selectedId && selectedTracks.axis === axis
      ? selectedTracks.indices
      : undefined;
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
  const commitList = (list: GridTrack[]) => commit(gridTrackListTemplate(list));
  const set = (index: number, next: string) => {
    const track = gridTrackOfValue(next);
    if (!track) return;
    const list: GridTrack[] = tracks.slice();
    list[index] = gridTrackResized(tracks[index]!, track);
    // Hug (Figma): the items filling the track keep their size — one step with the template.
    if (
      track.kind === "hug" &&
      tracks[index]!.kind !== "hug" &&
      host.applyGridTracks
    )
      host.applyGridTracks(selectedId, [
        {
          axis,
          template: gridTrackListTemplate(list),
          removed: [],
          hugged: [index],
        },
      ]);
    else commitList(list);
  };
  const setLimit = (index: number, limit: GridTrackLimit, next: string) => {
    const px = next.trim() ? parseFloat(next) : undefined;
    if (px !== undefined && !(px >= 0)) return;
    const list: GridTrack[] = tracks.slice();
    list[index] = gridTrackWithLimit(tracks[index]!, limit, px);
    if (!px)
      setOpen((keys) => keys.filter((key) => key !== `${index}:${limit}`));
    commitList(list);
  };
  // Deleting a track deletes what is only in it; spans across it shrink (Figma — `applyGridTracks`).
  const remove = (index: number) => {
    setOpen([]);
    useGridTrackSelection.getState().clear();
    const template = gridTrackListTemplate(
      tracks.filter((_, at) => at !== index),
    );
    if (host.applyGridTracks)
      host.applyGridTracks(selectedId, [
        { axis, template, removed: [index], deleteContents: true },
      ]);
    else commit(template);
  };
  const limitOf = (track: GridTrack, limit: GridTrackLimit) =>
    (track as { min?: number; max?: number })[limit];
  return (
    <>
      {tracks.map((track, index) => {
        const name = `${localize(spec.track)} ${index + 1}`;
        const allowed = gridTrackLimits(track);
        const shown = (["min", "max"] as const).filter(
          (limit) =>
            limitOf(track, limit) !== undefined ||
            (allowed[limit] && open.includes(`${index}:${limit}`)),
        );
        return (
          <Fragment key={index}>
            <div
              className="fieldset-row grid-track-row"
              data-wide
              data-selected={marked?.includes(index) || undefined}
            >
              <PropertyUnitInput
                label={name}
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
                <PropertyRowMenu
                  label={`${name} ${localize("Track options")}`}
                  items={[
                    ...(["min", "max"] as const).map((limit) => ({
                      id: limit,
                      label: localize(ADD_LIMIT_LABEL[limit]),
                      isDisabled: !allowed[limit] || shown.includes(limit),
                    })),
                    {
                      id: "remove",
                      label: localize(spec.remove),
                      icon: RemoveIcon,
                    },
                  ]}
                  onAction={(id) => {
                    if (id === "remove") remove(index);
                    else setOpen((keys) => [...keys, `${index}:${id}`]);
                  }}
                />
              </div>
            </div>
            {shown.length > 0 && (
              <div className="fieldset-row grid-track-limits">
                {shown.map((limit) => (
                  <PropertyUnitInput
                    key={limit}
                    label={localize(LIMIT_LABEL[limit])}
                    unitSuffix
                    placeholder="—"
                    className={`grid-track-${limit}`}
                    value={
                      limitOf(track, limit) !== undefined
                        ? `${limitOf(track, limit)}px`
                        : ""
                    }
                    units={["reset", "px"]}
                    preserveEmptyValueOnUnitChange
                    onChange={(next) => setLimit(index, limit, next)}
                    min={0}
                    max={9999}
                  />
                ))}
              </div>
            )}
          </Fragment>
        );
      })}
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
