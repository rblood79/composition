# FONTS 실행 계획서

## Status

Implemented — Phase A+B+C+**C2(Font Manager Panel)**+**D(Preview/Publish 런타임)**+**E(정적 Export 멀티파일)** 완료 (2026-03-05)

## 0) 확정 결정 (2026-02-13)

1. 폰트 적용 규칙은 Builder/WebGL, Preview, Publish, Static Export에 **동일 적용**한다.
2. 저장 전략은 **일반적인 빌더 방식**(프로젝트 스코프 자산 + 런타임 캐시)으로 간다.
3. 정적 퍼블리시는 단일 HTML이 아니라 **멀티파일 산출물**로 간다.
4. 멀티파일 전달 방식은 **디렉터리 저장**(사용자 선택 경로 직접 쓰기)으로 간다.
5. 폰트 메타/적용 UX는 **기존 Typography 컨트롤 재사용**을 기본으로 한다.
6. 폰트 레지스트리 정본은 **`projects` 컬럼 확장(`font_registry`)**으로 저장한다.

---

## 1) 목적

사용자 커스텀 폰트를 Builder에서 추가한 뒤, 아래 모든 경로에서 동일하게 보이도록 한다.

1. 스타일 패널 Typography의 폰트 리스트에 노출
2. WebGL/Skia 텍스트 렌더 경로 반영
3. Preview iframe(srcdoc) 반영
4. Publish 앱 반영
5. 정적 멀티파일 산출물에서 오프라인 환경 포함 정상 동작

---

## 1-1) 현재 구현 상태 (Baseline)

> 아래는 계획 수립 기준으로 이미 구현된 코드를 정리한 것이다. Phase별 작업 시 이 기반 위에서 시작한다.

| 영역                         | 상태                                      | 파일                                                                                 |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| **커스텀 폰트 타입**         | ✅ `CustomFontAsset`                      | `packages/shared/src/utils/font.utils.ts`                                            |
| **localStorage 저장**        | ✅ `composition.custom-fonts` 키          | `packages/shared/src/utils/font.utils.ts` (`CUSTOM_FONT_STORAGE_KEY`)                |
| **@font-face CSS 생성**      | ✅ `buildCustomFontFaceCss()`             | `packages/shared/src/utils/font.utils.ts`                                            |
| **Builder DOM 적용**         | ✅                                        | `apps/builder/src/builder/fonts/customFonts.ts`                                      |
| **초기화**                   | ✅                                        | `apps/builder/src/builder/fonts/initCustomFonts.ts`                                  |
| **Publish 읽기**             | ✅ localStorage에서 읽어 적용             | `apps/publish/src/App.tsx`                                                           |
| **Skia 폰트 매니저**         | ✅ 기본 폰트만, 커스텀 미지원             | `apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`                      |
| **IndexedDB 캐싱**           | ✅ DB명 `composition-fonts`               | `apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`                      |
| **Typography UI**            | ✅ 폰트 추가 버튼 + family 입력 흐름 존재 | `apps/builder/src/builder/panels/styles/sections/TypographySection.tsx`              |
| **프로젝트 레벨 레지스트리** | ❌ 미구현                                 | —                                                                                    |
| **Export에 폰트 포함**       | ❌ 미구현                                 | `packages/shared/src/types/export.types.ts` (`ExportedProjectData`에 폰트 필드 없음) |
| **마이그레이션**             | ❌ 미구현                                 | —                                                                                    |

---

## 2) 범위(Scope)

### In Scope

- 폰트 등록/저장/삭제/목록 노출 UX
- 폰트 메타데이터 구조 정의 (family, weight/style, source, format)
- 렌더링 경로별 폰트 로드 전략 통합(Builder DOM, WebGL/Skia, Preview srcdoc, Publish)
- 정적 export 멀티파일 산출(`index.html + assets/fonts/*`) 구현
- 정적 export 멀티파일의 디렉터리 저장 플로우 구현
- `projects.font_registry` 컬럼 확장 및 마이그레이션
- 기존 localStorage 기반 커스텀 폰트 데이터의 마이그레이션

### Out of Scope (이번 라운드)

- 팀/프로젝트 단위 원격 폰트 저장소 동기화(예: Cloud Storage)
- 라이선스 스캐닝 자동화
- Variable font 고급 축(axis) 편집 UI

---

## 3) 설계 원칙

1. **단일 폰트 레지스트리**를 기준으로 모든 런타임이 읽는다.
2. **프로젝트 자산(project-asset) 중심**으로 운영하고, data URL은 임시/마이그레이션 용도로만 허용한다.
3. CSS(`@font-face`)와 Canvas/WebGL 폰트 로더 입력을 동일 메타데이터에서 파생한다.
4. 실패 시 반드시 fallback 폰트 체인으로 안전하게 렌더한다.
5. 저장 형식은 버전 필드를 포함해 점진 마이그레이션 가능해야 한다.

