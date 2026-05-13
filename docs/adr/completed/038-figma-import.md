# ADR-038: Figma 디자인 임포트 시스템

> **상태**: Proposed
> **날짜**: 2026-03-13
> **작성자**: Claude Code

---

## 1. 컨텍스트

composition는 노코드 웹 빌더로, 현재 모든 디자인을 자체 에디터에서 직접 구성해야 한다. Figma에는 수천 개의 커뮤니티 UI Kit, 컴포넌트 라이브러리, 실무 디자인 파일이 존재하며, 이를 composition로 가져와 활용할 수 있다면 사용자의 디자인 시작점이 크게 향상된다.

### 현재 상태

- `apps/builder/src/types/theme/figma.types.ts`에 **디자인 토큰 동기화용 타입**만 존재
- 실제 API 호출, 노드 변환, UI 등 구현 코드 없음
- Pencil(.pen) 파일 구조와 높은 유사성 확인 (트리 기반 노드, component/instance, descendants 동일 개념)

### 동기

- Figma 커뮤니티의 다양한 컴포넌트 디자인과 레이아웃을 composition에서 즉시 활용
- 디자인 → 개발 워크플로우에서 수동 재구성 시간 제거
- 기존 Figma 디자인 자산을 composition 프로젝트로 마이그레이션

---

## 2. Figma ↔ composition 구조 매핑 분석

### 2.1 Node Type 매핑

| Figma Node Type     | composition Tag             | 변환 전략                        | 비고                              |
| ------------------- | --------------------------- | -------------------------------- | --------------------------------- |
| `DOCUMENT`          | (무시)                      | 최상위 래퍼                      |                                   |
| `CANVAS`            | Page + Body                 | 페이지 생성                      | Figma 캔버스 = composition 페이지 |
| `FRAME`             | `div` (flex/block)          | Auto Layout → flex, 일반 → block | **핵심 변환**                     |
| `GROUP`             | `Group`                     | 자식 유지                        |                                   |
| `RECTANGLE`         | `div`                       | fills/strokes → style            | 장식용 박스                       |
| `ELLIPSE`           | `div` + borderRadius 50%    | 근사 변환                        | 원형만 정확                       |
| `LINE`              | `Separator` or `div`        | 수평선 → Separator               |                                   |
| `VECTOR`            | `Icon` or SVG Image         | 단순 → Icon, 복잡 → SVG/PNG      |                                   |
| `TEXT`              | `Text` / `Heading`          | fontSize 기반 추론               |                                   |
| `COMPONENT`         | `componentRole: "master"`   | 하위 트리 포함                   |                                   |
| `COMPONENT_SET`     | 다중 master (variant별)     | variant prop 분류                | 복잡도 높음                       |
| `INSTANCE`          | `componentRole: "instance"` | masterId + overrides             |                                   |
| `BOOLEAN_OPERATION` | `div` + SVG/Image           | flatten → rasterize              | 정확 변환 불가                    |
| `SECTION`           | `Section`                   | 직접 매핑                        |                                   |
| `STICKY/CONNECTOR`  | (무시)                      | FigJam 전용                      |                                   |

### 2.2 Auto Layout → Flex Layout

| Figma Property                    | composition CSS                        | 변환 규칙                                                                |
| --------------------------------- | -------------------------------------- | ------------------------------------------------------------------------ |
| `layoutMode: "HORIZONTAL"`        | `display: flex; flexDirection: row`    | 직접 매핑                                                                |
| `layoutMode: "VERTICAL"`          | `display: flex; flexDirection: column` | 직접 매핑                                                                |
| `layoutMode: "NONE"`              | `display: block` or 절대 배치          | 자식 위치 기반 판단                                                      |
| `primaryAxisAlignItems`           | `justifyContent`                       | MIN→flex-start, CENTER→center, MAX→flex-end, SPACE_BETWEEN→space-between |
| `counterAxisAlignItems`           | `alignItems`                           | MIN→flex-start, CENTER→center, MAX→flex-end, BASELINE→baseline           |
| `layoutWrap: "WRAP"`              | `flexWrap: wrap`                       | 직접 매핑                                                                |
| `itemSpacing`                     | `gap`                                  | 직접 매핑 (px)                                                           |
| `counterAxisSpacing`              | `rowGap` / `columnGap`                 | wrap 시 cross-axis gap                                                   |
| `paddingTop/Right/Bottom/Left`    | `padding-*`                            | 직접 매핑                                                                |
| `layoutAlign: "STRETCH"` (자식)   | `alignSelf: stretch`                   | cross-axis                                                               |
| `layoutGrow: 1` (자식)            | `flexGrow: 1`                          | main-axis 확장                                                           |
| `layoutSizingHorizontal: "FIXED"` | `width: Npx`                           | 고정                                                                     |
| `layoutSizingHorizontal: "HUG"`   | `width: fit-content`                   | 콘텐츠 기반                                                              |
| `layoutSizingHorizontal: "FILL"`  | `flexGrow: 1` or `width: 100%`         | 부모 채우기                                                              |

