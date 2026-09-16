# @composition/upload

대용량 파일 업로드 전송 엔진 — TUS 1.0 (core + creation + expiration, `checksum`/`termination` 감지) · sans-I/O 상태기계 · 런타임 의존 0. composition 밖 (JSP/Spring 고객 페이지, Node/Electron) 에서도 그대로 쓴다. 결정 기록: [ADR-201](../../docs/adr/201-large-file-upload-engine-component-server-contract.md) · 구현 상세 [breakdown](../../docs/adr/design/201-large-file-upload-engine-component-server-contract-breakdown.md).

## 사용법 — entry 3개

### 1. 코어 (`@composition/upload`)

```ts
import { createUploadQueue } from "@composition/upload";

const queue = createUploadQueue({
  endpoint: "https://example.com/upload/files",
  chunkSize: 8 * 1024 ** 2, // 기본 8MB (Apache Timeout 60s 회선 안전). Infinity = 단일 PATCH
  parallelUploads: 3,
  getHeaders: () => ({
    "X-CSRF-Token": document
      .querySelector("meta[name=csrf]")!
      .getAttribute("content")!,
  }),
});
queue.subscribe((items) => render(items)); // UploadItemState[] — offset 은 진행 힌트
queue.add(Array.from(input.files!)); // autoProceed 기본 true
queue.pause(id);
queue.resume(id);
queue.cancel(id);
queue.remove(id);
```

Node/Electron 은 `driver: createFetchDriver()` 를 주지 않아도 `XMLHttpRequest` 가 없으면 fetch driver 를 지연 로드한다 (진행률 콜백 없음 — 청크 완료 단위로만 `offset` 이 움직인다).

### 2. React (`@composition/upload/react`, react 는 optional peer)

```tsx
import { useUploadQueue, useUploadItem } from "@composition/upload/react";

function Uploader() {
  const { items, add, pause, resume, cancel, remove, queue } = useUploadQueue({
    endpoint,
    dryRun: isPreview,
  });
  return (
    <>
      <input
        type="file"
        multiple
        onChange={(e) => add(Array.from(e.target.files ?? []))}
      />
      {items.map((it) => (
        <Row key={it.id} item={it} />
      ))}
    </>
  );
}
```

`endpoint` / `protocol` / `dryRun` 이 바뀌면 큐를 새로 만든다 (진행 중 항목 abort). 나머지 옵션은 최초 값 고정.

### 3. Vanilla / IIFE (`@composition/upload/vanilla`, global `CompositionUpload`) — JSP 1줄

```html
<script src="composition-upload.iife.js"></script>
<div id="upload"></div>
<script>
  CompositionUpload.create(document.getElementById("upload"), {
    endpoint: "/app/upload/files",
    protocol: "tus",
    chunkSize: 8 * 1024 * 1024,
    withCredentials: true,
    getHeaders: function () {
      return {
        "X-CSRF-Token": document.querySelector("meta[name=_csrf]").content,
      };
    },
  });
</script>
```

파일 선택 input · 행 목록 (이름 `textContent` · `<progress>` · 상태 · 일시정지/재개/취소 버튼) 을 최소 DOM 으로 그린다. `input` 옵션으로 기존 `<input type=file>` 을 넘길 수 있고 `directory: true` 면 폴더 선택 (`webkitdirectory`).

## 옵션 (`UploadQueueOptions`)