---

## 4) 데이터 모델 제안 (v2)

```ts
type FontSourceType = "project-asset" | "remote-url" | "data-url-temp";

interface FontFileRef {
  type: FontSourceType;
  url: string; // /assets/fonts/*.woff2 | https://... | data:...
  originalFileName?: string;
  mimeType?: string;
  byteSize?: number;
  checksum?: string;
}

interface FontFaceAsset {
  id: string;
  family: string; // 예: "Pretendard Custom"
  weight?: string; // "400", "700" 등
  style?: "normal" | "italic";
  format?: "woff2" | "woff" | "truetype" | "opentype";
  unicodeRange?: string;
  display?: "swap" | "fallback" | "block" | "optional";
  source: FontFileRef;
  createdAt: string;
  updatedAt: string;
}

interface FontRegistryV2 {
  version: 2;
  faces: FontFaceAsset[];
}
```

레거시 호환(현재 운영 데이터):

> **참고:** 아래는 현재 코드의 `CustomFontAsset` 타입(`packages/shared/src/utils/font.utils.ts`)과 동일하며,
> 마이그레이션 문맥에서 "Legacy"로 별칭한다.

```ts
// 실제 코드: CustomFontAsset (packages/shared/src/utils/font.utils.ts)
interface LegacyCustomFontAsset {
  id: string;
  family: string;
  source: string; // 현재는 data URL만 사용
  format?:
    "woff2" | "woff" | "truetype" | "opentype" | "embedded-opentype" | "svg";
}
```

---

## 5) 저장 전략 (2단계)

### Stage 1: localStorage 기반 (현재 Phase A~E 대상)

1. **정본(Source of Truth)**: localStorage (`composition.font-registry`)
2. **바이너리 캐시**: IndexedDB (`composition-fonts`) — Skia Typeface 바이너리
3. **런타임 로드**: Builder/Preview/Publish는 동일 레지스트리에서 `@font-face` 생성
4. **Export 시점**: `project-asset` 경로로 정규화 후 상대 경로로 주입

핵심:

- 기존 키(`composition.custom-fonts`)에서 새 키(`composition.font-registry`)로 `FontRegistryV2` 형식 마이그레이션
- 레거시 키는 1~2 릴리스 동안 fallback read 유지 후 삭제
- 모든 Phase(A~E)는 localStorage 기반으로 완성

### Stage 2: Cloud 연동 (향후)

- `projects.font_registry (jsonb)` 컬럼 추가
- localStorage → Cloud 동기화 레이어 추가
- Stage 1 코드의 저장/조회 인터페이스만 교체 (레지스트리 로직 재사용)

---

## 6) 마이그레이션 전략 (Legacy → v2)

1. 앱 부팅 시 `composition.font-registry` 키 유무 확인
2. 없고 `composition.custom-fonts`가 있으면 `LegacyCustomFontAsset[]` 파싱
3. 각 항목을 `FontFaceAsset`으로 변환
4. `source`가 data URL이면 `source.type = 'data-url-temp'`로 표기
5. 변환 완료 후 `composition.font-registry` 키에 `FontRegistryV2` JSON 저장
6. 기존 키는 즉시 삭제하지 않고 1~2 릴리스 동안 fallback read만 유지

---

## 7) 단계별 실행 계획

### Phase A. 레지스트리/서비스 계층 정리

- `FontRegistryV2` 타입 및 관리 모듈 신규 작성 (읽기/쓰기/검증/중복 처리/버전 마이그레이션)
  - 제안 위치: `packages/shared/src/types/font.types.ts` (타입), `packages/shared/src/utils/fontRegistry.ts` (로직)
- 기존 `buildCustomFontFaceCss()`를 레지스트리 기반으로 확장하거나 래핑
- Skia 로더 입력 생성 유틸 분리 (현재 `SkiaFontManager`는 기본 폰트만 지원)
- 파일 확장자/포맷 검증, 파일 크기 제한 정책 추가
- `ExportedProjectData`(`packages/shared/src/types/export.types.ts`)에 `fontRegistry` 필드 추가
- `projects` 스키마 확장: `font_registry (jsonb)` 컬럼 추가
  - `ProjectsApiService.ts`의 `Project` 인터페이스에 `font_registry?: FontRegistryV2` 필드 추가
  - Cloud 쿼리는 `select("*")` 패턴이라 DB 반영 후 데이터는 자동 조회됨

**산출물**

