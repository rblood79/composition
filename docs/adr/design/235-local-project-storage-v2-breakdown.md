# ADR-235 구현 상세 — 로컬 프로젝트 저장 v2

> 본문: [ADR-235](../235-local-project-storage-v2-asset-store-directory-format.md)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-23 (AskUserQuestion — "저장만 1개 ADR"):

1. **base / 응용**: 235 는 저장 형식 · 자산 저장소 · IndexedDB 역할 (base) 을 정한다. Electron standalone 외피 (사용자 정의 프로토콜 · platform 어댑터 · 서명/업데이트) 는 이 형식을 원본으로 쓰는 응용이며 후속 ADR 로 분리한다.
2. **schema 직교성**: 새 저장 스키마는 (a) IndexedDB `assets` store (해시 키 Blob) (b) 파일 형식 v2 (`manifest.json` `formatVersion: "2.0.0"`) 두 가지. canonical document 스키마는 이미지·폰트 참조 문자열의 **값 규약**만 바뀐다 (`asset:sha256-<hex>`) — 노드 필드 추가 없음.
3. **선행 전제 역전 검증**: `lib/db/index.ts` 주석의 "Electron = PGlite" 전제는 승계하지 않는다 (ADR 본문 대안 D 기각). 기존 v1 JSON (`export.utils.ts` `CURRENT_VERSION = "1.0.0"`) 은 가져오기 전용으로 남고 v2 가 내보내기 기본이 된다.
4. **범위**: 자산 저장소 · 형식 v2 · IndexedDB 작업본 · 웹 보호. Electron · 클라우드 동기화 · 이미지 변환 파이프라인 (WebP 파생본 등) 은 범위 밖.

## 2. 형식 v2 레이아웃

```
<name>.composition/            ← 디렉토리 (작업) 또는 같은 구조의 zip (교환)
├── manifest.json              formatVersion · project {id,name} · revision · savedAt · assets[] (hash, mime, bytes, ext, name?)
├── document.json              canonical CompositionDocument (자산은 asset:sha256-<hex>)
├── collections/
│   ├── collections.json       DataTableDefinition[]
│   ├── api-endpoints.json     ApiEndpointDefinition[]
│   └── variables.json         VariableDef[]
├── fonts.json                 FontRegistryV2 (source 는 asset: 참조)
├── assets/<hex>.<ext>         원본 바이트 그대로
└── thumbnail.png              앱 생성 (선택, 캐시 취급)
```

- **자산 참조 문자열**: `asset:sha256-<64 hex>`. CSS `url()` 에 그대로 들어가도 네트워크 요청이 나가지 않는 스킴을 쓴다 (해석 함수를 거치지 않은 누락이 조용히 외부 요청이 되지 않도록).
- **쓰기 순서 (디렉토리)**: ① manifest 에 없는 새 자산 파일 → ② `document.json` · `collections/*` · `fonts.json` (파일별 `createWritable()` — 닫을 때 반영) → ③ `manifest.json` (revision 증가). 읽기는 manifest 기준 — manifest 가 가리키지 않는 자산은 무시, manifest 가 가리키는데 없는 자산은 오류 보고.
- **v1 가져오기**: `parseProjectData` 결과를 받아 인라인 dataURL 을 Phase 2 이관 함수로 자산화한 뒤 적용.

