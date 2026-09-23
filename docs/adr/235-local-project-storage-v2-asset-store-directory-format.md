# ADR-235: 로컬 프로젝트 저장 v2 — 해시 자산 저장소 · 디렉토리 형식 · IndexedDB 작업본

## Status

Proposed — 2026-09-23

## Context

### 문제

composition 은 서버 없이 도는 local-first 빌더다. 프로젝트 원본은 브라우저 IndexedDB 에만 있고, 파일로 나가는 길은 단일 JSON 내보내기 하나뿐이다. 2026-09-23 standalone 병행 분석 (대화 기록 — Electron 외피는 이 ADR 의 응용으로 분리, 사용자 confirm) 에서 다음이 실측됐다.

1. **이미지 바이트가 문서 안에 있다.** `apps/builder/src/builder/panels/styles/components/ImageFillEditor.tsx:93` 이 업로드 파일을 `readAsDataURL` 로 base64 문자열로 바꿔 `ImageFillItem.url` (`apps/builder/src/types/builder/fill.types.ts:84`) 에 넣는다. 그 문서가 다시
   - 백업 ring 에 통째로 복제되고 (`apps/builder/src/lib/db/indexedDB/documentPersistGuard.ts:36` `BACKUP_GENERATIONS = 5`, `incrementalDocuments.ts:179` `joinDocument` 결과 저장)
   - 히스토리 스냅샷에 통째로 복제된다 (`apps/builder/src/builder/stores/history/snapshots.ts:37` "canonical document 전체 캡처본", `historyIndexedDB.ts:52` `MAX_AGE_DAYS = 90`).
   - 결과: 이미지 1장이 문서 1 + 백업 최대 5 + 스냅샷 N 벌로 복제되고, base64 로 약 1.33 배 부푼다.
2. **사용자 폰트가 localStorage 에 있다.** `packages/shared/src/utils/fontRegistry.ts:57` `saveFontRegistry` 가 base64 폰트를 포함한 레지스트리 전체를 `localStorage.setItem` 한다. 허용 한도는 `packages/shared/src/types/font.types.ts:56` `FONT_LIMITS` — 파일당 5MB × 최대 20개. localStorage 는 origin 당 약 5MB 라서 **3.75MB 이상 폰트 1개로 한도를 넘는다** (base64 1.33 배). 저장 실패 처리 (`QuotaExceededError`) 는 코드에 없다 (grep 0건).
3. **브라우저 저장소 보호가 없다.** `navigator.storage.persist()` / `estimate()` 호출 0건. 디스크 부족 시 브라우저가 origin 저장소를 통째로 지울 수 있고, 같은 origin 의 백업 ring 도 함께 사라진다. 버려도 되는 캐시 (`collection_runtime` store — `adapter.ts:295`, `apps/builder/src/builder/utils/QueryPersister.ts:54` 최대 50MB) 가 원본과 같은 저장소·같은 퇴거 순위에 묶여 있다.
4. **파일 형식은 이미 절반 있다.**
   - 프로젝트 JSON: `packages/shared/src/utils/export.utils.ts:103` `ProjectExportData` (`CURRENT_VERSION = "1.0.0"`, `:41`) — `downloadProjectAsJson` (`:883`) / `loadProjectFromFile` (`:1025`), builder 진입점 `BuilderCore.tsx:1215` (내보내기) · `:1248` (가져오기). 자산이 전부 문자열로 인라인된 단일 파일.
   - 정적 HTML 내보내기: `exportProject` (`:1458`) 가 이미 `showDirectoryPicker` 디렉토리 쓰기 + JSZip 폴백 (`:1540`, lazy import) + `assets/fonts/` 배치를 쓴다. 디렉토리 + zip 이중 경로의 선례.
   - publish 런타임은 `loadProjectFromUrl("/project.json")` (`apps/publish/src/App.tsx:411`) 으로 v1 JSON 하나를 읽는다.

### SSOT 3-Domain 판정