- 공용 유틸/타입
- 레지스트리 단위 테스트
- 레거시 마이그레이션 단위 테스트

### Phase B. Builder UX

> **현재 상태:** `TypographySection.tsx`에 폰트 추가 버튼과 family 입력 흐름이 이미 존재한다.
> 아래는 v2 레지스트리 연동 기준 보완 사항이다.

- ~~Typography 섹션에 `폰트 추가` 버튼 제공~~ → ✅ 이미 구현됨
- ~~별도 신규 모달/패널은 만들지 않고, 기존 Typography 컨트롤 재사용~~ → ✅ Phase C2에서 전용 Font Manager 패널 추가
- ✅ 기존 localStorage 직접 저장 → `FontRegistryV2` 기반 저장으로 전환
- ✅ 폰트 목록: 기본 폰트 + 커스텀 폰트 그룹화 표시 (현재 `DEFAULT_FONT_OPTIONS` + 커스텀 합산)
- ✅ 삭제/교체 UX 보강 — Font Manager 패널에서 face 단위 삭제
- ✅ `customFonts.ts`와 `initCustomFonts.ts`를 레지스트리 기반으로 리팩터링

**산출물**

- ✅ 스타일 패널 UI 레지스트리 연동
- 사용자 액션(추가/삭제/선택) E2E 시나리오

### Phase C. WebGL/Skia 반영

> **현재 상태:** `SkiaFontManager`(`apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`)가
> IndexedDB(`composition-fonts`) 캐싱과 `CanvasKit.Typeface.MakeFreeTypeFaceFromData()` 로드를 이미 지원하지만,
> **커스텀 폰트 등록 경로는 미구현**이다.

- `SkiaFontManager`에 레지스트리 기반 커스텀 폰트 로드 경로 추가
- 텍스트 렌더러가 레지스트리 기반 폰트를 우선 조회
- 폰트 로드 완료 이벤트 후 재측정/재렌더 트리거
- 로드 실패 시 fallback 체인 명확화

**산출물**

- `SkiaFontManager` 커스텀 폰트 통합 테스트
- 대표 컴포넌트 폰트 적용 검증 (예: Text/Button/Input/Badge/Heading)

### Phase C2. Font Manager Panel (2026-03-04 완료)

> Typography 섹션의 제한된 폰트 관리 UX를 전용 패널로 분리.

**구현 내역:**

- ✅ **FontManagerPanel** (`panels/fonts/FontManagerPanel.tsx`) — 전용 폰트 관리 패널
  - PanelHeader (Type 아이콘, "Fonts" 제목, face 카운트 배지)
  - FontUploadZone (드래그 & 드롭 + 파일 선택, `secondary-container` 배경)
  - FontFamilyGroup (패밀리별 PropertySection, weight 오름차순 정렬)
  - EmptyState (폰트 미등록 시)
- ✅ **PropertyListItem** (`components/property/PropertyListItem.tsx`) — 재사용 컴포넌트 신규
  - PropertyUnitInput DOM 구조 그대로 복제하여 기존 CSS 100% 재사용
  - `fieldset.properties-aria > .react-aria-Group > .control-label + .react-aria-UnitComboBox > .combobox-container > input[readOnly] + button(X)`
  - 향후 HistoryPanel 등에서도 재사용 가능
- ✅ **패널 시스템 등록** — PanelId `'fonts'`, 카테고리 `'tool'`, 우측 패널 배치
- ✅ **TypographySection 통합** — Type 아이콘 버튼 → `togglePanel("right", "fonts")`
- ✅ **폰트 메타데이터 추출** — OS/2 테이블 바이너리 파싱 (`parseOS2Table`)
  - `usWeightClass` → weight (100~900), `fsSelection` bit 0 → italic
  - CanvasKit `FontMgr.FromData()` → family 이름
  - TTF/OTF 직접 파싱, WOFF/WOFF2는 파일명 추론 fallback

**신규/수정 파일:**

| 파일                                                  | 변경                                                                                |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **NEW** `panels/fonts/FontManagerPanel.tsx`           | 메인 패널 (Gateway + Content)                                                       |
| **NEW** `panels/fonts/FontManagerPanel.css`           | 스타일 (upload zone, section-content grid)                                          |
| **NEW** `panels/fonts/components/FontUploadZone.tsx`  | 드래그 & 드롭 업로드                                                                |
| **NEW** `panels/fonts/components/FontFamilyGroup.tsx` | 패밀리별 그룹 (PropertySection + PropertyListItem)                                  |
| **NEW** `components/property/PropertyListItem.tsx`    | 재사용 읽기전용 목록 항목 컴포넌트                                                  |
| `panels/core/types.ts`                                | PanelId에 `'fonts'` 추가, rightPanels 등록                                          |
| `panels/core/panelConfigs.ts`                         | FontManagerPanel config 등록                                                        |
| `panels/index.ts`                                     | FontManagerPanel export                                                             |
| `components/property/index.ts`                        | PropertyListItem export                                                             |
| `components/index.ts`                                 | PropertyListItem export                                                             |
| `fonts/customFonts.ts`                                | `extractFontMetadata()` + `parseOS2Table()` + `inferWeightStyleFromFileName()` 추가 |
| `panels/styles/sections/TypographySection.tsx`        | 파일 업로드 → Font Manager 패널 열기 버튼으로 교체                                  |

