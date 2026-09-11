/**
 * cURL 명령 → endpoint 초안 (순수 규칙 파서, 모델 0) — ADR-213 Phase 6 AI-2 의 1차 경로.
 * ADR-212 Phase 4 (API 편집기 "cURL 붙여넣기") 가 같은 파서를 쓴다.
 *
 * 지원: `curl [-X METHOD] URL` · `-H/--header "K: V"` · `-d/--data/--data-raw/--data-binary/
 * --data-urlencode` · `-u/--user user:pass` (Basic) · `-G/--get` (data → query) · `--url` ·
 * 줄 끝 `\` 이어짐 · 작은/큰따옴표 · `$'...'`. 모르는 옵션은 무시한다.
 */
export interface ParsedCurl {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers: { key: string; value: string }[];
  body: string | null;
}

export function looksLikeCurl(text: string): boolean {
  return /^\s*curl\s/.test(text);
}

/** 셸 어법 토큰화 — 따옴표 · 백슬래시 이어짐 */
export function tokenizeShell(text: string): string[] {
  const src = text.replace(/\\\r?\n/g, " ");
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < src.length) {
        current += src[++i];
      } else current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      has = true;
      continue;
    }
    if (ch === "$" && src[i + 1] === "'") {
      quote = "'";
      has = true;
      i++;
      continue;
    }
    if (ch === "\\" && i + 1 < src.length) {
      current += src[++i];
      has = true;
      continue;
    }
    if (/\s/.test(ch)) {
      if (has || current) tokens.push(current);
      current = "";
      has = false;
      continue;
    }
    current += ch;
    has = true;
  }
  if (has || current) tokens.push(current);
  return tokens;
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

export function parseCurlCommand(text: string): ParsedCurl | null {
  const tokens = tokenizeShell(text.trim());
  if (tokens[0] !== "curl") return null;
  let method: ParsedCurl["method"] | null = null;
  let url: string | null = null;
  const headers: ParsedCurl["headers"] = [];
  const data: string[] = [];
  let get = false;
  let user: string | null = null;

  const next = (i: number): string | undefined => tokens[i + 1];
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "-X" || tok === "--request") {
      const m = (next(i) ?? "").toUpperCase();
      if ((METHODS as readonly string[]).includes(m))
        method = m as ParsedCurl["method"];
      i++;
    } else if (tok.startsWith("-X") && tok.length > 2) {
      const m = tok.slice(2).toUpperCase();
      if ((METHODS as readonly string[]).includes(m))
        method = m as ParsedCurl["method"];
    } else if (tok === "-H" || tok === "--header") {
      const raw = next(i) ?? "";
      const colon = raw.indexOf(":");
      if (colon > 0) {
        headers.push({
          key: raw.slice(0, colon).trim(),
          value: raw.slice(colon + 1).trim(),
        });
      }
      i++;
    } else if (
      tok === "-d" ||
      tok === "--data" ||
      tok === "--data-raw" ||
      tok === "--data-binary" ||
      tok === "--data-urlencode" ||
      tok === "--json"
    ) {
      data.push(next(i) ?? "");
      if (tok === "--json") headers.push({ key: "Content-Type", value: "application/json" });
      i++;
    } else if (tok === "-u" || tok === "--user") {
      user = next(i) ?? null;
      i++;
    } else if (tok === "-G" || tok === "--get") {
      get = true;
    } else if (tok === "--url") {
      url = next(i) ?? null;
      i++;
    } else if (
      tok === "-A" || tok === "--user-agent" || tok === "-b" || tok === "--cookie" ||
      tok === "-e" || tok === "--referer" || tok === "-o" || tok === "--output" ||
      tok === "-m" || tok === "--max-time" || tok === "--connect-timeout" ||
      tok === "-x" || tok === "--proxy"
    ) {
      if (tok === "-b" || tok === "--cookie")
        headers.push({ key: "Cookie", value: next(i) ?? "" });
      i++;
    } else if (tok.startsWith("-")) {
      // 값 없는 플래그 (-s -k -L -i -v --compressed …) — 무시
    } else if (!url) {
      url = tok;
    }
  }
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  if (user) {
    const encoded =
      typeof btoa === "function"
        ? btoa(user)
        : Buffer.from(user, "utf-8").toString("base64");
    headers.push({ key: "Authorization", value: `Basic ${encoded}` });
  }
  let body: string | null = null;
  if (data.length > 0) {
    if (get) {
      const joined = data.join("&");
      url += (url.includes("?") ? "&" : "?") + joined;
    } else {
      body = data.join("&");
    }
  }
  return {
    method: method ?? (body !== null ? "POST" : "GET"),
    url,
    headers,
    body,
  };
}

export interface CurlEndpointDraft {
  name: string;
  method: ParsedCurl["method"];
  baseUrl: string;
  path: string;
  headers: { key: string; value: string; enabled: boolean }[];
  queryParams: {
    key: string;
    value: string;
    type: "string" | "number" | "boolean";
    required: boolean;
  }[];
  bodyType: "json" | "x-www-form-urlencoded" | "none";
  bodyTemplate?: string;
}

/** 파싱 결과 → `define_endpoint` 초안 (이름은 host + 경로에서). */
export function curlToEndpointDraft(
  parsed: ParsedCurl,
  name?: string,
): CurlEndpointDraft {
  const u = new URL(parsed.url);
  const queryParams = [...u.searchParams.entries()].map(([key, value]) => ({
    key,
    value,
    type: "string" as const,
    required: false,
  }));
  let bodyType: CurlEndpointDraft["bodyType"] = "none";
  let bodyTemplate: string | undefined;
  if (parsed.body !== null) {
    bodyTemplate = parsed.body;
    try {
      JSON.parse(parsed.body);
      bodyType = "json";
    } catch {
      bodyType = "x-www-form-urlencoded";
    }
  }
  const pathSlug = u.pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/[^A-Za-z0-9]+/g, ""))
    .filter(Boolean)
    .join("_");
  return {
    name: name ?? `${u.hostname.replace(/^www\./, "")}${pathSlug ? `_${pathSlug}` : ""}`,
    method: parsed.method,
    baseUrl: u.origin,
    path: u.pathname,
    headers: parsed.headers.map((h) => ({ ...h, enabled: true })),
    queryParams,
    bodyType,
    ...(bodyTemplate !== undefined ? { bodyTemplate } : {}),
  };
}
