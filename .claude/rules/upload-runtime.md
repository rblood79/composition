---
description: 대용량 파일 업로드 (ADR-201) — @composition/upload 엔진 · FileUpload 컴포넌트 · TUS 서버 계약의 불변식과 실측 함정
paths:
  - "packages/upload-engine/**"
  - "packages/shared/src/upload/**"
  - "packages/shared/src/components/FileUpload*.tsx"
  - "packages/shared/src/renderers/UploadRenderers.tsx"
  - "docs/reference/upload/**"
  - "examples/upload-server-spring/**"
  - "examples/upload-client-jsp/**"
  - "apps/builder/scripts/adr201-*.mjs"
---

# 업로드 런타임 규칙 — ADR-201 (Implemented 2026-09-17)

정본: [ADR-201](../../docs/adr/completed/201-large-file-upload-engine-component-server-contract.md) · 서버 계약 [server-contract.md](../../docs/reference/upload/server-contract.md) v1.0.0 · breakdown `docs/adr/design/201-*-breakdown.md`.

## 1. 불변식 (깨지면 결함)

| #   | 불변식                                                                                                                                                                                                                                                                   | 지키는 게이트                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| HC1 | 엔진 `@composition/upload` 과 `FileUploadActive` (endpoint 해석 · CSRF · 런타임 행) 는 **initial chunk 밖** — 첫 파일 유입 때 `import()`. `FileUpload.tsx` 는 idle 껍데기만 (정적 import 에 `./FileUploadActive` · `resolveUploadEndpoint` · `@composition/upload` 금지) | `adr201-bundle-gate.mjs` (`uploadEngineLazy` · `uploadActiveLazy`) · `fileUploadComponent.test.tsx` lazy 경계 정적 검사 |
| HC3 | **서버 `Upload-Offset` 이 진실** — 클라이언트 카운터로 offset 을 정하지 않는다. 재개는 `HEAD` 재동기 → 그 offset 부터 (재전송 ≤ chunkSize). 클라이언트가 `ERR_ABORTED` 로 본 PATCH 도 서버는 적용했을 수 있다                                                            | 엔진 conformance · tusd 대조군 · G5 live                                                                                |
| HC7 | canonical 문서에는 **endpoint id 만** (`FileUpload.endpoint` = `ApiEndpointDefinition.id`). URL · 헤더 · 토큰은 Data 패널 endpoint 정의에서 런타임 해석. 파일명 · 큐 상태 등 런타임 상태는 문서 write 0 (`selectedFiles` 채널은 제거됨)                                  | `plaintextTokenCorpus.test.ts` · G5 "문서 write 0"                                                                      |
| m4  | vault placeholder (`{{secret.NAME}}`) 헤더가 남아 있으면 **보내지 않고** `E_UNAUTHORIZED` — 이때 엔진도 로드하지 않는다                                                                                                                                                  | `resolveUploadEndpoint.test.ts` · `fileUploadComponent.test.tsx`                                                        |
| —   | 에러 코드는 `packages/upload-engine/src/errors.ts` + `errors.json` 단일 소스 (11종) — 계약 §9 표와 3자 대조. 코드 추가는 세 곳 동시                                                                                                                                      | 엔진 errors 테스트                                                                                                      |
| —   | preview 는 endpoint 정의 `uploadDryRun` (기본 true = 바이트 미전송) 을 따르고, publish 는 `dryRun={false}` 명시 — 컴포넌트 기본값을 바꾸지 않는다                                                                                                                        | `resolveUploadEndpoint.test.ts`                                                                                         |
| —   | 압축 없음 — `File.slice` 원본 바이트를 `application/offset+octet-stream` 으로. 스트림 압축은 offset 모델을 깨므로 엔진에 넣지 않는다 (필요하면 파일 자체를 먼저 zip)                                                                                                     | —                                                                                                                       |

## 2. 등록 표면 (D2)

- `accepts` 11: `acceptedFileTypes, allowsMultiple, acceptDirectory, isDisabled, endpoint, chunkSize, retryDelays, parallelUploads, maxFileSize, autoProceed, showPreview` — `protocol` 은 D2 판정으로 제거됨, 재도입 금지.
- capability: FileTrigger `onSelect` · DropZone `onDrop` 만 (RAC 실존 callback, `satisfies keyof` 로 컴파일 증명). 완료·오류 커스텀 이벤트는 ADR-158 개정 없이는 등재하지 않는다 (무음 no-op 규칙이 된다).
- API 편집기: TUS endpoint 는 GET 프로브에 `405`/`412` + `Tus-Resumable` 로 답한다 → `stores/utils/uploadEndpointProbe.ts` 가 업로드 endpoint 로 분류 (오류 채널에 싣지 않는다). 자동 Send 자체는 유지 — 생성 시점엔 종류를 모른다.

## 3. 실측 함정 (Why)

1. **dev proxy 자동 Send 가 호스트 쿠키를 덮는다** — API 편집기 자동 Send 가 `/api/proxy` 를 지나 참조 서버 새 세션의 `Set-Cookie` 를 5173 응답으로 되돌려 `XSRF-TOKEN` 을 다른 세션 값으로 바꾼다. live 하니스는 endpoint 정의 뒤 dev-login 을 다시 한다. production builder 는 proxy 없음.
2. CSRF 403 이 CORS 헤더 없이 나가면 브라우저는 status 0 → `E_NETWORK` 로 보인다. 계약은 교차 출처 운영을 비권장 (§5).
3. `XSRF-TOKEN` 쿠키 Path 는 `/` — 컨텍스트 경로면 다른 컨텍스트의 페이지가 `document.cookie` 로 못 읽는다.
4. Spring DispatcherServlet `/` 가 정적 `js/*.iife.js` 를 삼킨다 → `configureDefaultServletHandling`.
5. `{version}` 같은 파라미터 메시지는 `translations.ts` `formattedMessages` 함수 등록 없이는 치환되지 않는다 (정적 문자열만 두면 live 에 `{version}` 그대로).
6. **live 하니스 실행 중 소스를 편집하지 않는다** — dev 서버 HMR 이 preview iframe 을 교체해 `Frame was detached` 로 끝난다.
7. `docs/adr/evidence/` 는 gitignore — worktree 를 지우면 그 안의 evidence 가 같이 사라진다. 제거 전 main 으로 복사.
8. 번들 게이트는 sameLockfile 을 검사하지 않는다 (workspace package 추가가 산출물). 상한 재승인은 `APPROVED` 상수로 사용자 결정을 코드에 남긴다.

## 4. 실행 절차

- 참조 서버: `JAVA_HOME=/opt/homebrew/opt/openjdk@17 mvn -q cargo:run -Dupload.storage.dir=<웹루트 밖> -Dupload.cors.allowedOrigins=http://localhost:5173` (dev-login 은 cargo 프로파일이 켠다). 끝나면 `pkill -f cargo:run`.
- G5 live: `node apps/builder/scripts/adr201-g5-live.mjs` (preview, 1GB `/tmp/adr201-g5/g5-1g.zip`) · `adr201-g5-jsp-live.mjs` (JSP). 번들: before/after 를 같은 revision 으로 `adr209-bundle-closure.mjs` → `adr201-bundle-gate.mjs`.
- 메모리: `project-adr201-file-upload-execution-2026-09`.
