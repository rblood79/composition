/**
 * ADR-313 Decision 7 · §2.4 — 스키마 가져오기: OpenAPI 3.0 · 3.1 문서나 JSON Schema (JSON — 사용자 결정 3)
 * 를 읽어 고를 수 있는 스키마 목록을 만들고, 고른 스키마의 열 (`DetectedColumn` — 미리보기 열 표가 그대로
 * 쓴다) · 가져오지 않은 것의 보고 · 행 배열 경로 후보 · endpoint 초안 (사용자 결정 2) 을 만든다.
 *
 * - 네트워크를 쓰지 않는다 (HC1) — `$ref` 는 문서 안 (`#/…`) 만 풀고, 외부 `$ref` 는 보고에 적는다.
 * - 받지 않는 구성 (`oneOf` · `anyOf` · `not` · `discriminator` · `patternProperties` · 스키마 값의
 *   `additionalProperties` · 외부 `$ref` · 순환) 과 저장하지 않는 제약 (`enum` · 범위 · `pattern` · 길이 …
 *   — 사용자 결정 4) 은 보고에 전부 적는다. 조용히 버리지 않는다.
 * - `int64` 의 기본 타입은 `number` (사용자 결정 5) — key 후보인 `int64` 열에만 큰 정수 글자 (`bigInt`) 를
 *   후보로 낸다.
 *
 * 생성 창이 이 모듈을 lazy 로 읽는다. 순수 함수.
 */
import type {
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";
import type { DetectedColumn } from "../utils/columnDetector";
import type { ColumnChoice } from "../utils/encodingChoices";

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** 깊이 한도 — 문서 검증 `dataFields` 와 같다. */
const MAX_DEPTH = 8;

export type SchemaDocumentKind = "openapi-3.0" | "openapi-3.1" | "json-schema";

/** 문서에서 고를 수 있는 스키마 하나. */
export interface SchemaChoice {
  id: string;
  /** 보이는 이름 — 컴포넌트 이름 · `GET /api/users` · 루트. */
  label: string;
  /** 스키마 노드 (`$ref` 그대로일 수 있다). */
  node: unknown;
  /** 응답 스키마면 그 요청 (endpoint 초안의 재료). */
  operation?: {
    method: string;
    path: string;
    queryParams: string[];
  };
}

export interface SchemaDocument {
  kind: SchemaDocumentKind;
  root: Json;
  choices: SchemaChoice[];
  /** OpenAPI `servers[0].url` — endpoint 초안의 base URL. */
  baseUrl: string;
}

export type ImportReportItem =
  | { kind: "construct"; path: string; name: string }
  | { kind: "constraint"; path: string; name: string };

export type SchemaReadError = "not-json" | "not-schema";

/** 문서 글자 → 종류 · 고를 수 있는 스키마. JSON 만 받는다 (사용자 결정 3). */
export function readSchemaDocument(
  text: string,
): SchemaDocument | { error: SchemaReadError } {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { error: "not-json" };
  }
  if (!isObject(root)) return { error: "not-schema" };
  if (typeof root.openapi === "string") {
    const kind = root.openapi.startsWith("3.1") ? "openapi-3.1" : "openapi-3.0";
    const choices: SchemaChoice[] = [];
    // 성공 응답의 스키마 (`paths`) — endpoint 초안을 만들 수 있다.
    const paths = isObject(root.paths) ? root.paths : {};
    for (const [path, item] of Object.entries(paths)) {
      if (!isObject(item)) continue;
      for (const [method, op] of Object.entries(item)) {
        if (!isObject(op) || !/^(get|post|put|patch|delete)$/.test(method))
          continue;
        const responses = isObject(op.responses) ? op.responses : {};
        const success = Object.entries(responses).find(([code]) =>
          /^2\d\d$/.test(code),
        )?.[1];
        const content =
          isObject(success) && isObject(success.content) ? success.content : {};
        const media = Object.entries(content).find(([type]) =>
          /json|\*\/\*/.test(type),
        )?.[1];
        if (!isObject(media) || media.schema === undefined) continue;
        const params = [
          ...(Array.isArray(item.parameters) ? item.parameters : []),
          ...(Array.isArray(op.parameters) ? op.parameters : []),
        ]
          .map((p) => resolveRef(root as Json, p).node)
          .filter(
            (p): p is Json =>
              isObject(p) && p.in === "query" && typeof p.name === "string",
          )
          .map((p) => p.name as string);
        choices.push({
          id: `${method.toUpperCase()} ${path}`,
          label: `${method.toUpperCase()} ${path}`,
          node: media.schema,
          operation: {
            method: method.toUpperCase(),
            path,
            queryParams: params,
          },
        });
      }
    }
    const components =
      isObject(root.components) && isObject(root.components.schemas)
        ? root.components.schemas
        : {};
    for (const [name, node] of Object.entries(components))
      if (looksLikeObject(root, node))
        choices.push({ id: `#/components/schemas/${name}`, label: name, node });
    const server =
      Array.isArray(root.servers) && isObject(root.servers[0])
        ? root.servers[0].url
        : undefined;
    return {
      kind,
      root,
      choices,
      baseUrl: typeof server === "string" ? server : "",
    };
  }
  // JSON Schema — 루트 객체 + `$defs` · `definitions`.
  const choices: SchemaChoice[] = [];
  if (looksLikeObject(root, root))
    choices.push({
      id: "#",
      label: typeof root.title === "string" ? root.title : "#",
      node: root,
    });
  for (const bag of ["$defs", "definitions"] as const) {
    const defs = isObject(root[bag]) ? (root[bag] as Json) : {};
    for (const [name, node] of Object.entries(defs))
      if (looksLikeObject(root, node))
        choices.push({ id: `#/${bag}/${name}`, label: name, node });
  }
  if (!choices.length) return { error: "not-schema" };
  return { kind: "json-schema", root, choices, baseUrl: "" };
}