### 2.3 시각적 속성 매핑

#### Fills → Background

| Figma Fill         | composition Style                       | 비고                           |
| ------------------ | --------------------------------------- | ------------------------------ |
| `SOLID`            | `backgroundColor: rgba(...)`            | 직접 매핑                      |
| `GRADIENT_LINEAR`  | `backgroundImage: linear-gradient(...)` | 지원                           |
| `GRADIENT_RADIAL`  | `backgroundImage: radial-gradient(...)` | 지원                           |
| `GRADIENT_ANGULAR` | **미지원**                              | conic-gradient 미구현          |
| `GRADIENT_DIAMOND` | **미지원**                              | CSS 대응 없음                  |
| `IMAGE`            | `backgroundImage: url(...)`             | 이미지 다운로드+호스팅 필요    |
| 다중 fill (레이어) | 첫 번째만 적용                          | CSS multiple background 미지원 |

#### Strokes → Border

| Figma Stroke              | composition Style     | 비고             |
| ------------------------- | --------------------- | ---------------- |
| `strokeWeight`            | `borderWidth`         | 직접 매핑        |
| `strokes[0].color`        | `borderColor`         | 첫 번째 stroke만 |
| `strokeAlign: "INSIDE"`   | 기본 border-box       | 유사             |
| `strokeAlign: "OUTSIDE"`  | `outline` 근사        | 정확 대응 어려움 |
| `strokeDashes`            | `borderStyle: dashed` | 패턴 상세 손실   |
| `individualStrokeWeights` | `borderTopWidth` 등   | 개별 변 지원     |

#### Effects → Visual

| Figma Effect      | composition Style  | 비고                   |
| ----------------- | ------------------ | ---------------------- |
| `DROP_SHADOW`     | `boxShadow`        | 직접 매핑              |
| `INNER_SHADOW`    | `boxShadow: inset` | 직접 매핑              |
| `LAYER_BLUR`      | **미지원**         | filter 미구현          |
| `BACKGROUND_BLUR` | **미지원**         | backdrop-filter 미구현 |

#### Text → Typography

| Figma Text               | composition Style          | 비고                         |
| ------------------------ | -------------------------- | ---------------------------- |
| `fontFamily`             | `fontFamily`               | Google Fonts 매칭 필요       |
| `fontWeight`             | `fontWeight`               | 100~900 직접                 |
| `fontSize`               | `fontSize` (px)            | 직접                         |
| `lineHeight` (PIXELS)    | `lineHeight` (px)          | 직접                         |
| `lineHeight` (PERCENT)   | `lineHeight` (비율)        | value/100 변환               |
| `letterSpacing` (PIXELS) | `letterSpacing` (px)       | 직접                         |
| `textAlignHorizontal`    | `textAlign`                | LEFT/CENTER/RIGHT/JUSTIFIED  |
| `textCase: UPPER`        | `textTransform: uppercase` | 직접                         |
| `textDecoration`         | `textDecoration`           | 직접                         |
| Mixed text styles        | **미지원**                 | composition Text 단일 스타일 |

#### Constraints → Positioning

| Figma Constraint       | composition Style                   | 비고             |
| ---------------------- | ----------------------------------- | ---------------- |
| `LEFT` + `TOP`         | `position: absolute; left; top`     | 기본             |
| `RIGHT` + `BOTTOM`     | `position: absolute; right; bottom` | 반대편 앵커      |
| `LEFT_RIGHT` (stretch) | `width: 100%` or `left + right`     | 반응형           |
| `CENTER`               | `margin: 0 auto` or flex center     | 근사             |
| `SCALE`                | **미지원**                          | 고정 크기로 대체 |

### 2.4 Component/Instance 매핑

| Figma              | composition                              | 비고                            |
| ------------------ | ---------------------------------------- | ------------------------------- |
| `COMPONENT`        | `componentRole: "master"`                | 하위 트리 전체 포함             |
| `COMPONENT_SET`    | 다중 master (variant별)                  | variant prop 분류               |
| `INSTANCE`         | `componentRole: "instance"` + `masterId` | master 참조                     |
| Instance overrides | `overrides` + `descendants`              | 구조 유사 (배열→객체 변환 필요) |

---

## 3. 변환 가능 범위 요약

### 직접 매핑 (~65%)

- Frame + Auto Layout → flex 컨테이너
- 고정 크기/위치 요소
- 단색 배경/테두리/borderRadius
- 기본 텍스트 스타일
- Drop Shadow → boxShadow
- Opacity, Padding, Gap
- Linear/Radial Gradient

