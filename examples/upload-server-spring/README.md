# upload-server-spring — TUS 1.0 참조 서버 (ADR-201 Phase 2)

[`docs/reference/upload/server-contract.md`](../../docs/reference/upload/server-contract.md) v1.0.0 의 실물. 초기 고객 환경 (Java 8 · Spring MVC 5.3 · servlet 3.1 · Tomcat 9 · Oracle) 에서 그대로 배포할 수 있게 **Spring Boot 비의존** · 전자정부 표준프레임워크와 같은 API 만 쓴다. pnpm/turbo 대상 밖이며 CI 는 [`.github/workflows/upload-server-java.yml`](../../.github/workflows/upload-server-java.yml) (JDK 8, `mvn -q test`) 이 따로 돈다.

> **실행 기록 (2026-09-17)** — 작성 머신에 JDK · Maven 이 없어 처음엔 미실행이었고, 같은 날 사용자가 `brew install openjdk@17 maven` 으로 설치한 뒤 실행했다 (JDK 17 로 `-source/-target 1.8` 컴파일 · JDK 8 자체는 미설치). 결과: `mvn -q test` 52/52 PASS · `mvn -P tus-lib test` 52/52 PASS · `mvn package` → `target/upload.war` · `mvn cargo:run` 기동 후 curl 흐름 (생성 → PATCH → override PATCH → CSRF 없는 PATCH 403 → 타 소유자 403 → 다운로드 → DELETE) 계약대로 · 웹루트 저장 기동 거부 실물 확인. 첫 실행이 잡은 결함 4 — `JndiDataSourceLookup` 패키지 오기 · `@PostConstruct` 의존 (JDK 11+ 빌드 머신) · tus-java-server 버전이 jakarta 계열 (`1.0.0-3.0` → `1.0.0-2.1`) + 죽은 `TusException` catch · cargo `-Dupload.storage.dir` 가 pom 하드코딩에 막힘. 남은 미실행: 1GB 업로드→중단→재개 (브라우저 · G2b-3) · tusd 대조군은 엔진 worktree (G2a) 가 별도 확인. 로그: `docs/adr/evidence/201-phase2-server.md` §4.

## 구성

