# ADR-235 구현 상세 — 로컬 프로젝트 저장 v2

> 본문: [ADR-235](../235-local-project-storage-v2-asset-store-directory-format.md)
>
> 개정 2026-09-26 — [review round 1](../reviews/235.md) 반영: §2 레이아웃·쓰기 순서 (h1 세대 전환 · m2 `currentPageId`) · §3 Phase 재배치 (h3 reader 먼저 · h2 GC root · m1 캐시 보장 범위) · §4 · §5. §1 전제 기록은 무변경 (scope 무변경 — 순서·쓰기 방식만 바뀜).

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-23 (AskUserQuestion — "저장만 1개 ADR"):

1. **base / 응용**: 235 는 저장 형식 · 자산 저장소 · IndexedDB 역할 (base) 을 정한다. Electron standalone 외피 (사용자 정의 프로토콜 · platform 어댑터 · 서명/업데이트) 는 이 형식을 원본으로 쓰는 응용이며 후속 ADR 로 분리한다.
2. **schema 직교성**: 새 저장 스키마는 (a) IndexedDB `assets` store (해시 키 Blob) + `asset_gc` store (pin·참조 epoch·후보 메타데이터) (b) 파일 형식 v2 (`manifest.json` `formatVersion: "2.0.0"`) 두 가지. canonical document 스키마는 이미지·폰트 참조 문자열의 **값 규약**만 바뀐다 (`asset:sha256-<hex>`) — 노드 필드 추가 없음.
3. **선행 전제 역전 검증**: `lib/db/index.ts` 주석의 "Electron = PGlite" 전제는 승계하지 않는다 (ADR 본문 대안 D 기각). 기존 v1 JSON (`export.utils.ts` `CURRENT_VERSION = "1.0.0"`) 은 가져오기 전용으로 남고 v2 가 내보내기 기본이 된다.
4. **범위**: 자산 저장소 · 형식 v2 · IndexedDB 작업본 · 웹 보호. Electron · 클라우드 동기화 · 이미지 변환 파이프라인 (WebP 파생본 등) 은 범위 밖.

## 2. 형식 v2 레이아웃

```
<name>.composition/            ← 디렉토리 (작업) 또는 같은 구조의 zip (교환)
├── manifest.json              현재 세대 — manifests/<revision>.json 과 같은 내용
├── manifests/<revision>.json  불변 세대 기록 (디렉토리만 · zip 은 현재 세대 1개)
├── parts/<hex>.json           불변 part — document · collections · api-endpoints · variables · fonts
├── assets/<hex>.<ext>         원본 바이트 그대로 (불변)
└── thumbnail.png              앱 생성 (선택, 캐시 취급)
```

manifest 필드:

| 필드                                        | 내용                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `formatVersion`                             | `"2.0.0"` — 호환 판정 기준                                                                                                                                        |
| `project`                                   | `{ id, name }`                                                                                                                                                    |
| `revision` · `previousRevision` · `savedAt` | 세대 번호 (단조 증가) · 직전 세대 · 저장 시각                                                                                                                     |
| `parts`                                     | `{ document, collections, apiEndpoints, variables, fonts }` → 각각 `parts/<hex>.json` 경로 + bytes + sha256. 바뀌지 않은 part 는 이전 세대 파일을 그대로 가리킨다 |
| `assets[]`                                  | `{ hash, mime, bytes, ext, name? }`                                                                                                                               |
| `editor`                                    | `{ currentPageId }` — v1 `ProjectExportData.currentPageId` (`export.utils.ts:108` 인터페이스) 대응                                                                |
| `metadata`                                  | v1 `ProjectMetadata` (`packages/shared/src/types/export.types.ts:75`) 그대로                                                                                      |

