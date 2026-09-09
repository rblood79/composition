# composition 모노레포 구조

> **최종 검증일**: 2026-09-09 — 아래 표·트리는 `pnpm-workspace.yaml` · 각 `package.json` ·
> 디렉토리 실물로 대조했다.
> **전환 이력**: 2025-12-31 에 끝난 전환의 실행 계획서 (Phase 별 `git mv` 절차 · 롤백 계획) 는
> [legacy/MONOREPO_MIGRATION-2025-12.md](../../legacy/MONOREPO_MIGRATION-2025-12.md) 로 옮겼다.
> 그 문서의 "현재 구조" 절은 PixiJS 시대 기준이라 현행과 다르다.

---

## 1. 워크스페이스

pnpm workspace + Turborepo. `pnpm-workspace.yaml` 이 `apps/*` 와 `packages/*` 를 잡고,
`packages/react-aria-starter` 만 제외한다 (RAC starter upstream 스냅샷 — read-only 참조 baseline).
공통 의존성 버전은 같은 파일의 `catalogs.default` 가 고정한다.

| 워크스페이스                  | 패키지명                                   | 역할                                                     |
| ----------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `apps/builder`                | `@composition/builder`                     | Skia(CanvasKit) 빌더 앱. 개발 서버 5173                  |
| `apps/publish`                | `@composition/publish`                     | 퍼블리시 런타임 (DOM + CSS 렌더)                         |
| `packages/shared`             | `@composition/shared`                      | catalog(D3 SSOT) · 공용 컴포넌트 · 렌더러 · 스키마       |
| `packages/specs`              | `@composition/specs`                       | 잔존 spec 3개 (Frame/Group/Slot) · CSS 생성 · 차트 기하  |
| `packages/config`             | `@composition/config`                      | 공유 tsconfig · eslint 설정                              |
| `packages/composition-engine` | (Rust crate)                               | 레이아웃 엔진 → wasm. 워크스페이스 패키지가 아니라 cargo |
| `packages/react-aria-starter` | `@composition/react-aria-starter-upstream` | upstream 스냅샷. **편집 금지**, 워크스페이스에서 제외    |

### 의존 방향 (단방향)

```
apps/builder ──▶ @composition/publish, @composition/shared, @composition/specs
apps/publish ──▶ @composition/shared
packages/shared ──▶ @composition/specs
packages/specs ──▶ (내부 의존 없음)
```

`packages/composition-engine` 은 wasm 산출물 (`pkg/`, gitignored) 로 소비된다 —
`pnpm wasm:build:engine` 이 생성하고, fresh clone·엔진 변경 후에는 필수다.

---

## 2. 디렉토리

```
composition/
├── apps/
│   ├── builder/src/
│   │   ├── builder/          # 빌더 본체
│   │   │   ├── workspace/canvas/skia/   # Skia 렌더 (핵심 진입점)
│   │   │   ├── panels/       # navigator · properties · styles · datatable ·
│   │   │   │                 #   interactions · history · themes · settings · ai · fonts
│   │   │   ├── stores/       # Zustand
│   │   │   ├── layout/       # 엔진 경계 (engines/fullTreeLayout.ts 등)
│   │   │   ├── overlay/ · projection/ · factories/ · templates/ · performance/
│   │   ├── adapters/ · resolvers/   # canonical 문서 변환
│   │   ├── preview/          # COMPARE_MODE 프리뷰
│   │   ├── services/         # ai · agent · api · save
│   │   ├── stores/ · hooks/ · dashboard/ · auth/ · i18n/
│   │   └── main.tsx          # 빌더 진입점
│   └── publish/src/
│       ├── registry/ · renderer/ · components/ · hooks/ · styles/
│       └── main.tsx          # 런타임 진입점
├── packages/
│   ├── shared/src/
│   │   ├── catalog/          # generated/componentRulesTable.ts = D3 SSOT
│   │   ├── components/ · renderers/ · collections/ · interactions/
│   │   └── schemas/ · types/ · hooks/ · utils/ · i18n/
│   ├── specs/src/
│   │   ├── components/       # 잔존 spec 3개 (Frame · Group · Slot)
│   │   ├── primitives/ · renderers/ (CSSGenerator) · chart/ · icons/ · runtime/
│   ├── composition-engine/   # Rust — src/ · benches/ · tests/ · pkg(생성물)
│   ├── config/               # tsconfig/ · eslint/
│   └── react-aria-starter/   # upstream 스냅샷 (제외 워크스페이스)
└── scripts/                  # generate-engine-matrix.mjs · prepare-wasm.mjs · agent/ · codex/ 등
```

앱별 스크립트는 각 워크스페이스 안에 있다 — 예: `apps/builder/scripts/visual-parity-gate.mjs`.

---

## 3. Turborepo 태스크

`turbo.json` 이 정의하는 태스크: `build` · `build:preview` · `build:all` · `dev` · `type-check` ·
`lint` · `test` · `clean`.

```bash
pnpm install          # postinstall: canvaskit wasm 복사 + specs 빌드
pnpm dev              # builder dev 서버 (포트 충돌 시 pnpm dev:kill)
pnpm type-check       # Stop hook 이 같은 명령을 실행
pnpm codex:preflight  # guard + format + typecheck + registration gate
pnpm wasm:build:engine
```

**실패 개수는 per-package 로만 정확하다** — `pnpm -F <pkg> test`. turbo 합산값을 신뢰하지 않는다.

---

## 4. 관련 문서

- SSOT 3-Domain 분할: [.claude/rules/ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)
- 컴포넌트 정본: [components/COMPONENT_SPEC.md](../components/COMPONENT_SPEC.md)
- 스토어 구조: [STRUCTURE_STORE.md](STRUCTURE_STORE.md) · 훅 구조: [STRUCTURE_HOOKS.md](STRUCTURE_HOOKS.md)
- 문서 체계: [../DOCUMENT_STRUCTURE.md](../DOCUMENT_STRUCTURE.md)