| 경로                                                               | 역할                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/java/com/composition/upload/config/`                     | `UploadWebAppInitializer` (servlet 3.1, web.xml 없이 DispatcherServlet + 필터 2개) · `UploadWebConfig` (프로퍼티·DataSource·`@EnableScheduling`) · `UploadCoreConfig` (명시 배선) · `StorageDirectoryValidator` (S1 기동 거부)                    |
| `.../web/TusController.java`                                       | 변형 ① — jar 무의존 TUS core + creation + expiration + termination + checksum. PATCH 는 `request.getInputStream()` → `RandomAccessFile.seek(offset)` 1회 쓰기                                                                                     |
| `.../web/MethodOverrideFilter.java`                                | `POST + X-HTTP-Method-Override: PATCH\|DELETE` (계약 §4)                                                                                                                                                                                          |
| `.../web/CsrfHeaderFilter.java` · `CsrfTokens.java`                | 세션 토큰 ↔ `X-CSRF-TOKEN` 헤더 (P5) — 없으면 403                                                                                                                                                                                                 |
| `.../web/DownloadController.java`                                  | `GET /files/{id}` — APPROVED 만 · `attachment` · `nosniff` (S6)                                                                                                                                                                                   |
| `.../web/SessionController.java`                                   | `GET /session` (CSRF 토큰 JSON) · `GET /session/dev-login?owner=` (`upload.devLogin.enabled=true` 일 때만)                                                                                                                                        |
| `.../service/UploadSessionService.java`                            | 생성 (quota·확장자·Tus-Max-Size) → PATCH 직렬화 (`SELECT … FOR UPDATE` 안에서 쓰기 + `MERGE`) → 완료 시 매직바이트 + `UploadScanner` → APPROVED/REJECTED → 종료/GC                                                                                |
| `.../service/FileNameValidator.java` · `UploadMetadataParser.java` | 계약 §3-1 12 규칙 (P1)                                                                                                                                                                                                                            |
| `.../service/UploadScanner.java` · `NoOpUploadScanner.java`        | S4 AV 연동 지점 — 참조 구현은 no-op (APPROVED)                                                                                                                                                                                                    |
| `.../service/ExpiredUploadReaper.java`                             | S7 TTL GC (`@Scheduled`, `upload.gcIntervalMillis`)                                                                                                                                                                                               |
| `src/main/resources/schema-oracle.sql` · `schema-h2.sql`           | `UPLOAD_SESSION` — Oracle (DBA 1회 실행) / H2 Oracle 모드 (개발·테스트, `CREATE TABLE IF NOT EXISTS`)                                                                                                                                             |
| `src/tuslib/java/…/TusLibraryController.java`                      | 변형 ② — [tus-java-server](https://github.com/tomdesair/tus-java-server) 위임 스켈레톤. Maven 프로파일 `tus-lib` 에서만 컴파일 (`mvn -P tus-lib`, tus-java-server `1.0.0-2.1` = javax · Java 8 — `3.x` 는 jakarta). 컴파일·테스트 확인 2026-09-17 |
| `src/test/java/`                                                   | JUnit 4 + MockMvc + H2 — 아래 §테스트                                                                                                                                                                                                             |

## 설정 (`src/main/resources/upload.properties` — 시스템 프로퍼티 `-D` 로 덮어쓰기)

| 키                                         | 기본값                                  | 의미                                                                                                |
| ------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `upload.storage.dir`                       | `${java.io.tmpdir}/composition-uploads` | 파일 바이트 저장 디렉터리. **웹루트 (`getRealPath("/")`) 하위면 기동 실패** (예외 메시지에 두 경로) |
| `upload.maxSize`                           | `10737418240` (10 GiB)                  | `Tus-Max-Size`                                                                                      |
| `upload.chunk.maxBytes`                    | `67108864` (64 MiB)                     | PATCH 1회 상한 (초과 413) — 클라이언트 `chunkSize` 상한과 맞춘다                                    |
| `upload.ttlHours`                          | `24`                                    | `Upload-Expires` = 마지막 PATCH + TTL                                                               |
| `upload.gcIntervalMillis`                  | `600000`                                | TTL GC 주기                                                                                         |
| `upload.quota.maxActivePerOwner`           | `10`                                    | 소유자당 동시 활성 업로드 (초과 429)                                                                |
| `upload.allowedExtensions`                 | `pdf,png,jpg,…`                         | 확장자 화이트리스트 (소문자). 확장자 없는 파일은 거부                                               |
| `upload.cors.allowedOrigins`               | (빈 값 = CORS 헤더 0)                   | 교차 출처 배포 시 명시 origin 목록. `*` 는 credentials 와 조합 불가라 기동 실패                     |
| `upload.devLogin.enabled`                  | `false`                                 | `GET /session/dev-login?owner=` 활성 — **운영 금지**                                                |
| `upload.jdbc.jndiName`                     | (빈 값)                                 | 있으면 컨테이너 DataSource (Oracle 운영: 비밀은 Tomcat `context.xml` 에)                            |
| `upload.jdbc.driver/url/username/password` | H2 파일 DB (Oracle 모드)                | JNDI 가 없을 때 직접 연결 (개발)                                                                    |
| `upload.jdbc.initSchema`                   | `h2`                                    | `h2` = 기동 시 `schema-h2.sql` 실행 · `none` = Oracle (DBA 가 `schema-oracle.sql` 1회)              |

인증: 기본 `SessionOwnerResolver` — 컨테이너 `getUserPrincipal()` 이름 → 없으면 세션 속성 `UPLOAD_OWNER_ID` → 없으면 401. 애플리케이션 로그인이 세션 속성을 넣거나 `OwnerResolver` 구현 1개를 바꿔 끼운다 (`UploadCoreConfig#ownerResolver`).

## 빌드 · 실행

```bash
# JDK 8 + Maven (macOS) — 운영 target. 빌드 머신은 JDK 17 도 가능 (pom 이 -source/-target 1.8, 2026-09-17 실측)
brew install --cask temurin@8            # 또는: brew install openjdk@8 maven  /  brew install openjdk@17 maven
brew install maven
export JAVA_HOME="$(/usr/libexec/java_home -v 1.8)"   # JDK 17 이면: export JAVA_HOME="$(brew --prefix openjdk@17)"

cd examples/upload-server-spring
mvn -q test                              # 단위·MockMvc 스위트 (H2 in-memory)
mvn -q package                           # target/upload.war

# 로컬 실행 A — 임베디드 Tomcat 9 (cargo), http://localhost:8080/upload/
mvn cargo:run
# 로컬 실행 B — 설치된 Tomcat 9
cp target/upload.war "$CATALINA_HOME/webapps/"
JAVA_OPTS="-Dupload.storage.dir=/var/composition/uploads -Dupload.devLogin.enabled=true" "$CATALINA_HOME/bin/catalina.sh" run
```