- **자산 참조 문자열**: `asset:sha256-<64 hex>`. CSS `url()` 에 그대로 들어가도 네트워크 요청이 나가지 않는 스킴을 쓴다 (해석 함수를 거치지 않은 누락이 조용히 외부 요청이 되지 않도록 — G1 검사 항목).
- **part 파일 이름 = 내용 SHA-256**: 같은 내용이면 이미 있는 파일을 재사용하고, 기존 파일은 절대 덮어쓰지 않는다.
- **쓰기 순서 (디렉토리 — 세대 전환)**:
  1. manifest 에 없는 새 자산 파일 → 없는 part 파일 (각각 `createWritable()` → `close()`, 불변 경로라 중단돼도 어느 세대도 가리키지 않는 고아 파일만 남는다)
  2. 쓴 파일 크기·해시 재확인 (읽어서 대조)
  3. `manifests/<revision+1>.json` 쓰기 (불변)
  4. `manifest.json` 교체 — 이 한 번이 세대 전환 지점. 파일 단위 `close()` 반영은 단일 파일에 대해서만 기대하고, 손상·중단 시 3 의 기록으로 복구한다
  5. 정리: 현재 + 직전 1세대 (보존 세대 수는 Phase 6 에서 확정, 최소 1) 가 가리키지 않는 part · 자산 · `manifests/` 파일 삭제. 정리 중단은 고아 파일만 남긴다
- **읽기 (디렉토리)**: `manifest.json` 을 읽고, 파싱 실패 · 가리키는 part 누락 · 해시 불일치면 `manifests/` 를 revision 내림차순으로 훑어 part 가 전부 있는 첫 세대를 쓴다 (복구 사실을 사용자에게 알림). manifest 가 가리키지 않는 파일은 무시한다.
- **zip**: 단일 파일로 한 번에 쓰므로 현재 세대 1개만 담는다 (`manifests/` 없음). 읽기 규칙은 같다.
- **`currentPageId` 검증**: 읽을 때 문서 페이지 목록에 없으면 `null` 로 버리고 경고 1건 — 이후 기존 fallback (첫 페이지, `deriveProjectEditorPageModelFromDocument` `export.utils.ts:821`) 을 탄다.
- **v1 가져오기**: `parseProjectData` 결과를 받아 인라인 dataURL 을 Phase 2 이관 함수로 자산화한 뒤 적용 (writer 활성 후에만. 그 전에는 지금처럼 인라인 그대로).
- **v1 내보내기 (자립 — HC7)**: `serializeProjectData` (`export.utils.ts:843`) 경계에서 `asset:` 참조를 자산 바이트의 dataURL 로 되살려 넣는다. 문서 · 폰트 레지스트리 모두. 자산을 찾지 못하면 내보내기를 실패로 알리고 참조만 든 파일을 만들지 않는다.

## 3. Phase

**활성화 경계**: reader (dual-read) · 자립 내보내기가 Phase 1 에서 먼저 켜지고, `asset:` 을 새로 쓰는 코드 (업로드 · 폰트 · 이관) 는 G1 통과 후 Phase 2 에서만 켜진다. writer 활성화는 설정 한 곳 (flag) 으로 묶어 G2 실패 시 끌 수 있게 하고, 꺼도 이미 쓴 `asset:` 은 Phase 1 reader 가 계속 읽는다.

