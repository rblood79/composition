/**
 * ADR-312 — Chart 데이터 역할 표 (breakdown §2.1 · §2.2).
 *
 * 역할 하나 = 「차트가 행에서 읽는 열 하나 (또는 열 목록) 의 뜻」. 뜻 · 형 · 라벨은 전 종류 공통 표 하나
 * (`CHART_ROLE_DEFS`) 이고, 종류가 그 역할을 쓰는 방식 (필수 · 종류별 라벨 · 종류가 받는 형) 은 형태
 * (`ChartForm`) 안의 `ChartRoleUse` 다. 패널의 칸 · 선택 / 필수 · 라벨, 공통 검증, prop 전달 목록, 필드
 * 사용처가 이 두 표에서 나온다 — 손으로 적은 역할 목록을 두지 않는다.
 *
 * 첫 화면 번들에 든다 (descriptor 와 함께 — HC3). 표본 · 계산은 family chunk 그대로다.
 */
import { resolveFieldRef } from "../data/fieldIdIndex";
import { toFiniteNumber } from "./scales";
import type {
  ChartDataMode,
  ChartDiagnostic,
  ChartProps,
  ChartRow,
  ChartType,
} from "./types";

export type ChartRoleKind = "field" | "fields";
export type ChartRoleAccepts = "number" | "string" | "date" | "any";

/** 역할의 뜻 — 전 종류 공통. */
export interface ChartRoleDef {
  /** 저장 key (평탄 prop — 대안 B 기각, 본문 Decision 3) */
  key: keyof ChartProps & string;
  kind: ChartRoleKind;
  accepts: ChartRoleAccepts;
  /** 같은 키의 행을 합칠 수 있는 값인가 (breakdown §2.4 — Phase 3 의 행 정책이 읽는다) */
  additive: boolean;
  /** 값이 없을 때 읽는 열 · 표본의 열 이름 (Phase 2 가 읽는다). 목록 역할 대부분은 없다. */
  defaultField?: string | readonly string[];
  /** 패널 기본 라벨 — 번역 조회 key (영어, `apps/builder/src/i18n/labels.ts`) */
  label: string;
  /** 이름의 출처 — `rsc` 면 React Spectrum Charts 와 같은 이름, 아니면 대응 이름 (`rscName`) */
  source: "rsc" | "composition";
  rscName?: string;
}

/** 종류가 그 역할을 쓰는 방식. */
export interface ChartRoleUse {
  role: ChartRoleDef["key"];
  required: boolean;
  /** 종류 · 형태별 라벨 (scatter 의 `dimension` = "X") */
  label?: string;
  /** 종류가 받는 형 (calendar 의 `dimension` = "date") — 없으면 역할의 형 */
  accepts?: ChartRoleAccepts;
}

/**
 * 행 정책 (breakdown §2.4 · 본문 Decision 5) — 같은 키의 행을 어떻게 읽는가.
 * - `sum` — 형태의 `key` 역할 값이 같은 행은 한 항목. 가산 역할은 더하고 (비숫자는 결측), 가산이 아닌 역할은 첫 행
 *   값 + 값이 갈리면 경고 `rows.duplicate`.
 * - `row` — 행 하나가 표식 하나 (점 · 단계 · 봉 · 선). 합치지 않는다.
 * - `sample` — 행 하나가 표본 하나 (분위수 · 구간 · 밀도의 입력).
 */
export type ChartRowPolicy = "sum" | "row" | "sample";

/** 입력 형태 — 역할 집합과 행 정책. 형태가 둘 이상인 종류만 `dataMode` 로 고른다 (값이 없으면 첫 형태). */
export interface ChartForm {
  id: ChartDataMode;
  roles: readonly ChartRoleUse[];
  rows: ChartRowPolicy;
  /**
   * `sum` 의 키 역할 — 이 역할 값이 모두 같은 행이 한 항목이다. 빈 목록이면 모든 행이 한 항목 (gauge). 키 역할에
   * 값이 없으면 (선택 역할 — sparkline 의 `dimension`) 묶지 않는다.
   */
  key: readonly ChartRoleDef["key"][];
  /**
   * 그 종류의 계산이 이미 같은 키로 합친다 (시리즈 격자 · family 의 격자 루프) — 공용 묶기 (`families/rowPolicy.ts`)
   * 를 다시 지나지 않는다 (HC6). 같은 정책임은 손계산 fixture 가 고정한다 (`adr312RowPolicy.test.ts`).
   */
  grouped?: true;
}