function looksLikeObject(root: Json, node: unknown): boolean {
  const { node: resolved } = resolveRef(root, node);
  if (!isObject(resolved)) return false;
  return (
    isObject(resolved.properties) ||
    Array.isArray(resolved.allOf) ||
    resolved.type === "object"
  );
}

/** 문서 안 `$ref` (`#/…`) 풀기 — 외부 `$ref` 는 `external`. */
function resolveRef(
  root: Json,
  node: unknown,
  seen: ReadonlySet<string> = new Set(),
): { node: unknown; ref?: string; external?: string; cycle?: boolean } {
  let current = node;
  let ref: string | undefined;
  const visited = new Set(seen);
  while (isObject(current) && typeof current.$ref === "string") {
    const target = current.$ref;
    if (!target.startsWith("#")) return { node: undefined, external: target };
    if (visited.has(target))
      return { node: undefined, ref: target, cycle: true };
    visited.add(target);
    ref = target;
    current = target
      .slice(1)
      .split("/")
      .filter(Boolean)
      .map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce<unknown>(
        (value, key) => (isObject(value) ? value[key] : undefined),
        root,
      );
  }
  return { node: current, ...(ref ? { ref } : {}) };
}

const CONSTRAINTS = [
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "uniqueItems",
  "const",
] as const;
const CONSTRUCTS = [
  "oneOf",
  "anyOf",
  "not",
  "discriminator",
  "patternProperties",
] as const;

/** 행 배열 경로 후보 — 포장 (`{code, message, data}`) · 페이지 (`content` · `totalElements`). */
export interface RowPathChoice {
  /** 행 배열까지의 점 경로 (`""` = 스키마 자체가 행). */
  path: string;
  /** 행 하나의 스키마. */
  item: unknown;
  /** 같은 단계의 전체 수 (`totalElements` · `totalCount` · `total` · `count`). */
  totalPath?: string;
}

const TOTAL_NAMES =
  /^(total|totalCount|totalElements|count|totalRows|total_count)$/;

