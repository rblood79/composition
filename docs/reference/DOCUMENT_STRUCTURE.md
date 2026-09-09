# docs 디렉토리 구조 가이드

> **최종 검증**: 2026-09-09
> **검증 방법**: 파일시스템 실측 (`find` / `ls` 로 디렉터리별 `.md` 개수와 전체 파일 수를 직접 셈). 아래 숫자는 전부 이 시점의 실측값이며, 추정치는 없습니다.

이 문서는 `docs/` 디렉토리의 구조와 각 하위 디렉토리의 목적을 설명합니다.

- `docs/` 전체 `.md` 파일: **827개**
- `docs/` 최상위 `.md` 파일: **9개**
- `docs/` 직속 하위 디렉터리: **12개** (`adr` `audit` `bug` `explanation` `features` `how-to` `legacy` `migrations` `pencil-copy` `pencil-extracted` `reference` `tutorials`)

---

## 📁 디렉토리 구조

```
docs/
├── adr/                        # Architecture Decision Records — 직속 md 13 (README 1 + 진행 중/미구현 ADR 12)
│   ├── completed/              # 완료된 ADR (229개)
│   ├── design/                 # ADR 상세 구현 breakdown (SSOT) — md 255 (그중 *-breakdown.md 174) + JSON 3
│   │   └── completed/          # 완료된 ADR 의 breakdown (10개)
│   ├── evidence/               # 실행 근거 (측정 로그·스크린샷) — md 48 + PNG 1, 하위 디렉터리 3
│   │   ├── 203-g1-final/       # 비-md 산출물 10 파일
│   │   ├── 203-phase1/         # 비-md 산출물 23 파일
│   │   └── 203-phase3/         # 비-md 산출물 8 파일
│   └── reviews/                # ADR 리뷰 기록 Layer 0 (md 105 = README 1 + 리뷰 104)
│
├── features/                   # 기능별 상세 문서 — 직속 md 0 (하위 디렉터리만)
│   └── completed/              # 완료된 기능 문서 (md 21 = README 1 + 문서 20)
│
├── reference/                  # 참조 문서 — 직속 md 2 (WORKFLOW.md · adr-912-prop-parity-audit.md)
│   ├── api/                    # API 문서 (1개)
│   ├── architecture/           # 아키텍처 참조 (4개 — MONOREPO / MULTIPAGE / STRUCTURE_HOOKS / STRUCTURE_STORE)
│   ├── audits/                 # 날짜 붙은 감사 보고서 (12개, 2026-05-17 ~ 08-21)
│   ├── components/             # 컴포넌트 참조 문서 (진행 중/계획, 13개)
│   ├── schemas/                # 스키마 문서 (3개 — INDEXDB / SUPABASE / ADR_REVIEW_LAYER0)
│   └── status/                 # 상태별 문서 (6개 — COMPLETED / PLANNED / UNIMPLEMENTED / DB_COMPATIBILITY / STYLE_SYSTEM / REACT_ARIA_1.13)
│
├── explanation/                # 설명 및 분석 문서 — 직속 md 0 (하위 디렉터리만)
│   ├── architecture/           # 아키텍처 설명 (3개)
│   └── research/               # 리서치·외부 대조 문서 (28개)
│
├── how-to/                     # 실용 가이드 — 직속 md 0 (하위 디렉터리만)
│   ├── development/            # 개발 가이드 (10개)
│   ├── migration/              # 마이그레이션 가이드 (1개)
│   └── troubleshooting/        # 문제 해결 (1개)
│
├── tutorials/                  # 학습 중심 실습 가이드 — 직속 md 0 (하위 디렉터리만)
│   └── features/               # 기능 튜토리얼 (1개 — TREE_COMPONENT.md)
│
├── migrations/                 # DB 마이그레이션 SQL + 성능·부팅 조사 노트 — md 8 + SQL 2 + JSON 3
│   └── evidence/               # 측정 산출물 (직속 파일 0, 하위 디렉터리 3, 전체 539 파일 / md 5)
│
├── legacy/                     # 역사적 참조를 위한 레거시 문서 (md 25 = README 1 + 문서 24)
├── audit/                      # 단발 감사 보고서 (1개 — component-audit-report.md)
├── bug/                        # 개별 버그 조사 노트 (2개)
├── pencil-copy/                # Pencil 포맷·슬롯 모델 분석 (md 8 = README 1 + 문서 7) + fixtures/ JSON 1
├── pencil-extracted/           # Pencil Desktop 앱 번들 역공학 추출물 (전체 390 파일, md 2)
│
├── CHANGELOG.md                    # 현재 변경 이력 (2026-09-01 ~ 09-09, 97 엔트리, 148KB)
├── CHANGELOG-2026-Q3-archived.md   # 2026-07-01 ~ 08-31 (346 엔트리, 968KB, append-only)
├── CHANGELOG-2026-H1-archived.md   # 2026-02-22 ~ 06-30 (209 엔트리, 872KB, append-only)
├── CHANGELOG-2025-archived.md      # 2025-10-27 ~ 2026-03-27 (124 항목, 252KB, append-only)
├── COMPONENT_SPEC.md               # 컴포넌트 스펙 참조 (349KB)
├── CSS_SUPPORT_MATRIX.md           # CSS 지원 매트릭스 (132KB)
├── COLOR_PICKER.md                 # Color Picker + Fill 시스템 설계 (49KB)
├── DOCUMENT_STRUCTURE.md           # 이 문서
└── README.md                       # 문서 메인 인덱스
```