const role = (
  key: ChartRoleDef["key"],
  kind: ChartRoleKind,
  accepts: ChartRoleAccepts,
  additive: boolean,
  label: string,
  extra: Partial<
    Pick<ChartRoleDef, "defaultField" | "source" | "rscName">
  > = {},
): ChartRoleDef => ({
  key,
  kind,
  accepts,
  additive,
  label,
  source: "composition",
  ...extra,
});

/**
 * 역할 표. 순서 = 패널 Collection 섹션의 칸 순서 (ADR-306 binding 의 순서 그대로).
 */
export const CHART_ROLE_DEFS: readonly ChartRoleDef[] = [
  role("dimension", "field", "string", false, "Category", {
    defaultField: "category",
    source: "rsc",
  }),
  role("metric", "field", "number", true, "Value", {
    defaultField: "value",
    source: "rsc",
  }),
  role("color", "field", "string", false, "Series", {
    defaultField: "series",
    source: "rsc",
  }),
  role("goalField", "field", "number", true, "Goal", {
    defaultField: "goal",
    rscName: "target",
  }),
  role("rangeFields", "fields", "number", false, "Range Fields"),
  role("startField", "field", "number", true, "Start", {
    defaultField: "start",
    rscName: "metricStart",
  }),
  role("endField", "field", "number", true, "End", {
    defaultField: "end",
    rscName: "metricEnd",
  }),
  role("kindField", "field", "string", false, "Kind", { defaultField: "kind" }),
  role("rankField", "field", "number", false, "Rank", { defaultField: "rank" }),
  role("frontFields", "fields", "number", true, "Front Fields"),
  role("binStartField", "field", "number", false, "Bin Start", {
    defaultField: "binStart",
  }),
  role("binEndField", "field", "number", false, "Bin End", {
    defaultField: "binEnd",
  }),
  role("countField", "field", "number", true, "Count", {
    defaultField: "count",
  }),
  role("labelField", "field", "string", false, "Label", {
    defaultField: "label",
  }),
  role("rowField", "field", "string", false, "Row", { defaultField: "row" }),
  role("openField", "field", "number", false, "Open", { defaultField: "open" }),
  role("highField", "field", "number", false, "High", { defaultField: "high" }),
  role("lowField", "field", "number", false, "Low", { defaultField: "low" }),
  role("volumeField", "field", "number", true, "Volume", {
    defaultField: "volume",
  }),
  role("invertFields", "fields", "number", false, "Inverted Axes"),
  role("pathFields", "fields", "string", false, "Path", {
    defaultField: ["group", "category"],
  }),
  role("sourceField", "field", "string", false, "Source", {
    defaultField: "source",
  }),
  role("targetField", "field", "string", false, "Target", {
    defaultField: "target",
  }),
  role("lowerFields", "fields", "number", true, "Band Lower", {
    rscName: "metricStart",
  }),
  role("upperFields", "fields", "number", true, "Band Upper", {
    rscName: "metricEnd",
  }),
  role("sizeField", "field", "number", false, "Size", {
    defaultField: "size",
    rscName: "size",
  }),
  // 값 열 목록 — 패널은 원천 모드 컨트롤 (`ChartDataMappingControls`) 이 편집한다 (generic 칸 아님).
  role("valueFields", "fields", "number", true, "Value Fields"),
];

/** 역할 key 전부 (표 순서). */
export const CHART_ROLE_KEYS: readonly (keyof ChartProps & string)[] =
  CHART_ROLE_DEFS.map((def) => def.key);

const DEF_BY_KEY = new Map(CHART_ROLE_DEFS.map((def) => [def.key, def]));

export function chartRoleDef(key: string): ChartRoleDef | undefined {
  return DEF_BY_KEY.get(key as ChartRoleDef["key"]);
}

// ── 형태 (breakdown §2.2 · §2.3 — 역할 집합 + 행 정책 §2.4) ──

const use = (
  key: ChartRoleDef["key"],
  required: boolean,
  extra: Omit<ChartRoleUse, "role" | "required"> = {},
): ChartRoleUse => ({ role: key, required, ...extra });

const CATEGORY = use("dimension", true);
const VALUE = use("metric", true);
const SERIES = use("color", false);
const VALUES = use("valueFields", true);
const BANDS = [use("lowerFields", false), use("upperFields", false)];

