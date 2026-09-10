import "./ChartAuthoringControls.css";
import { Button } from "react-aria-components/Button";
import { memo, useMemo, useState } from "react";
import {
  buildSeriesGrid,
  seriesLabel,
  seriesTokenIndex,
  seriesTokenName,
  type ChartProps,
  type ChartRow,
  type ChartSeriesConfig,
} from "@composition/specs";
import type { ResolvedField } from "@composition/shared";
import { PropertyInput, PropertySelect } from "../../components";
import { useI18n } from "@/i18n";
import { readSeriesConfig } from "./chartPresentationPatch";

/**
 * ADR-210 P2 — 시리즈 표시 설정 (이름 · 팔레트 토큰 · 순서 · 항목 초기화 · 휴면 설정).
 *
 * 현재 보이는 시리즈는 **실제 집계 (`buildSeriesGrid`)** 에서 읽는다 — 저장 config 를
 * 나열하는 것이 아니라 화면의 시리즈 순서를 그대로 보여 준다 (설정 순서 → 미설정 출현
 * 순서). 모든 편집은 `seriesConfig` 배열 **전체 교체** 한 번이다 (§2.1). 이름/색은 범례·
 * 툴팁 표시만 바꾼다 — 행 값을 고치는 도구로 오해시키지 않도록 안내를 둔다.
 *
 * 범주가 색을 가르는 모드 (pie · 단일 시리즈 radial · bar colorBy=category) 에서는
 * 설정이 적용되지 않으므로 컨트롤을 사유와 함께 접는다 (저장 config 는 휴면 보존).
 */
