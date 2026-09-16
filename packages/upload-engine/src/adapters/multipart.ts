/**
 * multipart/form-data POST fallback — 단일 요청, 재개 없음 (소용량 · 레거시 컨트롤러).
 * 필드: `file` + metadata (`filename`/`filetype`/`relativePath` + 옵션 metadata).
 */
import { errorOfResponse } from "../errors";
import type { UploadEvent } from "../core/protocol/types";
import { absoluteUrl, DEFAULT_CAPABILITIES, type WireAdapter } from "./types";

export function createMultipartAdapter(): WireAdapter {
  return {
    single: true,
    preflight: () => Promise.resolve({ ...DEFAULT_CAPABILITIES }),
    request(op, ctx) {
      if (op !== "create") {
        return {
          method: "HEAD",
          url: ctx.state.url ?? ctx.endpoint,
          headers: ctx.headers,
        };
      }
      const form = new FormData();
      form.append("filename", ctx.file.name);
      form.append("filetype", ctx.file.type);
      if (ctx.state.relativePath)
        form.append("relativePath", ctx.state.relativePath);
      for (const [k, v] of Object.entries(ctx.metadata)) form.append(k, v);
      form.append("file", ctx.file, ctx.file.name);
      return {
        method: "POST",
        url: ctx.endpoint,
        headers: ctx.headers,
        body: form,
      };
    },
    response(op, res, ctx): UploadEvent {
      const ok = res.status >= 200 && res.status < 300;
      if (op !== "create") return { kind: "chunk-sent", bytes: 0 };
      if (!ok)
        return {
          kind: "fail",
          error: errorOfResponse(res.status, res.text, false),
        };
      const location = res.header("Location");
      return {
        kind: "created",
        url: location ? absoluteUrl(location, ctx.endpoint) : "",
        offset: ctx.file.size,
      };
    },
  };
}