type FormRoles = Pick<ChartForm, "id" | "roles">;
type RoleKey = ChartRoleDef["key"];

const group = (...roles: ChartRoleUse[]): FormRoles => ({ id: "group", roles });
const columns = (...roles: ChartRoleUse[]): FormRoles => ({
  id: "columns",
  roles,
});
const form = (id: ChartDataMode, ...roles: ChartRoleUse[]): FormRoles => ({
  id,
  roles,
});

// 행 정책 (§2.4). `summed` = 그 종류의 계산이 이미 같은 키로 합친다 (`grouped`).
const sum = (f: FormRoles, key: RoleKey[]): ChartForm => ({
  ...f,
  rows: "sum",
  key,
});
const summed = (f: FormRoles, key: RoleKey[]): ChartForm => ({
  ...sum(f, key),
  grouped: true,
});
const each = (f: FormRoles): ChartForm => ({ ...f, rows: "row", key: [] });
const samples = (f: FormRoles): ChartForm => ({
  ...f,
  rows: "sample",
  key: [],
});

const BY_SERIES: RoleKey[] = ["dimension", "color"];
const BY_CATEGORY: RoleKey[] = ["dimension"];

// 시리즈 격자 (`series.ts` `buildSeriesInput`) 가 범주 × 시리즈로 합친다.
const CARTESIAN: readonly ChartForm[] = [
  summed(group(CATEGORY, VALUE, SERIES), BY_SERIES),
  summed(columns(CATEGORY, VALUES), BY_CATEGORY),
];
const CARTESIAN_BANDS: readonly ChartForm[] = [
  summed(group(CATEGORY, VALUE, SERIES, ...BANDS), BY_SERIES),
  summed(columns(CATEGORY, VALUES, ...BANDS), BY_CATEGORY),
];
// 본문 사용자 결정 4 — 행마다 표식이던 범주 × 값 종류도 bar 와 같이 범주로 합친다.
const CATEGORY_VALUE: readonly ChartForm[] = [
  sum(group(CATEGORY, VALUE), BY_CATEGORY),
];
// 산점도 x 는 숫자 (기본 linear 축) — 시간 축 (`dimensionScale: "time"`) 이면 날짜 (`chartRoleAccepts`). 「아무 형」 이면
//   연결 때 첫 글자 열을 받아 그릴 점이 없었다 (ADR-312 Phase 5 live).
const X = use("dimension", true, { label: "X", accepts: "number" });
const Y = use("metric", true, { label: "Y" });
const SCATTER_EXTRA = [use("sizeField", false), use("labelField", false)];
const DATE = use("dimension", true, { label: "Date", accepts: "date" });
const PATH = [use("pathFields", true), VALUE];
const FLOW = [use("sourceField", true), use("targetField", true), VALUE];

/**
 * 종류마다 형태 목록. 첫 형태가 `dataMode` 미설정의 형태다. 형태는 `dataMode` 로만 바뀐다 (역할의 유무로 바꾸지
 * 않는다 — Phase 2). 행 정책은 같은 모양의 종류가 같은 정책이다 (범주 × 값은 bar 와 같이 합산 — Phase 3).
 */