첫 확인:

```bash
curl -i -X OPTIONS http://localhost:8080/upload/upload
# Tus-Resumable: 1.0.0 / Tus-Extension: creation,expiration,termination,checksum / Tus-Max-Size / Tus-Checksum-Algorithm
curl -c jar -b jar "http://localhost:8080/upload/session/dev-login?owner=demo"
TOKEN=$(curl -s -c jar -b jar http://localhost:8080/upload/session | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
curl -i -c jar -b jar -X POST http://localhost:8080/upload/upload \
  -H 'Tus-Resumable: 1.0.0' -H 'Upload-Length: 5' -H "X-CSRF-TOKEN: $TOKEN" \
  -H "Upload-Metadata: filename $(printf 'hello.txt' | base64)"
# → 201 Location: /upload/upload/{uuid}
```

Tomcat/Apache 앞단 knob (Timeout · maxSwallowSize · LimitRequestBody · WAF PATCH) 은 계약 §6 표.

## 테스트 (`src/test/java`)

| 클래스                                 | 계약 항목                                                                                                                                                                                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web/TusFlowTest`                      | OPTIONS 능력 · 생성→PATCH→완료(APPROVED) · HEAD 재개 · 409 (+서버 offset) · 413 ×3 (Tus-Max-Size · 길이 초과 · 청크 상한) · Defer-Length 400 · 415 · 412 · override 모드 (PATCH 동형 + 409) · override 값 400 · 405 · checksum 204/460/400 · DELETE · 410 · 0바이트 · 404 · 매직바이트 REJECTED · quota 429 |
| `web/AttackCorpusTest`                 | traversal 12종 (T1~T12) 전부 400 + 행 0 · 널바이트 · CRLF · 예약명 · 길이 (문자·바이트) · 확장자 · relativePath 세그먼트 · metadata 형식 · Upload-Length 음수/누락                                                                                                                                          |
| `web/OwnershipAndCsrfTest`             | 타인 URL HEAD/PATCH/DELETE 403 + offset 무변경 · CSRF 없음/불일치 403 (override 포함, HEAD 면제) · 미인증 401                                                                                                                                                                                               |
| `web/DownloadControllerTest`           | APPROVED 만 · attachment + `filename*` · nosniff · 매직바이트 Content-Type · 미완료/REJECTED 404 · 타인 403 · 미인증 401                                                                                                                                                                                    |
| `config/StorageDirectoryValidatorTest` | 웹루트 하위·동일 거부 (메시지에 `web root` · `ADR-201 S1`) · 밖 허용 · 빈 값 거부 · **ApplicationContext refresh 실패 실물**                                                                                                                                                                                |
| `service/ExpiredUploadReaperTest`      | 만료 활성 세션만 파일+행 삭제, 살아 있는 세션·APPROVED 유지 · 멱등                                                                                                                                                                                                                                          |
| `service/FileNameValidatorTest`        | 통과 이름 · NFD→NFC · 255/256 경계 · relativePath · 확장자 · 제어 문자                                                                                                                                                                                                                                      |

`mvn -q test` 는 이 표 전체를 돈다. 배선은 `TestConfig` (H2 in-memory `MODE=Oracle` + `java.io.tmpdir` 저장) → `UploadCoreConfig` 그대로 — 운영과 같은 필터 체인 (override → CSRF).

## 사용자 실행 명령 (G2 — 작성 머신에서 차단됐던 항목, 2026-09-17 실행 결과 병기)

| 항목                       | 명령                                                                                                                                                                                                              | 기대                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| G2b-1 단위·MockMvc         | `cd examples/upload-server-spring && mvn -q test`                                                                                                                                                                 | `BUILD SUCCESS`, 실패 0 (`target/surefire-reports/`) — **PASS 52/52 (09-17)**             |
| G2b-2 기동 거부 실물       | `mvn cargo:run -Dupload.storage.dir="$PWD/target/cargo/configurations/tomcat9x/webapps/upload/WEB-INF/uploads"`                                                                                                   | 컨텍스트 기동 실패, 로그에 `must be outside the web root (ADR-201 S1)` — **확인 (09-17)** |
| G2b-3 1GB 업로드→중단→재개 | `mvn cargo:run` 후 `examples/upload-client-jsp` README 절차 (브라우저) 또는 클라이언트 스위트 `pnpm -F @composition/upload test:server -- --endpoint http://localhost:8080/upload/upload` (엔진 worktree 가 제공) | 중단 후 HEAD offset 부터 재개, 재전송 ≤ chunkSize, 최종 APPROVED                          |
| G2a tusd 대조군            | tusd release 바이너리 (darwin-arm64, Go·docker 불요): `tusd -upload-dir /tmp/tusd -port 1080` → 같은 스위트 `--endpoint http://localhost:1080/files/`                                                             | 참조 서버와 같은 케이스 PASS — 다르면 참조 서버 방언 → 서버 수정                          |
| 변형 ② 컴파일              | `mvn -q -P tus-lib compile`                                                                                                                                                                                       | 컴파일 성공 — **확인 (09-17, `mvn -P tus-lib test` 52/52)**                               |