### Phase D. Preview/Publish 런타임 반영

> **현재 상태:** Publish(`apps/publish/src/App.tsx`)는 localStorage에서 직접 커스텀 폰트를 읽어 적용 중이다.
> 레지스트리 전환 후에는 프로젝트 데이터 기반으로 변경해야 한다.

- Preview srcdoc 생성 시 레지스트리 기반 `@font-face` 포함
- Publish 앱 초기화 시 동일 생성기 사용해 head 주입 (localStorage 의존 제거)
- 세션 프리뷰/새 탭 프리뷰 간 레지스트리 전달 방식 통일

**산출물**

- Preview/Publish 렌더 동일성 확인

### Phase E. 정적 Export (멀티파일, 핵심)

- export 산출 형식을 멀티파일로 전환
- 기본 전략: `assets/fonts/*` 생성 + HTML/CSS에 상대 경로 연결
- export 메타에 폰트 목록과 매핑 정보 포함
- 전달 방식: **디렉터리 저장**
  - 사용자 디렉터리 선택 → `index.html`, `project.json`, `assets/fonts/*` 직접 쓰기
  - 구현 기준 API: File System Access API (`showDirectoryPicker`)

**산출물 구조 (예시)**

- `index.html`
- `project.json`
- `assets/fonts/*.woff2`
- `assets/fonts/manifest.json` (선택)

검증:

- 로컬 파일 서버에서 오프라인 상태로 폰트 정상 동작

---

## 8) 수용 기준(Acceptance Criteria)

1. 사용자 폰트 업로드 후 Typography 폰트 리스트에서 즉시 보인다.
2. 같은 요소가 Builder(WebGL/Skia), Preview, Publish에서 동일 family/weight/style로 렌더된다.
3. 정적 멀티파일 산출물을 별도 서버에 올리거나 로컬 서버에서 열어도 폰트가 깨지지 않는다.
4. 폰트 로드 실패 시 UI 깨짐 없이 fallback 폰트로 렌더된다.
5. 프로젝트 재진입 시 폰트 목록/적용 상태가 유지된다.
6. 기존 레거시 폰트(localStorage 배열) 사용 프로젝트도 자동 마이그레이션 후 정상 동작한다.
7. export 시 사용자가 선택한 디렉터리에 `index.html/project.json/assets/fonts/*`가 생성된다.

---

## 9) 테스트 계획

- 단위 테스트
  - 포맷 추론, CSS 생성, 레지스트리 merge/중복 처리
  - Legacy → v2 마이그레이션
  - export 경로 치환(`/assets/fonts/*`) 검증
- 통합 테스트
  - 스타일 패널 선택 → 요소 style 반영 → 렌더 반영
- E2E 테스트
  - 업로드 → 적용 → Preview 확인 → Publish 확인
  - 프로젝트 재진입 후 폰트 유지 확인
  - 디렉터리 저장 export 후 파일 구조/상대 경로 동작 확인
- 수동 확인
  - 정적 멀티파일 export 결과를 로컬 파일 서버에서 확인

---

## 10) 리스크 및 대응

- **리스크:** data URL 기반 기존 데이터로 인한 용량 증가
  - **대응:** 마이그레이션 후 export 단계에서 `assets/fonts`로 정규화
- **리스크:** 브라우저/Canvas 폰트 로딩 타이밍 차이
  - **대응:** 로딩 완료 신호 기반 재측정/재렌더
- **리스크:** remote URL 폰트의 CORS/가용성 문제
  - **대응:** export 시 로컬 자산으로 복제 실패하면 경고 표출 + fallback 적용
- **리스크:** 디렉터리 저장 API 브라우저 지원 편차
  - `showDirectoryPicker`는 Chromium 계열(Chrome 86+, Edge 86+) 전용, Firefox/Safari 미지원
  - **대응:** 지원 브라우저 정책 명시 + 비지원 환경 fallback (ZIP 다운로드 또는 안내 메시지)