| 옵션                  | 기본                    | 설명                                                                                                    |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `endpoint`            | (필수)                  | TUS creation URL. `201 Location` 은 이 URL 기준 상대 경로도 수용                                        |
| `protocol`            | `"tus"`                 | `"tus"` \| `"multipart"` (FormData 단일 POST, 재개 없음 — 지연 청크)                                    |
| `chunkSize`           | `8MB`                   | PATCH 청크. `Infinity` = 단일 PATCH. 504/timeout 마다 절반 (하한 1MB)                                   |
| `parallelUploads`     | `3`                     | 동시 전송 수                                                                                            |
| `retryDelays`         | `[0, 1000, 3000, 5000]` | 연속 실패 backoff (ms). 길이 = 최대 재시도. 소진 시 `error` — `start(id)` 로 사용자 재개                |
| `maxFileSize`         | —                       | `add()` 시점에 초과 파일은 `E_TOO_LARGE`. 서버 `Tus-Max-Size` 는 OPTIONS 로 별도 선차단                 |
| `headers`             | —                       | 정적 헤더 (문서에 비밀 저장 금지 — ADR-201 R3)                                                          |
| `getHeaders`          | —                       | 요청마다 호출 (CSRF 토큰 등 동적 값), sync/async                                                        |
| `withCredentials`     | `true`                  | 쿠키 세션. `Access-Control-Allow-Origin: *` 와 함께 쓸 수 없다 (서버가 Origin 반사)                     |
| `autoProceed`         | `true`                  | `add()` 직후 자동 시작 (Uppy 원천 명)                                                                   |
| `metadata`            | —                       | `Upload-Metadata` 추가 키 (`filename`/`filetype`/`relativePath` 는 자동)                                |
| `overridePatchMethod` | `false`                 | `POST + X-HTTP-Method-Override: PATCH`. PATCH 405/501 수신 시 1회 자동 전환                             |
| `dryRun`              | `false`                 | 바이트 미전송 (preview 기본). 진행률 시뮬레이션, 저장소 메모리 — dry-run driver 지연 로드               |
| `checksum`            | `true`                  | 서버가 `checksum` 확장을 광고하면 청크별 `Upload-Checksum` (sha256 > sha1). 64MB 초과 청크는 계산 안 함 |
| `requestTimeout`      | `0`                     | 요청 timeout ms → `E_PROXY_TIMEOUT`                                                                     |
| `driver` / `storage`  | XHR / localStorage      | 주입 (테스트 · Node)                                                                                    |

## 에러 코드 (`UploadError.code`) — 정본 `src/errors.ts` (`errors.json` 덤프)

| 코드                | HTTP                                               | retryable | 동작                                                                           |
| ------------------- | -------------------------------------------------- | :-------: | ------------------------------------------------------------------------------ |
| `E_PATCH_BLOCKED`   | 405, 501                                           |    no     | 첫 405 는 override 로 1회 자동 전환 (그때만 retryable) — 그래도 막히면 이 코드 |
| `E_PROXY_TIMEOUT`   | 504, 408, 502                                      |    yes    | 다음 청크부터 chunkSize 절반                                                   |
| `E_OFFSET_MISMATCH` | 409                                                |    yes    | 응답에 `Upload-Offset` 있으면 그 값으로, 없으면 HEAD — 대기 없이 즉시          |
| `E_TOO_LARGE`       | 413                                                |    no     | OPTIONS `Tus-Max-Size` 로 creation 전에 차단                                   |
| `E_NETWORK`         | 0 (응답 없음)                                      |    yes    | 단절 · DNS · CORS 거부                                                         |
| `E_UNAUTHORIZED`    | 401, 403                                           |    no     | 인증 · 소유자 불일치 · CSRF 부재                                               |
| `E_EXPIRED`         | 410, 404                                           |    yes    | 저장소 forget → 처음부터 재생성                                                |
| `E_CHECKSUM`        | 460                                                |    yes    | HEAD 후 같은 청크 재전송                                                       |
| `E_REJECTED`        | 400, 415, 422 (+ 411 · 412 · 429 등 표에 없는 4xx) |    no     | 파일명 traversal · 메타데이터 · Content-Type · Defer-Length · quota            |
| `E_SERVER`          | 500, 503 (+ 표에 없는 5xx)                         |    yes    | backoff                                                                        |
| `E_CANCELLED`       | —                                                  |    no     | 사용자 취소 — `termination` 있으면 DELETE                                      |