export const CHART_FORMS = {
  bar: CARTESIAN,
  line: CARTESIAN_BANDS,
  area: CARTESIAN_BANDS,
  radar: CARTESIAN,
  // ADR-210 — Pie · Radial 은 columns 를 받지 않는다 (`columns.unsupportedChartType`).
  pie: [summed(group(CATEGORY, VALUE, SERIES), BY_SERIES)],
  radial: [summed(group(CATEGORY, VALUE, SERIES), BY_SERIES)],
  scatter: [
    each(group(X, Y, SERIES, ...SCATTER_EXTRA)),
    each(columns(X, VALUES, ...SCATTER_EXTRA)),
  ],
  // 여러 행이면 합 (지금은 첫 행만 읽었다 — 사용자 결정 4).
  gauge: [sum(group(VALUE, use("goalField", false)), [])],
  // 구간 경계 (`rangeFields`) 는 가산이 아니다 — 같은 범주에서 갈리면 첫 행 + `rows.duplicate`.
  bullet: [
    sum(
      group(
        CATEGORY,
        VALUE,
        use("goalField", false),
        use("rangeFields", false),
      ),
      BY_CATEGORY,
    ),
  ],
  dumbbell: [
    sum(
      group(CATEGORY, use("startField", true), use("endField", true)),
      BY_CATEGORY,
    ),
  ],
  lollipop: CATEGORY_VALUE,
  segmented: CATEGORY_VALUE,
  waffle: CATEGORY_VALUE,
  funnel: CATEGORY_VALUE,
  pareto: CATEGORY_VALUE,
  // 행 = 단계 (같은 이름의 단계가 둘이어도 두 단계다).
  waterfall: [each(group(CATEGORY, VALUE, use("kindField", false)))],
  // `dimension` 이 있으면 같은 항목을 합친다, 없으면 행 순서 그대로 (키 역할에 값이 없으면 묶지 않는다).
  sparkline: [
    sum(group(VALUE, use("dimension", false, { accepts: "any" })), BY_CATEGORY),
  ],
  marimekko: [summed(group(CATEGORY, use("color", true), VALUE), BY_SERIES)],
  stream: [
    summed(group(CATEGORY, VALUE, SERIES), BY_SERIES),
    summed(columns(CATEGORY, VALUES), BY_CATEGORY),
  ],
  // ADR-312 Phase 2 — 형태는 `dataMode` 로만 바뀐다 (역할의 유무로 바꾸지 않는다). 첫 형태 = 미설정.
  //   순위는 가산이 아니다 — 같은 시점 · 항목이 겹치면 첫 행 + `rows.duplicate` (지금은 순위를 더했다).
  bump: [
    sum(
      form("ranked", CATEGORY, use("color", true), use("rankField", true)),
      BY_SERIES,
    ),
    summed(group(CATEGORY, use("color", true), VALUE), BY_SERIES),
  ],
  // slope — 역할의 뜻은 형태와 무관하다: `color` 가 늘 항목, group 은 `dimension` = 시점, pair 는 앞 · 뒤 값.
  //   같은 시점 · 항목 (pair 는 같은 항목) 은 합친다 (지금은 마지막 행이 이겼다).
  slope: [
    sum(
      group(
        use("dimension", true, { label: "Period" }),
        use("color", true, { label: "Item" }),
        VALUE,
      ),
      BY_SERIES,
    ),
    sum(
      form(
        "pair",
        use("color", true, { label: "Item" }),
        use("startField", true),
        use("endField", true),
      ),
      ["color"],
    ),
  ],
  skyline: [
    summed(
      group(CATEGORY, VALUE, SERIES, use("frontFields", false)),
      BY_SERIES,
    ),
    summed(columns(CATEGORY, VALUES, use("frontFields", false)), BY_CATEGORY),
  ],
  // histogram — group = 값 하나하나가 표본, binned = 미리 센 구간 (시작 · 끝 · 개수 — 같은 구간은 합친다).
  histogram: [
    samples(group(VALUE, SERIES)),
    summed(
      form(
        "binned",
        use("binStartField", true),
        use("binEndField", true),
        use("countField", true),
        SERIES,
      ),
      ["binStartField", "binEndField", "color"],
    ),
  ],
  box: [samples(group(use("dimension", true, { label: "Groups" }), VALUE))],
  beeswarm: [
    samples(
      group(
        VALUE,
        use("dimension", false, { label: "Groups" }),
        use("labelField", false),
      ),
    ),
  ],
  ridgeline: [
    samples(group(use("dimension", true, { label: "Groups" }), VALUE)),
  ],
  heatmap: [
    summed(group(CATEGORY, use("rowField", true), VALUE), [
      "dimension",
      "rowField",
    ]),
  ],
  calendar: [summed(group(DATE, VALUE), BY_CATEGORY)],
  candlestick: [
    each(
      group(
        DATE,
        use("openField", false),
        use("highField", false),
        use("lowField", false),
        // ADR-312 Decision 3 — 주 값은 늘 `metric` (종가). 옛 `closeField` 는 없앴다.
        use("metric", true, { label: "Close" }),
        use("volumeField", false),
      ),
    ),
  ],
  // parallel 은 값 열 목록만 읽는다 — 형태 하나 (본문 F6 「읽지 않는 토글」 을 없앤다).
  parallel: [
    each(columns(VALUES, use("labelField", false), use("invertFields", false))),
  ],
  treemap: [summed(group(...PATH), ["pathFields"])],
  sunburst: [summed(group(...PATH), ["pathFields"])],
  sankey: [summed(group(...FLOW), ["sourceField", "targetField"])],
  chord: [summed(group(...FLOW), ["sourceField", "targetField"])],
} as const satisfies Record<ChartType, readonly ChartForm[]>;