- **리스크:** 폰트 라이선스 이슈
  - **대응:** 업로드 시 라이선스 확인 안내 문구 추가

---

## 11) 구현 순서 제안

1. 레지스트리 v2 + 마이그레이션(Phase A)
2. 스타일 패널 UX 보완(Phase B)
3. WebGL/Skia 로딩/재렌더 안정화(Phase C)
4. Preview/Publish 통합(Phase D)
5. 정적 Export 멀티파일 자산화(Phase E)

---

## 12) 관련 코드 위치 요약

| 파일                                                                    | 역할                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/shared/src/utils/font.utils.ts`                               | `CustomFontAsset` 타입, `CUSTOM_FONT_STORAGE_KEY`, `buildCustomFontFaceCss()` |
| `packages/shared/src/types/font.types.ts`                               | `FontRegistryV2`, `FontFaceAsset` 타입 정의                                   |
| `packages/shared/src/utils/fontRegistry.ts`                             | 레지스트리 CRUD (`addFontFace`, `removeFontFace`, `loadFontRegistry` 등)      |
| `apps/builder/src/builder/fonts/customFonts.ts`                         | Builder DOM 폰트 적용 + OS/2 메타데이터 추출 + 파일명 추론                    |
| `apps/builder/src/builder/fonts/initCustomFonts.ts`                     | 앱 부팅 시 폰트 초기화                                                        |
| `apps/builder/src/builder/panels/fonts/FontManagerPanel.tsx`            | Font Manager 패널 (업로드/조회/삭제)                                          |
| `apps/builder/src/builder/panels/fonts/FontManagerPanel.css`            | Font Manager 패널 스타일                                                      |
| `apps/builder/src/builder/panels/fonts/components/FontUploadZone.tsx`   | 드래그 & 드롭 폰트 업로드                                                     |
| `apps/builder/src/builder/panels/fonts/components/FontFamilyGroup.tsx`  | 패밀리별 폰트 그룹 표시                                                       |
| `apps/builder/src/builder/components/property/PropertyListItem.tsx`     | 재사용 읽기전용 목록 컴포넌트 (PropertyUnitInput 구조 복제)                   |
| `apps/builder/src/builder/panels/styles/sections/TypographySection.tsx` | Typography UI (폰트 선택 + Font Manager 패널 열기)                            |
| `apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`         | `SkiaFontManager` (IndexedDB 캐싱, Typeface 로드)                             |
| `apps/publish/src/App.tsx`                                              | Publish 앱 폰트 읽기                                                          |
| `apps/builder/src/services/api/ProjectsApiService.ts`                   | `projects` API 타입/저장 (`font_registry` 확장 대상)                          |
| `packages/shared/src/types/export.types.ts`                             | `ExportedProjectData` (폰트 필드 추가 필요)                                   |
| `packages/shared/src/utils/export.utils.ts`                             | Export 유틸리티                                                               |

---

## 13) 코드 수정 시작 전 체크리스트

- [x] 계획서 리뷰 승인
- [x] Export 산출물 포맷: 멀티파일(`assets/fonts`)로 확정
- [x] 용량 제한/허용 확장자 정책 확정 (2026-03-04)
- [x] 테스트 범위(필수 E2E 시나리오) 확정 (2026-03-04)
- [x] `SkiaFontManager` 커스텀 폰트 로드 전략 확정 (2026-03-04)
- [x] `ExportedProjectData` 스키마 변경 범위 확정 (2026-03-04)
- [x] 디렉터리 저장 API 지원 브라우저 정책 확정 (2026-03-04)
- [x] `projects.font_registry` 컬럼 마이그레이션 방식 확정 (2026-03-04)

---

## 코드 대조 검증 (2026-03-03)

### 검증 범위

실제 파일 경로와 구현 현황을 `Grep/Glob/Read`로 확인한 결과를 기록한다.

### 현재 폰트 시스템 구현 확인

#### 공유 유틸 (`packages/shared/src/utils/font.utils.ts`)

| 항목                         | 확인 결과                                  |
| ---------------------------- | ------------------------------------------ |
| `CustomFontAsset` 인터페이스 | ✅ 존재. `{ id, family, source, format? }` |
| `CUSTOM_FONT_STORAGE_KEY`    | ✅ `'composition.custom-fonts'`            |
| `buildCustomFontFaceCss()`   | ✅ 존재. `@font-face` CSS 생성             |
| `inferFontFormatFromName()`  | ✅ 존재                                    |
| `stripExtension()`           | ✅ 존재                                    |

#### Builder 폰트 모듈

| 파일                                                | 확인 결과                                                                                                                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/fonts/customFonts.ts`     | ✅ `getCustomFonts()`, `saveCustomFonts()`, `injectCustomFontStyle()`, `createCustomFontFromFile()`, `DEFAULT_FONT_FAMILY = 'Pretendard'`, `DEFAULT_FONT_OPTIONS` 포함 |
| `apps/builder/src/builder/fonts/initCustomFonts.ts` | ✅ 앱 부팅 시 localStorage에서 폰트 읽어 DOM 주입, `storage` 이벤트 + `composition:custom-fonts-updated` 이벤트 구독                                                   |