/**
 * 고른 스키마에서 행 배열까지의 경로 후보 (지금의 `utils/responseSchema.ts` 와 같은 규칙을 스키마에 —
 * 응답 값 대신 스키마의 `array` 속성). 스키마 자체가 행 배열이면 `""`, 객체 행이면 그 객체도 후보.
 */
export function rowPathChoices(
  doc: SchemaDocument,
  node: unknown,
): RowPathChoice[] {
  const out: RowPathChoice[] = [];
  const visit = (
    value: unknown,
    path: string,
    depth: number,
    seen: Set<string>,
  ) => {
    if (depth > 4) return;
    const { node: resolved, ref } = resolveRef(doc.root, value, seen);
    if (!isObject(resolved)) return;
    const nextSeen = ref ? new Set([...seen, ref]) : seen;
    if (resolved.type === "array" || resolved.items !== undefined) {
      out.push({ path, item: resolved.items });
      return;
    }
    const { properties } = mergedObject(doc.root, resolved, nextSeen);
    const total = Object.keys(properties).find((key) => TOTAL_NAMES.test(key));
    const before = out.length;
    for (const [key, child] of Object.entries(properties))
      visit(child, path ? `${path}.${key}` : key, depth + 1, nextSeen);
    if (total)
      for (let i = before; i < out.length; i++)
        if (
          out[i].path.split(".").length ===
          (path ? path.split(".").length + 1 : 1)
        )
          out[i] = { ...out[i], totalPath: path ? `${path}.${total}` : total };
  };
  visit(node, "", 0, new Set());
  // (객체 스키마 자체도 행이 될 수 있다 — 한 건 응답 · 컴포넌트 스키마.)
  if (!out.some((choice) => choice.path === ""))
    out.push({ path: "", item: node });
  return out;
}

/** `allOf` 를 합친 객체 — `properties` · `required` (Java 상속). */
function mergedObject(
  root: Json,
  node: Json,
  seen: ReadonlySet<string>,
  report?: (item: ImportReportItem) => void,
  path = "",
): { properties: Json; required: Set<string>; order: string[] } {
  const properties: Json = {};
  const order: string[] = [];
  const required = new Set<string>();
  const add = (part: Json) => {
    if (isObject(part.properties))
      for (const [key, value] of Object.entries(part.properties)) {
        if (!(key in properties)) order.push(key);
        properties[key] = value;
      }
    if (Array.isArray(part.required))
      for (const key of part.required)
        if (typeof key === "string") required.add(key);
  };
  if (Array.isArray(node.allOf))
    for (const part of node.allOf) {
      const resolved = resolveRef(root, part, seen);
      if (resolved.external)
        report?.({
          kind: "construct",
          path,
          name: `$ref ${resolved.external}`,
        });
      else if (resolved.cycle)
        report?.({ kind: "construct", path, name: `cycle ${resolved.ref}` });
      else if (isObject(resolved.node)) {
        const inner = mergedObject(
          root,
          resolved.node,
          resolved.ref ? new Set([...seen, resolved.ref]) : seen,
          report,
          path,
        );
        for (const key of inner.order) {
          if (!(key in properties)) order.push(key);
          properties[key] = inner.properties[key];
        }
        for (const key of inner.required) required.add(key);
      }
    }
  add(node);
  return { properties, required, order };
}

/** 한 속성의 타입 · null 허용 (3.1 `type: [T, "null"]` · 3.0 `nullable`). */
function typeOf(node: Json): { type?: string; nullable: boolean } {
  const raw = node.type;
  if (Array.isArray(raw)) {
    const types = raw.filter((t) => t !== "null");
    return {
      type: typeof types[0] === "string" ? types[0] : undefined,
      nullable: raw.includes("null"),
    };
  }
  return {
    type: typeof raw === "string" ? raw : undefined,
    nullable: node.nullable === true,
  };
}

const keyLike = (key: string) => /^(id|.*_ID|.*_id|.*[a-z]Id)$/.test(key);

