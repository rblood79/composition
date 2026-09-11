/**
 * `{field}` 템플릿의 사용자 문법 (이름) ↔ 저장형 (`{#<fieldId>}`) 변환 (ADR-152 Phase 1b).
 *
 * 사용자는 ADR-159 문법 그대로 `{name}` · `{name.first}` · `{d|date}` 를 쓰고 본다. 문서에는
 * `{#<id>.first|date}` 로 저장돼 필드 rename 이 템플릿을 깨지 않는다. 변환은 토큰 첫
 * 세그먼트 (필드 key) 만 바꾸고 경로 · 포맷 · literal · `{{` 이스케이프는 그대로 둔다.
 *
 * - `templateToStored`: schema 에 key 가 있고 id 가 있으면 `#id` 로. key 가 schema 에 없으면
 *   (가상 필드 label/description/icon/value · 정적 items · 미지 필드) 이름 그대로. key 는 있는데
 *   id 가 없으면 정규화 누락이다 — 이름 그대로 두고 `console.warn` (렌더는 이름으로 계속
 *   동작하므로 편집 UI 를 throw 로 세우지 않는다; 정규화 경로는 store 진입 경계 test 가 지킨다).
 * - `storedToTemplate`: `#id` 가 schema 에 있으면 key 로. 없으면 (collection 미로드 · 삭제된
 *   필드) 저장형 그대로 노출 — 사용자가 고칠 수 있게.
 */
import { TOKEN_PATTERN } from "./fieldTemplate";
import { resolveField } from "./resolveBoundCollection";

type FieldLike = { id?: string; key: string };

function splitHead(raw: string): { head: string; rest: string } {
  const end = raw.search(/[.[]/);
  return end < 0
    ? { head: raw, rest: "" }
    : { head: raw.slice(0, end), rest: raw.slice(end) };
}

function mapTokens(text: string, mapHead: (head: string) => string): string {
  return text.replace(
    TOKEN_PATTERN,
    (whole, ident?: string, format?: string) => {
      if (ident === undefined) return whole; // `{{` / `}}`
      const { head, rest } = splitHead(ident);
      const next = mapHead(head);
      if (next === head) return whole;
      return `{${next}${rest}${format ? `|${format}` : ""}}`;
    },
  );
}

export function templateToStored(
  template: string,
  schema: readonly FieldLike[] | null | undefined,
): string {
  if (!schema || schema.length === 0 || !template.includes("{"))
    return template;
  return mapTokens(template, (head) => {
    if (head.startsWith("#")) return head;
    // key 매치 — `resolveField` 는 id 매치가 먼저라 key 와 같은 문자열의 id 는 없다는 전제 (UUID).
    const field = resolveField(schema, head);
    if (!field || field.key !== head) return head;
    if (!field.id) {
      console.warn(
        `[fieldTemplate] 필드 "${head}" 에 id 가 없어 이름 저장형으로 둔다 — normalizeCollection 누락`,
      );
      return head;
    }
    return `#${field.id}`;
  });
}

export function storedToTemplate(
  stored: string,
  schema: readonly FieldLike[] | null | undefined,
): string {
  if (!stored.includes("{#")) return stored;
  return mapTokens(stored, (head) => {
    if (!head.startsWith("#")) return head;
    const field = resolveField(schema ?? undefined, head.slice(1));
    return field?.id === head.slice(1) ? field.key : head;
  });
}