#### Skia 폰트 매니저 (`apps/builder/src/builder/workspace/canvas/skia/fontManager.ts`)

| 항목                                            | 확인 결과                                                               |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| IndexedDB 캐싱                                  | ✅ DB명 `composition-fonts`, store `fonts`                              |
| `SkiaFontManager.loadFont(family, url)`         | ✅ URL 기반 폰트 로드 (네트워크 fetch + IndexedDB 캐시)                 |
| `CanvasKit.Typeface.MakeFreeTypeFaceFromData()` | ✅ 사용 중                                                              |
| 커스텀 폰트 레지스트리 연동                     | ❌ 미구현 — URL 직접 전달 방식만 지원, `CustomFontAsset` 배열 연동 없음 |

#### Publish 앱 (`apps/publish/src/App.tsx`)

| 항목                      | 확인 결과                                                             |
| ------------------------- | --------------------------------------------------------------------- |
| localStorage 직접 읽기    | ✅ `localStorage.getItem(CUSTOM_FONT_STORAGE_KEY)` — 문서 내용과 일치 |
| 프로젝트 데이터 기반 전환 | ❌ 미구현                                                             |

#### 프로젝트 레벨 레지스트리

| 항목                                                                         | 확인 결과                  |
| ---------------------------------------------------------------------------- | -------------------------- |
| `apps/builder/src/services/api/ProjectsApiService.ts`에 `font_registry` 필드 | ❌ 미구현 — grep 결과 없음 |
| `packages/shared/src/types/export.types.ts`에 `fontRegistry` 필드            | ❌ 미구현 — grep 결과 없음 |

### Phase별 전제 조건 현황

| Phase   | 설명                        | 전제 조건 현황                                                                             |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------ |
| Phase A | 레지스트리/서비스 계층 정리 | 기반 타입(`CustomFontAsset`)은 존재. `FontRegistryV2` 신규 작성 필요                       |
| Phase B | Builder UX 보완             | `TypographySection.tsx` 폰트 추가 UI 이미 구현됨 (✅). localStorage → 레지스트리 전환 필요 |
| Phase C | WebGL/Skia 반영             | `SkiaFontManager`는 구현됨(✅). 커스텀 폰트 레지스트리 연동 경로 추가 필요(❌)             |
| Phase D | Preview/Publish 런타임 반영 | Publish는 localStorage 직접 읽기(✅ 동작하나 레거시 방식). 전환 필요                       |
| Phase E | 정적 Export 멀티파일        | `ExportedProjectData`에 폰트 필드 없음(❌). 전체 구현 필요                                 |

### 파일 경로 정확성

문서의 모든 파일 경로(`apps/builder/src/...`, `packages/shared/src/...`)는 실제 경로와 일치한다.

### 1-1 Baseline 표 갱신 사항

문서의 Baseline 표(section 1-1)는 현재 코드와 일치함을 확인하였다.

- `packages/shared/src/utils/font.utils.ts` — ✅ 일치
- `apps/builder/src/builder/fonts/customFonts.ts` — ✅ 일치. 단, 파일 내에 `DEFAULT_FONT_FAMILY`, `DEFAULT_FONT_OPTIONS`도 포함됨 (문서에 미기재)
- `apps/builder/src/builder/workspace/canvas/skia/fontManager.ts` — ✅ IndexedDB 캐싱 구현 일치. 커스텀 폰트 미지원 확인

### Status 판단

**Partial 승격 (2026-03-04)**. Phase A+B+C+C2가 완료되었다.

- ✅ Phase A: FontRegistryV2 타입 + CRUD + 마이그레이션 + CSS 생성 (`fontRegistry.ts`, `font.types.ts`)
- ✅ Phase B: Builder UX 레지스트리 연동 (`customFonts.ts`, `initCustomFonts.ts`, `TypographySection.tsx`, `previewSrcdoc.ts`)
- ✅ Phase C: Skia `loadFontFromBuffer()` 구현 완료
- ✅ Phase C2: Font Manager Panel 구현 완료 (전용 패널 + PropertyListItem 재사용 컴포넌트 + OS/2 메타데이터 추출)
- ✅ Phase D: Publish 앱 레지스트리 전환 완료
- ✅ Phase E: 정적 Export 멀티파일 완료 (showDirectoryPicker + JSZip fallback)

