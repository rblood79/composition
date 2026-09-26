# ADR-235: 로컬 프로젝트 저장 v2 — 해시 자산 저장소 · 디렉토리 형식 · IndexedDB 작업본

## Status

Implemented — 2026-09-26 (Phase 0~7 완료 · [Live Exercise](#live-exercise)) · Accepted — 2026-09-26 (사용자 `/execute-adr 235` "모든phase완료까지 착수해" · review round 2 pending 0) · Proposed 2026-09-23

- 후속 2026-09-26 — Decision 4 의 "오래 닫힌 연결 프로젝트 내용 비우기" 구현 (사용자 판정 "삭제해도 된다"): 30일 · 도장 · 열림 (Web Locks) · 폴더 세대 확인을 모두 통과할 때만 비우고, 비운 프로젝트는 "폴더 내용으로 열기" 로 복원. live 6/6 — [breakdown §후속](../design/235-local-project-storage-v2-breakdown.md#후속--오래-닫힌-연결-프로젝트-비우기-decision-4-2026-09-26)

- Phase 0 완료 2026-09-26 — [G0 inventory](../design/235-local-project-storage-v2-breakdown.md#6-phase-기록). 기존 결함 발견: Canvas 가 image fill 을 그리지 않음 (G1 선결, Phase 1 에서 수리) · 정적 HTML fills 미적용 · 같은 dataURL 이 `fills` 와 `metadata.legacyProps.fills` 에 이중 보관.

- 추가 개정 2026-09-26 — 수리 검증 round 2 h2 반영: 기존 자산 재참조도 공개 전 pin 확보, 참조 epoch와 pin을 최종 삭제와 같은 IndexedDB 트랜잭션에서 확인. R2 · G3 · breakdown §3.1에 순서·실패 처리 명시.

- 개정 2026-09-26 — [review round 1](../reviews/235.md) h1 · h2 · h3 · m1 · m2 반영. 변경 섹션: Hard constraints HC2 · Risk Threshold Check · Decision 3 (세대 전환 쓰기) · Decision 5 (캐시 퇴거 보장 범위) · 위험 수용 근거 · Risks (R2 확장, R9 ~ R11 추가) · Gates 전면 재배치 · Consequences. 구현 순서 (reader 먼저 · writer 나중) 는 breakdown §3.
- 같은 날 유지 섹션 인용 재측정 — 정정: `export.utils.ts` 라인 전부 (`ProjectExportData` :108 · `CURRENT_VERSION` :46 · `downloadProjectAsJson` :876 · `parseProjectData` :919 · `loadProjectFromFile` :1018 · `generateStaticHtml` :1065 · `exportProject` :1451 · JSZip :1548), `BuilderCore.tsx` :1224 · :1257, `MAX_AGE_DAYS = 90` 은 history entry 전용 (스냅샷은 개수 상한), `QuotaExceededError` 는 테스트 mock 1건뿐 (production 0), QueryPersister 는 이미 별도 DB. 무변경 확인: `ImageFillEditor.tsx:93` · `fill.types.ts:84` · `documentPersistGuard.ts:36` · `incrementalDocuments.ts:179` · `fontRegistry.ts:57` · `font.types.ts:56` · `adapter.ts:295` · `imageCache.ts:389` · `:400` · `apps/publish/src/App.tsx:411`.

## Context

### 문제

composition 은 서버 없이 도는 local-first 빌더다. 프로젝트 원본은 브라우저 IndexedDB 에만 있고, 파일로 나가는 길은 단일 JSON 내보내기 하나뿐이다. 2026-09-23 standalone 병행 분석 (대화 기록 — Electron 외피는 이 ADR 의 응용으로 분리, 사용자 confirm) 에서 다음이 실측됐다.

1. **이미지 바이트가 문서 안에 있다.** `apps/builder/src/builder/panels/styles/components/ImageFillEditor.tsx:93` 이 업로드 파일을 `readAsDataURL` 로 base64 문자열로 바꿔 `ImageFillItem.url` (`apps/builder/src/types/builder/fill.types.ts:84`) 에 넣는다. 그 문서가 다시
   - 백업 ring 에 통째로 복제되고 (`apps/builder/src/lib/db/indexedDB/documentPersistGuard.ts:36` `BACKUP_GENERATIONS = 5`, `incrementalDocuments.ts:179` `joinDocument` 결과 저장)
   - 히스토리 스냅샷에 통째로 복제되며 (`apps/builder/src/builder/stores/history/snapshots.ts:4` "canonical document 전체 캡처본", `:54` 사용자 10 개 · `:55` 시스템 rolling 5 개)
   - undo/redo history entry 의 삭제 node · `prevProps` / `nextProps` 에도 남는다 (`historyIndexedDB.ts:211` `saveEntry`, `:52` `MAX_AGE_DAYS = 90` 은 이 entry 정리 기준).
   - 결과: 이미지 1장이 문서 1 + 백업 최대 5 + 스냅샷 최대 15 + history entry N 벌로 복제되고, base64 로 약 1.33 배 부푼다.
2. **사용자 폰트가 localStorage 에 있다.** `packages/shared/src/utils/fontRegistry.ts:57` `saveFontRegistry` 가 base64 폰트를 포함한 레지스트리 전체를 `localStorage.setItem` 한다. 허용 한도는 `packages/shared/src/types/font.types.ts:56` `FONT_LIMITS` — 파일당 5MB × 최대 20개. localStorage 는 origin 당 약 5MB 라서 **3.75MB 이상 폰트 1개로 한도를 넘는다** (base64 1.33 배). 저장 실패 처리 (`QuotaExceededError`) 는 production 코드에 없다 (grep 결과 테스트 mock 1건뿐).
3. **브라우저 저장소 보호가 없다.** `navigator.storage.persist()` / `estimate()` 호출 0건. 디스크 부족 시 브라우저가 origin 저장소를 통째로 지울 수 있고, 같은 origin 의 백업 ring 도 함께 사라진다. 버려도 되는 캐시 (`collection_runtime` store — `adapter.ts:295`, `apps/builder/src/builder/utils/QueryPersister.ts:51` 별도 DB `composition-query-cache` · `:54` 최대 50MB) 는 DB 이름만 다를 뿐 원본과 같은 origin 기본 저장 단위에 묶여 같이 퇴거된다.
4. **파일 형식은 이미 절반 있다.**
   - 프로젝트 JSON: `packages/shared/src/utils/export.utils.ts:108` `ProjectExportData` (`CURRENT_VERSION = "1.0.0"`, `:46`) — `downloadProjectAsJson` (`:876`) / `loadProjectFromFile` (`:1018`), builder 진입점 `BuilderCore.tsx:1224` (내보내기) · `:1257` (가져오기). 자산이 전부 문자열로 인라인된 단일 파일. 문서 밖 envelope 필드로 `currentPageId` · `fontRegistry` · `metadata` · collections 3종을 든다.
   - 정적 HTML 내보내기: `exportProject` (`:1451`) 가 이미 `showDirectoryPicker` 디렉토리 쓰기 + JSZip 폴백 (`:1548`, lazy import) + `assets/fonts/` 배치를 쓴다. 디렉토리 + zip 이중 경로의 선례.
   - publish 런타임은 `loadProjectFromUrl("/project.json")` (`apps/publish/src/App.tsx:411`) 으로 v1 JSON 하나를 읽고, `currentPageId` 를 초기 페이지로 쓴다 (`:329` `usePageRouting`).

### SSOT 3-Domain 판정

저장·영속 인프라 결정이며 D1 (DOM/접근성) · D2 (Props/API) 는 관여하지 않는다. **D3 경계 1건**: 이미지 참조를 문자열 URL 에서 자산 참조로 바꾸면 D3 의 두 대등 consumer — Canvas (`apps/builder/src/builder/workspace/canvas/skia/imageCache.ts:389` fetch → `:400` `MakeImageFromEncoded`) 와 Preview/Publish (`packages/shared/src/utils/fillAdapter.ts:171` 의 CSS `url(...)`, 정적 HTML `generateStaticHtml` `export.utils.ts:1065`) — 가 같은 참조를 같은 바이트로 풀어야 한다. SSOT 경계 자체 (D1/D2/D3 소속) 는 바뀌지 않는다.

### Hard constraints

| ID  | 제약                                                                                                                                                                                                                                                                                                 | 근거                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| HC1 | 상태 변경 파이프라인 순서 `Memory → Index → History → DB → Preview` 보존. DB 단계는 백그라운드 — 파일 쓰기가 편집을 막지 않음                                                                                                                                                                        | `.claude/rules/state-management.md`                |
| HC2 | initial 번들은 ADR-201 재승인 상한 (2026-09-26 ADR-235 재승인 — Builder ≤ 1,421,000 / Preview ≤ 623,000 B gzip, 만료 2026-10-25. 09-25 값 1,415,000 / 622,000 을 Phase 1 실측 초과로 사용자 재승인) 을 넘지 않는다 — zip · 해시 · v2 reader/writer 는 lazy, initial Δ 는 detached baseline 대비 실측 | `docs/adr/completed/201-*.md` §initial 상한 재승인 |
| HC3 | v1 JSON (`version: "1.0.0"`) 가져오기는 계속 동작 (기존 사용자 파일 100% 호환)                                                                                                                                                                                                                       | `export.utils.ts:919` `parseProjectData`           |
| HC4 | 새 서버·계정 0 — 인증은 로컬 라이선스 그대로                                                                                                                                                                                                                                                         | `apps/builder/src/auth/license/*`                  |
| HC5 | Chromium · Safari · Firefox 모두에서 데이터를 잃지 않는 경로가 있어야 함 (File System Access 는 Chromium 전용)                                                                                                                                                                                       | MDN 호환 표                                        |
| HC6 | Canvas 와 Preview/Publish 의 이미지·폰트 시각 결과 동일 (D3 대칭)                                                                                                                                                                                                                                    | `.claude/rules/ssot-hierarchy.md` §1 D3            |
| HC7 | 어떤 구현 단계에서도 내보낸 파일은 자립적이다 — 파일만으로 (같은 origin 의 IndexedDB 없이) 문서·자산 바이트 전부를 복원한다                                                                                                                                                                          | 교환 파일의 정의 (review round 1 h3)               |

### Soft constraints

- 후속 Electron standalone ADR 이 이 형식을 그대로 원본으로 쓸 수 있어야 한다 (디렉토리 원본 + IndexedDB 작업본).
- 기존 IndexedDB 투자 (증분 head/parts, 급감 가드, 백업 ring) 를 버리지 않는다.
- 사용자가 탐색기에서 자산을 알아볼 수 있어야 한다 (확장자 보존).

## Alternatives Considered

### 대안 A: 현상 유지 + 브라우저 보호만 추가

- 설명: IndexedDB 단독 원본과 v1 JSON 을 그대로 두고 `persist()` · `estimate()` · 저장 실패 알림만 추가한다. 폰트는 IndexedDB 로만 옮긴다.
- 외부 사례: 대부분의 웹 전용 도구 (Excalidraw 초기) 가 이 수준에서 출발.
- 위험: 기술(LOW) / 성능(MEDIUM — 이미지 복제·base64 증가 유지, 문서가 커질수록 저장·스냅샷 비용 증가) / 유지보수(MEDIUM) / 마이그레이션(LOW)
- 한계: 사용자의 사이트 데이터 삭제·PC 교체에 무방비. standalone 으로 이어질 파일 원본이 없다.

### 대안 B: 해시 자산 저장소 + 디렉토리 형식 v2 (작업) / 같은 구조 zip (교환) + IndexedDB 작업본

- 설명:
  - 이미지·폰트를 **원본 바이트 그대로** Blob 으로, 내용 SHA-256 을 키로 저장한다 (재인코딩 없음 — PNG 일괄 변환은 JPEG 3~10 배 증가 · 애니메이션/벡터 손실로 기각). 문서는 참조만 든다.
  - 프로젝트 형식 v2 = `manifest.json` 이 가리키는 불변 part 파일 (document · collections · fonts) + `assets/<hash>.<ext>` 디렉토리. 교환·비-Chromium 경로는 같은 구조를 zip 으로 묶은 단일 파일.
  - IndexedDB 는 비-Chromium 에서 원본 (현재와 같음), 디렉토리를 연결한 프로젝트 (Chromium FSA · 후속 Electron) 에서는 작업본.
  - Storage Buckets 지원 브라우저에서는 원본·자산과 캐시를 다른 bucket 에 두고 `persist()` 를 원본 쪽에 요청한다.
- 외부 사례: Sketch (zip 컨테이너 + JSON + 이미지 파일), Git 객체 저장 (내용 해시 주소 · ref 하나의 전환으로 세대 교체), VS Code 웹 (FSA 디렉토리 연결 + IndexedDB 캐시), 기존 `exportProject` 의 디렉토리/zip 이중 경로.
- 위험: 기술(MEDIUM — FSA 권한 재요청 UX, 다중 파일 쓰기 순서) / 성능(LOW — 복제 제거로 개선, 해시 계산은 업로드 시 1회) / 유지보수(MEDIUM — 자산 참조 해석 consumer 추가) / 마이그레이션(HIGH — 기존 문서의 인라인 dataURL 을 자산으로 옮기는 이관이 데이터 손실 경로)

### 대안 C: 단일 zip 파일을 원본으로

- 설명: v2 구조를 항상 zip 하나로 쓰고 그것을 원본으로 삼는다.
- 외부 사례: Sketch `.sketch`, OOXML `.docx`.
- 위험: 기술(LOW) / 성능(HIGH — 자동 저장마다 zip 전체 재작성. 이미지가 많은 프로젝트에서 저장이 무거워지고 HC1 백그라운드 단계가 밀림) / 유지보수(LOW) / 마이그레이션(MEDIUM)

### 대안 D: 단일 DB 파일 (SQLite/PGlite on OPFS)

- 설명: `apps/builder/src/lib/db/index.ts` 주석의 "PGlite (Electron, 향후)" 계획을 따라 관계형 DB 파일 하나로 옮긴다.
- 위험: 기술(MEDIUM — wasm 추가, OPFS 동기 접근은 Worker 필요) / 성능(MEDIUM — PGlite 약 3MB wasm, HC2 lazy 필요) / 유지보수(HIGH — 문서 중심 모델 (`documents` keyPath `project_id`) 에 SQL 층을 얹는 불일치, `DatabaseAdapter` 전 메서드 재구현) / 마이그레이션(HIGH — 전 store 이관)
- 한계: OPFS 도 origin 저장소라 퇴거·사이트 데이터 삭제 위험은 그대로. 사용자가 파일을 볼 수 없다.

### 대안 E: 서버·클라우드 동기화

- 설명: 원본을 서버에 두고 브라우저는 캐시.
- 위험: 기술(MEDIUM) / 성능(LOW) / 유지보수(HIGH) / 마이그레이션(CRITICAL — HC4 위반, 로컬 라이선스·서버 0 모델 폐기)

### Risk Threshold Check

| 대안 | HIGH+                                 | 판정                                                                          |
| ---- | ------------------------------------- | ----------------------------------------------------------------------------- |
| A    | 없음 (MEDIUM 2)                       | 위험은 낮으나 문제 1·2 중 복제 문제와 사이트 데이터 삭제를 풀지 못함          |
| B    | 마이그레이션 HIGH 1                   | 이관을 "원본 보존 + 멱등 + 이관 전 백업" 으로 설계해 수용 가능 (아래 Gate G2) |
| C    | 성능 HIGH 1                           | 교환 형식으로만 채택 (B 에 흡수)                                              |
| D    | 유지보수 HIGH · 마이그레이션 HIGH     | 기각                                                                          |
| E    | 유지보수 HIGH · 마이그레이션 CRITICAL | 기각 (HC4)                                                                    |

루프 1회: HIGH 가 없는 대안은 A 하나이고 A 는 문제를 풀지 못해, 문제를 푸는 대안 중 HIGH 를 피하는 새 대안을 검토했다 — "자산 저장소만 먼저 (B 의 부분)" 은 A 와 같이 파일 원본이 없어 문제 3 을 못 푼다. B 를 유지하되 HIGH 를 이관 설계와 Gate 로 관리한다.

## Decision

**대안 B 를 채택한다.** 결정 요소:

1. **자산 = 원본 바이트 + 내용 해시.** 이미지·폰트는 업로드 시 SHA-256 을 계산해 Blob 으로 한 번만 저장한다. 문서·백업·스냅샷·history entry·폰트 레지스트리는 `asset:` 참조만 든다. 재인코딩하지 않는다 (예외: 앱이 직접 만드는 썸네일은 PNG/WebP 로 생성하되 캐시 취급).
2. **참조 해석은 한 곳, reader 가 writer 보다 먼저.** Canvas (`imageCache`) · Preview (`fillAdapter` CSS) · 정적 HTML · publish 로더 · 폰트 로더가 같은 해석 함수 하나로 `asset:` 을 실행 시점 URL (builder: `blob:` · 내보낸 파일: 상대 경로 `assets/<hash>.<ext>`) 로 바꾼다. consumer 가 각자 해석하지 않는다 (HC6). 모든 consumer 가 `asset:` 과 기존 dataURL/http 를 함께 읽고 (dual-read), 모든 내보내기가 자립 파일을 만드는 것 (HC7 — v1 JSON 내보내기는 `asset:` 을 dataURL 로 되살려 인라인) 을 검증한 **뒤에만** 업로드·이관이 `asset:` 을 쓰기 시작한다. 그 전까지 writer 는 지금처럼 dataURL 을 쓴다.
3. **형식 v2 = 디렉토리 (작업) + 같은 구조 zip (교환), 세대는 manifest 전환 하나로 바뀐다.** document · collections · fonts 는 내용 해시 이름의 불변 part 파일로, 자산은 `assets/<hash>.<ext>` 불변 파일로 쓴다. 한 저장 세대 = part·자산 파일 집합을 가리키는 manifest 하나이며, 새 세대는 (i) 없는 자산·part 파일 쓰기 → (ii) 불변 세대 기록 `manifests/<revision>.json` 쓰기 → (iii) `manifest.json` 교체 순서로만 만든다. 기존 파일을 덮어쓰지 않으므로 어느 지점에서 중단돼도 읽기 결과는 직전 세대 전체 또는 새 세대 전체 중 하나다. `manifest.json` 이 손상되면 `manifests/` 의 최신 유효 세대로 복구한다. 직전 세대 (최소 1개) 가 가리키는 파일은 새 세대 전환 뒤에도 남기고, 어느 보존 세대도 가리키지 않는 파일만 정리한다. `formatVersion` 이 호환 판정 기준이다. v1 JSON 가져오기는 유지한다 (HC3). 내보내기는 v2 zip 이 기본이다. manifest 는 v1 envelope 의 문서 밖 상태 (`currentPageId` · `metadata`) 를 함께 들고, 읽을 때 `currentPageId` 가 문서의 페이지가 아니면 버리고 첫 페이지로 대체한다.
4. **IndexedDB 역할 = 원본 또는 작업본.** 디렉토리를 연결하지 않은 프로젝트는 지금처럼 IndexedDB 가 원본이다. 디렉토리를 연결한 프로젝트 (Chromium FSA, 후속 Electron) 는 디렉토리가 원본이고 IndexedDB 는 작업본이며, 닫힌 지 오래된 연결 프로젝트는 요약 정보만 남기고 내용을 비울 수 있다. 연결은 프로젝트별 opt-in.
5. **웹 보호 — 보장 범위를 경로별로 구분한다.** 첫 저장 시점에 `persist()` 요청 · 허용/거부 상태 표시 · `estimate()` 사용량 표시 · 저장 실패 알림.
   - Storage Buckets 지원 (Chromium): 캐시 (`collection_runtime` · QueryPersister) 를 `persisted: false` named bucket 으로 옮기고 원본·자산은 `persist()` 를 받은 기본 bucket 에 둔다. 이 경로에서만 브라우저가 캐시를 원본과 따로 퇴거한다.
   - 미지원 (Safari · Firefox): DB 이름 분리는 퇴거 순서를 바꾸지 못한다 — 브라우저는 origin 저장소를 한 단위로 지우고, 원본과 캐시가 함께 사라질 수 있다. 앱이 보장하는 것은 (a) 캐시 용량 상한 (b) `estimate()` 사용률 기준 선제 캐시 정리 (c) 원본 쓰기의 `QuotaExceededError` 시 캐시를 비우고 1회 재시도, 그래도 실패하면 알림 + 내보내기 권유다. `persist()` 거부 상태에서는 "브라우저가 이 프로젝트를 지울 수 있음" 을 상시 표시한다.

**위험 수용 근거**: 대안 평가 단계의 HIGH 는 이관 (마이그레이션) 1건이다. 이관은 기존 데이터를 지우지 않는 방향 (인라인 dataURL → 자산 저장 성공 확인 후 참조 치환, 치환 전 백업 1세대 강제, 멱등) 이고, reader 가 먼저 준비된 뒤에만 활성화되므로 실패 모드가 "이관 안 됨 = 현재 상태 유지" 로 좁혀진다. 이행 중 HIGH (R1 이관 · R2 GC · R3 해석 비대칭 · R9 세대 혼합 · R10 writer 선행) 는 전부 Gate 와 1:1 로 대응하고, 각 Gate 의 실패 대안이 해당 기능만 끄는 형태라 다른 결정 요소를 되돌리지 않는다. 이 형식은 폰트 저장 실패 (현존 결함 후보) 와 이미지 복제 (측정 가능한 낭비) 를 함께 해소한다.

**기각 사유**:

- A: 이미지 복제와 사이트 데이터 삭제 위험이 그대로이고 standalone 원본을 만들지 못한다. A 의 보호 조치는 B 의 결정 요소 5 로 흡수했다.
- C: 원본으로 쓰면 자동 저장마다 전체 재작성 (성능 HIGH). 교환 형식으로만 B 에 흡수했다.
- D: 문서 모델과 맞지 않는 SQL 층 + 전 store 이관 비용에 비해 얻는 것이 없고, OPFS 도 퇴거 위험이 같다. `lib/db/index.ts` 의 PGlite 주석 계획은 이 ADR 로 대체된다.
- E: 서버 0 · 로컬 라이선스 모델 (HC4) 위반.

> 구현 상세: [235-local-project-storage-v2-breakdown.md](../design/235-local-project-storage-v2-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                      | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 문서의 인라인 dataURL → 자산 이관 중 손실 (자산 저장 실패 후 참조만 치환)                                                                            |  HIGH  | 저장 성공 확인 후 치환 · 치환 전 백업 강제 · 멱등 · 실패 시 인라인 유지 (G2)                                                                                                                                                                                                                                                                                                                                                                                |
| R2  | 자산 GC 가 아직 참조 중인 자산 삭제 (백업 ring · 히스토리 스냅샷 · undo/redo history entry · 메모리 history · 다른 프로젝트 참조 누락, mark 이후 새 참조) |  HIGH  | GC root = 전 프로젝트 문서 + 백업 + 스냅샷 + IndexedDB history entry payload + 메모리 history (진행 중 transaction 포함) + 폰트 레지스트리 (Phase 0 에서 참조 보유처 전수 고정). 두 번 연속 미참조 + 유예는 후보 조건뿐이다. 참조 공개 전 pin 확보와 삭제가 같은 `assets`·`asset_gc` readwrite 트랜잭션 범위에서 직렬화된다. 삭제는 pin 없음·관측 epoch 일치를 확인한 뒤에만 확정한다. history 및 영속되지 않은 메모리 참조도 보호한다 (breakdown §3.1, G3) |
| R3  | Canvas 와 Preview 가 `asset:` 참조를 다르게 해석해 시각 결과가 갈림                                                                                       |  HIGH  | 해석 함수 단일화 + 이미지 채우기 · 사용자 폰트 cross-check (G1 · G4)                                                                                                                                                                                                                                                                                                                                                                                        |
| R4  | 디렉토리 원본과 IndexedDB 작업본 발산 (다른 곳에서 파일 수정, 권한 만료 중 편집)                                                                          |  MED   | manifest revision + `lastModified` 비교로 충돌 감지 · 권한 재요청은 사용자 클릭 버튼 · 미기록 변경은 IndexedDB 에 보존                                                                                                                                                                                                                                                                                                                                      |
| R5  | publish 로더가 v2 를 못 읽어 배포 결과 깨짐                                                                                                               |  MED   | publish 는 v1 JSON · v2 디렉토리 둘 다 읽음, 정적 HTML 은 자산 상대 경로로 (G5)                                                                                                                                                                                                                                                                                                                                                                             |
| R6  | Safari · Firefox 는 자동 파일 저장 불가 — 여전히 브라우저 저장소 의존                                                                                     |  MED   | 수용. `persist()` + 내보내기 안내로 보완 (HC5 는 "잃지 않는 경로 존재" 로 충족)                                                                                                                                                                                                                                                                                                                                                                             |
| R7  | 폰트 레지스트리 localStorage → 자산 저장소 이관 중 폰트 소실                                                                                              |  MED   | R1 과 같은 이관 규칙, localStorage 원본은 이관 확인 후 1 릴리스 동안 보존                                                                                                                                                                                                                                                                                                                                                                                   |
| R8  | zip · 해시 코드가 초기 번들 증가                                                                                                                          |  LOW   | lazy import (기존 JSZip 선례), `crypto.subtle` 사용으로 신규 의존 0, initial Δ 실측 (HC2)                                                                                                                                                                                                                                                                                                                                                                   |
| R9  | 디렉토리 저장 중단 시 새 문서 + 옛 collections · manifest 가 섞이고 직전 세대도 사라짐                                                                    |  HIGH  | 불변 part · 자산 파일 + `manifests/<revision>.json` + `manifest.json` 교체 한 번으로 세대 전환, 기존 파일 덮어쓰기 금지, 직전 세대 보존 (G6)                                                                                                                                                                                                                                                                                                                |
| R10 | `asset:` writer 가 reader 보다 먼저 켜져 이미지가 깨지거나, 참조만 든 파일이 다른 브라우저로 나가 바이트 유실                                             |  HIGH  | 구현 순서 = dual-read + 자립 내보내기 검증 (G1) → writer 활성화 (G2). writer 는 G1 전까지 dataURL 유지 (HC7)                                                                                                                                                                                                                                                                                                                                                |
| R11 | Storage Buckets 미지원 환경에서 캐시와 원본이 함께 퇴거                                                                                                   |  MED   | 수용 — 보장 범위를 Decision 5 대로 명시, 앱 수준 상한 · 선제 정리 · quota 재시도 · persist 거부 상태 표시 · 내보내기 권유                                                                                                                                                                                                                                                                                                                                   |

## Gates

측정 조건 공통: 브라우저 · 버전 · `persist()` 상태 · 탭 visibilityState 를 기록한다. bytes 비교는 같은 샘플 프로젝트의 변경 전 arm (detached baseline) 과 A/B 한다.

| Gate | 시점                         | 통과 조건                                                                                                                                                                                                                                                                                                                                                 | 실패 시 대안                                                                |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| G0   | Phase 0 종료                 | 이미지·폰트 URL consumer 전수 목록 · 자산 참조 보유처 (GC root) 전수 목록 · Preview 실행 문맥에서 자산 바이트에 닿는 경로 고정 · 폰트 localStorage 한도 초과 재현 (RED) · 샘플 프로젝트 저장 용량 기준선 (문서 · 백업 · 스냅샷 · history entry bytes)                                                                                                     | consumer · 보유처 누락 발견 시 목록 보강 후 재측정                          |
| G1   | Phase 1 종료 (writer 비활성) | 업로드 결과가 여전히 dataURL (writer 꺼짐 확인) · `asset:` fixture 문서의 이미지 채우기 (stretch/fill/fit) · 사용자 폰트가 Canvas ↔ Preview cross-check 통과 · 해석 누락 참조가 네트워크 요청 0 · `asset:` 문서의 v1 JSON 내보내기 → 빈 브라우저 프로필 가져오기에서 시각 동일 (HC7) · 같은 바이트 2회 저장 = 자산 1개                                    | writer 활성화 보류 (현재 상태 유지), 해석 함수 수리 — consumer 별 분기 금지 |
| G2   | Phase 2 종료 (writer 활성)   | 이관 원복 RED — (a) 자산 저장 강제 실패 시 인라인 유지 (b) 2회 실행 결과 동일 (c) 이관 전 백업 존재. 이관 전후 문서 시각 결과 동일 · 4MB 폰트 저장 성공 · 이미지 포함 프로젝트의 백업+스냅샷+history bytes 가 G0 기준선 대비 감소                                                                                                                         | writer · 이관 비활성 (dual-read 는 유지 — 이미 쓴 `asset:` 은 계속 읽힘)    |
| G3   | Phase 3 종료                 | GC 반증 각 1건 RED→GREEN — 백업에만 · 스냅샷에만 · 다른 프로젝트에만 · **history entry 에만 남은 자산 → GC → undo/redo 로 이미지 복원** · 메모리 history 에만 · 기존 후보 자산을 바이트 재저장 없이 두 번째 mark와 삭제 사이에 재참조: pin 선행이면 삭제 취소, 삭제 선행이면 참조 공개 거부 · root 영속화 뒤 pin 해제도 이전 mark 무효화 (breakdown §3.1) | GC 비활성 (공간 회수만 포기)                                                |
| G4   | Phase 4 종료                 | v2 zip · 디렉토리에서 연 publish 와 정적 HTML 의 이미지 · 사용자 폰트가 Canvas 와 cross-check 통과 (상대 경로 해석)                                                                                                                                                                                                                                       | 해석 함수 수리, consumer 별 분기 금지                                       |
| G5   | Phase 4 종료                 | v1 JSON 가져오기 기존 fixture 전부 통과 · v2 zip 왕복 (내보내기 → 가져오기) 에서 문서 · 자산 · collections 3종 · 폰트 · `currentPageId` · `metadata` 동일 (현재 페이지 B 인 fixture 포함) · 없는 페이지를 가리키는 `currentPageId` 는 첫 페이지 + 경고 · publish 가 v1 · v2 모두 저장된 현재 페이지로 렌더                                                | v2 내보내기 기본값 보류, v1 유지 (G1 로 v1 도 자립 파일)                    |
| G6   | Phase 6 종료                 | 디렉토리 연결 프로젝트: 편집 → 파일 반영 · 중단 주입 (자산 쓰기 후 · part 쓰기 후 · `manifests/<rev>` 쓰기 후 · `manifest.json` 쓰기 중 · 정리 중) 전부에서 읽기 결과가 직전 세대 전체 또는 새 세대 전체 (세대 혼합 0) · `manifest.json` 손상 시 직전 유효 세대 복구 · 외부 수정 충돌 감지                                                                | 디렉토리 연결 기능만 보류 (1~5 결정은 유지)                                 |

### Live Exercise

실제 builder (dev 서버 5173 · Playwright — Chrome 153 `channel: "chrome"` · WebKit 26.5 · 새 프로젝트, Compare Mode · Preview iframe 미개방 — 사용자 지시) 에서 UI · store · IndexedDB · 폴더 파일 · Skia 픽셀로 확인했다 (2026-09-26). 기록 JSON 은 `/private/tmp/adr235-*-live/` (로컬). Chrome MCP · 사용자 confirm 은 쓰지 않았다 — 사용자 확인 대상은 아래 끝 항목.

- `adr235-p7-live.mjs` **6/6** (Phase 7 종합): E1 UI 업로드 (이미지 채우기 · 사용자 폰트) → `asset:` 참조 2 · 새로고침 뒤 Canvas 이미지 픽셀 · 폰트 유지 · E2 요소 삭제 → GC 2회 (history root) 에도 바이트 유지 → undo → 같은 픽셀로 다시 그림 · E3 v2 zip 내보내기 → 빈 프로필 새 프로젝트 가져오기 → 현재 페이지 B · 이미지 · 폰트 · E4 publish (헤더 Preview 버튼 → 새 탭 런타임) → 페이지 B Image `blob:` 로드 (naturalWidth 100) · 폰트 · `asset:` 문자열 누수 0 · E5 두 탭 — 살아 있는 탭의 pin 은 다른 탭 GC 가 존중 · 탭이 닫힌 뒤 (Web Locks 해제) 정리 · E6 WebKit (Safari 엔진, Storage Buckets 미지원 경로) — Chrome 에서 만든 v2 zip 가져오기 · Canvas 이미지 · 다시 내보낸 zip 의 자산 해시 동일.
- `adr235-g1-live.mjs` **9/9** (G1 · HC7): writer 꺼짐 시 dataURL · `asset:` fixture 이미지 채우기 3 모드 · 폰트 · 해석 누락 참조 네트워크 요청 0 · v1 JSON (메뉴 「JSON 으로 내보내기」) → 빈 프로필 가져오기 시각 동일 · 같은 바이트 2회 = 자산 1.
- `adr235-g2-live.mjs` **7/7** (G2): 인라인 이관 (백업 선행 · 2회 동일 · 강제 실패 시 인라인 유지) · 4MB 폰트 저장 · 백업 + 스냅샷 + history bytes 감소.
- `adr235-g3-live.mjs` **4/4** (G3): 백업 · 스냅샷 · 다른 프로젝트 · history 에만 남은 자산이 GC 뒤 유지 · undo/redo 복원.
- `adr235-g4-live.mjs` **8/8** (G4 · G5): v2 zip 왕복 (문서 · 자산 · collections · 폰트 · `currentPageId` 페이지 B · metadata) · 없는 페이지 → 첫 페이지 + 경고 · 손상 manifest 복구 경고 · publish v1 · v2 현재 페이지.
- `adr235-p5-live.mjs` (Phase 5): 첫 저장 뒤 persist 요청 · 헤더 사용량 표시 · 캐시가 `composition-cache` bucket (persisted:false) 으로 · 원본 DB 캐시 0.
- `adr235-g6-live.mjs` **6/6** (G6, 폴더 선택창 대신 OPFS 디렉토리 핸들을 같은 연결 경로로): 연결 → 1세대 · 편집 → DB 저장 뒤 2세대 (직전 보존) · 외부 수정 → conflict · 덮어쓰기 · `manifest.json` 손상 → `manifests/` 복구 · 권한 없음 → 쓰지 않음 · 허용 → 씀 · 영속 프로필 재시작 뒤 연결 복원. 중단 주입 5 지점은 unit (`formatV2Directory.test.ts`).
- live 에서 잡은 결함 (수리): Canvas 가 image fill 을 그리지 않음 (기존 결함) · 이관 뒤 mirror 에 dataURL 잔존 · 사용량 문구 `{used}` 미치환 (+ 기존 가져오기/내보내기 실패 `{message}`) · bucket IndexedDB 장기 연결이 몇 초 idle 뒤 멈춤 · `manifest.json` 손상 뒤 revision 이 1 로 되돌아감 · WebKit 비공개 저장소가 Blob 을 IndexedDB 에 넣지 못함 (ArrayBuffer 로 저장).
- 사용자 확인 대상 (자동화 불가): 실제 Chrome 폴더 선택창 · 새로고침 뒤 권한 요청 흐름 · Preview iframe · 실제 Safari · Firefox (이 환경에서 Playwright Firefox 실행 불가 — WebKit 으로 대체).

## Consequences

### Positive

- 이미지가 문서 · 백업 · 스냅샷 · history entry 에 복제되지 않는다. base64 증가분이 사라진다.
- 사용자 폰트가 localStorage 5MB 한도에서 벗어난다 (현존 저장 실패 경로 제거).
- 사용자가 프로젝트를 탐색기에서 보이는 디렉토리 · zip 으로 가진다 — 사이트 데이터 삭제 · PC 교체에도 복구 경로가 생긴다. 디렉토리 저장은 중단돼도 직전 세대가 남는다.
- 후속 Electron standalone ADR 이 형식 · 원본/작업본 구조를 그대로 쓴다.
- Storage Buckets 지원 브라우저에서는 디스크 부족 시 캐시가 원본과 따로 비워진다. 미지원 브라우저에서도 캐시 상한 · 선제 정리로 원본 쓰기 실패 확률이 줄어든다.

### Negative

- 이미지 URL consumer 전부 (`imageCache.ts` · `fillAdapter.ts` · `generateStaticHtml` · publish 로더 · 폰트 로더) 가 해석 함수를 거치도록 바뀐다.
- 형식 버전이 2개 (v1 가져오기 전용, v2) 가 되어 가져오기 경로를 계속 유지해야 한다. v1 내보내기를 유지하는 동안 자산 인라인 경로도 유지해야 한다.
- 디렉토리 원본에 불변 part · `manifests/` 파일이 쌓여 세대 정리가 필요하다.
- GC 가 history 까지 읽어야 해서 GC 한 번의 비용이 history 크기에 비례한다.
- Safari · Firefox 에서는 캐시 우선 퇴거를 보장하지 못한다 (R11 수용).
- 디렉토리 연결은 Chromium 전용이라 브라우저별 동작이 갈린다 (Safari · Firefox 는 내보내기 기반).
- FSA 권한 재요청 UX (브라우저 재시작 후 클릭 1회) 가 생긴다.