### 근사 변환 (~20%)

- Constraints → CSS positioning (SCALE 제외)
- Ellipse → borderRadius 50%
- Component/Instance → master/instance (중첩 제한)
- Mixed fills (첫 번째만)
- Stroke align OUTSIDE → outline 근사
- Text Auto Resize → sizing keywords

### 손실 (~15%)

| 손실 항목                | 이유                          | 대안                               |
| ------------------------ | ----------------------------- | ---------------------------------- |
| Vector/Boolean Operation | SVG→CSS 불가                  | Figma Image Export API로 rasterize |
| Layer/Background Blur    | filter/backdrop-filter 미구현 | 향후 지원 시 복구                  |
| Angular/Diamond Gradient | conic-gradient 미구현         | linear-gradient 근사 또는 이미지화 |
| 다중 Fill 레이어         | multiple background 미구현    | 최상위만 적용                      |
| Mixed Text Styles        | 단일 스타일 모델              | 스타일별 Text 분리                 |
| Prototyping (인터랙션)   | 모델 차이                     | 무시                               |
| Video Fill               | 미지원                        | 스킵                               |
| 복잡 Mask/Clip           | clipPath 제한적               | 사각형만 가능                      |

---

## 4. 구현 계획

### Phase 1: Core Structure (MVP)

**목표**: Figma 레이아웃 골격을 composition에서 재현

| 항목                        | 설명                                                     |
| --------------------------- | -------------------------------------------------------- |
| Figma REST API 타입         | 전체 노드 프로퍼티 타입 정의 (Frame, Text, Rectangle 등) |
| API 프록시                  | Supabase Edge Function — CORS 해결 + PAT 인증            |
| Frame/Group/Rectangle → div | Auto Layout → flex, 일반 → block/absolute                |
| Text → Text/Heading         | 기본 텍스트 스타일 매핑                                  |
| Solid Fill/Stroke           | backgroundColor, borderWidth, borderColor, borderRadius  |
| 고정 크기/위치              | width, height, x, y → CSS                                |
| 트리 → 플랫 변환            | Figma children[] → parent_id + order_num                 |
| Import UI                   | 파일 URL 입력 → 노드 선택 → 변환 진행률                  |

**예상 커버리지**: ~60%

### Phase 2: Visual Fidelity

**목표**: 시각적 완성도 향상

| 항목                   | 설명                                         |
| ---------------------- | -------------------------------------------- |
| Linear/Radial Gradient | gradient stops → CSS gradient                |
| Drop/Inner Shadow      | boxShadow 변환                               |
| 이미지 fill            | 다운로드 → Supabase Storage → Image 태그     |
| Ellipse                | borderRadius 50%                             |
| 개별 변 border         | individualStrokeWeights                      |
| Text 고급 스타일       | letterSpacing, textDecoration, textTransform |
| Constraints            | 기본 앵커 → CSS positioning                  |
| Opacity                | 직접 매핑                                    |

**예상 커버리지**: ~80%

### Phase 3: Component System

**목표**: Figma 컴포넌트 재사용 체계 변환

| 항목                | 설명                                                                |
| ------------------- | ------------------------------------------------------------------- |
| COMPONENT → master  | 하위 트리 포함 master Element 생성                                  |
| INSTANCE → instance | masterId 연결 + overrides 추출                                      |
| COMPONENT_SET       | variant별 master 분류                                               |
| Smart Mapping       | Figma 컴포넌트 이름/구조 → composition 태그 추론 (Button, Input 등) |
| Override 매핑       | overriddenFields → overrides/descendants                            |

**예상 커버리지**: ~90%

### Phase 4: Edge Cases & Polish

**목표**: 나머지 변환 + UX 개선

| 항목               | 설명                                                      |
| ------------------ | --------------------------------------------------------- |
| Vector → SVG/Image | Figma Image Export API rasterization                      |
| Mixed text styles  | 스타일 구간 분할 → 다중 Text                              |
| 폰트 매핑          | Figma 폰트 → Google Fonts 자동 매칭 (FontRegistryV2 연동) |
| 충돌 해결 UI       | 이름 충돌 시 skip/overwrite/rename                        |
| 증분 업데이트      | 재 import 시 변경분만 적용                                |
| 반응형 추론        | Constraints + Auto Layout → 반응형 패턴                   |

---

## 5. 아키텍처 결정

### 5.1 변환 위치: 하이브리드 (프록시 + 클라이언트)