/** 종류의 형태 목록 (모르는 종류는 bar). */
export function chartForms(type: unknown): readonly ChartForm[] {
  return (
    (CHART_FORMS as Record<string, readonly ChartForm[]>)[String(type)] ??
    CHART_FORMS.bar
  );
}

/** 지금 형태 — `dataMode` 가 그 종류의 형태면 그것, 아니면 첫 형태. */
export function chartActiveForm(
  props: Pick<ChartProps, "chartType" | "dataMode">,
): ChartForm {
  const forms = chartForms(props.chartType);
  return forms.find((form) => form.id === props.dataMode) ?? forms[0];
}

/** 종류가 그 형태를 받는가. */
export function chartTypeHasForm(type: unknown, id: ChartDataMode): boolean {
  return chartForms(type).some((form) => form.id === id);
}

/** 그 역할을 쓰는 형태가 하나라도 있는 종류. */
export function chartTypesUsingRole(key: string): ChartType[] {
  return (Object.keys(CHART_FORMS) as ChartType[]).filter((type) =>
    CHART_FORMS[type].some((form) => form.roles.some((u) => u.role === key)),
  );
}

/** 이 종류 · 형태에서 그 역할의 쓰임 (안 쓰면 undefined). */
export function chartRoleUse(
  props: Pick<ChartProps, "chartType" | "dataMode">,
  key: string,
): ChartRoleUse | undefined {
  return chartActiveForm(props).roles.find((u) => u.role === key);
}

/**
 * 지금 props 에서 그 역할이 받는 형 — 종류의 형 (`ChartRoleUse.accepts`), 없으면 역할의 형. 시간 축
 * (`dimensionScale: "time"`) 의 범주 역할은 날짜다 (축 해석 — Decision 9).
 */
export function chartRoleAccepts(
  props: object,
  roleUse: ChartRoleUse,
): ChartRoleAccepts {
  if (
    roleUse.role === "dimension" &&
    (props as { dimensionScale?: unknown }).dimensionScale === "time"
  )
    return "date";
  return roleUse.accepts ?? chartRoleDef(roleUse.role)?.accepts ?? "any";
}

/** 패널 라벨 — 종류별 라벨, 없으면 역할의 라벨. */
export function chartRoleLabel(
  props: Pick<ChartProps, "chartType" | "dataMode">,
  key: string,
): string | undefined {
  return chartRoleUse(props, key)?.label ?? chartRoleDef(key)?.label;
}

// ── 기본 열 이름 (본문 Decision 8 — 값이 없는 역할은 기본 열 이름으로 읽는다) ──

const hasKey = (rows: readonly ChartRow[], key: string): boolean =>
  rows.some((row) => Object.prototype.hasOwnProperty.call(row, key));

/**
 * 지금 형태의 역할 중 값이 없는 (`undefined`) 것을 기본 열 이름으로 채운다. 필수 역할은 늘 채우고 (열이
 * 없으면 검증이 `role.missing` 을 낸다), 선택 역할은 그 열이 데이터에 있을 때만 채운다 — 없는 열을 가리키는
 * 선택 역할은 「역할 없음」 과 같아 지금 그림을 바꾸지 않는다. 빈 글자 (`""`) 는 사용자가 해제한 것이라 두고,
 * 형태 밖 역할은 건드리지 않는다. 같은 입력이면 같은 결과 (두 consumer · 여러 번 불러도 같다).
 */
export function resolveChartRoleDefaults<T extends ChartProps>(
  props: T,
  rows: readonly ChartRow[],
): T {
  const record = props as unknown as Record<string, unknown>;
  let out: Record<string, unknown> | null = null;
  for (const roleUse of chartActiveForm(props).roles) {
    if (record[roleUse.role] !== undefined) continue;
    const fallback = chartRoleDef(roleUse.role)?.defaultField;
    if (fallback === undefined) continue;
    const keys = typeof fallback === "string" ? [fallback] : fallback;
    if (!roleUse.required && !keys.every((key) => hasKey(rows, key))) continue;
    out ??= { ...record };
    out[roleUse.role] = typeof fallback === "string" ? fallback : [...fallback];
  }
  return (out ?? props) as T;
}