CI: `.github/workflows/upload-server-java.yml` — push/PR 에서 `examples/upload-server-spring/**` 변경 시 JDK 8 로 `mvn -q -B test`. 이 저장소는 `gh` 미인증이라 러너 결과를 세션에서 관측하지 못한다 — 로컬 `mvn -q test` PASS 로그가 게이트 근거다 (ADR-198 잔여와 같은 상태).

## 보안 의무 ↔ 코드 (계약 §8)

| #   | 지점                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------- |
| P1  | `UploadMetadataParser` · `FileNameValidator` (12 규칙, 400)                                                |
| P2  | `TusController.create` — Defer-Length 400 · `UploadSessionService.create` — Tus-Max-Size 413               |
| P3  | `UploadSessionService.checkOwned` — 모든 HEAD/PATCH/DELETE/다운로드 경로, 403 + 감사 로그                  |
| P4  | `UploadSessionService.appendChunk` — 409 (+`Upload-Offset`) · 413 · `TusController` 415/411                |
| P5  | `CsrfHeaderFilter` — POST/PATCH/DELETE 403                                                                 |
| P6  | `web.xml` cookie-config (HttpOnly; 운영 `secure=true`) · TLS 는 프록시/Connector 설정                      |
| S1  | `StorageDirectoryValidator` — `@PostConstruct` 에서 기동 실패                                              |
| S2  | `UploadStorage.pathFor` — UUIDv4 만 경로에 사용, 원본명은 DB                                               |
| S3  | `UploadProperties.isExtensionAllowed` (POST) · `MagicBytes.matches` (완료)                                 |
| S4  | `UploadSessionService.complete` — SCANNING → `UploadScanner` → APPROVED/REJECTED (REJECTED 는 바이트 삭제) |
| S5  | 압축 해제 코드 0 (설계 원칙)                                                                               |
| S6  | `DownloadController` — attachment · nosniff · 매직바이트 Content-Type · APPROVED 만                        |
| S7  | quota 429 · `ExpiredUploadReaper` TTL GC                                                                   |
| S8  | `UploadSessionRepository` — `?` 바인딩만                                                                   |
| S9  | `AuditLog` — CR/LF·제어 문자 제거                                                                          |
| S10 | `TusExceptionHandler` — 한 줄 사유, 스택 0                                                                 |

## Java 8 호환 — 사용한 API

`java.util.Base64` · `java.nio.file.Files/Paths/Path` · `RandomAccessFile` · `java.text.Normalizer` · `java.time.Instant/ZoneOffset/DateTimeFormatter.RFC_1123_DATE_TIME` · `java.security.MessageDigest/SecureRandom` · `java.util.UUID` · `String.join` · `Collections.unmodifiableSet/List` · 익명 클래스 (`RowMapper`, `TransactionCallback`) · `HttpServletRequest.getContentLengthLong()` (servlet 3.1). `var` · record · `List.of` · `Optional.isEmpty` · `String.isBlank` · switch expression 사용 0.