---

## 📚 문서 타입별 가이드

### ADR (Architecture Decision Records)

**위치**: `docs/adr/`

- **`adr/*.md`** (13개): `README.md` 1개 + 진행 중/미구현 ADR 12개 (013 · 027 · 150 · 152 · 162 · 201 · 202 · 208 · 910 · 911 · 921 · react-skia-zustand-frame-performance-design)
- **`adr/completed/`** (229개): 구현 완료된 ADR (수정 금지)
- **`adr/design/`** (md 255): 상세 구현 breakdown 의 SSOT. 이 중 `*-breakdown.md` 가 174개이고 나머지 81개는 inventory / baseline / checklist 류 보조 문서. 비-md 3개는 측정 baseline JSON (`187-*.json` · `188-*.json`)
- **`adr/design/completed/`** (10개): 완료된 ADR 의 breakdown
- **`adr/evidence/`** (md 48 + PNG 1): ADR Implemented 승격에 필요한 실행 근거. 하위 3개 디렉터리(`203-g1-final` · `203-phase1` · `203-phase3`)는 md 가 없고 측정 산출물 41 파일만 보관
- **`adr/reviews/`** (md 105): 리뷰 기록 Layer 0 — `README.md` 1개 + ADR 번호별 리뷰 104개. 이 기록의 종결 상태가 전제 확정의 근거 (`.claude/rules/premise-decision-points.md`)
- **인덱스**: `adr/README.md` — 전체 ADR 현황 및 우선순위

### 기능 문서

**완료된 기능**:

- **위치**: `docs/features/completed/` (md 21 = README 1 + 문서 20)
- **내용**: 구현 완료된 주요 기능의 상세 설계 및 구현 문서
- **인덱스**: `features/completed/README.md`
- **요약**: `reference/status/COMPLETED.md`

`docs/features/` 직속에는 파일이 없습니다 — `completed/` 하나만 있습니다.

**계획 중 기능**:

- **상세 계획**: `reference/status/PLANNED.md`
- **개요**: `reference/status/UNIMPLEMENTED.md`

### 참조 문서

**위치**: `docs/reference/` (직속 md 2 — `WORKFLOW.md` · `adr-912-prop-parity-audit.md`)

- **`api/`** (1개): API 엔드포인트 문서
- **`architecture/`** (4개): 모노레포 구조, 다중 페이지 렌더링, Builder hooks / Zustand store 구조
- **`audits/`** (12개): 날짜 접두 감사 보고서 — RAC/spec SSOT 감사, canonical 컴포넌트 인벤토리, design-data props 감사, interaction registry 커버리지 등
- **`components/`** (13개): 개별 컴포넌트/기능 참조 문서 (진행 중/계획)
- **`schemas/`** (3개): IndexedDB 현행 스키마, Supabase (역사 기록), ADR 리뷰 Layer 0 스키마
- **`status/`** (6개): 구현 상태별 문서 + 과거 호환성·스타일 시스템 기록

### 설명 문서

**위치**: `docs/explanation/` (직속 md 0)

- **`architecture/`** (3개): 페이지 타입 분리, 데이터 아키텍처, Drag & Drop 설계
- **`research/`** (28개): 기술 리서치와 외부 프로젝트 대조 — 빌더 비교, Pen / open-pencil / pretext / Taffy / webstudio 델타 분석, 성능 baseline (`BUILDER_PERF_BASELINE_2026-09.md` · `BUILDER_FRAME_DROP_BASELINE_5K.md`) 등

### 실용 가이드

**위치**: `docs/how-to/` (직속 md 0)

- **`development/`** (10개): 기여 가이드, 성능·Long Task 최적화, 벤치마크 템플릿, AI 로컬 엔드포인트 등
- **`migration/`** (1개): React Query 스타일 마이그레이션
- **`troubleshooting/`** (1개): Rate Limit 해결

### 튜토리얼

**위치**: `docs/tutorials/` (직속 md 0)

- **`features/`** (1개): Tree 컴포넌트 가이드

### 조사·마이그레이션 산출물