/**
 * 새 차트의 표본 (결정 3 — 역할의 기본 열 이름). family 표본 (`sample` · `sampleProps`) 의 열을 지금 형태의
 * 역할 기본 열 이름으로 바꾸고, 그렇게 이름으로 읽히는 역할 값과 그 종류가 읽지 않는 역할 값 · 형태가 하나이거나
 * 첫 형태인 `dataMode` 를 지운다. 기본 열 이름이 없는 목록 역할 (`valueFields` · `frontFields` · `rangeFields`
 * · `invertFields`) 은 남긴다 — 지우면 그릴 열이 없다 (리뷰 round 1 h1).
 */
export function standardizeChartSample(
  type: ChartType,
  rows: readonly ChartRow[],
  sampleProps: Readonly<Partial<ChartProps>>,
): { rows: ChartRow[]; props: Partial<ChartProps> } {
  const props: Record<string, unknown> = { ...sampleProps };
  const forms = chartForms(type);
  const active = forms.find((form) => form.id === props.dataMode) ?? forms[0];
  const used = new Set(forms.flatMap((form) => form.roles.map((u) => u.role)));
  const rename = new Map<string, string>();
  for (const roleUse of active.roles) {
    const def = chartRoleDef(roleUse.role);
    const value = props[roleUse.role];
    if (!def?.defaultField || value === undefined) continue;
    if (typeof def.defaultField === "string" && typeof value === "string")
      rename.set(value, def.defaultField);
    else if (
      Array.isArray(def.defaultField) &&
      Array.isArray(value) &&
      value.length === def.defaultField.length
    )
      value.forEach((from, i) =>
        rename.set(String(from), (def.defaultField as readonly string[])[i]),
      );
    else continue;
    delete props[roleUse.role];
  }
  for (const def of CHART_ROLE_DEFS)
    if (!used.has(def.key) && def.key in props) delete props[def.key];
  if (forms.length === 1 || props.dataMode === forms[0].id)
    delete props.dataMode;
  const renamed = rows.map((row) => {
    const next: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row))
      next[rename.get(key) ?? key] = value;
    return next;
  });
  return { rows: renamed, props: props as Partial<ChartProps> };
}

/**
 * 표본 행 편집기의 칸 (본문 Decision 7 — 「지금 형태의 역할이 가리키는 열 + 행에 실제로 있는 열」). 역할 순서대로
 * 그 역할이 가리키는 열 (값이 없으면 기본 열 이름), 그 뒤에 행에만 있는 열. `numeric` 은 숫자 역할의 열 (새 행의
 * 기본값 0). `#id` 참조는 연결된 원천의 필드라 표본 칸이 아니다 — 건너뛴다.
 */
export function chartSampleColumns(
  props: Pick<ChartProps, "chartType" | "dataMode">,
  rows: readonly ChartRow[],
): { key: string; label: string; numeric: boolean }[] {
  const record = props as unknown as Record<string, unknown>;
  const out = new Map<
    string,
    { key: string; label: string; numeric: boolean }
  >();
  for (const roleUse of chartActiveForm(props).roles) {
    const def = chartRoleDef(roleUse.role);
    if (!def) continue;
    const value = record[roleUse.role] ?? def.defaultField;
    const keys = (Array.isArray(value) ? value : [value]).filter(
      (key): key is string =>
        typeof key === "string" && key !== "" && !key.startsWith("#"),
    );
    const numeric = chartRoleAccepts(props, roleUse) === "number";
    keys.forEach((key, i) => {
      if (!out.has(key))
        out.set(key, {
          key,
          label:
            keys.length > 1 || def.kind === "fields"
              ? key
              : (roleUse.label ?? def.label),
          numeric,
        });
      void i;
    });
  }
  for (const row of rows)
    for (const key of Object.keys(row))
      if (!out.has(key))
        out.set(key, {
          key,
          label: key,
          numeric: typeof row[key] === "number",
        });
  return [...out.values()];
}

// ── 원천이 바뀔 때의 역할 (본문 Decision 10 · breakdown §5.2) ──

/** 원천의 열 하나 — 연결이면 보기의 결과 schema, 아니면 표본 행에서 읽은 열. */
export interface ChartSourceColumn {
  key: string;
  /** 필드 색인에 등록되는 id (컬렉션 schema 의 필드). 결과 schema 의 집계 열은 없다 — key 로 저장한다. */
  id?: string;
  type: "number" | "string" | "date" | "other";
}