| Phase | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Gate    |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 0     | inventory freeze — (a) 이미지·폰트 URL consumer 전수 grep (`ImageFillItem.url` · Image 컴포넌트 `src` · `fillAdapter` · `imageCache` · `generateStaticHtml` · publish 로더 · 폰트 로더 · AI `fillContract.ts`) (b) 자산 참조 보유처 전수 — GC root 후보: 전 프로젝트 문서 · 백업 ring · 스냅샷 store · `history-entries` payload (`historyIndexedDB.ts:211`, 삭제 node · `prevProps` / `nextProps`) · 메모리 `HistoryManager.pageHistories` (`stores/history.ts:251`) · transaction buffer (`:264`) · 폰트 레지스트리 · 그 밖에 grep 으로 나오는 보유처 (c) Preview 실행 문맥에서 해석 함수가 자산 바이트에 닿는 경로 (같은 origin IndexedDB 직접 읽기 또는 builder 가 `blob:` URL 전달) 확정 (d) 폰트 4MB 저장 실패 재현 (RED) (e) 샘플 프로젝트 (이미지 5 · 폰트 2) 의 문서/백업/스냅샷/history bytes 기준선 | G0      |
| 1     | 자산 저장소 + reader — IndexedDB `assets` · `asset_gc` store (DB_VERSION 23) · 참조 공개 전 pin 준비 (§3.1) · `crypto.subtle` SHA-256 · 해석 함수 (`asset:` → `blob:` URL, 참조 카운트 기반 revoke) · **consumer 전부 dual-read 전환** (Canvas `imageCache` · Preview `fillAdapter` · 정적 HTML · publish 로더 · 폰트 로더 — `asset:` 과 dataURL/http 모두) · **자립 v1 내보내기** (§2) · 업로드 경로는 여전히 dataURL (writer 꺼짐)                                                                                                                                                                                                                                                                                                                                                                           | G1      |
| 2     | writer 활성화 · 이관 — 업로드 (ImageFillEditor · customFonts) 가 자산 저장 · 폰트 레지스트리 localStorage → IndexedDB (localStorage 원본 1 릴리스 보존) · 기존 문서 인라인 dataURL → 자산 (로드 시 lazy, 멱등, 치환 전 백업 강제) · v1 가져오기 자산화                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | G2      |
| 3     | GC — Phase 0 (b) root 전부에서 참조 수집 (mark) · 미참조 자산에 후보 시각 기록 · 다음 GC 에서도 미참조이고 유예 기간이 지난 후보만 삭제 (sweep). history entry 는 `cleanupOldEntries` (`historyIndexedDB.ts:508`) · `clearPageHistory` (`:360`) 로 정리될 때까지 root 로 남는다. 새 저장분 제외와 별개로 모든 참조 공개·pin 해제·sweep은 §3.1의 pin·epoch 계약을 따른다. 두 번의 mark와 유예만으로 삭제하지 않는다                                                                                                                                                                                                                                                                                                                                                                                             | G3      |
| 4     | 형식 v2 — `packages/shared/src/utils/` 에 v2 reader/writer (디렉토리 · zip 공용 추상, §2 세대 규칙) · 내보내기 기본 v2 zip · 가져오기 v1/v2 판정 · `editor.currentPageId` · `metadata` 왕복 · publish 로더 v2 디렉토리 · 정적 HTML 자산 상대 경로                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | G4 · G5 |
| 5     | 웹 보호 — 첫 저장 시 `persist()` · 허용/거부 상태 · 사용량 표시 · `QuotaExceededError` 알림 · 캐시 (`collection_runtime` · QueryPersister) 저장 위치: Storage Buckets 지원 시 `persisted: false` named bucket, 미지원 시 현 위치 유지 + 용량 상한 · `estimate()` 사용률 기준 선제 정리 · 원본 쓰기 quota 실패 시 캐시 비우고 1회 재시도 · persist 거부 상태 상시 표시 · 히스토리 스냅샷 용량 상한                                                                                                                                                                                                                                                                                                                                                                                                              | —       |
| 6     | 디렉토리 연결 (Chromium FSA) — 프로젝트별 opt-in · handle 보관 · 권한 재요청 버튼 · 저장 파이프라인 DB 단계 뒤 백그라운드 파일 쓰기 (§2 세대 전환) · 보존 세대 수 확정 · 충돌 감지 (manifest revision + `lastModified`) · 오래 닫힌 연결 프로젝트 내용 비우기                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | G6      |
| 7     | live exercise — builder 에서 이미지·폰트 업로드 → 새로고침 → 이미지 삭제 → GC → undo → 내보내기 → 새 프로젝트로 가져오기 (현재 페이지 유지) → publish 렌더, Chromium 디렉토리 연결 편집 · Safari 또는 Firefox 1종 zip 왕복                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —       |

Phase 5 는 1~4 와 독립이라 먼저 착수해도 된다 (가장 작은 작업으로 퇴거 확률을 낮춘다). Phase 3 (GC) 이 끝나기 전에는 자산이 지워지지 않을 뿐 데이터 손실 경로는 없다.

### 3.1. GC 참조 공개와 삭제의 순서 (round 2 h2 수리)

두 번의 mark와 유예 기간은 삭제 후보를 고르는 조건이다. 최종 삭제에는 다음 계약을 추가한다. GC 메타데이터는 문서의 쓰기 원본이 아니며 실제 root는 기존 canonical document·history·백업·폰트에서 수집한다.