## 재개 계약

- fingerprint = `sha256(name|size|lastModified|endpoint)` (폴더 선택은 `relativePath` 가 name 대신). `crypto.subtle` 이 없는 비보안 컨텍스트는 FNV-1a 폴백.
- localStorage 키 `cu:<fingerprint>` 에 `{u: url, e?: expires}` 만 — 파일명·크기·내용 0. 완료·취소·만료·거부 시 삭제, 만료 지난 항목은 읽는 순간 삭제.
- 재개 시 **서버 `Upload-Offset` 이 진실** — `HEAD` 로 묻고 그 offset 부터 다음 청크. 클라이언트 `offset` 은 진행 힌트일 뿐이며 실패하면 committed 로 되돌린다. 3경로 (네트워크 단절 · 새로고침 · 탭 종료) 모두 재전송 ≤ chunkSize (측정값 아래).
- 서버 요구: `Access-Control-Expose-Headers: Location, Upload-Offset, Upload-Length, Upload-Expires, Tus-Resumable, Tus-Version, Tus-Extension, Tus-Max-Size, Tus-Checksum-Algorithm` (교차 출처일 때 — 없으면 `Upload-Offset` 을 못 읽어 `E_REJECTED`).

## 상태기계 (sans-I/O)

`reduce(state, event, config) → [state, commands]` (`src/core/protocol`). 브라우저 API 0 — driver/queue 가 `http` / `persist` / `forget` / `wait` / `abort` command 를 실행하고 결과를 이벤트로 되돌린다. 시나리오 corpus (`protocol.test.ts`) 가 Rust 이식 시 대조 기준.

## 검증 (G0 · G1 — 2026-09-17, Chromium 151.0.7922.34 headless, macOS arm64, localhost mock TUS 서버)

| 항목                                    | 결과                                                                                                                                                       |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 first-nail (100MB, XHR)              | 진행률 15 이벤트 (단조) · 단절 2회 (소켓 reset → Chromium 자동 재시도 → 409 → HEAD 50.14MB / 서버 다운 → E_NETWORK → HEAD 75.08MB) · 재전송 합 8MB · 완료  |
| 힙 Δ (4GB × 3, parallel 3, dryRun 아님) | peak Δ 중앙값 **2.22 MB** (상한 64MB) · GC 후 Δ 1.02 MB · 12GB / 11.4s · 재전송 0 (`scripts/results/heap-*.json`)                                          |
| 재개 3경로 (256MB, chunk 8MB)           | 단절 4.06MB · 새로고침 0 · 탭 종료 0 — 전부 ≤ 8MB, creation 1회 (`scripts/results/resume-*.json`)                                                          |
| 크기                                    | core+tus 초기 청크 **5,852 B gz** (상한 6,144) · react entry 6,064 · IIFE **8,068 B gz** (상한 10,240) · 지연 청크 dry-run 666 / fetch 451 / multipart 470 |
| 적합성 스위트 (mock)                    | 31 + 공격 corpus 18 + 상태기계 22 + 표 4 + 경계 3 + 크기 1 = 79 PASS                                                                                       |
| tusd v2.10.1 대조군                     | 8/8 PASS — tusd 는 `checksum` 미광고 (헤더 미전송 확인) · 409 에 `Upload-Offset` 없음 (HEAD 경로) · metadata 검증 없음 (id 저장)                           |

재현: `node scripts/live.mjs g0|heap|resume` (sparse 파일 + Playwright Chromium) · `pnpm measure:size` · `TUSD_BIN=… pnpm test src/tusd.conformance.test.ts`.

## 비스코프

cloud 어댑터 (대상 서비스가 저장소에서 소거돼 oracle 없음 — review round 1) · `s3-multipart` / resumable.js 호환 어댑터 · 전체 파일 해시 · 압축 전송.