저장·영속 인프라 결정이며 D1 (DOM/접근성) · D2 (Props/API) 는 관여하지 않는다. **D3 경계 1건**: 이미지 참조를 문자열 URL 에서 자산 참조로 바꾸면 D3 의 두 대등 consumer — Canvas (`apps/builder/src/builder/workspace/canvas/skia/imageCache.ts:389` fetch → `:400` `MakeImageFromEncoded`) 와 Preview/Publish (`packages/shared/src/utils/fillAdapter.ts` 의 CSS `backgroundImage: url(...)`, 정적 HTML `generateStaticHtml` `export.utils.ts:1072`) — 가 같은 참조를 같은 바이트로 풀어야 한다. SSOT 경계 자체 (D1/D2/D3 소속) 는 바뀌지 않는다.

### Hard constraints

| ID  | 제약                                                                                                                          | 근거                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| HC1 | 상태 변경 파이프라인 순서 `Memory → Index → History → DB → Preview` 보존. DB 단계는 백그라운드 — 파일 쓰기가 편집을 막지 않음 | `.claude/rules/state-management.md`      |
| HC2 | 초기 번들 < 500KB — zip·해시 코드는 lazy                                                                                      | CLAUDE.md §성능 기준                     |
| HC3 | v1 JSON (`version: "1.0.0"`) 가져오기는 계속 동작 (기존 사용자 파일 100% 호환)                                                | `export.utils.ts:926` `parseProjectData` |
| HC4 | 새 서버·계정 0 — 인증은 로컬 라이선스 그대로                                                                                  | `apps/builder/src/auth/license/*`        |
| HC5 | Chromium · Safari · Firefox 모두에서 데이터를 잃지 않는 경로가 있어야 함 (File System Access 는 Chromium 전용)                | MDN 호환 표                              |
| HC6 | Canvas 와 Preview/Publish 의 이미지·폰트 시각 결과 동일 (D3 대칭)                                                             | `.claude/rules/ssot-hierarchy.md` §1 D3  |

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
  - 프로젝트 형식 v2 = `manifest.json` · `document.json` · `collections/` · `assets/<hash>.<ext>` 디렉토리. 교환·비-Chromium 경로는 같은 구조를 zip 으로 묶은 단일 파일.
  - IndexedDB 는 비-Chromium 에서 원본 (현재와 같음), 디렉토리를 연결한 프로젝트 (Chromium FSA · 후속 Electron) 에서는 작업본.
  - 원본·자산 bucket 과 캐시 bucket 을 분리하고 `persist()` 를 원본 쪽에 요청한다.
- 외부 사례: Sketch (zip 컨테이너 + JSON + 이미지 파일), Git 객체 저장 (내용 해시 주소), VS Code 웹 (FSA 디렉토리 연결 + IndexedDB 캐시), 기존 `exportProject` 의 디렉토리/zip 이중 경로.
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

루프 1회: 모든 대안이 HIGH 1+ 를 가져 새 대안을 검토했다 — "자산 저장소만 먼저 (B 의 부분)" 은 A 와 같이 파일 원본이 없어 문제 3 을 못 푼다. B 를 유지하되 HIGH 를 이관 설계와 Gate 로 관리한다.

## Decision

**대안 B 를 채택한다.** 결정 요소:

1. **자산 = 원본 바이트 + 내용 해시.** 이미지·폰트는 업로드 시 SHA-256 을 계산해 Blob 으로 한 번만 저장한다. 문서·백업·스냅샷·폰트 레지스트리는 `asset:` 참조만 든다. 재인코딩하지 않는다 (예외: 앱이 직접 만드는 썸네일은 PNG/WebP 로 생성하되 캐시 취급).
2. **참조 해석은 한 곳.** Canvas (`imageCache`) · Preview (`fillAdapter` CSS) · 정적 HTML · publish 로더가 같은 해석 함수 하나로 `asset:` 을 실행 시점 URL (builder: `blob:` · 내보낸 파일: 상대 경로 `assets/<hash>.<ext>`) 로 바꾼다. consumer 가 각자 해석하지 않는다 (HC6).
3. **형식 v2 = 디렉토리 (작업) + 같은 구조 zip (교환).** `manifest.json` 의 `formatVersion` 이 호환 판정 기준이다. 디렉토리 쓰기 순서는 "새 자산 → 문서·collections → manifest" 로 고정해 중간 중단 시에도 직전 또는 새 저장 중 하나만 남게 한다. v1 JSON 가져오기는 유지한다 (HC3). 내보내기는 v2 zip 이 기본이다.
4. **IndexedDB 역할 = 원본 또는 작업본.** 디렉토리를 연결하지 않은 프로젝트는 지금처럼 IndexedDB 가 원본이다. 디렉토리를 연결한 프로젝트 (Chromium FSA, 후속 Electron) 는 디렉토리가 원본이고 IndexedDB 는 작업본이며, 닫힌 지 오래된 연결 프로젝트는 요약 정보만 남기고 내용을 비울 수 있다. 연결은 프로젝트별 opt-in.
5. **웹 보호.** 첫 저장 시점에 `persist()` 요청 · 상태 표시 · `estimate()` 사용량 표시 · 저장 실패 알림. 캐시 (`collection_runtime` · QueryPersister) 는 원본과 분리된 저장 공간 (Storage Buckets 지원 시 별도 bucket, 미지원 시 별도 DB) 으로 옮기고 용량 상한을 둔다.

**위험 수용 근거**: 유일한 HIGH (이관) 는 기존 데이터를 지우지 않는 방향 (인라인 dataURL → 자산 저장 성공 확인 후 참조 치환, 치환 전 백업 1세대 강제, 멱등) 으로 설계하면 실패 모드가 "이관 안 됨 = 현재 상태 유지" 로 좁혀진다. 나머지는 MEDIUM 이하이며, 이 형식은 폰트 저장 실패 (현존 결함 후보) 와 이미지 복제 (측정 가능한 낭비) 를 함께 해소한다.

**기각 사유**:

- A: 이미지 복제와 사이트 데이터 삭제 위험이 그대로이고 standalone 원본을 만들지 못한다. A 의 보호 조치는 B 의 결정 요소 5 로 흡수했다.
- C: 원본으로 쓰면 자동 저장마다 전체 재작성 (성능 HIGH). 교환 형식으로만 B 에 흡수했다.
- D: 문서 모델과 맞지 않는 SQL 층 + 전 store 이관 비용에 비해 얻는 것이 없고, OPFS 도 퇴거 위험이 같다. `lib/db/index.ts` 의 PGlite 주석 계획은 이 ADR 로 대체된다.
- E: 서버 0 · 로컬 라이선스 모델 (HC4) 위반.

> 구현 상세: [235-local-project-storage-v2-breakdown.md](design/235-local-project-storage-v2-breakdown.md)

## Risks