보호 단위의 근거는 [IndexedDB transaction 계약](https://w3c.github.io/IndexedDB/#transaction-concept)이다. 같은 object store를 포함하는 readwrite 트랜잭션이 서로의 변경 중간에 끼어들지 않는 성질을 사용한다.

1. **공유 메타데이터**: 같은 IndexedDB의 `asset_gc`에 자산별 단조 증가 `referenceEpoch`, 세션별 pin, 후보 `{ epoch, since }`를 둔다. 모든 탭의 참조 준비·pin 해제·최종 삭제는 `assets`와 `asset_gc`를 함께 포함하는 하나의 readwrite 트랜잭션을 사용하며, 성공은 request 성공이 아닌 **transaction complete**로 판정한다. 탭 안의 mutex나 시각 비교만으로 대체하지 않는다.
2. **참조 공개 전 보호**: 새 hash를 문서·history·폰트 등 root에 넣기 전에 해당 트랜잭션에서 바이트 존재를 확인하고 세션 pin 확보·epoch 증가·후보 해제를 함께 확정한다. 동일 바이트 중복 업로드, URL/src 직접 편집, 붙여넣기·복제, undo/redo, 가져오기·hydration도 포함한다. 원본 바이트가 없는 기존 `asset:`의 준비가 실패하면 참조를 공개하지 않고 오류를 알린다. 업로드처럼 원본 바이트가 있으면 바이트 저장과 pin을 함께 확정할 수 있다. 이미 유효한 세션 pin을 보유한 hash는 동기 편집에서 재사용한다.
3. **상태 파이프라인 유지**: 최초 자산 해석·참조 준비 경계에서 pin 확보를 기다린 뒤 기존 `Memory → Index → History → DB → Preview`를 실행한다. canonical mutation 중간에 DB 대기를 삽입하지 않는다. pin은 메모리 전용 참조·진행 중 history transaction·미완료 영속화가 남아 있는 동안 유지한다. 참조를 durable root에 넘겨 pin을 해제할 때는 관련 document·history 등 저장 트랜잭션의 complete를 먼저 확인하고, 보호 트랜잭션에서 epoch 증가·후보 해제와 함께 pin을 푼다. 중단·실패·탭 종료만으로 시간 만료를 적용해 pin을 지우지 않으며, 소유 상태가 불명확하면 유지하고 공간 회수를 미룬다.
4. **mark와 최종 sweep**: root 수집을 시작하기 전에 자산별 epoch를 읽는다. 수집 뒤 동일 epoch이고 pin이 없는 미참조 자산만 후보로 기록한다. 다음 GC도 같은 순서로 수집하고, 최종 보호 트랜잭션에서 `현재 epoch = 이번 수집 시작 epoch = 후보 epoch`, pin 없음, 이번 root 수집에서 미참조, 유예 경과를 모두 확인한 뒤 바이트 삭제·후보 해제·epoch 증가를 함께 확정한다. epoch tombstone은 남겨 같은 hash가 재등록돼도 과거 epoch를 재사용하지 않는다. 하나라도 다르면 삭제를 취소하고 다음 수집으로 넘긴다. 참조 준비가 먼저 확정되면 pin/epoch가 삭제를 막고, 삭제가 먼저 확정되면 이후 참조 준비의 존재 검사가 실패해 깨진 참조가 공개되지 않는다.
5. **활성화 조건**: Phase 0에서 자산 바이트를 다시 저장하지 않는 경로까지 참조 공개 진입점을 고정하고 Phase 1에서 준비 계약을 배선한다. pin을 우회하는 탭·writer 또는 GC 메타데이터를 읽지 못하는 상황에서는 sweep을 비활성화한다. stale pin 정리도 root 이관·소유권 종료를 증명하기 전에는 수행하지 않는다. 이 보수적 보존은 HC1을 바꾸지 않고 데이터 보존을 우선하는 비용이다.
6. **G3의 고정 반례**: 유예가 지난 기존 후보 A의 두 번째 mark 직후, 바이트를 재저장하지 않는 URL 참조 적용을 삽입한다. (a) pin 준비가 먼저면 A 바이트와 새 참조 모두 유지 (b) 삭제가 먼저면 참조 적용 실패·기존 문서 유지 (c) mark가 durable root 저장 전에 시작되고 저장 완료 뒤 pin이 해제돼도 epoch 변경으로 그 sweep은 취소된다. 서로 다른 탭에서도 같은 순서를 검증하고, 중단 시 pin 잔존이 삭제 허용으로 바뀌지 않는지 확인한다. [실행 모델](235-gc-reference-admission-model.mjs)은 이 순서의 설계 검증용이며 실제 IndexedDB·브라우저 G3를 대신하지 않는다.

## 4. 파일 변경 예상 (Phase 0 에서 확정)

| 영역           | 파일                                                                                                                    | 변경                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| IndexedDB      | `apps/builder/src/lib/db/indexedDB/adapter.ts` · `lib/db/types.ts`                                                      | `assets`·`asset_gc` store · 참조 준비·pin 해제·sweep 트랜잭션              |
| 자산 해석      | 신규 `packages/shared/src/utils/assetRef.ts` (규약 · 파싱) · 신규 `apps/builder/src/lib/assets/*` (저장 · 해석 · GC)    | 신규                                                                       |
| 업로드         | `builder/panels/styles/components/ImageFillEditor.tsx` · `builder/fonts/customFonts.ts`                                 | dataURL → 자산 저장 (Phase 2, flag 뒤)                                     |
| 폰트           | `packages/shared/src/utils/fontRegistry.ts` · `builder/fonts/loadCustomFontsToSkia.ts`                                  | dual-read (Phase 1) · localStorage → 자산 (Phase 2)                        |
| Canvas         | `builder/workspace/canvas/skia/imageCache.ts`                                                                           | 해석 함수 경유 fetch (Phase 1)                                             |
| Preview/CSS    | `packages/shared/src/utils/fillAdapter.ts`                                                                              | 해석 함수 경유 `url()` (Phase 1)                                           |
| 형식           | `packages/shared/src/utils/export.utils.ts` (+ 신규 v2 모듈)                                                            | 자립 v1 내보내기 (Phase 1) · v2 reader/writer · v1 가져오기 유지 (Phase 4) |
| builder 진입점 | `builder/main/BuilderCore.tsx:1224` · `:1257`                                                                           | 내보내기 v2 · 가져오기 v1/v2 · `currentPageId` 적용 (`:1296`)              |
| publish        | `apps/publish/src/App.tsx` 로더 (`:411`) · 초기 페이지 (`:329`)                                                         | dual-read (Phase 1) · v2 디렉토리 읽기 · `editor.currentPageId` (Phase 4)  |
| 히스토리·백업  | `builder/stores/history/historyIndexedDB.ts` · `builder/stores/history.ts` · `lib/db/indexedDB/documentPersistGuard.ts` | GC root 수집 (IndexedDB entry · 메모리 history) · 용량 상한                |
| 캐시           | `builder/utils/QueryPersister.ts` · `adapter.ts` `collection_runtime`                                                   | named bucket (지원 시) · 상한 · 선제 정리                                  |

## 5. 검증 매핑

- 원복 RED: G1 (writer 꺼짐 · 해석 누락 네트워크 0 · 자립 내보내기) · G2 (a)(b)(c) · G3 root 반증 (백업 · 스냅샷 · 다른 프로젝트 · history entry → undo/redo · 메모리 history) + §3.1 경쟁 순서 (기존 자산 재참조가 두 번째 mark 뒤 진입: pin 선행·삭제 선행, root 영속화 후 pin 해제) · G6 중단 주입 5지점 + manifest 손상 복구.
- cross-check: 이미지 채우기 (stretch/fill/fit) · 사용자 폰트 텍스트 (G1 — builder `blob:` 해석) · 정적 HTML · publish (G4 — 상대 경로 해석).
- 왕복 비교 (G5): canonical document 외에 collections 3종 · 폰트 · `currentPageId` · `metadata` — 현재 페이지가 첫 페이지가 아닌 fixture 필수.
- 브라우저 매트릭스: Chromium (디렉토리 · zip · Storage Buckets) · Firefox 또는 Safari 1종 (zip · bucket 미지원 경로).
- CHANGELOG: Phase 1 (자립 내보내기) · Phase 2 (폰트 저장 한도 해소) · Phase 4 (형식 v2) · Phase 6 (디렉토리 연결) 각각 사용자-가시 변경.