export interface SchemaColumns {
  /** 미리보기 열 표의 열 (선택 전) — 타입 · 후보. */
  columns: DetectedColumn[];
  /** 열 key → 필드에 실을 나머지 (required · label · default · children). */
  extras: Record<
    string,
    Pick<DataField, "required" | "label" | "defaultValue" | "children">
  >;
  report: ImportReportItem[];
  /** 정수형 이름의 속성 (JS 가 순서를 바꾼다 — 보고에 경고). */
  numericNames: string[];
}

/** 고른 행 스키마 → 열 · 보고 (§2.4). */
export function schemaColumns(
  doc: SchemaDocument,
  node: unknown,
): SchemaColumns {
  const report: ImportReportItem[] = [];
  const push = (item: ImportReportItem) => {
    if (
      !report.some(
        (r) =>
          r.kind === item.kind && r.path === item.path && r.name === item.name,
      )
    )
      report.push(item);
  };
  const extras: SchemaColumns["extras"] = {};
  const numericNames: string[] = [];

  const field = (
    key: string,
    value: unknown,
    required: boolean,
    path: string,
    depth: number,
    seen: ReadonlySet<string>,
  ):
    | { column: DetectedColumn; extra: SchemaColumns["extras"][string] }
    | undefined => {
    const resolved = resolveRef(doc.root, value, seen);
    if (resolved.external) {
      push({ kind: "construct", path, name: `$ref ${resolved.external}` });
      return undefined;
    }
    if (resolved.cycle) {
      push({ kind: "construct", path, name: `cycle ${resolved.ref}` });
      return undefined;
    }
    if (!isObject(resolved.node)) return undefined;
    const nextSeen = resolved.ref ? new Set([...seen, resolved.ref]) : seen;
    const node = resolved.node;
    for (const name of CONSTRUCTS)
      if (node[name] !== undefined) push({ kind: "construct", path, name });
    if (isObject(node.additionalProperties))
      push({ kind: "construct", path, name: "additionalProperties" });
    for (const name of CONSTRAINTS)
      if (node[name] !== undefined) push({ kind: "constraint", path, name });
    const { type: declared, nullable } = typeOf(node);
    // (모양이 `oneOf` · `anyOf` · `not` 뿐인 속성은 열로 만들지 않는다 — 보고에 적었다.)
    if (
      !declared &&
      !isObject(node.properties) &&
      !Array.isArray(node.allOf) &&
      node.items === undefined &&
      (node.oneOf !== undefined || node.anyOf !== undefined || node.not !== undefined)
    )
      return undefined;
    const format = typeof node.format === "string" ? node.format : undefined;
    const candidates: ColumnChoice[] = [];
    let type: DataFieldType = "string";
    let textFormat: DataField["format"] | undefined;
    let children: DataField[] | undefined;
    const isObjectNode =
      declared === "object" ||
      isObject(node.properties) ||
      Array.isArray(node.allOf);
    if (
      declared === "string" ||
      (!declared && !isObjectNode && node.items === undefined)
    ) {
      if (format === "date" || format === "date-time" || format === "time")
        type = "date";
      else if (format === "email") textFormat = "email";
      else if (format === "uri" || format === "url") textFormat = "url";
      // (값이 두 가지인 글자 enum — `Y` / `N` 류는 참 · 거짓 후보, 확정은 사용자.)
      if (Array.isArray(node.enum)) {
        const values = node.enum.filter((v) => v !== null);
        if (values.length === 2 && values.every((v) => typeof v === "string")) {
          const [a, b] = values as string[];
          const yes = /^(y|yes|t|true|1)$/i.test(a) ? a : b;
          const no = yes === a ? b : a;
          if (/^(y|yes|t|true|1)$/i.test(yes) && /^(n|no|f|false|0)$/i.test(no))
            candidates.push({
              type: "boolean",
              encoding: { kind: "flag", true: yes, false: no },
            });
          else push({ kind: "constraint", path, name: "enum" });
        } else push({ kind: "constraint", path, name: "enum" });
      }
    } else if (declared === "integer" || declared === "number") {
      type = "number";
      // (사용자 결정 5 — int64 는 number, key 후보인 int64 만 큰 정수 글자를 제안.)
      if (format === "int64" && required && !nullable && keyLike(key))
        candidates.push({ type: "string", encoding: { kind: "bigInt" } });
      if (Array.isArray(node.enum))
        push({ kind: "constraint", path, name: "enum" });
    } else if (declared === "boolean") {
      type = "boolean";
    } else if (declared === "array" || node.items !== undefined) {
      type = "array";
      const items = resolveRef(doc.root, node.items, nextSeen);
      if (
        isObject(items.node) &&
        (isObject(items.node.properties) || Array.isArray(items.node.allOf))
      )
        children =
          depth < MAX_DEPTH
            ? childFields(
                items.node,
                path,
                depth + 1,
                items.ref ? new Set([...nextSeen, items.ref]) : nextSeen,
              )
            : undefined;
    } else if (isObjectNode) {
      type = "object";
      if (depth < MAX_DEPTH)
        children = childFields(node, path, depth + 1, nextSeen);
      else push({ kind: "construct", path, name: "depth" });
    }
    const label =
      typeof node.title === "string"
        ? node.title
        : typeof node.description === "string" && node.description.length <= 40
          ? node.description
          : undefined;
    return {
      column: {
        key,
        label: label ?? key,
        type,
        ...(textFormat ? { format: textFormat } : {}),
        sampleValue: null,
        selected: true,
        candidates,
        keyCandidate: required && !nullable && keyLike(key),
      },
      extra: {
        ...(required && !nullable ? { required: true } : { required: false }),
        ...(label ? { label } : {}),
        ...(node.default !== undefined ? { defaultValue: node.default } : {}),
        ...(children ? { children } : {}),
      },
    };
  };

  const childFields = (
    node: Json,
    path: string,
    depth: number,
    seen: ReadonlySet<string>,
  ): DataField[] => {
    const { properties, required, order } = mergedObject(
      doc.root,
      node,
      seen,
      push,
      path,
    );
    const out: DataField[] = [];
    for (const key of order) {
      const made = field(
        key,
        properties[key],
        required.has(key),
        `${path}.${key}`,
        depth,
        seen,
      );
      if (!made) continue;
      out.push({
        key,
        type: made.column.type,
        ...(made.column.format ? { format: made.column.format } : {}),
        ...made.extra,
      });
    }
    return out;
  };

  const top = resolveRef(doc.root, node);
  const columns: DetectedColumn[] = [];
  if (isObject(top.node)) {
    const seen = top.ref ? new Set([top.ref]) : new Set<string>();
    for (const name of CONSTRUCTS)
      if (top.node[name] !== undefined)
        push({ kind: "construct", path: "", name });
    const { properties, required, order } = mergedObject(
      doc.root,
      top.node,
      seen,
      push,
      "",
    );
    for (const key of order) {
      if (/^\d+$/.test(key)) numericNames.push(key);
      const made = field(key, properties[key], required.has(key), key, 1, seen);
      if (!made) continue;
      columns.push(made.column);
      extras[key] = made.extra;
    }
  }
  return { columns, extras, report, numericNames };
}

/** 사용자 결정 2 — 표와 함께 만들 endpoint 정의의 초안 (정의만 — 실행하지 않는다). */
export interface EndpointDraftInput {
  name: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  baseUrl: string;
  path: string;
  queryParams: {
    key: string;
    value: string;
    type: "string";
    required: boolean;
  }[];
  dataPath: string;
  totalPath?: string;
}

export function endpointDraftOf(
  doc: SchemaDocument,
  choice: SchemaChoice,
  rows: RowPathChoice,
  name: string,
): EndpointDraftInput | undefined {
  if (!choice.operation) return undefined;
  return {
    name,
    method: choice.operation.method as EndpointDraftInput["method"],
    baseUrl: doc.baseUrl,
    path: choice.operation.path,
    queryParams: choice.operation.queryParams.map((key) => ({
      key,
      value: "",
      type: "string",
      required: false,
    })),
    dataPath: rows.path,
    ...(rows.totalPath ? { totalPath: rows.totalPath } : {}),
  };
}