/** 표본 행의 열 (이름 · 값에서 읽은 형). */
export function chartColumnsOfRows(
  rows: readonly ChartRow[],
): ChartSourceColumn[] {
  const out = new Map<string, ChartSourceColumn>();
  for (const row of rows)
    for (const [key, value] of Object.entries(row)) {
      if (out.has(key) || value === null || value === undefined) continue;
      out.set(key, {
        key,
        type:
          typeof value === "number"
            ? "number"
            : typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
              ? "date"
              : "string",
      });
    }
  return [...out.values()];
}

const fits = (column: ChartSourceColumn, accepts: ChartRoleAccepts): boolean =>
  accepts === "any" ||
  (accepts === "number"
    ? column.type === "number"
    : accepts === "date"
      ? column.type === "date"
      : column.type !== "number");

/**
 * 원천이 바뀔 때 역할을 맞추는 patch (값 `undefined` = 지움). 순수 함수 — 연결 · 다른 원천으로 변경 · 해제가 같은
 * 함수를 지나고, 패널의 「다시 맞추기」 도 같다.
 * 1. 역할이 가리키는 열 (값이 없으면 기본 열 이름) 이 원천에 있고 형이 맞으면 둔다 — 같은 원천을 다시 연결해도 지정이
 *    남는다.
 * 2. 해제일 때만: 그 종류의 표본 지정 (`sample`) 이 가리키는 열이 원천 (= 표본) 에 있으면 그것으로.
 * 3. 필수 역할이면 그 종류가 받는 형에 맞는 원천의 첫 열 (다른 역할에 준 열은 건너뜀). 목록 역할은 형이 맞는 열을
 *    순서대로 `listLimit` 개까지.
 * 4. 그 밖 (맞는 열이 없음 · 선택 역할) 은 지운다 — 필수면 scene 이 `role.missing`.
 * 저장 값: id 가 있는 열은 `#id`, 없는 열 (집계 · 표본) 은 key. 기본 열 이름과 같은 key 는 쓰지 않고 지운다
 * (Decision 8 — 기본 열 이름으로 읽힌다).
 */
export function reconcileChartRoles(input: {
  props: Pick<ChartProps, "chartType" | "dataMode"> &
    Readonly<Record<string, unknown>>;
  columns: readonly ChartSourceColumn[];
  /** 해제 — 표본으로 돌아갈 때 그 종류의 표본 지정 (`standardizeChartSample` 의 props) */
  sample?: Readonly<Record<string, unknown>>;
  listLimit?: number;
}): Record<string, unknown> {
  const { props, columns, sample, listLimit = 8 } = input;
  const byRef = (ref: unknown): ChartSourceColumn | undefined =>
    typeof ref !== "string" || ref === ""
      ? undefined
      : ref.startsWith("#")
        ? columns.find((column) => column.id === ref.slice(1))
        : columns.find((column) => column.key === ref);
  const stored = (column: ChartSourceColumn) =>
    column.id ? `#${column.id}` : column.key;
  const patch: Record<string, unknown> = {};
  const taken = new Set<string>();
  const roles = chartActiveForm(props).roles;
  // 먼저 그대로 둘 역할의 열을 잡아 둔다 (자동 지정이 그 열을 다시 주지 않게).
  const keep = new Set<string>();
  for (const roleUse of roles) {
    const def = chartRoleDef(roleUse.role);
    if (!def) continue;
    const value = props[roleUse.role] ?? def.defaultField;
    const refs = Array.isArray(value) ? value : [value];
    const found = refs.map(byRef);
    // 형이 맞는 열일 때만 — 숫자 역할이 글자 열을 가리키면 다시 연결해도 그대로 남았다 (Phase 5 live).
    const accepts = chartRoleAccepts(props, roleUse);
    if (
      refs.length > 0 &&
      found.every((column) => column !== undefined && fits(column, accepts))
    ) {
      keep.add(roleUse.role);
      found.forEach((column) => taken.add(column!.key));
    }
  }
  for (const roleUse of roles) {
    const def = chartRoleDef(roleUse.role);
    if (!def || keep.has(roleUse.role)) continue;
    const accepts = chartRoleAccepts(props, roleUse);
    const fromSample =
      sample?.[roleUse.role] ?? (sample ? def.defaultField : undefined);
    const sampleRefs = Array.isArray(fromSample) ? fromSample : [fromSample];
    if (
      sample &&
      fromSample !== undefined &&
      sampleRefs.every((ref) => byRef(ref))
    ) {
      sampleRefs.forEach((ref) => taken.add(byRef(ref)!.key));
      patch[roleUse.role] =
        sample[roleUse.role] === undefined ? undefined : sample[roleUse.role];
      continue;
    }
    const free = columns.filter(
      (column) => !taken.has(column.key) && fits(column, accepts),
    );
    if (!roleUse.required || free.length === 0) {
      patch[roleUse.role] = undefined;
      continue;
    }
    const chosen = def.kind === "fields" ? free.slice(0, listLimit) : [free[0]];
    chosen.forEach((column) => taken.add(column.key));
    const values = chosen.map(stored);
    patch[roleUse.role] =
      def.kind === "fields"
        ? values
        : values[0] === def.defaultField
          ? undefined
          : values[0];
  }
  // 이미 원하는 값이면 patch 에 싣지 않는다.
  for (const [key, value] of Object.entries(patch))
    if (JSON.stringify(props[key]) === JSON.stringify(value)) delete patch[key];
  return patch;
}