---

## 14) 체크리스트 확정 내역 (2026-03-04)

### 14-1. 용량 제한/허용 확장자 정책

| 항목                        | 확정 내용                                                               |
| --------------------------- | ----------------------------------------------------------------------- |
| **허용 확장자**             | `.woff2` (권장), `.woff`, `.ttf`, `.otf` — 4종                          |
| **제외 확장자**             | `.eot` (IE 전용 레거시), `.svg` (비효율, 보안 위험)                     |
| **파일 크기 제한**          | 파일당 **5MB** (`EXPORT_LIMITS.MAX_FILE_SIZE` 10MB의 절반)              |
| **MIME 타입 검증**          | `font/woff2`, `font/woff`, `font/ttf`, `font/otf`, `application/font-*` |
| **프로젝트당 최대 폰트 수** | **20개** (face 단위, 같은 family 다른 weight 각각 1개)                  |
| **검증 시점**               | `createCustomFontFromFile()` 진입 직후 (Phase A에서 구현)               |

**근거**: 현재 `TypographySection.tsx`의 `accept=".woff,.woff2,.ttf,.otf,.eot,.svg"` → `.eot`/`.svg` 제거. 파일 크기 검증은 현재 미구현(❌)이므로 Phase A에서 추가.

### 14-2. 테스트 범위 (필수 시나리오)

**단위 테스트 (Phase A)**:

1. `FontRegistryV2` CRUD (추가/삭제/중복 검출/버전 검증)
2. `LegacyCustomFontAsset[]` → `FontRegistryV2` 마이그레이션 변환
3. `buildCustomFontFaceCss()` v2 레지스트리 입력 지원
4. 파일 크기/확장자/MIME 검증 거부 케이스

**통합 테스트 (Phase B~C)**: 5. Typography 패널 → 폰트 추가 → 레지스트리 저장 → 폰트 목록 갱신 6. `SkiaFontManager` 커스텀 폰트 로드 → 텍스트 렌더링 반영

**E2E 테스트 (Phase D~E)**: 7. 업로드 → Builder 적용 → Preview iframe 동일 렌더 확인 8. 프로젝트 재진입 → 폰트 목록/적용 상태 유지 확인 9. Export 멀티파일 → `assets/fonts/` 생성 + 오프라인 동작 확인

### 14-3. SkiaFontManager 커스텀 폰트 로드 전략

**현황**: `loadFont(family, url)` — HTTP(S) URL `fetch()`만 지원. data URL `fetch()` 불가.

**확정 전략: `loadFontFromBuffer()` 메서드 추가**

```
기존: loadFont(family, url) → fetch(url) → ArrayBuffer → Typeface
추가: loadFontFromBuffer(family, buffer) → 직접 ArrayBuffer → Typeface
```

| source.type     | 로드 경로                   | 메서드                                      |
| --------------- | --------------------------- | ------------------------------------------- |
| `project-asset` | 상대 URL fetch              | `loadFont(family, url)` (기존)              |
| `remote-url`    | 외부 URL fetch              | `loadFont(family, url)` (기존)              |
| `data-url-temp` | base64 디코딩 → ArrayBuffer | `loadFontFromBuffer(family, buffer)` (신규) |

**레지스트리 연동 흐름 (Phase C)**:

1. `FontRegistryV2.faces` 순회
2. `source.type`에 따라 분기
3. data-url-temp → `atob()` + `Uint8Array` → `loadFontFromBuffer()`
4. 나머지 → `loadFont(family, source.url)`
5. 전체 완료 후 `window.dispatchEvent(new CustomEvent('composition:fonts-ready'))` 발생
6. `BuilderCanvas.tsx`의 기존 `composition:fonts-ready` 핸들러가 `invalidateLayout()` 호출

### 14-4. ExportedProjectData 스키마 변경 범위

```ts
// packages/shared/src/types/export.types.ts
export interface ExportedProjectData {
  version: string;
  exportedAt: string;
  project: { id: string; name: string };
  pages: Page[];
  elements: Element[];
  currentPageId?: string | null;
  metadata?: ProjectMetadata;
  fontRegistry?: FontRegistryV2; // ← 추가 (optional, 하위 호환)
}
```

- **Optional 필드**: 기존 export 데이터와 하위 호환 유지
- **Import 시**: `fontRegistry` 있으면 레지스트리 복원, 없으면 스킵
- **Export 시**: 레지스트리가 비어있으면 필드 자체 생략 (`undefined`)
- **EXPORT_LIMITS 추가**: `MAX_FONT_REGISTRY_SIZE: 50 * 1024 * 1024` (50MB — 폰트 바이너리 포함)