| ID  | 위험                                                                                        | 심각도 | 대응                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 문서의 인라인 dataURL → 자산 이관 중 손실 (자산 저장 실패 후 참조만 치환)              |  HIGH  | 저장 성공 확인 후 치환 · 치환 전 백업 강제 · 멱등 · 실패 시 인라인 유지 (G2)                                           |
| R2  | 자산 GC 가 아직 참조 중인 자산 삭제 (백업 ring · 히스토리 스냅샷 · 다른 프로젝트 참조 누락) |  HIGH  | 참조 수집 범위 = 전 프로젝트 문서 + 백업 + 스냅샷 + 폰트 레지스트리, 유예 기간 후 삭제 (G3)                            |
| R3  | Canvas 와 Preview 가 `asset:` 참조를 다르게 해석해 시각 결과가 갈림                         |  HIGH  | 해석 함수 단일화 + 이미지 채우기 · 사용자 폰트 cross-check (G4)                                                        |
| R4  | 디렉토리 원본과 IndexedDB 작업본 발산 (다른 곳에서 파일 수정, 권한 만료 중 편집)            |  MED   | manifest revision + `lastModified` 비교로 충돌 감지 · 권한 재요청은 사용자 클릭 버튼 · 미기록 변경은 IndexedDB 에 보존 |
| R5  | publish 로더가 v2 를 못 읽어 배포 결과 깨짐                                                 |  MED   | publish 는 v1 JSON · v2 디렉토리 둘 다 읽음, 정적 HTML 은 자산 상대 경로로 (G5)                                        |
| R6  | Safari · Firefox 는 자동 파일 저장 불가 — 여전히 브라우저 저장소 의존                       |  MED   | 수용. `persist()` + 내보내기 안내로 보완 (HC5 는 "잃지 않는 경로 존재" 로 충족)                                        |
| R7  | 폰트 레지스트리 localStorage → 자산 저장소 이관 중 폰트 소실                                |  MED   | R1 과 같은 이관 규칙, localStorage 원본은 이관 확인 후 1 릴리스 동안 보존                                              |
| R8  | zip · 해시 코드가 초기 번들 증가                                                            |  LOW   | lazy import (기존 JSZip 선례), `crypto.subtle` 사용으로 신규 의존 0                                                    |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                      | 실패 시 대안                                |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G0   | Phase 0 종료 | 이미지·폰트 URL consumer 전수 목록 고정 · 폰트 localStorage 한도 초과 재현 (RED) · 샘플 프로젝트 저장 용량 기준선 (문서 · 백업 · 스냅샷 bytes) | consumer 누락 발견 시 목록 보강 후 재측정   |
| G1   | Phase 1 종료 | 같은 파일 2회 업로드 = 자산 1개 · 4MB 폰트 저장 성공 · 기준선 대비 이미지 포함 프로젝트의 백업+스냅샷 bytes 감소 실측                          | 해시·저장 경로 수리                         |
| G2   | Phase 2 종료 | 이관 원복 RED — (a) 자산 저장 강제 실패 시 인라인 유지 (b) 2회 실행 결과 동일 (c) 이관 전 백업 존재. 이관 전후 문서 시각 결과 동일             | 이관 비활성 · 인라인 유지 (현재 상태)       |
| G3   | Phase 2 종료 | GC 가 백업·스냅샷·타 프로젝트 참조 자산을 지우지 않음 (반증 케이스 각 1건 RED→GREEN)                                                           | GC 비활성 (공간 회수만 포기)                |
| G4   | Phase 3 종료 | 이미지 채우기 · 사용자 폰트 · 정적 HTML 내보내기의 Canvas ↔ Preview cross-check 통과                                                           | 해석 함수 수리, consumer 별 분기 금지       |
| G5   | Phase 3 종료 | v1 JSON 가져오기 기존 fixture 전부 통과 · v2 zip 왕복 (내보내기 → 가져오기) 문서·자산 동일 · publish 가 v1 · v2 모두 렌더                      | v2 내보내기 기본값 보류, v1 유지            |
| G6   | Phase 5 종료 | 디렉토리 연결 프로젝트: 편집 → 파일 반영 · 쓰기 중단 주입 시 직전 또는 새 저장 중 하나 · 외부 수정 충돌 감지                                   | 디렉토리 연결 기능만 보류 (1~4 결정은 유지) |

### Live Exercise

(Implemented 승격 시 기재 — 실제 builder 에서 exercise 한 시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분)

## Consequences

### Positive

- 이미지가 문서 · 백업 · 스냅샷에 복제되지 않는다. base64 증가분이 사라진다.
- 사용자 폰트가 localStorage 5MB 한도에서 벗어난다 (현존 저장 실패 경로 제거).
- 사용자가 프로젝트를 탐색기에서 보이는 디렉토리 · zip 으로 가진다 — 사이트 데이터 삭제 · PC 교체에도 복구 경로가 생긴다.
- 후속 Electron standalone ADR 이 형식 · 원본/작업본 구조를 그대로 쓴다.
- 캐시가 원본과 분리돼 디스크 부족 시 캐시부터 비워진다.

### Negative

- 이미지 URL consumer 전부 (`imageCache.ts` · `fillAdapter.ts` · `generateStaticHtml` · publish 로더) 가 해석 함수를 거치도록 바뀐다.
- 형식 버전이 2개 (v1 가져오기 전용, v2) 가 되어 가져오기 경로를 계속 유지해야 한다.
- 디렉토리 연결은 Chromium 전용이라 브라우저별 동작이 갈린다 (Safari · Firefox 는 내보내기 기반).
- FSA 권한 재요청 UX (브라우저 재시작 후 클릭 1회) 가 생긴다.
