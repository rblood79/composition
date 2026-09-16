# 대용량 업로드 서버 계약 (TUS 1.0) — v1.0.0

> 정본. ADR-201 Hard Constraint 5·7 의 서버 측 계약이며 `@composition/upload` package 버전과 같이 움직인다 (**계약 변경 = package major**). 클라이언트 적합성 스위트 (`packages/upload-engine`) 와 참조 서버 (`examples/upload-server-spring/`) 는 이 문서를 oracle 로 둔다. 설계 배경: [ADR-201](../../adr/201-large-file-upload-engine-component-server-contract.md) · [breakdown §3-3 · §3-6](../../adr/design/201-large-file-upload-engine-component-server-contract-breakdown.md).

| 항목           | 값                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 계약 버전      | **1.0.0** (= `@composition/upload` package 버전. 헤더·응답 코드·필수 확장이 바뀌면 major)                                                                                                    |
| 기반 프로토콜  | [TUS 1.0.0](https://tus.io/protocols/resumable-upload) core                                                                                                                                  |
| 필수 확장      | `creation` · `expiration`                                                                                                                                                                    |
| 선택 확장      | `checksum` (sha1 · sha256) · `termination` · `concatenation` — 클라이언트가 `OPTIONS` 의 `Tus-Extension` 으로 감지한 뒤에만 사용                                                             |
| 참조 서버      | `examples/upload-server-spring/` — Java 8 · Spring MVC 5.3 · servlet 3.1 · Tomcat 9 (Boot 비의존)                                                                                            |
| 호환 대조군    | [tusd](https://github.com/tus/tusd) (Go 레퍼런스) — 같은 클라이언트 스위트가 tusd 에서도 PASS 해야 한다. 참조 서버에서만 통과하는 항목은 계약이 아니라 방언이다                              |
| 다른 호환 서버 | [tus-node-server](https://github.com/tus/tus-node-server) · [tusdotnet](https://github.com/tusdotnet/tusdotnet) · [tus-java-server](https://github.com/tomdesair/tus-java-server) — §10 참조 |

## 1. 기능 감지 — `OPTIONS`

클라이언트는 첫 업로드 전에 `OPTIONS {endpoint}` 를 1회 보내고 아래 헤더로 서버 능력을 읽는다. 감지 결과가 없으면 core + `creation` + `expiration` 만 가정한다.

| 응답 헤더                | 필수 | 값 (참조 서버)                             | 의미                                                                                |
| ------------------------ | :--: | ------------------------------------------ | ----------------------------------------------------------------------------------- |
| `Tus-Resumable`          |  ✓   | `1.0.0`                                    | 프로토콜 버전. 모든 응답 (OPTIONS 제외 가능) 에 실린다                              |
| `Tus-Version`            |  ✓   | `1.0.0`                                    | 서버가 지원하는 버전 목록 (쉼표 구분)                                               |
| `Tus-Extension`          |  ✓   | `creation,expiration,termination,checksum` | 활성 확장. `concatenation` 은 참조 서버가 구현하지 않는다 (선택)                    |
| `Tus-Max-Size`           |  ✓   | `10737418240` (10 GiB, 설정값)             | 파일 1개 상한 (바이트). 클라이언트는 이 값을 넘는 파일을 `E_TOO_LARGE` 로 즉시 거부 |
| `Tus-Checksum-Algorithm` |  △   | `sha1,sha256`                              | `checksum` 확장이 있을 때만. 클라이언트는 목록의 첫 항목을 우선 사용                |

응답 상태는 `204 No Content` (본문 없음). `OPTIONS` 는 인증 없이 응답해도 된다 (CORS pre-flight 와 겸용).

```http
OPTIONS /upload HTTP/1.1
Host: app.example.test
Tus-Resumable: 1.0.0

HTTP/1.1 204 No Content
Tus-Resumable: 1.0.0
Tus-Version: 1.0.0
Tus-Extension: creation,expiration,termination,checksum
Tus-Max-Size: 10737418240
Tus-Checksum-Algorithm: sha1,sha256
```

## 2. 요청/응답 시퀀스

```
클라이언트                                   서버
   │  OPTIONS {endpoint}                       │  204 + Tus-Extension/Tus-Max-Size
   │  POST {endpoint} Upload-Length/Metadata   │  201 Location: {url} + Upload-Expires
   │  PATCH {url} Upload-Offset: 0 (chunk 1)   │  204 Upload-Offset: 8388608
   │  PATCH {url} Upload-Offset: 8388608 …     │  204 Upload-Offset: …
   │  (단절 / 새로고침 / 탭 종료)               │
   │  HEAD {url}                               │  200 Upload-Offset/Upload-Length/Upload-Expires
   │  PATCH {url} Upload-Offset: {서버 offset} │  204 … (offset == Upload-Length 이면 완료 → SCANNING)
   │  DELETE {url} (선택, termination)         │  204
```

### 2-1. 메서드별 계약

| 단계 | 요청                                                                                                                                                                                                 | 성공 응답                                                                                                                    | 오류 응답                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성 | `POST {endpoint}` · `Tus-Resumable: 1.0.0` · `Upload-Length: {bytes}` · `Upload-Metadata: {§3}` · `Content-Length: 0`                                                                                | `201 Created` · `Location: {url}` (절대 또는 endpoint 기준 상대) · `Upload-Expires` · `Tus-Resumable`                        | `400` Upload-Length 없음·음수·`Upload-Defer-Length` 사용·metadata 규칙 위반 (§3) · `401/403` 인증·CSRF 없음 · `412` Tus-Resumable 불일치 · `413` Upload-Length > Tus-Max-Size · `429` 소유자 동시 업로드 수 초과                  |
| 조회 | `HEAD {url}` · `Tus-Resumable`                                                                                                                                                                       | `200 OK` · `Upload-Offset` · `Upload-Length` · `Upload-Expires` · `Upload-Metadata` (echo) · `Cache-Control: no-store`       | `403` 타인 소유 · `404` 없는 id · `410` 만료 (TTL 경과, GC 전) · `412`                                                                                                                                                            |
| 전송 | `PATCH {url}` · `Tus-Resumable` · `Content-Type: application/offset+octet-stream` · `Upload-Offset: {offset}` · `Content-Length: {n}` · body = 청크 바이트 · (`Upload-Checksum: sha1 {base64}` 선택) | `204 No Content` · `Upload-Offset: {offset + n}` · `Upload-Expires` (완료 시에도 204 — 완료 여부는 offset == length 로 판단) | `403` 타인 소유·CSRF 없음 · `404`/`410` · `409` Upload-Offset ≠ 서버 offset · `411` Content-Length 없음 · `412` · `413` offset + n > Upload-Length 또는 청크 > 서버 청크 상한 · `415` Content-Type 불일치 · `460` checksum 불일치 |
| 삭제 | `DELETE {url}` (`termination`)                                                                                                                                                                       | `204 No Content`                                                                                                             | `403` · `404`/`410` · `412`                                                                                                                                                                                                       |

`Tus-Resumable` 은 OPTIONS 를 제외한 모든 요청에 필수이며, 없거나 `1.0.0` 이 아니면 `412 Precondition Failed` + `Tus-Version`.

### 2-2. 예시 raw HTTP

**생성**

```http
POST /upload HTTP/1.1
Host: app.example.test
Tus-Resumable: 1.0.0
Upload-Length: 1073741824
Upload-Metadata: filename cmVwb3J0LTIwMjYucGRm,filetype YXBwbGljYXRpb24vcGRm,relativePath
Content-Length: 0
Cookie: JSESSIONID=…
X-CSRF-TOKEN: …

HTTP/1.1 201 Created
Tus-Resumable: 1.0.0
Location: /upload/3f2c9a1e-5b7d-4c1a-9e0f-2a6b8d4c7e10
Upload-Expires: Thu, 18 Sep 2026 09:00:00 GMT
```

**전송 (청크 1개 8 MiB)**

```http
PATCH /upload/3f2c9a1e-5b7d-4c1a-9e0f-2a6b8d4c7e10 HTTP/1.1
Host: app.example.test
Tus-Resumable: 1.0.0
Content-Type: application/offset+octet-stream
Upload-Offset: 0
Content-Length: 8388608
Cookie: JSESSIONID=…
X-CSRF-TOKEN: …

<8388608 bytes>

HTTP/1.1 204 No Content
Tus-Resumable: 1.0.0
Upload-Offset: 8388608
Upload-Expires: Thu, 18 Sep 2026 09:00:00 GMT
```

**재개 (HEAD)**

```http
HEAD /upload/3f2c9a1e-5b7d-4c1a-9e0f-2a6b8d4c7e10 HTTP/1.1
Host: app.example.test
Tus-Resumable: 1.0.0
Cookie: JSESSIONID=…

HTTP/1.1 200 OK
Tus-Resumable: 1.0.0
Upload-Offset: 8388608
Upload-Length: 1073741824
Upload-Expires: Thu, 18 Sep 2026 09:00:00 GMT
Cache-Control: no-store
```

**offset 불일치 (재개 후 클라이언트 카운터가 앞선 경우)**

```http
PATCH /upload/3f2c9a1e-… HTTP/1.1
Upload-Offset: 16777216
…

HTTP/1.1 409 Conflict
Tus-Resumable: 1.0.0
Upload-Offset: 8388608
```

`409` 응답에도 서버 offset 을 실어 준다 (권장, tusd 동형). 클라이언트는 이 값 또는 `HEAD` 로 재동기화한 뒤 그 offset 부터 다시 보낸다 — **서버 `Upload-Offset` 이 진실이고 클라이언트 카운터는 힌트다** (ADR-201 Hard Constraint 3).

**만료 / 초과 / 소유자 / content-type / checksum**

| 상황                                               | 응답                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Upload-Expires` 경과 (GC 전)                      | `410 Gone` (GC 후에는 `404 Not Found`)                                              |
| `Upload-Length` > `Tus-Max-Size` (POST)            | `413 Payload Too Large` + `Tus-Max-Size`                                            |
| offset + Content-Length > Upload-Length (PATCH)    | `413 Payload Too Large` — 파일은 그 청크를 저장하지 않는다                          |
| 다른 principal 의 upload URL                       | `403 Forbidden` (존재 여부 누설 방지를 위해 `404` 로 대체 가능 — 참조 서버는 `403`) |
| `Content-Type` ≠ `application/offset+octet-stream` | `415 Unsupported Media Type`                                                        |
| `Upload-Checksum` 불일치                           | `460` (TUS `checksum` 확장 고유 코드) — offset 은 전진하지 않는다                   |

## 3. `Upload-Metadata`

형식: `key base64(value)` 쌍을 쉼표로 이어 붙인다. 값이 빈 문자열이면 base64 부분을 생략할 수 있다 (`relativePath`). 키는 ASCII, 값은 **UTF-8 을 base64 (표준 알파벳, 패딩 포함)** 로 인코딩한다.

| 키             | 필수 | 내용                                             | 서버 사용                                                                                                                                                  |
| -------------- | :--: | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `filename`     |  ✓   | 사용자 파일명 (확장자 포함)                      | **메타 DB 에만** 저장 (`UPLOAD_SESSION.file_name`) · 다운로드 `Content-Disposition` · 확장자 화이트리스트 판정. 저장 파일명으로는 **절대 사용하지 않는다** |
| `filetype`     |  △   | 브라우저가 보고한 MIME (`File.type`)             | 메타 DB 만. 신뢰하지 않으며 완료 후 매직바이트로 재판정                                                                                                    |
| `relativePath` |  △   | 폴더 업로드 시 `webkitRelativePath` (구분자 `/`) | 메타 DB 만. 폴더 트리 복원은 애플리케이션 몫                                                                                                               |

### 3-1. 서버 검증 규칙 (위반 시 `400`, 세션 생성 0)

디코드한 `filename` 에 대해 순서대로 적용한다. `relativePath` 는 `/` 로 나눈 **각 세그먼트**에 같은 규칙을 적용하고 전체 길이 ≤ 1024.

1. base64 디코드 실패 · UTF-8 디코드 실패 → 거부
2. **널바이트** (`\u0000`) · **CR/LF** (`\r`, `\n`) · 그 밖의 제어 문자 (`< 0x20`, `0x7f`) 포함 → 거부
3. **NFC 정규화** 후 판정 (macOS 는 NFD 로 보낸다 — 동일 이름이 다른 바이트열이 되는 것을 막는다)
4. **경로 분리자** `/`, `\` 포함 → 거부 (`filename` 한정 — `relativePath` 는 `/` 만 세그먼트 구분자로 허용, `\` 는 거부)
5. **절대경로** — 선두 `/`·`\`, 드라이브 문자 (`^[A-Za-z]:`), UNC (`\\`) → 거부
6. `..` 또는 `.` 인 세그먼트 → 거부 (`my..file.txt` 처럼 이름 안의 `..` 는 허용)
7. **퍼센트 인코딩된 분리자·널** (`%2f`, `%5c`, `%00`, `%2e%2e` — 대소문자 무관) → 거부 (서버는 URL 디코드를 하지 않지만 하류 시스템의 이중 디코드를 막는다)
8. **전각 분리자** `／` (U+FF0F) · `＼` (U+FF3C) → 거부
9. **Windows 예약명** — `CON`, `PRN`, `AUX`, `NUL`, `COM1`~~`COM9`, `LPT1`~~`LPT9` (대소문자 무관, 확장자 유무 무관 — `nul.txt` 도 거부)
10. 선두·말미 공백 또는 말미 `.` → 거부 (Windows 가 조용히 잘라 다른 이름이 된다)
11. **길이** — NFC 기준 255 문자 이하 **그리고** UTF-8 255 바이트 이하
12. 빈 문자열 → 거부

검증을 통과한 원본명은 DB 에만 들어가고, 디스크 파일명은 **서버가 생성한 UUIDv4** 다. 즉 원본명은 어떤 경로 문자열에도 이어 붙여지지 않는다 — 위 규칙은 방어 심층이지 저장 경로 안전성의 유일한 근거가 아니다.

## 4. PATCH 차단 환경 — `X-HTTP-Method-Override`

일부 WAF · 사내 프록시 · 구형 게이트웨이가 `PATCH` 를 거른다 (`405` / `501` / 연결 리셋). 서버는 다음을 **반드시** 지원한다:

```http
POST /upload/{id} HTTP/1.1
X-HTTP-Method-Override: PATCH
Content-Type: application/offset+octet-stream
Upload-Offset: …
```

- 서버는 `POST` + `X-HTTP-Method-Override: PATCH` 를 `PATCH` 와 **완전히 동일**하게 처리한다 (같은 검증 · 같은 응답 코드). override 는 `PATCH`·`DELETE` 만 허용하고 다른 값은 `400`.
- 클라이언트는 `PATCH` 가 `405`/`501` 로 실패하면 `E_PATCH_BLOCKED` 를 기록하고 `overridePatchMethod: true` 로 재시도한다. 성공하면 그 세션 동안 override 를 유지한다.
- 참조 서버: `MethodOverrideFilter` (servlet `Filter`, `/upload/*` 매핑) 가 DispatcherServlet 앞에서 메서드를 바꾼다.

## 5. 인증 · CORS

| 축                  | 계약                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 기본                | **쿠키 세션** — 클라이언트 `withCredentials: true` (XHR). 서버는 세션 principal 을 업로드 소유자로 묶는다 (`UPLOAD_SESSION.owner_id`)                                                                                                                                                                                                                                                                              |
| 정적 헤더           | `headers: { "X-App-Id": "…" }` 류 — 문서(`project.json`)에 실려 **공개**된다. **비밀 (API key · Bearer 토큰) 금지** (ADR-201 Hard Constraint 7 정적 게이트)                                                                                                                                                                                                                                                        |
| 런타임 헤더         | `getHeaders(): Record<string,string> \| Promise<…>` — 요청마다 호출. CSRF 토큰 (`X-CSRF-TOKEN`) · 짧은 수명 토큰은 여기로                                                                                                                                                                                                                                                                                          |
| CSRF                | 상태 변경 요청 (`POST` · `PATCH` · `DELETE`) 은 세션에 묶인 CSRF 토큰 헤더 필수 — 없거나 불일치 `403`. `HEAD`/`OPTIONS` 는 면제                                                                                                                                                                                                                                                                                    |
| 미인증              | 세션 principal 없음 → `401 Unauthorized` (POST/HEAD/PATCH/DELETE 전부). 클라이언트 `E_UNAUTHORIZED`                                                                                                                                                                                                                                                                                                                |
| CORS (교차 출처 시) | `Access-Control-Allow-Origin` 은 **명시 origin 목록** — `*` 와 `Access-Control-Allow-Credentials: true` 조합은 브라우저가 거부하므로 금지 · `Access-Control-Allow-Methods: POST, HEAD, PATCH, DELETE, OPTIONS` · `Access-Control-Allow-Headers: Tus-Resumable, Upload-Length, Upload-Offset, Upload-Metadata, Upload-Checksum, Content-Type, X-HTTP-Method-Override, X-CSRF-TOKEN` · `Access-Control-Max-Age` 권장 |
| **Expose-Headers**  | `Access-Control-Expose-Headers: Upload-Offset, Location, Upload-Length, Upload-Expires, Tus-Resumable, Tus-Extension, Tus-Max-Size, Tus-Checksum-Algorithm` — **`Upload-Offset` · `Location` 이 빠지면 클라이언트가 XHR 에서 값을 읽지 못해 생성 직후 URL 을 잃고 재개도 불가능하다.** 교차 출처 배포에서 가장 흔한 무음 실패                                                                                      |

same-origin 배포 (publish 정적 앱을 Tomcat webapp 에 동봉) 에서는 CORS 헤더가 필요 없고 쿠키가 자동으로 실린다 — 권장 배치.

## 6. 인프라 knob (ADR-201 R1)

TUS 는 raw body `PATCH` 라 **multipart 파서 한도는 무관**하다. 아래 표의 항목만 본다.

| 층               | 설정                                               | 기본값                  | 권고                                                                                                                                                                                  |
| ---------------- | -------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apache httpd     | `Timeout`                                          | 60s                     | 청크 1개 전송 시간 > Timeout 이면 `408`/리셋. chunkSize 를 회선에 맞춰 계산 (§7) 하거나 `Timeout 300`                                                                                 |
| Apache httpd     | `LimitRequestBody`                                 | 0 (무제한) / 배포판 1GB | ≥ chunkSize. `Upload-Length` 가 아니라 **청크** 크기만 걸린다                                                                                                                         |
| Apache httpd     | `ProxyTimeout` (mod_proxy → Tomcat)                | = Timeout               | 백엔드가 청크를 디스크에 쓰는 시간 포함. `ProxyTimeout 300`                                                                                                                           |
| Apache httpd     | `RequestReadTimeout body=…`                        | 20,MinRate=500          | 느린 회선에서 body 읽기 중단 — `body=60,MinRate=500` 이상                                                                                                                             |
| Tomcat 9         | `maxSwallowSize` (Connector)                       | 2 MiB                   | 서버가 `4xx` 로 조기 거부할 때 남은 body 를 삼키는 상한. chunkSize 보다 작으면 거부 응답 뒤 **연결이 끊겨 클라이언트가 응답 코드를 못 본다** → `maxSwallowSize="-1"` 또는 ≥ chunkSize |
| Tomcat 9         | `maxPostSize`                                      | 2 MiB                   | `application/x-www-form-urlencoded` 파싱 한정 — TUS 무관. 그대로 둬도 된다                                                                                                            |
| Tomcat 9         | `connectionTimeout`                                | 60000ms                 | 요청 라인·헤더 대기. body 전송 중에는 `disableUploadTimeout="false"` + `connectionUploadTimeout` 이 적용 — 청크 전송 시간보다 크게                                                    |
| Tomcat 9         | `maxHttpHeaderSize`                                | 8 KiB                   | `Upload-Metadata` 가 길면 (relativePath 1024 + filename 255 → base64 ×1.34) 넉넉함. 기본값 유지                                                                                       |
| Spring           | `spring.servlet.multipart.*` · `MultipartResolver` | —                       | **무관**. TUS 컨트롤러는 `request.getInputStream()` 을 직접 읽으며 multipart 파서를 거치지 않는다. Boot 의 `max-file-size 1MB` 기본값도 영향 없음                                     |
| WAF / 게이트웨이 | `PATCH` 차단                                       | 제품별                  | §4 override 모드. 허용 목록 편집이 가능하면 `PATCH` 허용이 우선                                                                                                                       |
| nginx            | `client_max_body_size`                             | 1 MiB                   | ≥ chunkSize (예 `64m`). 초과 시 `413` 이 nginx 에서 나가며 서버 로그에 남지 않는다                                                                                                    |
| nginx            | `proxy_request_buffering off`                      | on                      | on 이면 청크 전체를 디스크에 버퍼링한 뒤 백엔드로 보낸다 — 진행률 지연 + 디스크 이중 쓰기. off 권장                                                                                   |
| nginx            | `proxy_read_timeout` / `proxy_send_timeout`        | 60s                     | Apache 와 같은 논리                                                                                                                                                                   |
| 참조 서버        | `upload.chunk.maxBytes`                            | 64 MiB                  | PATCH 1회 상한 — 클라이언트 chunkSize 상한과 맞춘다. 초과 `413`                                                                                                                       |
| 참조 서버        | `upload.maxSize`                                   | 10 GiB                  | `Tus-Max-Size`                                                                                                                                                                        |
| 참조 서버        | `upload.ttlHours`                                  | 24                      | `Upload-Expires` = 마지막 PATCH + TTL. GC 주기 `upload.gcIntervalMinutes`                                                                                                             |

## 7. 청크 크기 권고

- 기본 **8 MiB**. `chunkSize` 는 서버 `upload.chunk.maxBytes` 이하, 프록시 body 한도 이하.
- 회선 계산: 청크 1개 전송 시간 = chunkSize ÷ 업로드 대역폭. Apache `Timeout 60s` · 여유 50% 기준 **chunkSize ≤ 대역폭 × 30s**.
  - 10 Mbps (1.25 MB/s) → ≤ 37 MB → 8 MiB 안전
  - 2 Mbps (0.25 MB/s) → ≤ 7.5 MB → **4 MiB** 로 낮춘다
  - 100 Mbps 사내망 → 32~64 MiB 로 올려 요청 수를 줄인다 (PATCH 당 DB `FOR UPDATE` 1회)
- `chunkSize: Infinity` (단일 PATCH 스트리밍) 는 프록시 timeout 이 없는 same-origin 환경에서만. 실패 시 `HEAD` offset 재개로 손실은 프록시가 백엔드에 넘긴 바이트까지.
- 재전송 상한 = chunkSize (Hard Constraint 3). 청크가 클수록 단절 시 손실이 크다.

## 8. Security — 의무 조항 (ADR-201 R3 · G4)

참조 서버는 아래를 **전부 실물로** 충족하며 공격 corpus (§8-1) 를 전부 거부한다. 다른 서버 구현체를 쓸 때도 같은 항목을 점검한다.

### 프로토콜 층

| #   | 의무                                                                                                                        | 참조 서버 지점                               |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| P1  | `Upload-Metadata` 디코드 후 §3-1 12개 규칙 검증 — 실패 시 `400`, 세션 미생성                                                | `FileNameValidator` · `UploadMetadataParser` |
| P2  | `Tus-Max-Size` 초과 `413` · `Upload-Defer-Length` **비허용** (`400`) — 길이를 모르는 업로드는 quota 계산 불가               | `TusController.create`                       |
| P3  | upload id = **UUIDv4** (추측 불가) + 소유자 바인딩 — `HEAD`/`PATCH`/`DELETE` 마다 principal ↔ `owner_id` 대조, 불일치 `403` | `UploadSessionService.requireOwned`          |
| P4  | offset 불일치 `409` · 청크 상한 · offset + n > length `413` · Content-Type `415`                                            | `TusController.patch`                        |
| P5  | 상태 변경 요청 CSRF 헤더 토큰 (`X-CSRF-TOKEN`) — 없으면 `403`                                                               | `CsrfHeaderFilter`                           |
| P6  | TLS 필수 (프록시 종단 포함) — 쿠키 `Secure; HttpOnly; SameSite=Lax`                                                         | 배포 설정 (README)                           |

### 서버 층

| #   | 의무                                                                                                                                                                                                  | 참조 서버 지점                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| S1  | **웹루트 밖 저장** — 저장 디렉터리가 `ServletContext.getRealPath("/")` 하위면 **ApplicationContext 기동 실패** (예외 메시지에 두 경로와 사유). Tomcat `webapps/` 안 저장 = JSP 업로드 RCE             | `StorageDirectoryValidator` (`@PostConstruct`)        |
| S2  | **서버 생성 파일명** (UUID) — 원본명은 메타 DB 만. 디스크 경로에 사용자 입력 0                                                                                                                        | `UploadStorage.pathFor(id)`                           |
| S3  | 확장자 **화이트리스트** (`upload.allowedExtensions`) — POST 시 판정 · 완료 후 **매직바이트** 대조 (png/jpg/gif/pdf/zip 계열) — 불일치 `REJECTED`                                                      | `FileNameValidator.extension` · `MagicBytes`          |
| S4  | **격리 → 스캔 → 승인** — 완료 즉시 `SCANNING`, `UploadScanner` 훅 결과로 `APPROVED`/`REJECTED`. 다운로드는 `APPROVED` 만. 참조 구현 스캐너는 no-op (`APPROVED`) — AV 연동 지점                        | `UploadScanner` · `NoOpUploadScanner`                 |
| S5  | **압축 미해제** — zip/tar 를 서버가 풀지 않는다 (zip bomb · 경로 traversal). 필요하면 별도 격리 프로세스                                                                                              | 설계 원칙 (코드 0)                                    |
| S6  | 다운로드 `Content-Disposition: attachment; filename*=UTF-8''…` + `X-Content-Type-Options: nosniff` + `Content-Type` 은 저장된 `file_type` 이 아니라 매직바이트 판정값 또는 `application/octet-stream` | `DownloadController`                                  |
| S7  | **quota** — 소유자당 동시 활성 업로드 수 (`upload.quota.maxActivePerOwner`, 초과 `429`) · 소유자당 총 바이트 (선택) · **TTL GC** — `expires_at` 경과 세션의 파일 + 행 삭제                            | `UploadSessionService.create` · `ExpiredUploadReaper` |
| S8  | **prepared statement** 만 — SQL 문자열 결합 0                                                                                                                                                         | `UploadSessionRepository` (JdbcTemplate `?` 바인딩)   |
| S9  | **감사 로그** — 생성/완료/거부/삭제/403 을 principal · id · 원본명과 기록. 로그 값의 CR/LF 제거 (로그 주입)                                                                                           | `AuditLog.sanitize`                                   |
| S10 | 응답에 스택트레이스·저장 경로·내부 호스트명 노출 0                                                                                                                                                    | `TusExceptionHandler`                                 |

### 8-1. 공격 corpus (mock 서버 + 참조 서버 양쪽에서 전부 거부)

**traversal 파일명 12종** (`Upload-Metadata filename`, base64 인코딩 전 평문) — 기대 응답 **`400`**, 세션 미생성:

| #   | 평문 (JSON 문자열 표기)                   | 걸리는 규칙 (§3-1) |
| --- | ----------------------------------------- | ------------------ |
| T1  | `"../../etc/passwd"`                      | 4 · 6              |
| T2  | `"..\\..\\windows\\win.ini"`              | 4 · 6              |
| T3  | `"/etc/passwd"`                           | 4 · 5              |
| T4  | `"C:\\Windows\\system32\\cmd.exe"`        | 4 · 5              |
| T5  | `"....//....//etc/passwd"`                | 4                  |
| T6  | `"..%2f..%2fetc%2fpasswd"`                | 7                  |
| T7  | `"..／..／etc／passwd"` (U+FF0F)          | 8                  |
| T8  | `".."`                                    | 6                  |
| T9  | `"."`                                     | 6                  |
| T10 | `"webapps/ROOT/shell.jsp"`                | 4                  |
| T11 | `"../../webapps/ROOT/shell.jsp"`          | 4 · 6              |
| T12 | `"\\\\fileserver\\share\\evil.exe"` (UNC) | 4 · 5              |

**그 밖의 corpus**:

| #   | 공격                                                             | 요청                   | 기대 응답                    |
| --- | ---------------------------------------------------------------- | ---------------------- | ---------------------------- |
| C1  | metadata **널바이트** — `"report.pdf\u0000.jsp"`                 | POST                   | `400`                        |
| C2  | metadata **CRLF** — `"a.txt\r\nX-Injected: 1"`                   | POST                   | `400`                        |
| C3  | Windows 예약명 — `"CON"` · `"nul.txt"` · `"com1.pdf"`            | POST                   | `400`                        |
| C4  | 길이 초과 — `"a"×256 + ".txt"`                                   | POST                   | `400`                        |
| C5  | 화이트리스트 밖 확장자 — `"shell.jsp"` · `"run.exe"`             | POST                   | `400`                        |
| C6  | `Upload-Length` > `Tus-Max-Size`                                 | POST                   | `413`                        |
| C7  | `Upload-Defer-Length: 1`                                         | POST                   | `400`                        |
| C8  | offset 불일치 — 서버 0, 클라이언트 `Upload-Offset: 8388608`      | PATCH                  | `409` + 서버 `Upload-Offset` |
| C9  | offset + Content-Length > Upload-Length                          | PATCH                  | `413`, offset 무변경         |
| C10 | **타인 upload URL** — 소유자 A 생성, 세션 B 로 HEAD/PATCH/DELETE | HEAD · PATCH · DELETE  | `403` ×3, offset 무변경      |
| C11 | **CSRF 토큰 없는** POST/PATCH/DELETE                             | 헤더 누락 또는 불일치  | `403`                        |
| C12 | 잘못된 override 값 — `X-HTTP-Method-Override: PUT`               | POST                   | `400`                        |
| C13 | Content-Type 위조 — `multipart/form-data`                        | PATCH                  | `415`                        |
| C14 | 만료 세션 재개                                                   | HEAD/PATCH after TTL   | `410`                        |
| C15 | 매직바이트 위조 — `filename a.png`, body 가 `<?php`/JSP 텍스트   | 완료 후 상태           | `REJECTED`, 다운로드 `404`   |
| C16 | 미인증 (세션 principal 없음)                                     | POST/HEAD/PATCH/DELETE | `401`                        |

## 9. 클라이언트 에러 코드 ↔ 서버 응답

`@composition/upload` 가 노출하는 코드 8개와 이를 만드는 서버 응답. 컴포넌트/JSP 는 코드로 사용자 메시지를 고른다.

| 코드                | 서버 응답 / 조건                                                                       | 재시도 | 클라이언트 동작                                                                    |
| ------------------- | -------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------- |
| `E_PATCH_BLOCKED`   | `PATCH` 에 `405` · `501` (본 서버가 아니라 중간 장비)                                  |  자동  | `overridePatchMethod: true` 로 같은 offset 재시도 — 이후 세션 내내 override        |
| `E_PROXY_TIMEOUT`   | `504` · `408` · 네트워크 오류가 **청크 전송 시간 ≈ timeout** 부근에서 반복             |  자동  | `HEAD` 재동기화 후 chunkSize 를 절반으로 낮춰 재시도 (하한 1 MiB) — §7             |
| `E_OFFSET_MISMATCH` | `409`                                                                                  |  자동  | 응답 `Upload-Offset` 또는 `HEAD` 값으로 offset 재설정 후 재개 (재전송 ≤ chunkSize) |
| `E_TOO_LARGE`       | `413` (POST — `Tus-Max-Size` 초과 · PATCH — 청크 상한/길이 초과) · `OPTIONS` 사전 판정 |  없음  | 항목 `error`, 사용자에게 상한 표시                                                 |
| `E_NETWORK`         | XHR `onerror` · status 0 · DNS/TLS 실패                                                |  자동  | `retryDelays` 지수 backoff → 재개는 `HEAD` 부터                                    |
| `E_UNAUTHORIZED`    | `401` · `403`                                                                          |  없음  | `getHeaders()` 재호출 1회 (CSRF 토큰 갱신) 뒤에도 실패면 항목 `error`              |
| `E_EXPIRED`         | `404` · `410` (재개 시)                                                                |  없음  | 저장된 fingerprint→url 삭제 (`forget`) 후 새 세션으로 처음부터                     |
| `E_CHECKSUM`        | `460`                                                                                  |  자동  | 같은 청크 재전송 (최대 3회) — 반복되면 `checksum` 확장 비활성 후 진행              |

> 정본: `packages/upload-engine/src/errors.ts`, 계약 버전 1.0.0 — 코드 집합은 엔진이 단일 소스이며 이 표는 서버 응답과의 대응만 적는다 (통합 시 3자 대조: errors.ts · 이 표 · 참조 서버 테스트). 표 밖의 응답 (`5xx` · `400` · `411` · `412` · `415`) 은 코드 없이 항목 `error` + 응답 상태를 그대로 노출한다 — `5xx` 는 `retryDelays` 로 재시도, 나머지는 계약 위반이라 재시도하지 않는다.

## 10. 호환 서버

| 서버                                                            | 언어   | 필수 확장 (creation·expiration) | checksum | termination | 비고                                                                                        |
| --------------------------------------------------------------- | ------ | :-----------------------------: | :------: | :---------: | ------------------------------------------------------------------------------------------- |
| **참조 서버** `examples/upload-server-spring/`                  | Java 8 |                ✓                |    ✓     |      ✓      | 본 계약 v1.0.0 실물. Oracle/H2 메타 DB · 세션 소유자 · CSRF · webroot 거부                  |
| [tusd](https://github.com/tus/tusd)                             | Go     |                ✓                |    ✓     |      ✓      | 대조군. `-behind-proxy` · hooks 로 인증. 소유자 바인딩·CSRF 는 앞단 (hook/프록시) 에서 구현 |
| [tus-node-server](https://github.com/tus/tus-node-server)       | Node   |                ✓                |    △     |      ✓      | `@tus/server` + `@tus/file-store`                                                           |
| [tusdotnet](https://github.com/tusdotnet/tusdotnet)             | .NET   |                ✓                |    ✓     |      ✓      | ASP.NET Core 미들웨어                                                                       |
| [tus-java-server](https://github.com/tomdesair/tus-java-server) | Java 8 |                ✓                |    ✓     |      ✓      | 참조 서버 변형 ② (`tus-lib` 프로파일) 가 이 라이브러리에 위임                               |

호환 서버를 쓸 때 §8 서버 층 (S1~S10) 은 서버 앞뒤 (인증 프록시 · 완료 hook · 다운로드 엔드포인트) 에서 별도로 충족해야 한다 — 프로토콜 구현체가 대신하지 않는다.

## 11. 버전 정책

- 계약 버전 = `@composition/upload` `package.json` 버전. 이 문서 제목의 버전과 package 가 다르면 문서가 stale 이다.
- **major**: 필수 헤더 추가/삭제 · 응답 코드 의미 변경 · 필수 확장 변경 · metadata 필수 키 변경 · 인증 방식 변경.
- **minor**: 선택 확장 추가 · knob 추가 · corpus 추가 (기존 서버가 그대로 통과).
- **patch**: 문구 · 예시 · 오탈자.
- 참조 서버 `pom.xml` `<version>` 은 계약 major.minor 를 따른다.