## 3. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                | Gate    |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | inventory freeze — 이미지·폰트 URL consumer 전수 grep (`ImageFillItem.url` · Image 컴포넌트 `src` · `fillAdapter` · `imageCache` · `generateStaticHtml` · publish 로더 · AI `fillContract.ts`) · 폰트 4MB 저장 실패 재현 (RED) · 샘플 프로젝트 (이미지 5 · 폰트 2) 의 문서/백업/스냅샷 bytes 기준선 | G0      |
| 1     | 자산 저장소 — IndexedDB `assets` store (DB_VERSION 23) · `crypto.subtle` SHA-256 · 해석 함수 (`asset:` → `blob:` URL, 참조 카운트 기반 revoke) · 업로드 경로 (ImageFillEditor · customFonts) 가 자산 저장 · 폰트 레지스트리 localStorage → IndexedDB                                                | G1      |
| 2     | 이관 · GC — 기존 문서 인라인 dataURL → 자산 (로드 시 lazy, 멱등, 치환 전 백업 강제) · 폰트 localStorage 원본 1 릴리스 보존 · 참조 수집 (전 프로젝트 문서 + 백업 + 스냅샷 + 폰트) 후 유예 기간 경과 자산만 삭제                                                                                      | G2 · G3 |
| 3     | 형식 v2 — `packages/shared/src/utils/` 에 v2 reader/writer (디렉토리 · zip 공용 추상) · 내보내기 기본 v2 zip · 가져오기 v1/v2 판정 · publish 로더 v2 디렉토리 · 정적 HTML 자산 상대 경로 · consumer 전부 해석 함수 경유                                                                             | G4 · G5 |
| 4     | 웹 보호 — 첫 저장 시 `persist()` · 상태/사용량 표시 · `QuotaExceededError` 알림 · 캐시 (`collection_runtime` · QueryPersister) 분리 (Storage Buckets 또는 별도 DB) + 용량 상한 · 히스토리 스냅샷 용량 상한                                                                                          | —       |
| 5     | 디렉토리 연결 (Chromium FSA) — 프로젝트별 opt-in · handle 보관 · 권한 재요청 버튼 · 저장 파이프라인 DB 단계 뒤 백그라운드 파일 쓰기 · 충돌 감지 (manifest revision + `lastModified`) · 오래 닫힌 연결 프로젝트 내용 비우기                                                                          | G6      |
| 6     | live exercise — builder 에서 이미지·폰트 업로드 → 새로고침 → 내보내기 → 새 프로젝트로 가져오기 → publish 렌더, Chromium 디렉토리 연결 편집 · Safari 또는 Firefox 1종 zip 왕복                                                                                                                       | —       |

Phase 4 는 1~3 과 독립이라 먼저 착수해도 된다 (가장 작은 작업으로 퇴거 확률을 낮춘다).

## 4. 파일 변경 예상 (Phase 0 에서 확정)

| 영역           | 파일                                                                                                                 | 변경                                      |
| -------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| IndexedDB      | `apps/builder/src/lib/db/indexedDB/adapter.ts` · `lib/db/types.ts`                                                   | `assets` store · `DatabaseAdapter.assets` |
| 자산 해석      | 신규 `packages/shared/src/utils/assetRef.ts` (규약 · 파싱) · 신규 `apps/builder/src/lib/assets/*` (저장 · 해석 · GC) | 신규                                      |
| 업로드         | `builder/panels/styles/components/ImageFillEditor.tsx` · `builder/fonts/customFonts.ts`                              | dataURL → 자산 저장                       |
| 폰트           | `packages/shared/src/utils/fontRegistry.ts` · `builder/fonts/loadCustomFontsToSkia.ts`                               | localStorage → 자산 · 해석 함수           |
| Canvas         | `builder/workspace/canvas/skia/imageCache.ts`                                                                        | 해석 함수 경유 fetch                      |
| Preview/CSS    | `packages/shared/src/utils/fillAdapter.ts`                                                                           | 해석 함수 경유 `url()`                    |
| 형식           | `packages/shared/src/utils/export.utils.ts` (+ 신규 v2 모듈)                                                         | v2 reader/writer · v1 가져오기 유지       |
| builder 진입점 | `builder/main/BuilderCore.tsx:1215` · `:1248`                                                                        | 내보내기 v2 · 가져오기 v1/v2              |
| publish        | `apps/publish/src/App.tsx` 로더                                                                                      | v2 디렉토리 읽기                          |
| 히스토리·백업  | `builder/stores/history/historyIndexedDB.ts` · `lib/db/indexedDB/documentPersistGuard.ts`                            | GC 참조 수집 · 용량 상한                  |
| 캐시           | `builder/utils/QueryPersister.ts` · `adapter.ts` `collection_runtime`                                                | 분리 저장 공간                            |

## 5. 검증 매핑

- 원복 RED: G2 (a)(b)(c) · G3 반증 3건 · G6 쓰기 중단 주입.
- cross-check: 이미지 채우기 (stretch/fill/fit) · 사용자 폰트 텍스트 · 정적 HTML.
- 브라우저 매트릭스: Chromium (디렉토리 · zip) · Firefox 또는 Safari 1종 (zip).
- CHANGELOG: Phase 1 (폰트 저장 한도 해소) · Phase 3 (형식 v2) · Phase 5 (디렉토리 연결) 각각 사용자-가시 변경.
