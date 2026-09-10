/**
 * ADR-210 P2 — Chart 전용 컨트롤의 순수 helper: 컬럼 후보(타입 안내) · 배열 의미 비교 ·
 * 변경분만 남기는 patch 필터.
 *
 * 공통 패널 (`PropertiesPanel.handleSemanticPatch`) 의 변경 필터는 `!==` 참조 비교라
 * 스칼라 전제다 (breakdown §2.2). 배열 props 는 **여기서** 순서·entry key/label/colorToken·
 * 속성 존재 여부를 비교해 같은 값 재적용을 write 0 으로 만든다. 공통 패널에 deep compare
 * 를 넣지 않는다.
 *
 * 컬럼 타입은 schema (`DataField.type`) 만 믿는다 — 첫 행 추론으로 수치형을 확정하지
 * 않는다 (§4.1). schema 가 없으면 `unknown` 으로 표시하고 선택은 허용한다.
 */
import type { ChartSeriesConfig } from "@composition/specs";

import type { DataTable } from "../../../types/builder/data.types";

export type ChartColumnType = "number" | "text" | "unknown";

export interface ChartColumnCandidate {
  key: string;
  type: ChartColumnType;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function typeOfSchema(type: unknown): ChartColumnType {
  if (type === "number") return "number";
  if (type === "string") return "text";
  return "unknown";
}

/**
 * Chart 의 데이터 원천에서 컬럼 후보를 만든다 (타입 안내 포함). 출처 우선순위는
 * `columnsFromOwner` 와 같다 (dataTable schema → legacy static config → 정적 `data` 행).
 * schema 가 없는 출처의 키는 전부 `unknown` 이다. 출처가 없으면 null.
 */
export function chartColumnCandidates(
  props: Record<string, unknown>,
  collections: readonly DataTable[],
): ChartColumnCandidate[] | null {
  const binding = props.dataBinding;
  if (isRecord(binding)) {
    if (binding.source === "dataTable" && typeof binding.name === "string") {
      const table = collections.find(
        (candidate) =>
          candidate.name === binding.name || candidate.id === binding.name,
      );
      if (table) {
        const schema = (table.schema ?? []).filter(
          (field) => typeof field.key === "string" && field.key.length > 0,
        );
        if (schema.length > 0) {
          return schema.map((field) => ({
            key: field.key,
            type: typeOfSchema(field.type),
          }));
        }
        const first = table.mockData?.[0];
        if (isRecord(first)) {
          return Object.keys(first).map((key) => ({ key, type: "unknown" }));
        }
      }
    }
    if (binding.type === "collection" && isRecord(binding.config)) {
      const data = binding.config.data;
      if (Array.isArray(data) && isRecord(data[0])) {
        return Object.keys(data[0]).map((key) => ({ key, type: "unknown" }));
      }
    }
  }
  const data = props.data;
  if (Array.isArray(data) && isRecord(data[0])) {
    return Object.keys(data[0]).map((key) => ({ key, type: "unknown" }));
  }
  return null;
}

export function sameStringArray(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return a.length === b.length && a.every((item, i) => item === b[i]);
}

function sameEntry(a: unknown, b: unknown): boolean {
  if (!isRecord(a) || !isRecord(b)) return a === b;
  for (const key of ["key", "label", "colorToken"] as const) {
    if (Object.hasOwn(a, key) !== Object.hasOwn(b, key)) return false;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** 순서 + entry 의 key/label/colorToken + 속성 존재 여부. 객체 참조·키 나열 순서는 무관. */
export function sameSeriesConfig(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  return a.length === b.length && a.every((item, i) => sameEntry(item, b[i]));
}

function sameValue(key: string, a: unknown, b: unknown): boolean {
  if (key === "valueFields") return sameStringArray(a, b);
  if (key === "seriesConfig") return sameSeriesConfig(a, b);
  return a === b;
}

/**
 * baseline (해소된 effective props) 과 의미가 같은 키를 제거한 patch. 결과가 비면 write 0.
 * `force` 키는 값이 같아도 남긴다 — ref 인스턴스에서 상속 배열을 **명시 override 로
 * 고정**하는 사용자 동작 (§2.2 의 유일한 예외). 남긴 배열은 새 참조로 복사해 공통 패널의
 * `!==` 필터를 통과시킨다.
 */
export function chartPresentationPatch(
  baseline: Record<string, unknown>,
  patch: Record<string, unknown>,
  force: readonly string[] = [],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!force.includes(key) && sameValue(key, baseline[key], value)) continue;
    out[key] = Array.isArray(value)
      ? value.map((item) => (isRecord(item) ? { ...item } : item))
      : value;
  }
  return out;
}

/** `seriesConfig` 를 읽기 안전한 배열로 (잘못된 형식은 빈 배열 — 저장본은 건드리지 않는다). */
export function readSeriesConfig(value: unknown): ChartSeriesConfig[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is ChartSeriesConfig =>
      isRecord(entry) && typeof entry.key === "string",
  );
}

export function readValueFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** 배열 항목 이동 (불변). 범위 밖이면 원본 그대로. */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