```
┌──────────┐     ┌───────────────────┐     ┌──────────────┐
│  Builder │────▶│ Supabase Edge Fn  │────▶│  Figma API   │
│  (React) │     │ (API 프록시)       │     │  REST v1     │
│          │◀────│ + 이미지 다운로드   │◀────│              │
└──────────┘     └───────────────────┘     └──────────────┘
     │
     ▼ 클라이언트 사이드 변환
┌──────────────────────────────────────┐
│  FigmaConverter                      │
│  ├─ traverseNodes()     — DFS 순회   │
│  ├─ convertNode()       — 노드 변환  │
│  ├─ convertStyle()      — 스타일 변환 │
│  ├─ convertLayout()     — 레이아웃    │
│  ├─ convertComponent()  — 컴포넌트    │
│  └─ flattenTree()       — 플랫 변환   │
└──────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────┐
│  composition Store                       │
│  addElements() → 파이프라인 실행      │
│  (Memory → Index → History → DB)     │
└──────────────────────────────────────┘
```

**이유**:

- Figma API 호출: CORS 제약 → Edge Function 프록시 필수
- 노드 변환: 클라이언트 사이드 — Store 직접 접근, 진행률 UI 즉시 반영
- 이미지 처리: Edge Function에서 다운로드 → Storage 업로드 (클라이언트 CORS 우회)

### 5.2 대규모 파일 대응

- Worker thread에서 변환 수행 (메인 스레드 블로킹 방지)
- 1000+ 노드 파일: 배치 단위 변환 + 진행률 표시
- Figma API `depth` 파라미터로 필요한 깊이만 fetch

### 5.3 파일 구조

```
apps/builder/src/services/figma/
├── figmaApiTypes.ts        — Figma REST API 전체 노드 타입
├── figmaApiClient.ts       — API 호출 (Edge Function 경유)
├── figmaConverter.ts       — 노드 → Element 변환 엔진
├── figmaStyleConverter.ts  — 스타일 속성 변환
├── figmaLayoutConverter.ts — Auto Layout → flex 변환
├── figmaComponentMapper.ts — Component/Instance 변환
├── figmaImageHandler.ts    — 이미지 fill 처리
└── figmaImportStore.ts     — Import 상태 관리 (Zustand)

apps/builder/src/builder/panels/figma/
├── FigmaImportPanel.tsx    — Import UI 패널
├── FigmaNodePicker.tsx     — 노드 선택 트리
└── FigmaImportProgress.tsx — 진행률 표시
```

---

## 6. 리스크 및 대응

| 리스크                | 영향                    | 대응                                     |
| --------------------- | ----------------------- | ---------------------------------------- |
| Figma API Rate Limit  | 대규모 파일 import 실패 | 배치 요청 + 재시도 로직 + 캐싱           |
| 이미지 자산 처리 시간 | Import 지연             | 비동기 처리 + placeholder 표시           |
| 복잡한 컴포넌트 변환  | 중첩 instance 손실      | flatten 옵션 제공 (instance → 독립 요소) |
| 폰트 미사용 가능      | 텍스트 레이아웃 불일치  | Google Fonts 자동 매칭 + fallback 지정   |
| 대규모 노드 트리      | 메인 스레드 블로킹      | Web Worker 변환                          |
| Figma API 스키마 변경 | 변환 실패               | 버전 체크 + graceful degradation         |

---

## 7. Pencil(.pen) 파일과의 호환성 참고

Pencil 파일도 동일한 변환 파이프라인 구조를 공유할 수 있다:

| 개념       | Figma       | Pencil             | composition               |
| ---------- | ----------- | ------------------ | ------------------------- |
| 컨테이너   | FRAME       | frame              | div (flex)                |
| 텍스트     | TEXT        | text               | Text                      |
| 컴포넌트   | COMPONENT   | reusable: true     | componentRole: "master"   |
| 인스턴스   | INSTANCE    | type: "ref"        | componentRole: "instance" |
| 오버라이드 | overrides[] | descendants{}      | descendants{}             |
| 레이아웃   | Auto Layout | layout: "vertical" | display: flex             |
| 변수       | Variables   | $variable          | variableBindings          |

Pencil은 `descendants` 구조가 composition와 동일하므로 변환이 더 직접적이다. 향후 `ImportConverter` 인터페이스를 추상화하여 Figma/Pencil 양쪽 소스를 지원할 수 있다.

---

## 8. 성공 지표

| 지표                   | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
| ---------------------- | ------- | ------- | ------- | ------- |
| 구조 재현율            | 60%     | 80%     | 90%     | 95%+    |
| 시각적 재현율          | 40%     | 75%     | 85%     | 90%+    |
| 컴포넌트 활용율        | 0%      | 0%      | 70%     | 85%+    |
| Import 시간 (100노드)  | < 5초   | < 10초  | < 15초  | < 15초  |
| Import 시간 (1000노드) | < 30초  | < 60초  | < 90초  | < 90초  |
