/**
 * collection 요약 read model — ADR-213 Phase 1.
 *
 * `list_collections` · `get_editor_state.collections` · 시스템 프롬프트 동적 주입이
 * 같은 요약을 쓴다. 순수 모듈 — store 는 호출자가 읽어 넘긴다 (테스트에서 대체 가능).
 *
 * 예산 (HC3 · R5): 목록 최대 50개 · 이름 최대 80 code point · 직렬화 UTF-8 ≤ 8,192 bytes.
 * Phase 0 실측 — 50×80 은 ASCII 5,699 B (절단 0) 이지만 한글은 13,699 B 라 어떤 형식으로도
 * byte 상한을 넘는다. 그래서 상한은 **절단 + "더 있음 N"** 으로 집행한다 (token 상한 2,048
 * 은 G1 에서 provider `prompt_eval_count` 로 잰다).
 */
import { resolveBoundCollection } from "@composition/shared";
import type { DataTable } from "../../../types/builder/data.types";
import type { PromptTranslate } from "../promptTranslate";

export const COLLECTION_INJECTION_MAX_ITEMS = 50;
export const COLLECTION_NAME_MAX_CODE_POINTS = 80;
export const COLLECTION_INJECTION_MAX_BYTES = 8_192;
export const COLLECTION_INJECTION_MAX_TOKENS = 2_048;

/**
 * 보수적 token 추정 — 코드에 tokenizer 가 없어 (Phase 0) code point 등급별 가중치로
 * 상한을 집행한다. 가중치는 qwen3 (Ollama) 실측에 여유를 더한 값이라 실측보다 항상
 * 크거나 같다 (2026-09-11 G1: ASCII 알파벳 run 0.125 · 영단어 0.112 · snake_case 0.282 ·
 * 한글 1.000 · emoji 1.000 · 한글 문장 0.702 · 숫자/구두점 섞인 줄 0.652 tok/cp).
 * Anthropic tokenizer 는 키 부재로 미측정 — 한글·기타 비 ASCII 에 25~50% 여유를 둔 이유.
 */
export function estimatePromptTokens(text: string): number {
  let tokens = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x80) {
      // 알파벳 run 0.125 · 영단어 0.112 · snake_case 0.282 (밑줄이 단어를 쪼갠다) —
      // 알파벳 0.2 + 밑줄·공백·구두점 0.6 이 셋 다 위에 있다.
      tokens += /[A-Za-z]/.test(ch) ? 0.2 : /[0-9]/.test(ch) ? 0.4 : 0.6;
    } else if (
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0x3040 && code <= 0x30ff) ||
      (code >= 0x4e00 && code <= 0x9fff)
    ) {
      tokens += 1.25;
    } else {
      tokens += 1.5;
    }
  }
  return Math.ceil(tokens);
}

export interface CollectionSummary {
  id: string;
  name: string;
  fieldCount: number;
  rowCount: number;
  source: "manual" | "api";
  /** 이 collection 에 바인딩된 요소 수 (152 역참조 — `resolveBoundCollection` 경유) */
  usedBy: number;
}

/** usedBy 계산에 필요한 요소 모양 — `props.dataBinding` (패널 경로) 과 extension 둘 다. */
export interface BindingBearingElement {
  id: string;
  props?: unknown;
  dataBinding?: unknown;
}

function readBinding(element: BindingBearingElement): unknown {
  const props = element.props;
  if (props && typeof props === "object" && "dataBinding" in props) {
    const fromProps = (props as { dataBinding?: unknown }).dataBinding;
    if (fromProps) return fromProps;
  }
  return element.dataBinding;
}

/** collection id → 바인딩 요소 수. */
export function resolveCollectionUsage(
  elements: readonly BindingBearingElement[],
  collections: readonly DataTable[],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const element of elements) {
    const binding = readBinding(element);
    if (!binding) continue;
    const target = resolveBoundCollection(binding, collections);
    if (!target) continue;
    usage.set(target.id, (usage.get(target.id) ?? 0) + 1);
  }
  return usage;
}

export function visibleRowCount(table: DataTable): number {
  return table.useMockData
    ? (table.mockData?.length ?? 0)
    : (table.runtimeData?.length ?? 0);
}

export function summarizeCollections(
  collections: Iterable<DataTable>,
  usage: ReadonlyMap<string, number>,
): CollectionSummary[] {
  const out: CollectionSummary[] = [];
  for (const table of collections) {
    out.push({
      id: table.id,
      name: table.name,
      fieldCount: table.schema?.length ?? 0,
      rowCount: visibleRowCount(table),
      source: table.useMockData ? "manual" : "api",
      usedBy: usage.get(table.id) ?? 0,
    });
  }
  return out;
}

/** code point 단위 절단 — 서로게이트 쌍을 가르지 않는다. */
export function truncateCodePoints(value: string, max: number): string {
  const points = [...value];
  return points.length <= max ? value : points.slice(0, max).join("");
}

const encoder = new TextEncoder();
export const utf8Bytes = (text: string): number => encoder.encode(text).length;

export interface CollectionsSection {
  text: string;
  /** 예산에 밀려 목록에서 빠진 collection 수 */
  omitted: number;
}

/**
 * 시스템 프롬프트 collections 절. 항목 상한 → 이름 절단 → byte/token 이중 상한 순으로
 * 줄이고, 빠진 수는 "더 있음 N" 한 줄로 알린다 (모델이 `list_collections` 로 나머지를 읽는다).
 */
export function buildCollectionsSection(
  summaries: readonly CollectionSummary[],
  t: PromptTranslate,
  options: { maxItems?: number; maxBytes?: number; maxTokens?: number } = {},
): CollectionsSection {
  const maxItems = options.maxItems ?? COLLECTION_INJECTION_MAX_ITEMS;
  const maxBytes = options.maxBytes ?? COLLECTION_INJECTION_MAX_BYTES;
  const maxTokens = options.maxTokens ?? COLLECTION_INJECTION_MAX_TOKENS;
  const heading = t("aiPrompt.collectionsHeading");

  if (summaries.length === 0) {
    return { text: `${heading}\n${t("aiPrompt.collectionsNone")}`, omitted: 0 };
  }

  const lines = summaries.slice(0, maxItems).map((summary) =>
    t("aiPrompt.collectionsLine", {
      name: truncateCodePoints(summary.name, COLLECTION_NAME_MAX_CODE_POINTS),
      fieldCount: summary.fieldCount,
      rowCount: summary.rowCount,
      source: summary.source,
    }),
  );

  const render = (count: number): string => {
    const omitted = summaries.length - count;
    const body = lines.slice(0, count).join("\n");
    const more =
      omitted > 0
        ? `\n${t("aiPrompt.collectionsMore", { count: omitted })}`
        : "";
    return `${heading}\n${body}${more}`;
  };

  let count = lines.length;
  let text = render(count);
  while (
    count > 0 &&
    (utf8Bytes(text) > maxBytes || estimatePromptTokens(text) > maxTokens)
  ) {
    count -= 1;
    text = render(count);
  }
  return { text, omitted: summaries.length - count };
}
