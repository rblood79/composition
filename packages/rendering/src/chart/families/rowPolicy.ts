/**
 * ADR-312 Phase 3 — 행 정책의 공용 묶기 (breakdown §2.4 · 본문 Decision 5).
 *
 * 형태가 `rows: "sum"` 이고 그 종류의 계산이 스스로 합치지 않는 (`grouped` 아님) 종류 — lollipop · segmented · waffle
 * · funnel · pareto · bullet · dumbbell · gauge · sparkline · slope · bump (순위) — 는 family 계산 앞에서 이 함수를
 * 지난다. 키 역할 값이 같은 행을 한 행으로 합친다: 가산 역할 (`ChartRoleDef.additive`) 은 숫자를 더하고 (비숫자는
 * 결측 — 0 이 아니다, ADR-194), 가산이 아닌 역할은 첫 행 값 + 값이 갈리면 경고 `rows.duplicate`. 그 밖의 열은 첫
 * 행 값이다. 합친 행의 표식이 가리키는 행 (`ChartTarget.rows`) 은 원본 행 번호로 되돌린다.
 *
 * family chunk 안에 둔다 — 첫 화면 번들에 들지 않는다 (HC3).
 */
import { chartActiveForm, chartRoleDef } from "../roles";
import { toFiniteNumber } from "../scales";
import type {
  ChartDiagnostic,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartTarget,
} from "../types";
import { fieldKey, readLabel } from "./fields";
import type { ChartFamily } from "./types";

export interface ChartRowPolicyResult {
  rows: readonly ChartRow[];
  /** 합친 행 번호 → 원본 행 번호들 (합친 것이 없으면 null — 입력 그대로) */
  sources: readonly (readonly number[])[] | null;
  diagnostics: ChartDiagnostic[];
}

const refsOf = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : value === undefined ? [] : [value];

/** 지금 형태의 행 정책대로 행을 읽는다 (`sum` 이 아니거나 스스로 합치는 형태는 그대로). */
export function applyChartRowPolicy(
  props: ChartProps,
  rows: readonly ChartRow[],
): ChartRowPolicyResult {
  const same: ChartRowPolicyResult = { rows, sources: null, diagnostics: [] };
  const form = chartActiveForm(props);
  if (form.rows !== "sum" || form.grouped || rows.length < 2) return same;
  const record = props as unknown as Record<string, unknown>;
  const keyCols: string[] = [];
  for (const role of form.key) {
    const refs = refsOf(record[role]);
    if (refs.length === 0) return same; // 키 역할에 값이 없다 (선택 역할) — 묶지 않는다
    for (const ref of refs) {
      const col = fieldKey(ref as string);
      // 해제 (`""`) · 풀리지 않는 참조 — 묶지 않는다 (검증은 그 종류가 맡는다). 어느 행에도 없는 열을
      //   가리키는 선택 키 역할은 이 앞 (`resolveChartRoleDefaults`) 에서 해제로 읽힌다.
      if (col === null) return same;
      keyCols.push(col);
    }
  }
  const additive: string[] = [];
  const fixed: { role: string; col: string }[] = [];
  for (const use of form.roles) {
    if (form.key.includes(use.role)) continue;
    const def = chartRoleDef(use.role);
    if (!def) continue;
    for (const ref of refsOf(record[use.role])) {
      const col = fieldKey(ref as string);
      if (col === null) continue;
      if (def.additive) additive.push(col);
      else fixed.push({ role: use.role, col });
    }
  }
  // 첫 번째 지나기: 키 → 묶음. 원본 행은 복사하지 않는다 (겹친 묶음만 끝에서 새 행을 만든다 — HC6).
  const sources: number[][] = [];
  const firsts: ChartRow[] = [];
  if (keyCols.length === 0) {
    // 키 없음 (gauge) — 모든 행이 한 항목.
    sources.push(rows.map((_, i) => i));
    firsts.push(rows[0]);
  } else {
    // 키 열마다 한 단의 Map (글자 결합 없이 — HC6). 마지막 단의 값이 묶음 번호.
    const root = new Map<string, unknown>();
    const last = keyCols.length - 1;
    let merged = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let level = root;
      for (let k = 0; k < last; k++) {
        const label = readLabel(row, keyCols[k]);
        let next = level.get(label) as Map<string, unknown> | undefined;
        if (next === undefined) level.set(label, (next = new Map()));
        level = next;
      }
      const label = readLabel(row, keyCols[last]);
      const at = level.get(label) as number | undefined;
      if (at === undefined) {
        level.set(label, sources.length);
        sources.push([i]);
        firsts.push(row);
      } else {
        sources[at].push(i);
        merged = true;
      }
    }
    if (!merged) return same;
  }
  const duplicated = new Set<string>();
  const out = firsts.map((first, g) => {
    const from = sources[g];
    if (from.length === 1) return first;
    const row: Record<string, unknown> = { ...first };
    for (const col of additive) {
      let total: number | null = null;
      for (const i of from) {
        const n = toFiniteNumber(rows[i][col]);
        if (n !== null) total = (total ?? 0) + n;
      }
      if (total !== null) row[col] = total;
    }
    for (const { role, col } of fixed)
      if (from.some((i) => !Object.is(rows[i][col], first[col])))
        duplicated.add(role);
    return row as ChartRow;
  });
  return {
    rows: out,
    sources,
    diagnostics: [...duplicated].map((role) => ({
      code: "rows.duplicate",
      severity: "warning",
      message: `rows with the same key have different ${role} values — the first row's value is used`,
      value: role,
    })),
  };
}

const remapTarget = (
  target: ChartTarget,
  sources: readonly (readonly number[])[],
): ChartTarget => ({
  ...target,
  rows: target.rows.flatMap((i) => sources[i] ?? []),
});

/** family 의 `buildScene` 을 행 정책으로 감싼다 — 묶은 행으로 그리고 진단 · 표식의 원본 행을 되돌린다. */
export function withRowPolicy(
  build: ChartFamily["buildScene"],
): ChartFamily["buildScene"] {
  return (props, rows, size, metrics) => {
    const policy = applyChartRowPolicy(props, rows);
    const scene: ChartScene = build(props, policy.rows, size, metrics);
    const { sources, diagnostics } = policy;
    if (sources === null) return scene;
    return {
      ...scene,
      ...(scene.targets
        ? { targets: scene.targets.map((t) => remapTarget(t, sources)) }
        : {}),
      ...(diagnostics.length > 0
        ? { diagnostics: [...(scene.diagnostics ?? []), ...diagnostics] }
        : {}),
    };
  };
}