- **`docs/migrations/`**: DB 마이그레이션 SQL 2개 + shadcn 참조 JSON 3개 + 성능·부팅 조사 노트 8개 (2026-09-07 작성분 — worker WebGL surface, Skia 폰트 포맷, Styles 패널 rAF, 외부 성능 감사 등)
- **`docs/migrations/evidence/`**: 직속 파일 0, 하위 3개 디렉터리(`frame-performance` · `worker-product-20260907` · `worker-assets-20260907`)에 측정 산출물 총 539 파일 (그중 md 5)
- **`docs/audit/`** (1개) · **`docs/bug/`** (2개): 단발 감사·버그 조사 노트

### Pencil 분석

- **`docs/pencil-copy/`** (md 8): Pencil 포맷 모델, 슬롯 모델, composition 매핑, drag-drop 분석 + `fixtures/` 합성 JSON 1개
- **`docs/pencil-extracted/`**: Pencil Desktop 앱 번들 역공학 추출물 (전체 390 파일, md 2 — 대부분 `Frameworks/` · `Resources/` 바이너리·에셋)

### 레거시

- **`docs/legacy/`** (md 25 = README 1 + 문서 24): 완료된 리팩토링·마이그레이션 기록과 폐기된 문서. `WORKFLOW.md` · `STYLE_SYSTEM.md` · `REACT_ARIA_1.13.md` 는 `reference/` 쪽에도 같은 이름의 파일이 있으나 **내용이 서로 다릅니다** (`diff` 확인) — 인용 시 경로를 정확히 적어야 합니다

---

## 📜 CHANGELOG 구조 — 크기 우선 아카이빙

정본 규칙: [`.claude/rules/changelog.md`](../../.claude/rules/changelog.md) §4 (2026-09-09 개정 — **크기 우선, 연도는 보조**).

- `docs/CHANGELOG.md` 가 **500KB 초과** 또는 연도가 바뀐 직후 첫 주에 오래된 엔트리를 아카이브로 이동합니다
- 파일명은 연도 경계면 `CHANGELOG-YYYY-archived.md`, 연중에 크기 때문에 자르면 구간을 이름에 담습니다 (`-H1-` · `-Q3-`)
- 자를 위치는 본문이 500KB 아래로 내려가는 가장 이른 경계이며 월 중간을 쪼개지 않습니다
- 아카이브 파일은 **append-only** — 재편집 금지

**2026-09-09 아카이빙 실행 결과**: 본문이 1,979KB / 652 엔트리로 기준의 4배였습니다. 연도 단위로는 기준을 못 지켜 구간으로 나눴습니다.

| 파일                            | 구간                    | 엔트리   | 크기  |
| ------------------------------- | ----------------------- | -------- | ----- |
| `CHANGELOG.md`                  | 2026-09-01 ~ 09-09      | 97       | 148KB |
| `CHANGELOG-2026-Q3-archived.md` | 2026-07-01 ~ 08-31      | 346      | 968KB |
| `CHANGELOG-2026-H1-archived.md` | 2026-02-22 ~ 06-30      | 209      | 872KB |
| `CHANGELOG-2025-archived.md`    | 2025-10-27 ~ 2026-03-27 | 124 항목 | 252KB |

> 엔트리 수는 `## [제목] - YYYY-MM-DD` 표준 헤더 기준입니다. Q3 에 2건, H1 에 1건은 날짜를 대괄호 안에 넣은 구형 헤더라 위 집계 밖입니다. `CHANGELOG-2025-archived.md` 는 `## [Unreleased]` 아래 `### <구분> - <제목> (날짜)` 형식이라 항목 단위(124개)로 셌습니다.
>
> `CHANGELOG.md` 최상단에는 아카이브 전부의 링크를 구간·엔트리 수와 함께 유지합니다.

---

## 🔄 문서 라이프사이클

### 1. 계획 단계

```
reference/status/PLANNED.md (상세 계획)
reference/status/UNIMPLEMENTED.md (개요)
```

### 2. 구현 중

```
adr/*.md (ADR 작성)
adr/design/*-breakdown.md (구현 상세)
adr/reviews/{NNN}.md (리뷰 기록 Layer 0)
adr/evidence/{NNN}-*.md (측정·live exercise 근거)
reference/components/*.md (참조 문서)
```

### 3. 완료 후

```
adr/*.md → adr/completed/ (이동)
adr/design/*-breakdown.md → adr/design/completed/ (이동)
reference/components/*.md → features/completed/ (이동)
reference/status/COMPLETED.md (요약 업데이트)
docs/CHANGELOG.md (Implemented 승격 엔트리 반영)
```

---

## 📝 문서 작성 원칙

### DO