// ── 공통 검증 (본문 Decision 7 · R5 — 36 종 한 곳, scene 계산 앞) ──

function refKey(ref: unknown): string | null {
  if (typeof ref !== "string" || ref === "") return null;
  return resolveFieldRef(ref);
}

const hasColumn = (rows: readonly ChartRow[], key: string): boolean =>
  rows.some((row) => Object.prototype.hasOwnProperty.call(row, key));

const hasNumber = (rows: readonly ChartRow[], key: string): boolean =>
  rows.some((row) => toFiniteNumber(row[key]) !== null);

/**
 * 지금 형태의 역할을 행에 대어 본다.
 * - 필수 역할이 비었거나, 풀리지 않는 `#id` 이거나, 행이 있는데 어느 행에도 그 열이 없으면 `role.missing` (error).
 * - 숫자 역할의 열이 있는데 숫자가 하나도 없으면 `role.notNumeric` (warning — 그림은 지금처럼 「No data」).
 * 목록 역할 (`fields`) 은 필수인데 비었을 때만 본다 — 각 열의 검사는 그 종류의 계산이 한다. `valueFields` 는
 * 표시 설정 검증 (`valueFields.empty` · `.invalid` — `presentation.ts`, family 는 각자) 이 이미 맡아 건너뛴다.
 * 행이 0 이면 열 판정을 하지 않는다 (로딩 · 빈 결과 — ADR-209 상태 표).
 */
export function validateChartRoles(
  props: ChartProps,
  rows: readonly ChartRow[],
): ChartDiagnostic[] {
  const out: ChartDiagnostic[] = [];
  const record = props as unknown as Record<string, unknown>;
  for (const roleUse of chartActiveForm(props).roles) {
    const def = chartRoleDef(roleUse.role);
    if (!def || def.key === "valueFields") continue;
    const value = record[roleUse.role];
    if (def.kind === "fields") {
      if (roleUse.required && (!Array.isArray(value) || value.length === 0))
        out.push({
          code: "role.missing",
          severity: "error",
          message: `${roleUse.role} needs at least one field`,
          value: roleUse.role,
        });
      continue;
    }
    if (value === undefined || value === "") {
      if (roleUse.required)
        out.push({
          code: "role.missing",
          severity: "error",
          message: `${roleUse.role} field is required`,
          value: roleUse.role,
        });
      continue;
    }
    // 행이 없으면 열을 판정하지 않는다 — 풀리지 않는 `#id` 도 원천이 아직 오지 않은 것일 수 있다.
    if (rows.length === 0) continue;
    const key = refKey(value);
    if (key === null || !hasColumn(rows, key)) {
      if (roleUse.required)
        out.push({
          code: "role.missing",
          severity: "error",
          message: `${roleUse.role} points to a field the data does not have`,
          value: roleUse.role,
        });
      continue;
    }
    if (chartRoleAccepts(props, roleUse) === "number" && !hasNumber(rows, key))
      out.push({
        code: "role.notNumeric",
        severity: "warning",
        message: `${roleUse.role} field has no numbers`,
        value: roleUse.role,
      });
  }
  return out;
}