export const ChartSeriesControls = memo(function ChartSeriesControls({
  fields,
  rows,
  paletteLength,
  isRefInstance,
  onPatch,
}: {
  fields: ResolvedField[];
  rows: readonly ChartRow[];
  /** rule chart 채널의 팔레트 길이 — 토큰 후보 `--chart-series-1..N`. */
  paletteLength: number;
  /** ref 인스턴스이고 `seriesConfig` 가 아직 override 가 아닐 때 — 명시 고정 1회 (§2.2). */
  isRefInstance?: boolean;
  onPatch: (patch: Record<string, unknown>, force?: readonly string[]) => void;
}) {
  const { t } = useI18n();
  const [showDormant, setShowDormant] = useState(false);
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  ) as Record<string, unknown>;
  const configField = fields.find((field) => field.key === "seriesConfig");
  const config = readSeriesConfig(props.seriesConfig);
  const { grid, naturalOrder } = useMemo(() => {
    const palette = Math.max(1, paletteLength);
    const chartProps = props as unknown as ChartProps;
    return {
      grid: buildSeriesGrid(rows, chartProps, palette),
      // 설정을 뺀 **자연 순서** (출현 / valueFields) — key 만 있는 항목을 저장할지의 기준.
      naturalOrder: buildSeriesGrid(
        rows,
        { ...chartProps, seriesConfig: undefined },
        palette,
      ).series.map((series) => series.id),
    };
    // props 는 매 렌더 새 객체 — 실제 의존은 fields/rows 다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, rows, paletteLength]);

  const chartType = String(props.chartType ?? "bar");
  const byCategory =
    chartType === "pie" ||
    (chartType === "radial" && grid.series.length <= 1) ||
    (chartType === "bar" && props.colorBy === "category");
  if (byCategory) {
    return (
      <p className="chart-authoring-hint" role="note">
        {t("chart.seriesUnavailable")}
      </p>
    );
  }

  const visibleIds = new Set(grid.series.map((series) => series.id));
  const dormant = config.filter((entry) => !visibleIds.has(entry.key));
  const entryOf = (id: string): ChartSeriesConfig | undefined =>
    config.find((entry) => entry.key === id);

  /** 현재 표시 순서대로 config 를 다시 쓴다 — 보이는 시리즈는 전부 항목이 되고 휴면은 뒤에 남는다. */
  const write = (
    mutate: (entries: ChartSeriesConfig[]) => ChartSeriesConfig[],
  ): void => {
    const visibleEntries = grid.series.map(
      (series) => entryOf(series.id) ?? { key: series.id },
    );
    const next = mutate(visibleEntries);
    // 저장은 **앞에서부터 마지막으로 뜻이 있는 항목까지** 다 쓴다 (key 만 있는 항목 포함).
    //   `applySeriesConfig` 가 설정된 항목을 배열 순서대로 앞에 두므로, 중간 항목을 빼면
    //   이름만 바꾼 시리즈가 맨 앞으로 이동한다 (P2 판독 HIGH). 뒤쪽 꼬리의 key-only 만 뺀다.
    const lastMeaningful = Math.max(
      lastOrderChange(next, naturalOrder),
      next.reduce(
        (last, entry, index) =>
          Object.hasOwn(entry, "label") || Object.hasOwn(entry, "colorToken")
            ? index + 1
            : last,
        0,
      ),
    );
    const trimmed = [...next.slice(0, lastMeaningful), ...dormant];
    onPatch({ seriesConfig: trimmed });
  };

  // 기본 항목은 PropertySelect legacy 규약의 `"reset"` — `value ""` 를 그 항목으로 표시하고
  //   선택 시 `onChange("")` 로 돌려준다 (`value: ""` 옵션은 선택 표시가 안 된다).
  const tokenOptions = [
    { value: "reset", label: t("chart.defaultColor") },
    ...Array.from({ length: Math.max(1, paletteLength) }, (_, i) => ({
      value: seriesTokenName(i),
      label: seriesTokenName(i),
    })),
  ];

  return (
    <div
      className="chart-series-settings"
      role="group"
      aria-label={t("chart.seriesSettings")}
    >
      <p className="chart-authoring-hint">{t("chart.seriesPreviewHint")}</p>
      <ul className="chart-series-list">
        {grid.series.map((series, index) => {
          const entry = entryOf(series.id);
          const token =
            entry?.colorToken !== undefined &&
            seriesTokenIndex(entry.colorToken, paletteLength) !== null
              ? entry.colorToken
              : "";
          return (
            <li key={series.id} className="chart-series-item">
              <span className="chart-series-key">
                {seriesLabel(series, t("chart.series"))}
              </span>
              <PropertyInput
                label={t("chart.seriesLabel")}
                value={entry?.label ?? ""}
                placeholder={series.key || t("chart.series")}
                onChange={(value) =>
                  write((entries) =>
                    entries.map((e, i) =>
                      i === index ? { ...e, label: value } : e,
                    ),
                  )
                }
              />
              <PropertySelect
                label={t("chart.seriesColor")}
                value={token}
                options={tokenOptions}
                translateOptions={false}
                onChange={(value) =>
                  write((entries) =>
                    entries.map((e, i) => {
                      if (i !== index) return e;
                      const { colorToken: _drop, ...rest } = e;
                      return value ? { ...rest, colorToken: value } : rest;
                    }),
                  )
                }
              />
              <Button
                type="button"
                className="control-button chart-authoring-square"
                aria-label={`${t("chart.moveUp")} ${series.key}`}
                isDisabled={index === 0}
                onPress={() =>
                  write((entries) => swap(entries, index, index - 1))
                }
              >
                ↑
              </Button>
              <Button
                type="button"
                className="control-button chart-authoring-square"
                aria-label={`${t("chart.moveDown")} ${series.key}`}
                isDisabled={index === grid.series.length - 1}
                onPress={() =>
                  write((entries) => swap(entries, index, index + 1))
                }
              >
                ↓
              </Button>
              <Button
                type="button"
                className="control-button"
                aria-label={`${t("common.reset")} ${series.key}`}
                isDisabled={!entry}
                onPress={() =>
                  write((entries) =>
                    entries.map((e, i) => (i === index ? { key: e.key } : e)),
                  )
                }
              >
                {t("common.reset")}
              </Button>
            </li>
          );
        })}
      </ul>
      {isRefInstance && configField && !configField.isOverridden && (
        <Button
          type="button"
          className="control-button"
          onPress={() => onPatch({ seriesConfig: config }, ["seriesConfig"])}
        >
          {t("chart.pinToInstance")}
        </Button>
      )}
      {dormant.length > 0 && (
        <>
          <Button
            type="button"
            className="control-button"
            aria-expanded={showDormant}
            onPress={() => setShowDormant((value) => !value)}
          >
            {t("chart.dormantSeries")} ({dormant.length})
          </Button>
          {showDormant && (
            <ul className="chart-series-list">
              {dormant.map((entry) => (
                <li key={entry.key} className="chart-series-item">
                  <span className="chart-series-key">
                    {entry.label ?? entry.key}
                  </span>
                  <Button
                    type="button"
                    className="control-button"
                    aria-label={`${t("common.remove")} ${entry.key}`}
                    onPress={() =>
                      onPatch({
                        seriesConfig: config.filter(
                          (candidate) => candidate.key !== entry.key,
                        ),
                      })
                    }
                  >
                    {t("common.remove")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
});

function swap<T>(items: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= items.length || b >= items.length) return items;
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 표시 순서가 자연 순서와 마지막으로 갈리는 자리 (그 앞은 key 만 있어도 저장). 같으면 0. */
function lastOrderChange(
  entries: readonly ChartSeriesConfig[],
  defaultOrder: readonly string[],
): number {
  let last = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].key !== defaultOrder[i]) last = i + 1;
  }
  return last;
}
