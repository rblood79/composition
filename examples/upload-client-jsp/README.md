# upload-client-jsp — JSP 1장 예제 (ADR-201 Phase 2)

`@composition/upload` IIFE 를 `<script>` 1줄로 싣고 [참조 서버](../upload-server-spring/README.md) 에 업로드하는 JSP (JSTL) 한 장. React·빌드 도구 없이 기존 Java 웹앱 (전자정부 표준프레임워크 포함) 에 그대로 넣는 시나리오다.

| 파일         | 내용                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `upload.jsp` | `CompositionUpload.create(el, { endpoint, getHeaders: () => ({ "X-CSRF-TOKEN": meta.content }), withCredentials: true })` + 일시정지/재개/취소 버튼 + 이벤트 로그 |

## 엔진 파일 복사

IIFE 는 엔진 package 의 빌드 산출물이다 (아직 빌드되지 않았으면 먼저 빌드):

```bash
pnpm -F @composition/upload build                                  # → packages/upload-engine/dist/vanilla.global.js
mkdir -p examples/upload-server-spring/src/main/webapp/js
cp packages/upload-engine/dist/vanilla.global.js examples/upload-server-spring/src/main/webapp/js/composition-upload.iife.js
cp examples/upload-client-jsp/upload.jsp           examples/upload-server-spring/src/main/webapp/upload.jsp
```

다른 webapp 에 넣을 때도 같다 — `js/composition-upload.iife.js` 와 `upload.jsp` 두 파일. JSTL (`javax.servlet:jstl:1.2`) 이 `WEB-INF/lib` 에 있어야 한다 (참조 서버 pom 은 runtime 의존으로 포함).

## 실행 절차 (G2b-3 · G5 JSP 축)

```bash
cd examples/upload-server-spring
mvn cargo:run                                    # http://localhost:8080/upload/  (devLogin 활성, 저장 = java.io.tmpdir)
```

1. 브라우저에서 `http://localhost:8080/upload/session/dev-login?owner=demo` → "logged in as demo"
2. `http://localhost:8080/upload/upload.jsp` — 상태 표시에 `로그인: demo`, 로그에 `ready`
3. 1GB 이상 파일을 끌어다 놓거나 선택 → 로그에 `uploading N%` 진행
4. **중단 3경로** — (a) 일시정지 버튼 → 재개 버튼 (b) DevTools Network offline → online (c) 새로고침 후 같은 파일 다시 선택 → 로그에 `HEAD` 재개 offset 이 이전 진행률과 같아야 한다 (재전송 ≤ 8 MiB)
5. `done` 후 서버 DB 확인 — H2 콘솔 또는 `curl -b jar -I http://localhost:8080/upload/upload/{id}` (`Upload-Offset == Upload-Length`), 다운로드 `curl -b jar -OJ http://localhost:8080/upload/files/{id}` (`Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`)

기록: 날짜 · Chrome 버전 · 파일 크기 · 중단 경로별 재개 offset · 사용자 confirm 을 `docs/adr/evidence/201-phase2-server.md` G2b 행에 적는다.

## 계약 대응 (server-contract.md)

| 항목           | 이 페이지                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| §5 인증        | `withCredentials: true` (쿠키 세션) · `getHeaders()` 가 매 요청 `X-CSRF-TOKEN` (meta 태그 ← `${sessionScope.CSRF_TOKEN}`) |
| §5 정적 비밀 0 | `headers` 옵션 미사용 — 페이지 소스에 토큰·키 없음 (CSRF 토큰은 세션 스코프 런타임 값)                                    |
| §7 청크        | `chunkSize: 8 MiB` — 서버 `upload.chunk.maxBytes` (64 MiB) 이하, Apache `Timeout 60s` 안전                                |
| §4 PATCH 차단  | 엔진이 `405/501` 을 보면 `overridePatchMethod` 로 자동 전환 (참조 서버 `MethodOverrideFilter`)                            |
| §9 에러 코드   | `subscribe` 로그에 `item.error.code` — `E_UNAUTHORIZED` 는 안내 문구 출력                                                 |
| same-origin    | JSP 와 `/upload` 가 같은 컨텍스트 → CORS 설정 0. 교차 출처면 `upload.cors.allowedOrigins` + Expose-Headers (계약 §5)      |

## 알려진 제약

- 엔진 IIFE 는 다른 worktree (Phase 0/1) 가 만든다 — 이 예제는 엔진 API 계약 (`create/add/start/pause/resume/cancel/remove/getItems/subscribe/destroy`, `subscribe` 이벤트의 `item.status`/`item.error.code`) 만 전제한다. 이벤트 객체 형태가 최종 엔진과 다르면 `<script>` 블록의 `subscribe` 콜백만 고친다.
- 작성 머신에 JDK·Maven 이 없어 브라우저 실행은 **미검증** — 위 절차는 사용자 머신에서 돌린다.