### 14-5. 디렉터리 저장 API 지원 브라우저 정책

| 브라우저   | `showDirectoryPicker` | 정책                       |
| ---------- | --------------------- | -------------------------- |
| Chrome 86+ | ✅                    | 1순위 (멀티파일 직접 저장) |
| Edge 86+   | ✅                    | 1순위                      |
| Firefox    | ❌                    | ZIP 다운로드 fallback      |
| Safari     | ❌                    | ZIP 다운로드 fallback      |

**구현**:

```ts
async function exportProject(data: ExportData): Promise<void> {
  if ("showDirectoryPicker" in window) {
    await exportToDirectory(data); // File System Access API
  } else {
    await exportAsZip(data); // JSZip → Blob → <a download>
  }
}
```

**JSZip 의존성**: Phase E에서 `pnpm add jszip` (번들 ~45KB gzip). Export 전용이므로 동적 import로 초기 번들 미포함.

### 14-6. projects.font_registry 컬럼 마이그레이션 방식

**DB 마이그레이션 (Cloud 콘솔)**:

```sql
ALTER TABLE projects
ADD COLUMN font_registry jsonb DEFAULT NULL;

COMMENT ON COLUMN projects.font_registry IS 'FontRegistryV2 JSON — 프로젝트 폰트 메타데이터';
```

**영향 분석**:

- `nullable jsonb` → 기존 row 영향 없음 (`NULL`)
- `select("*")` 패턴 → 쿼리 변경 불필요
- RLS: 기존 `projects` 테이블 RLS 정책 자동 적용 (컬럼 레벨 RLS 불필요)

**타입 확장**:

```ts
// ProjectsApiService.ts
export interface Project {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  font_registry?: FontRegistryV2 | null; // ← 추가
}
```

**저장/조회**:

- 저장: `updateProject(id, { font_registry: registryV2 })`
- 조회: `project.font_registry ?? { version: 2, faces: [] }`
- 캐시 무효화: 기존 `updateProject` 로직이 자동 처리

---

## 15) Gates (잔존 HIGH 위험 관리)

| Gate                              | 시점            | 조건                                                                                        | 실패 시 대안                                                                        |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **G1: localStorage 마이그레이션** | Phase A 완료 시 | 레거시 `composition.custom-fonts` → `composition.font-registry` 변환 후 기존 폰트 정상 동작 | 마이그레이션 스킵, 레거시 키 직접 읽기 유지                                         |
| **G2: Skia 폰트 로딩 타이밍**     | Phase C 완료 시 | Builder Canvas에서 커스텀 폰트 텍스트가 1초 내 정상 렌더 + fallback 없이 표시               | `composition:fonts-ready` 이벤트 대기 + `invalidateLayout()` 재호출 루프 (최대 3회) |
| **G3: Export 브라우저 호환**      | Phase E 완료 시 | Chrome + fallback(ZIP) 양쪽에서 폰트 파일 포함 확인                                         | ZIP 전용으로 단순화 (showDirectoryPicker 제거)                                      |

### G1 상세: localStorage 마이그레이션 안전성

**위험**: 레거시 data URL 폰트가 `FontRegistryV2`로 변환 시 데이터 손실 또는 형식 오류.

**Gate 통과 조건**:

1. 레거시 `CustomFontAsset[]` → `FontRegistryV2` 변환 후 폰트 수 일치
2. 변환 후 `buildCustomFontFaceCss()` 출력이 레거시와 동일
3. 새 키(`composition.font-registry`) 저장/조회 왕복 일치

**실패 시**: 마이그레이션 로직 롤백, 레거시 키(`composition.custom-fonts`) 직접 읽기 유지.

> **Cloud 연동 (Stage 2 Gate)**: 향후 `projects.font_registry` 컬럼 추가 시 별도 Gate 정의. 현재 Phase A~E는 localStorage 전용.

### G2 상세: Skia 폰트 로딩 타이밍

**위험**: DOM `@font-face` 로드와 Skia `Typeface.MakeFreeTypeFaceFromData()` 완료 시점 차이로 텍스트 깜빡임 또는 폴백 폰트 고착.

**Gate 통과 조건**:

1. 커스텀 폰트 적용 요소가 Builder Canvas에서 1초 내 정상 렌더
2. `composition:fonts-ready` 이벤트 → `invalidateLayout()` → 재측정/재렌더 정상 동작
3. 폰트 로드 실패 시 Pretendard fallback으로 graceful degradation

**실패 시**: Skia 폰트 로드를 비동기 큐잉으로 전환 + `requestAnimationFrame` 기반 점진 렌더.