- ✅ 완료된 문서는 `completed/` 디렉토리로 이동
- ✅ ADR 과 breakdown 은 항상 쌍으로 관리
- ✅ 상태 변경 시 인덱스 문서 업데이트 (README.md, COMPLETED.md, CHANGELOG.md)
- ✅ 문서 간 상호 참조는 상대 경로 사용
- ✅ 개수를 적을 때는 실제로 세고, 센 날짜를 함께 적기

### DON'T

- ❌ **`adr/completed/` 수정 금지** (읽기 전용)
- ❌ **아카이브된 CHANGELOG 재편집 금지** (append-only)
- ❌ 중복 내용 작성 (기존 문서 참조 링크 사용)
- ❌ 레거시 문서 재사용 (`legacy/` 는 역사적 참조 전용)
- ❌ 일반 컴포넌트용 신규 spec 파일 생성 (D3 SSOT 는 catalog — `.claude/rules/ssot-hierarchy.md`)

---

## 🔍 문서 찾기

### 특정 기능 찾기

1. **완료된 기능**: `features/completed/README.md` 또는 `reference/status/COMPLETED.md`
2. **계획 중 기능**: `reference/status/PLANNED.md`
3. **미구현 기능**: `reference/status/UNIMPLEMENTED.md`

### ADR 찾기

1. **전체 ADR 목록**: `adr/README.md`
2. **완료된 ADR**: `adr/completed/` (229개)
3. **진행 중/미구현 ADR**: `adr/*.md` (12개, README 제외)
4. **리뷰 종결 상태**: `adr/reviews/{NNN}.md` (104개)

### 구현 상세 찾기

1. **ADR 관련**: `adr/design/*-breakdown.md` (174개) 또는 `adr/design/completed/` (10개)
2. **실행 근거**: `adr/evidence/` (48개)
3. **컴포넌트 관련**: `reference/components/*.md` (13개)

---

## 📊 문서 통계 (2026-09-09 실측)

| 카테고리             | 개수    | 위치                                |
| -------------------- | ------- | ----------------------------------- |
| ADR (완료)           | 229     | `adr/completed/`                    |
| ADR (진행 중/미구현) | 12      | `adr/*.md` (README 제외)            |
| Breakdown (완료)     | 10      | `adr/design/completed/`             |
| Breakdown (진행 중)  | 174     | `adr/design/*-breakdown.md`         |
| ADR 보조 문서        | 81      | `adr/design/*.md` (breakdown 제외)  |
| ADR 리뷰 기록        | 104     | `adr/reviews/` (README 제외)        |
| ADR 실행 근거        | 48      | `adr/evidence/*.md`                 |
| 완료 기능 문서       | 20      | `features/completed/` (README 제외) |
| 참조 문서 (컴포넌트) | 13      | `reference/components/`             |
| 감사 보고서          | 12      | `reference/audits/`                 |
| 리서치 문서          | 28      | `explanation/research/`             |
| 가이드 문서          | 12      | `how-to/**` (10 + 1 + 1)            |
| 레거시 문서          | 24      | `legacy/` (README 제외)             |
| **docs 전체 md**     | **827** | `docs/**/*.md`                      |

---

## 🗂️ 현재 비어 있는 디렉터리

파일이 하나도 없는 디렉터리 **2개** (둘 다 측정 산출물 자리):

- `migrations/evidence/frame-performance/p0-prod-smoke/`
- `migrations/evidence/frame-performance/remeasure-20260906-final/gpu-diagnostic-1-full/`

직속 파일 없이 **하위 디렉터리만** 가진 곳 (구조상 정상):

- `features/` · `how-to/` · `tutorials/` · `explanation/` (`.DS_Store` 제외) · `migrations/evidence/`
- `adr/evidence/203-g1-final/` · `203-phase1/` · `203-phase3/` 는 md 가 없고 비-md 산출물만 있습니다

---

## 🔗 주요 인덱스 문서

- [`README.md`](../../README.md) — 문서 메인 인덱스
- [`adr/README.md`](../adr/README.md) — ADR 전체 현황
- [`adr/reviews/README.md`](../adr/reviews/README.md) — 리뷰 기록 인덱스
- [`features/completed/README.md`](../features/completed/README.md) — 완료 기능 목록
- [`reference/status/COMPLETED.md`](../legacy/STATUS_COMPLETED-2025-11.md) — 완료 기능 요약
- [`reference/status/PLANNED.md`](../legacy/STATUS_PLANNED-2025-12.md) — 계획 중 기능
- [`reference/status/UNIMPLEMENTED.md`](../legacy/STATUS_UNIMPLEMENTED-2026-05.md) — 미구현 기능
- [`legacy/README.md`](../legacy/README.md) — 레거시 문서 인덱스
- [`pencil-copy/README.md`](../pencil-copy/README.md) — Pencil 포맷 분석 인덱스

---

**문서 구조 질문이나 제안사항**은 프로젝트 메인테이너에게 문의하세요.
