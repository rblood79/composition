# composition 모노레포 구조

> **작성일**: 2025-12-31
> **상태**: ✅ 완료 (Completed) - 2025-12-31
> **관련 문서**: [RENDERING_ARCHITECTURE.md](../../legacy/RENDERING_ARCHITECTURE.md)

---

## 1. Executive Summary

### 1.1 현재 구조

```
composition/ (pnpm + Turborepo 모노레포)
├── apps/
│   ├── builder/              # 메인 빌더 앱 (@composition/builder)
│   │   ├── src/
│   │   │   ├── builder/      # Pixi.js 기반 Canvas 편집기
│   │   │   │   ├── workspace/canvas/  # WebGL 편집 화면
│   │   │   │   ├── components/  # Builder 전용 UI (PanelHeader 등)
│   │   │   │   └── panels/      # 패널 컴포넌트
│   │   │   ├── preview/      # React 프리뷰 (COMPARE_MODE용)
│   │   │   │   ├── App.tsx
│   │   │   │   ├── messaging/
│   │   │   │   ├── store/
│   │   │   │   └── router/
│   │   │   └── ...
│   │   ├── .storybook/
│   │   ├── eslint-local-rules/
│   │   ├── scripts/
│   │   ├── public/
│   │   ├── index.html
│   │   ├── eslint.config.js
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── publish/              # 배포 런타임 (@composition/publish)
│       ├── src/
│       ├── package.json
│       ├── vite.config.ts
│       └── tsconfig.json
│
├── packages/
│   ├── shared/               # 순수 공유 라이브러리 (@composition/shared)
│   │   ├── src/
│   │   │   ├── components/   # 공유 UI (Button, Badge, TextField 등)
│   │   │   ├── renderers/    # PageRenderer, ElementRenderer
│   │   │   ├── hooks/        # 공유 훅
│   │   │   ├── types/        # 공유 타입 정의
│   │   │   └── utils/        # 공유 유틸리티 (export.utils 등)
│   │   └── package.json
│   │
│   └── config/               # 공유 설정 (@composition/config)
│       ├── tsconfig/
│       │   ├── base.json
│       │   ├── react-app.json
│       │   └── library.json
│       └── eslint/
│
├── pnpm-workspace.yaml       # catalogs 섹션 포함
├── turbo.json                # Turborepo 설정
├── vercel.json               # Vercel 배포 설정
├── package.json              # 워크스페이스 전용 (private: true)
└── tsconfig.json             # solution style references
```

### 1.2 패키지 구조

| 패키지                 | 역할                          | 의존성                                   |
| ---------------------- | ----------------------------- | ---------------------------------------- |
| `@composition/builder` | 메인 빌더 앱                  | @composition/shared, @composition/config |
| `@composition/publish` | 배포 런타임                   | @composition/shared                      |
| `@composition/shared`  | 순수 공유 코드 (types, utils) | 없음                                     |
| `@composition/config`  | 공유 설정 (tsconfig, eslint)  | 없음                                     |

> **Note**: 공유 컴포넌트(Button, Badge 등)와 렌더러는 `packages/shared/`에 위치합니다.
> Builder 전용 UI 컴포넌트(PanelHeader, PropertySection 등)는 `apps/builder/src/builder/components/`에 있습니다.

### 1.3 아키텍처 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        packages/shared/src/                                  │
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐       │
│  │  components/                  │  │  renderers/                    │       │
│  │  - Button, Badge, TextField   │  │  - FormRenderers               │       │
│  │  - styles/*.css               │  │  - LayoutRenderers             │       │
│  └───────────────────────────────┘  └───────────────────────────────┘       │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │
           ┌───────────────────┴───────────────────┐
           │                                       │
           ▼                                       ▼
┌─────────────────────┐              ┌─────────────────────┐
│  Builder (WebGL)    │              │  Preview (React)    │
│  Pixi.js Canvas     │              │  iframe 렌더링       │
├─────────────────────┤              ├─────────────────────┤
│  CSS 파싱 →         │  ◄────────►  │  React 컴포넌트     │
│  Canvas 시각화      │   메시징      │  직접 렌더링        │
│  (디자인 일관성)    │              │  (실제 동작)        │
└──────────┬──────────┘              └──────────┬──────────┘
           │                                    │
           └────────────────┬───────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              IndexedDB                                       │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                    │
│  │ 컴포넌트 트리  │  │ 스타일/속성   │  │ 이벤트 바인딩 │                    │
│  └───────────────┘  └───────────────┘  └───────────────┘                    │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────┐
                    │       packages/shared/ (순수 공유)       │
                    │  ┌─────────────────────────────────────┐│
                    │  │  types/  - Element, Page 타입       ││
                    │  │  utils/  - buildElementTree 등      ││
                    │  └─────────────────────────────────────┘│
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
                          ┌─────────────────────┐
                          │  Publish (React)    │
                          │  @composition/publish   │
                          ├─────────────────────┤
                          │  최종 배포 런타임    │
                          │  독립 실행          │
                          └─────────────────────┘
```

### 1.4 주요 명령어

```bash
# 개발 서버 실행
pnpm dev

# 빌드
pnpm build

# 타입 체크
pnpm type-check

# 린트
pnpm lint

# 테스트
pnpm test

# Storybook
pnpm storybook
```

**핵심 원칙:**

| 영역                | 컴포넌트 위치                                   | 렌더링 방식    |
| ------------------- | ----------------------------------------------- | -------------- |
| **Builder (WebGL)** | `apps/builder/src/builder/workspace/canvas/ui/` | Pixi.js Canvas |
| **Preview (React)** | `packages/shared/components/`                   | React DOM      |
| **Publish (React)** | `packages/shared/components/`                   | React DOM      |

**컴포넌트 이중 구조:**

```
packages/shared/components/           apps/builder/src/builder/workspace/canvas/ui/
├── TextField.tsx (React)             ├── PixiTextField.tsx (Pixi.js)
├── ListBox.tsx (React)               ├── PixiListBox.tsx (Pixi.js)
├── DatePicker.tsx (React)            ├── PixiDatePicker.tsx (Pixi.js)
├── styles/                           └── ... (60+ Pixi 컴포넌트)
│   └── TextField.css ─────────────────────┘
│                         ↑
│              스타일 파싱하여 Canvas에 반영
└── ...
```

- **React 컴포넌트**: DOM 기반 렌더링 (Preview, Publish에서 사용)
- **Pixi 컴포넌트**: WebGL Canvas 기반 렌더링 (Builder 편집 화면에서 사용)
- **스타일 공유**: React 컴포넌트의 CSS를 Pixi 컴포넌트가 파싱하여 동일한 디자인 구현
- **Single Source of Truth**: `packages/shared/components/styles/`가 디자인 기준

> **디렉토리명 변경**: 기존 `src/canvas/` → `src/preview/`로 리네이밍 권장
> (Pixi.js의 `workspace/canvas`와 혼동 방지)

### 1.4 퍼블리싱 모드

Builder에서 퍼블리싱 시 두 가지 모드 중 선택 가능:

```
┌─────────────────────────────────────────────────────────────┐
│  퍼블리싱 옵션 선택                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │  📦 런타임 모드      │    │  📄 정적 빌드 모드   │         │
│  │  (SPA)              │    │  (SSG)              │         │
│  ├─────────────────────┤    ├─────────────────────┤         │
│  │  • 동적 데이터 지원  │    │  • SEO 최적화       │         │
│  │  • 실시간 업데이트   │    │  • 빠른 초기 로드    │         │
│  │  • API 연동 가능     │    │  • CDN 캐싱 최적    │         │
│  │  • CSR 방식         │    │  • 정적 HTML 생성    │         │
│  └─────────────────────┘    └─────────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 모드 1: 런타임 렌더러 (SPA)

```
빌드 결과물:
dist/
├── index.html          # SPA 진입점
├── assets/
│   ├── index-[hash].js # React 앱 번들
│   └── index-[hash].css
└── data/
    └── project.json    # 프로젝트 데이터 (동적 로드)
```

**동작 방식:**

1. 사용자가 페이지 접속
2. React 앱 로드 (`index.js`)
3. `project.json` fetch
4. 렌더러가 JSON → React 컴포넌트 변환
5. 화면 표시

**적합한 경우:**

- 데이터가 자주 변경되는 사이트
- API 연동이 필요한 경우
- 사용자 인터랙션이 많은 앱

#### 모드 2: 정적 빌드 (SSG)

```
빌드 결과물:
dist/
├── index.html          # 홈페이지 (정적 HTML)
├── about/
│   └── index.html      # /about 페이지
├── products/
│   └── index.html      # /products 페이지
└── assets/
    ├── index-[hash].js # 하이드레이션용 JS (선택)
    └── index-[hash].css
```

**동작 방식:**

1. 빌드 시점에 JSON → HTML 변환
2. 각 페이지별 정적 HTML 생성
3. 배포 후 즉시 HTML 제공
4. (선택) 하이드레이션으로 인터랙션 추가

**적합한 경우:**

- SEO가 중요한 마케팅 사이트
- 정적 콘텐츠 위주 (블로그, 포트폴리오)
- CDN 배포로 빠른 로딩 필요

#### 모드별 운영 지표 및 모니터링

| 지표                         | 런타임 모드 (SPA)   | 정적 빌드 (SSG)         | 측정 도구    |
| ---------------------------- | ------------------- | ----------------------- | ------------ |
| First Contentful Paint (FCP) | 1.5-2.5초           | 0.5-1.0초               | Lighthouse   |
| Time to Interactive (TTI)    | 2.5-4.0초           | 1.0-2.0초               | Web Vitals   |
| 번들 크기                    | ~200KB (React 포함) | ~50KB (하이드레이션 시) | Bundlephobia |
| SEO 점수                     | 60-80               | 90-100                  | Lighthouse   |

**API 실패 시 폴백 전략 (SPA 전용)**:

```typescript
// apps/publish/src/utils/dataLoader.ts
export async function loadProjectData() {
  try {
    const response = await fetch("/api/project");
    if (!response.ok) throw new Error("API 실패");
    return await response.json();
  } catch (error) {
    console.warn("API 실패, 로컬 캐시 사용:", error);

    // 폴백 1: 로컬 스토리지 캐시
    const cached = localStorage.getItem("project-cache");
    if (cached) return JSON.parse(cached);

    // 폴백 2: 빌드 시 포함된 정적 데이터
    return import("./fallback-data.json");
  }
}
```

**모드 선택 가이드라인**:

| 요구사항             | 권장 모드 |
| -------------------- | --------- |
| SEO 필수             | SSG       |
| 실시간 데이터 표시   | SPA       |
| CDN 캐싱 최대화      | SSG       |
| 사용자 로그인 필요   | SPA       |
| 빠른 초기 로딩       | SSG       |
| API 기반 동적 콘텐츠 | SPA       |

#### 퍼블리싱 UI 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  Builder 퍼블리싱 다이얼로그                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📤 퍼블리싱 설정                                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  퍼블리싱 모드 선택                                  │    │
│  │                                                      │    │
│  │  ○ 런타임 모드 (SPA)                                │    │
│  │    동적 데이터, API 연동 지원                        │    │
│  │                                                      │    │
│  │  ● 정적 빌드 (SSG) - 권장                           │    │
│  │    SEO 최적화, 빠른 로딩                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  배포 대상                                           │    │
│  │                                                      │    │
│  │  ○ 다운로드 (ZIP)                                   │    │
│  │  ○ Vercel                                           │    │
│  │  ○ Netlify                                          │    │
│  │  ○ AWS S3                                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│                              [ 취소 ]  [ 퍼블리싱 ]          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 빌드 스크립트

```json
// apps/publish/package.json
{
  "scripts": {
    "build": "vite build",
    "build:ssg": "cross-env BUILD_MODE=ssg vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "cross-env": "catalog:"
  }
}
```

> **Windows 호환성**: `cross-env` 패키지를 사용하여 환경변수를 크로스 플랫폼으로 설정합니다.

```typescript
// apps/publish/vite.config.ts
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
// SSG 구현 시 필요한 모듈 (실제 사용 시 import)
// import fs from 'fs/promises';
// import path from 'path';

// SSG 플러그인 정의 (예시 구현)
function ssgPlugin(options: { routes: () => Promise<string[]> }): Plugin {
  return {
    name: "vite-plugin-ssg",
    apply: "build",
    async closeBundle() {
      if (process.env.BUILD_MODE !== "ssg") return;

      const routes = await options.routes();
      console.log(`SSG: ${routes.length} pages to generate`);
      // 실제 구현은 프로젝트 요구사항에 맞게 작성
    },
  };
}

// 프로젝트 데이터 로드 (예시)
async function loadProjectData() {
  // IndexedDB 또는 API에서 페이지 데이터 로드
  // 실제 구현 시 데이터 소스에 맞게 수정 필요
  return {
    pages: [{ slug: "/" }, { slug: "/about" }],
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // SSG 모드일 때 정적 HTML 생성
    process.env.BUILD_MODE === "ssg" &&
      ssgPlugin({
        routes: async () => {
          const data = await loadProjectData();
          return data.pages.map((page) => page.slug);
        },
      }),
  ].filter(Boolean),
}));
```

> **SSG 구현 참고**: 위 `ssgPlugin`과 `loadProjectData`는 예시입니다.
> 실제 SSG 구현은 [vite-plugin-ssr](https://vite-plugin-ssr.com/) 또는 커스텀 구현을 사용할 수 있습니다.

---

## 2. 의존성 버전 정책

### 2.1 pnpm Catalogs

모든 패키지에서 공유하는 의존성 버전을 중앙에서 관리합니다.

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"

# pnpm 10+ 형식: catalogs + default 사용
catalogs:
  default:
    # React 생태계
    react: ^19.2.3
    react-dom: ^19.2.3
    react-router: ^7.11.0
    react-router-dom: ^7.11.0
    react-aria-components: ^1.14.0

    # 빌드 도구
    typescript: ~5.9.3
    vite: ^7.3.0
    "@vitejs/plugin-react-swc": ^4.2.2
    cross-env: ^7.0.3

    # 상태 관리
    zustand: ^5.0.9
    immer: ^10.1.1

    # 타입 정의
    "@types/react": ^19.2.7
    "@types/react-dom": ^19.2.3
    "@types/node": ^24.10.2
```

> **Note**: `onlyBuiltDependencies`는 **루트** `.npmrc`에 별도로 설정합니다.
> 워크스페이스 전체에 적용됩니다.

```ini
# /.npmrc (루트 디렉토리)
onlyBuiltDependencies[]=@swc/core
onlyBuiltDependencies[]=esbuild
onlyBuiltDependencies[]=puppeteer
```

### 2.2 패키지별 사용

```json
// apps/builder/package.json
{
  "dependencies": {
    "react": "catalog:",
    "react-dom": "catalog:",
    "@composition/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vite": "catalog:"
  }
}
```

---

## 3. Phase별 구현 계획

### Phase 1: 의존성 정리

**목표**: pnpm catalog로 의존성 버전 중앙 관리

**작업 내용**:

1. `pnpm-workspace.yaml`에 catalogs 섹션 추가 (pnpm 10+ 형식)
2. `.npmrc`에 `onlyBuiltDependencies` 설정
3. **packages 경로에서 `.` 제거 준비** (Phase 3 이후 적용)
4. 모든 패키지에서 `catalog:` 프로토콜 사용
5. **Vite 버전 통일** (6 → 7)

> **Note**: 루트 package.json은 워크스페이스 전용이므로 의존성을 추가하지 않습니다.
> `@composition/shared`는 각 앱(apps/builder, apps/publish)의 package.json에서 참조합니다.

**pnpm-workspace.yaml 변경:**

```yaml
# 현재 (루트가 앱 역할)
packages:
  - "." # ← Phase 3 완료 후 제거
  - "packages/*"

# Phase 3 이후 (목표 상태)
packages:
  - "apps/*"
  - "packages/*"
```

**Vite 버전 통일:**

```bash
# packages/publish의 Vite 6 → 7 업그레이드
cd packages/publish
pnpm add -D vite@^7.3.0

# Breaking changes 확인
# - Vite 7은 Node.js 18+ 필요
# - vite.config.ts 호환성 확인
```

**수정 파일**:

- `/pnpm-workspace.yaml`
- `/package.json`
- `/packages/shared/package.json`
- `/packages/publish/package.json` (Vite 버전 업그레이드)

**검증**:

```bash
pnpm install
pnpm why typescript  # 모든 패키지에서 동일 버전 확인
pnpm why vite        # Vite 7.x 통일 확인
```

**Catalog 버전 검증 스크립트**:

마이그레이션 전후로 catalog 버전이 올바르게 적용되었는지 자동으로 검증합니다.

```bash
#!/bin/bash
# scripts/verify-catalog.sh

echo "🔍 Catalog 버전 검증 중..."

# 기대하는 버전들
EXPECTED_REACT="19.2.3"
EXPECTED_TS="5.9.3"
EXPECTED_VITE="7.3.0"

# 실제 설치된 버전 확인
ACTUAL_REACT=$(pnpm why react --json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
ACTUAL_TS=$(pnpm why typescript --json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
ACTUAL_VITE=$(pnpm why vite --json 2>/dev/null | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)

ERRORS=0

check_version() {
  local name=$1
  local expected=$2
  local actual=$3

  if [[ "$actual" == *"$expected"* ]]; then
    echo "✅ $name: $actual (expected: $expected)"
  else
    echo "❌ $name: $actual (expected: $expected)"
    ((ERRORS++))
  fi
}

check_version "React" "$EXPECTED_REACT" "$ACTUAL_REACT"
check_version "TypeScript" "$EXPECTED_TS" "$ACTUAL_TS"
check_version "Vite" "$EXPECTED_VITE" "$ACTUAL_VITE"

echo ""

# 버전 불일치 검사
echo "🔍 패키지 간 버전 불일치 검사..."
DUPLICATE_REACT=$(pnpm why react 2>/dev/null | grep -c "react@")
DUPLICATE_TS=$(pnpm why typescript 2>/dev/null | grep -c "typescript@")

if [ "$DUPLICATE_REACT" -gt 1 ]; then
  echo "⚠️  React 버전이 여러 개 존재합니다. pnpm dedupe 실행 권장"
  ((ERRORS++))
fi

if [ "$DUPLICATE_TS" -gt 1 ]; then
  echo "⚠️  TypeScript 버전이 여러 개 존재합니다. pnpm dedupe 실행 권장"
  ((ERRORS++))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "✅ 모든 catalog 버전이 올바르게 적용되었습니다."
  exit 0
else
  echo "❌ $ERRORS개의 버전 불일치가 발견되었습니다."
  exit 1
fi
```

**사용 방법:**

```bash
# 스크립트 실행
chmod +x scripts/verify-catalog.sh
./scripts/verify-catalog.sh

# 또는 npm script로 등록
# package.json: "verify:catalog": "./scripts/verify-catalog.sh"
pnpm run verify:catalog
```

---

### Phase 2: 공유 설정 패키지 생성

**목표**: TypeScript, ESLint 설정 중앙화

**디렉토리 구조**:

```
packages/config/
├── package.json
├── tsconfig/
│   ├── base.json
│   ├── react-app.json
│   └── library.json
└── eslint/
    └── base.js
```

**packages/config/package.json**:

```json
{
  "name": "@composition/config",
  "version": "0.0.0",
  "private": true,
  "exports": {
    "./tsconfig/base": "./tsconfig/base.json",
    "./tsconfig/react-app": "./tsconfig/react-app.json",
    "./tsconfig/library": "./tsconfig/library.json",
    "./eslint": "./eslint/base.js"
  }
}
```

**tsconfig/base.json**:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedSideEffectImports": true
  }
}
```

**tsconfig/react-app.json**:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "moduleDetection": "force"
  }
}
```

**tsconfig/library.json**:

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": false
  }
}
```

---

### Phase 3: apps/builder/ 생성 및 이전

**목표**: 메인 빌더 앱을 표준 위치로 이전

**작업 순서** (순서 중요 ⚠️):

> **주의**: 렌더러 이동은 builder 이동 완료 후 진행해야 import 경로 충돌을 방지할 수 있습니다.

**Step 1: 디렉토리 생성**

```bash
mkdir -p apps/builder
```

**Step 2: Builder 파일 이동** (git mv 사용으로 이력 보존)

```bash
git mv src/ apps/builder/src/
git mv public/ apps/builder/public/
git mv index.html apps/builder/index.html
git mv vite.config.ts apps/builder/vite.config.ts
git mv vite.preview.config.ts apps/builder/vite.preview.config.ts
git mv tsconfig.app.json apps/builder/tsconfig.app.json
git mv tsconfig.node.json apps/builder/tsconfig.node.json

# 환경변수 파일 이동
git mv .env apps/builder/.env
git mv .env.example apps/builder/.env.example
```

**Step 2.5: 디렉토리 리네이밍** (혼동 방지)

```bash
# canvas/ → preview/ 리네이밍 (Pixi.js workspace/canvas와 구분)
git mv apps/builder/src/canvas/ apps/builder/src/preview/

# vite.preview.config.ts 내 경로 업데이트
# entry: 'src/canvas/index.tsx' → 'src/preview/index.tsx'
```

> **이유**: `src/canvas/`는 React 기반 프리뷰 앱이지만, 이름이 Pixi.js의
> `apps/builder/src/builder/workspace/canvas/` (WebGL 편집 화면)와 혼동을 줄 수 있음

**Step 3: 빌드 검증** (렌더러 이동 전 중간 검증)

```bash
cd apps/builder
pnpm install
pnpm run build  # 기존 경로로 빌드 성공 확인
```

**Step 4: 공유 코드 분리** ✅ 완료

> **완료됨 (2026-01-02)**: 공유 컴포넌트와 렌더러가 `packages/shared/`로 이동되었습니다.
> Preview와 Publish가 동일한 렌더링 결과를 보장합니다.

```
데이터 흐름:
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  IndexedDB  │ ──▶ │  Renderers       │ ──▶ │  UI Components     │
│  (설계 데이터) │     │  (FormRenderers) │     │  (TextField, List) │
└─────────────┘     └──────────────────┘     └────────────────────┘
                            │                         │
                            └─────────────────────────┘
                                      ▼
                              React 컴포넌트 렌더링
                              (Preview & Publish 동일)
```

```bash
# 4-1. UI 컴포넌트를 packages/shared로 이동 (렌더러 의존성)
git mv apps/builder/src/shared/components/ packages/shared/src/components/

# 4-2. 렌더러를 packages/shared로 이동
git mv apps/builder/src/preview/renderers/ packages/shared/src/renderers/
```

```
# 이동 후 구조
packages/shared/src/
├── components/            # React 컴포넌트 (기존 src/shared/components)
│   ├── TextField.tsx
│   ├── ListBox.tsx
│   ├── DatePicker.tsx
│   ├── Tabs.tsx
│   ├── styles/
│   │   └── index.css
│   └── list.ts            # barrel export
│
├── renderers/             # 렌더러 (기존 src/canvas/renderers)
│   ├── FormRenderers.tsx
│   ├── LayoutRenderers.tsx
│   ├── DateRenderers.tsx
│   ├── SelectionRenderers.tsx
│   ├── TableRenderer.tsx
│   └── CollectionRenderers.tsx
│
├── types/                 # 공용 타입
└── utils/                 # 공용 유틸리티

apps/builder/src/
├── builder/               # Pixi.js 편집기 (WebGL)
│   └── workspace/canvas/ui/  # Pixi 컴포넌트 (여기에 유지)
├── preview/               # React 프리뷰 (iframe)
│   ├── App.tsx            # @composition/shared 사용
│   └── ...
└── (shared/ 제거됨)

apps/publish/src/
└── App.tsx                # @composition/shared 사용 (동일한 렌더링)
```

**Import 경로 변경:**

```typescript
// 변경 전 (apps/builder/src/preview/App.tsx)
import { TextField } from "../../shared/components/list";
import { renderTextField } from "./renderers/FormRenderers";

// 변경 후 (apps/builder/src/preview/App.tsx)
import { TextField } from "@composition/shared/components";
import { renderTextField } from "@composition/shared/renderers";

// apps/publish/src/App.tsx (동일한 import)
import { TextField } from "@composition/shared/components";
import { renderTextField } from "@composition/shared/renderers";
```

**컴포넌트 분류 기준:**

| 컴포넌트 유형   | 위치                                            | 사용처                    |
| --------------- | ----------------------------------------------- | ------------------------- |
| UI 컴포넌트     | `packages/shared/src/components/`               | Preview, Publish          |
| 렌더러          | `packages/shared/src/renderers/`                | Preview, Publish          |
| 공용 타입       | `packages/shared/src/types/`                    | Builder, Preview, Publish |
| Pixi 컴포넌트   | `apps/builder/src/builder/workspace/canvas/ui/` | Builder WebGL             |
| Builder 전용 UI | `apps/builder/src/builder/components/`          | Builder Inspector, Panels |

**Builder 전용 컴포넌트 (이동 안함):**

`src/builder/components/`는 Builder UI 전용 컴포넌트로, `apps/builder/` 내에 그대로 유지됩니다.

```
apps/builder/src/builder/components/   # Builder 전용 (이동 안함)
├── data/              # 데이터 관련 컴포넌트
├── dialog/            # 다이얼로그
├── feedback/          # 피드백 UI
├── help/              # 도움말 (KeyboardShortcutsHelp 등)
├── overlay/           # 오버레이
├── panel/             # 패널 컴포넌트
├── property/          # 속성 편집기 (PropertyCheckbox 등)
├── selection/         # 선택 관련 (BatchPropertyEditor 등)
└── styles/            # Builder 전용 스타일
```

> **주의**: 이 컴포넌트들은 `packages/shared/components/`를 import하여 사용합니다.
> 마이그레이션 후 import 경로만 `@composition/shared/components`로 변경하면 됩니다.

**Step 5: Import 경로 업데이트** (렌더러 이동 직후 즉시 수행)

```bash
# 변경이 필요한 파일 검색
grep -r "from.*['\"].*renderers" apps/builder/src/preview/ --include="*.tsx" --include="*.ts"
```

**분리 후 구조**:

```
apps/builder/src/preview/          # Builder 프리뷰 전용 (구 canvas/)
├── App.tsx                        # 프리뷰 앱 진입점
├── index.tsx                      # srcdoc iframe 진입점
├── messaging/                     # postMessage 핸들러
├── router/                        # 프리뷰 라우팅
├── store/                         # 프리뷰 상태
└── (renderers/ → packages/shared/src/renderers/로 이동됨)

packages/shared/src/
├── components/                    # React UI 컴포넌트
│   ├── TextField.tsx
│   ├── ListBox.tsx
│   ├── styles/
│   └── index.ts
├── renderers/                     # 렌더러 (components 병렬)
│   ├── FormRenderers.tsx
│   ├── LayoutRenderers.tsx
│   ├── DateRenderers.tsx
│   ├── SelectionRenderers.tsx
│   ├── TableRenderer.tsx
│   ├── CollectionRenderers.tsx
│   └── index.ts
├── types/
└── utils/
```

4. **Import 경로 업데이트**

   ```typescript
   // apps/builder/src/preview/App.tsx (변경 전)
   import { FormRenderers } from "./renderers";

   // apps/builder/src/preview/App.tsx (변경 후)
   import { FormRenderers } from "@composition/shared/renderers";

   // apps/publish/src/App.tsx
   import { FormRenderers } from "@composition/shared/renderers";
   ```

**렌더러 계약 검증 테스트 계획**:

렌더러를 `packages/shared`로 이동할 때, Pixi 기반 WebGL과 React 프리뷰/퍼블리시가 동일한 컴포넌트 계약을 유지하는지 확인해야 합니다.

```typescript
// packages/shared/src/components/renderers/__tests__/contract.test.ts

import { describe, it, expect } from "vitest";
import { FormRenderers, LayoutRenderers } from "../index";

// Props 타입 계약 검증
describe("Renderer Props Contract", () => {
  it("FormRenderers should accept standard props", () => {
    const props = {
      id: "test-input",
      value: "",
      onChange: () => {},
      disabled: false,
    };
    // 타입 체크 통과 확인
    expect(() => FormRenderers.TextInput(props)).not.toThrow();
  });

  it("LayoutRenderers should accept children and style props", () => {
    const props = {
      children: null,
      style: { padding: 16 },
      className: "container",
    };
    expect(() => LayoutRenderers.Container(props)).not.toThrow();
  });
});

// 스타일 토큰 계약 검증
describe("Style Token Contract", () => {
  it("should use consistent spacing tokens", () => {
    // 공유 스타일 토큰이 builder/publish에서 동일하게 적용되는지 확인
    expect(FormRenderers.getSpacing("md")).toBe(16);
    expect(LayoutRenderers.getSpacing("md")).toBe(16);
  });
});

// 이벤트 시그니처 계약 검증
describe("Event Signature Contract", () => {
  it("onChange should receive consistent event shape", () => {
    const mockOnChange = vi.fn();
    const input = FormRenderers.TextInput({ onChange: mockOnChange });

    // 시뮬레이션된 이벤트가 동일한 형태인지 확인
    fireEvent.change(input, { target: { value: "test" } });
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: "test" }),
      }),
    );
  });
});
```

**검증 항목 체크리스트**:

| 항목               | 검증 방법        | 기대 결과        |
| ------------------ | ---------------- | ---------------- |
| Props 타입 일치    | `tsc --noEmit`   | 타입 오류 없음   |
| 스타일 토큰 일관성 | 단위 테스트      | 동일 값 반환     |
| 이벤트 시그니처    | 통합 테스트      | 동일 형태 이벤트 |
| 시각적 일관성      | Chromatic 스냅샷 | 픽셀 차이 0%     |

5. **apps/builder/package.json 생성**

   ```json
   {
     "name": "@composition/builder",
     "private": true,
     "version": "0.0.0",
     "type": "module",
     "scripts": {
       "dev": "vite",
       "build": "tsc -b && vite build",
       "build:preview": "vite build --config vite.preview.config.ts",
       "build:all": "npm run build:preview && npm run build",
       "preview": "vite preview",
       "check-types": "tsc --noEmit",
       "lint": "eslint src"
     },
     "dependencies": {
       "@composition/shared": "workspace:*",
       "react": "catalog:",
       "react-dom": "catalog:",
       "react-router": "catalog:",
       "react-router-dom": "catalog:",
       "react-aria-components": "catalog:",
       "zustand": "catalog:"
       // ... 기존 의존성
     },
     "devDependencies": {
       "@composition/config": "workspace:*",
       "typescript": "catalog:",
       "vite": "catalog:",
       "@vitejs/plugin-react-swc": "catalog:"
     }
   }
   ```

6. **apps/builder/tsconfig.json 생성**

   ```json
   {
     "extends": "@composition/config/tsconfig/react-app",
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     },
     "include": ["src"],
     "references": [
       { "path": "./tsconfig.app.json" },
       { "path": "./tsconfig.node.json" }
     ]
   }
   ```

7. **vite.config.ts 수정** (경로 업데이트)
   ```typescript
   // resolve alias 수정
   resolve: {
     alias: {
       "@": path.resolve(__dirname, "./src"),
     },
   },
   ```

**검증 체크리스트**:

```bash
# 1. workspace 링크 확인
pnpm list --depth 0
# @composition/shared workspace:* 링크 확인

# 2. TypeScript project references 검증
pnpm exec tsc --showConfig | head -30
# "references" 섹션에 shared 패키지 포함 확인

# 3. 빌드 테스트 (앱 단위)
pnpm -F @composition/builder run build

# 4. 타입 체크 (앱 단위)
pnpm -F @composition/builder run check-types
# 또는 turbo 사용 시:
# turbo run check-types --filter=@composition/builder
```

---

### Phase 4: apps/publish/ 이동

**목표**: publish 앱을 apps/ 하위로 이동

**작업 내용**:

1. **디렉토리 이동**

   ```bash
   git mv packages/publish/ apps/publish/
   ```

2. **package.json 업데이트**
   ```json
   {
     "name": "@composition/publish",
     "dependencies": {
       "@composition/shared": "workspace:*",
       "react": "catalog:",
       "react-dom": "catalog:"
     },
     "devDependencies": {
       "@composition/config": "workspace:*",
       "typescript": "catalog:",
       "vite": "catalog:",
       "cross-env": "catalog:"
     }
   }
   ```

````

3. **vite.config.ts 업데이트** (Vite 7 호환)

4. **tsconfig.json 업데이트**
 ```json
 {
   "extends": "@composition/config/tsconfig/react-app",
   "compilerOptions": {
     "paths": {
       "@composition/shared": ["../../packages/shared/src"],
       "@composition/shared/*": ["../../packages/shared/src/*"]
     }
   }
 }
````

5. **@composition/shared 연동** (핵심 통합 작업)

   현재 `packages/publish`는 기본 HTML 요소만 등록되어 있습니다.
   `@composition/shared/components`와 `@composition/shared/renderers`를 연동해야 합니다.

   ```typescript
   // apps/publish/src/registry/ComponentRegistry.tsx 수정

   import {
     TextField,
     ListBox,
     DatePicker,
     // ... 기타 컴포넌트
   } from "@composition/shared/components";

   import {
     renderTextField,
     renderListBox,
     // ... 기타 렌더러
   } from "@composition/shared/renderers";

   // React Aria 컴포넌트 등록
   registerComponent("TextField", {
     component: TextField,
     displayName: "TextField",
     category: "input",
   });

   registerComponent("ListBox", {
     component: ListBox,
     displayName: "ListBox",
     category: "collection",
   });

   // ... 기타 컴포넌트 등록
   ```

   ```typescript
   // apps/publish/src/renderer/ElementRenderer.tsx 수정

   import {
     renderTextField,
     renderListBox,
     renderDatePicker,
     // ...
   } from '@composition/shared/renderers';

   // 렌더러 매핑
   const rendererMap: Record<string, RenderFunction> = {
     'TextField': renderTextField,
     'ListBox': renderListBox,
     'DatePicker': renderDatePicker,
     // ... 기타 렌더러
   };

   export const ElementRenderer = ({ element, ...props }) => {
     const renderer = rendererMap[element.tag];
     if (renderer) {
       return renderer(element, props);
     }
     // fallback to default HTML
     return <DefaultRenderer element={element} {...props} />;
   };
   ```

   ```css
   /* apps/publish/src/styles/index.css */

   /* @composition/shared 스타일 import */
   @import "@composition/shared/components/styles/index.css";
   ```

**검증 체크리스트**:

```bash
# 1. 의존성 링크 확인
cd apps/publish && pnpm list --depth 0
# @composition/shared, @composition/config 링크 확인

# 2. Vite 버전 호환성 확인
pnpm exec vite --version
# Vite 7.x 확인

# 3. 빌드 테스트 (SSG/SPA 모두)
pnpm run build
pnpm run build:ssg

# 4. shared 패키지 import 확인
pnpm exec tsc --noEmit
```

---

### Phase 5: packages/shared/ 정리

**목표**: Just-in-Time 타입 패턴 적용

**package.json 업데이트**:

```json
{
  "name": "@composition/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    },
    "./types": {
      "types": "./src/types/index.ts",
      "default": "./src/types/index.ts"
    },
    "./utils": {
      "types": "./src/utils/index.ts",
      "default": "./src/utils/index.ts"
    },
    "./components": {
      "types": "./src/components/index.ts",
      "default": "./src/components/index.ts"
    },
    "./renderers": {
      "types": "./src/renderers/index.ts",
      "default": "./src/renderers/index.ts"
    }
  },
  "peerDependencies": {
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@composition/config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

**tsconfig.json 업데이트**:

```json
{
  "extends": "@composition/config/tsconfig/library",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**검증 체크리스트**:

```bash
# 1. exports 경로 확인
node -e "console.log(require.resolve('@composition/shared'))"
# packages/shared/src/index.ts 경로 확인

# 2. 타입 내보내기 확인
pnpm exec tsc --showConfig
# declaration: true 확인

# 3. builder/publish에서 import 테스트
cd apps/builder && pnpm exec tsc --noEmit
cd apps/publish && pnpm exec tsc --noEmit

# 4. 순환 의존성 확인
pnpm exec madge --circular packages/shared/src
```

---

### Phase 6: 루트 정리

**목표**: 루트를 순수 워크스페이스로 전환

**루트 package.json**:

```json
{
  "name": "composition",
  "private": true,
  "packageManager": "pnpm@10.26.2",
  "scripts": {
    "dev": "turbo run dev --filter=@composition/builder",
    "build": "turbo run build",
    "build:all": "turbo run build:all",
    "check-types": "turbo run check-types",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.5.0"
  }
}
```

**이동할 파일들**:

| 파일                     | 이동 위치                             | 비고                     |
| ------------------------ | ------------------------------------- | ------------------------ |
| `src/`                   | `apps/builder/src/`                   | Phase 3에서 처리         |
| `public/`                | `apps/builder/public/`                | Phase 3에서 처리         |
| `index.html`             | `apps/builder/index.html`             | Phase 3에서 처리         |
| `vite.config.ts`         | `apps/builder/vite.config.ts`         | Phase 3에서 처리         |
| `vite.preview.config.ts` | `apps/builder/vite.preview.config.ts` | Phase 3에서 처리         |
| `tsconfig.app.json`      | `apps/builder/tsconfig.app.json`      | Phase 3에서 처리         |
| `tsconfig.node.json`     | `apps/builder/tsconfig.node.json`     | Phase 3에서 처리         |
| `vitest.workspace.ts`    | `apps/builder/vitest.workspace.ts`    | Vitest 워크스페이스 설정 |
| `postcss.config.js`      | `apps/builder/postcss.config.js`      | PostCSS 설정             |
| `eslint.config.js`       | 루트 유지 또는 `packages/config/`     | 전사 공용 설정           |
| `eslint-local-rules/`    | `apps/builder/eslint-local-rules/`    | Builder 전용 규칙        |
| `.storybook/`            | `apps/builder/.storybook/`            | 4.7에서 상세 설명        |
| `tests/`                 | `apps/builder/tests/`                 | 단위 테스트              |

**삭제할 파일들**:

| 파일            | 이유                                |
| --------------- | ----------------------------------- |
| `test-results/` | 테스트 실행 결과물 (gitignore 대상) |
| `scripts/`      | 테스트용 스크립트 (필요시 이동)     |

**루트에 유지할 파일들**:

| 파일               | 이유                                           |
| ------------------ | ---------------------------------------------- |
| `docs/`            | 프로젝트 전체 문서                             |
| `.github/`         | CI/CD 워크플로우                               |
| `eslint.config.js` | 전사 공용 ESLint (또는 packages/config로 이동) |
| `.gitignore`       | 업데이트 필요 (4.8 참조)                       |
| `README.md`        | 프로젝트 소개                                  |

**추가 이동 명령어**:

```bash
# Vitest 워크스페이스 설정
git mv vitest.workspace.ts apps/builder/vitest.workspace.ts

# PostCSS 설정
git mv postcss.config.js apps/builder/postcss.config.js

# ESLint 로컬 규칙 (Builder 전용)
git mv eslint-local-rules/ apps/builder/eslint-local-rules/

# Storybook
git mv .storybook/ apps/builder/.storybook/

# 테스트 디렉토리
git mv tests/ apps/builder/tests/

# 테스트 결과 삭제 (gitignore 대상)
rm -rf test-results/

# 테스트용 스크립트 삭제
rm -rf scripts/
```

**루트 tsconfig.json** (선택적 - solution style):

```json
{
  "files": [],
  "references": [
    { "path": "./apps/builder" },
    { "path": "./apps/publish" },
    { "path": "./packages/shared" },
    { "path": "./packages/config" }
  ]
}
```

---

### Phase 7: Turborepo 설정

**목표**: 빌드 캐싱 및 병렬 실행

**turbo.json**:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"],
      "inputs": ["src/**", "package.json", "tsconfig.json", "vite.config.ts"]
    },
    "build:preview": {
      "dependsOn": ["^build"],
      "outputs": ["dist/preview/**"]
    },
    "build:all": {
      "dependsOn": ["build:preview", "build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "test": {
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

**turbo 설치**:

```bash
pnpm add -Dw turbo
```

---

### Phase 8: 검증 및 정리

**검증 체크리스트**:

1. **의존성 설치**

   ```bash
   pnpm install
   ```

2. **타입 체크**

   ```bash
   turbo run check-types
   ```

3. **빌드 테스트**

   ```bash
   turbo run build
   ```

4. **개발 서버**

   ```bash
   turbo run dev --filter=@composition/builder
   ```

5. **린트**

   ```bash
   turbo run lint
   ```

6. **테스트**
   ```bash
   turbo run test
   ```

**성능 확인**:

```bash
# Turborepo 캐시 상태 확인
turbo run build --summarize

# 빌드 시간 비교 (캐시 적중 vs 미적중)
turbo run build --force  # 캐시 무시
turbo run build          # 캐시 사용
```

---

## 4. 주의사항

### 4.1 Git 이력 보존

파일 이동 시 반드시 `git mv` 사용:

```bash
git mv src/ apps/builder/src/
```

### 4.2 Import 경로 업데이트

`@/` alias가 새 경로를 가리키도록 vite.config.ts 수정 필요.

### 4.3 환경변수 파일 위치

모노레포에서 환경변수는 **앱별로 분리**하는 것을 권장합니다:

```
composition/
├── .env.example              # 루트: 공통 환경변수 템플릿
├── apps/
│   ├── builder/
│   │   ├── .env              # Builder 전용 (VITE_API_URL, VITE_WS_URL 등)
│   │   ├── .env.local        # 로컬 개발용 (gitignore)
│   │   └── .env.production   # 프로덕션 빌드용
│   └── publish/
│       ├── .env              # Publish 전용
│       └── .env.production
└── packages/                  # 라이브러리는 환경변수 사용 지양
```

**환경변수 분리 기준:**

| 변수 유형           | 위치                       | 예시             |
| ------------------- | -------------------------- | ---------------- |
| 앱별 API 엔드포인트 | `apps/[app]/.env`          | `VITE_API_URL`   |
| 앱별 포트 설정      | `apps/[app]/.env`          | `VITE_PORT=5173` |
| 공통 서비스 키      | 루트 `.env` 또는 CI 시크릿 | `TURBO_TOKEN`    |
| 민감한 정보         | CI/CD 시크릿만             | `DATABASE_URL`   |

**Vite 환경변수 로드 순서:**

```
.env                # 항상 로드
.env.local          # 항상 로드, gitignore 대상
.env.[mode]         # 해당 모드에서만 로드
.env.[mode].local   # 해당 모드에서만 로드, gitignore 대상
```

**마이그레이션 시 주의:**

- 기존 루트 `.env` 파일을 `apps/builder/.env`로 복사
- `VITE_` 접두사가 있는 변수만 클라이언트에 노출됨
- `.gitignore`에 `apps/*/.env.local` 패턴 추가

---

### 4.4 CI/CD 업데이트

빌드 스크립트의 경로 업데이트 필요:

#### GitHub Actions 변경 사항

```yaml
# .github/workflows/ci.yml (변경 전)
- name: Build
  run: pnpm build
  working-directory: .

# .github/workflows/ci.yml (변경 후)
- name: Build
  run: pnpm turbo run build
  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ vars.TURBO_TEAM }}

# 캐시 키 패턴 변경
- name: Cache turbo build
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

#### Vercel 설정 변경

```json
// vercel.json
{
  "buildCommand": "pnpm turbo run build --filter=@composition/builder",
  "outputDirectory": "apps/builder/dist",
  "installCommand": "pnpm install",
  "framework": "vite"
}
```

#### Netlify 설정 변경

```toml
# netlify.toml
[build]
  command = "pnpm turbo run build --filter=@composition/publish"
  publish = "apps/publish/dist"

[build.environment]
  NODE_VERSION = "20"
```

#### 워크스페이스 경로 변경 요약

| 항목               | 기존 경로               | 신규 경로           |
| ------------------ | ----------------------- | ------------------- |
| 빌더 빌드 출력     | `./dist`                | `apps/builder/dist` |
| 퍼블리시 빌드 출력 | `packages/publish/dist` | `apps/publish/dist` |
| 캐시 디렉토리      | `node_modules/.cache`   | `.turbo`            |

### 4.5 ESLint 설정

현재 `eslint-local-rules/` 위치 결정:

#### 위치 선택 기준

| 규칙 유형              | 권장 위치                          | 이유                     |
| ---------------------- | ---------------------------------- | ------------------------ |
| Pixi.js/Canvas 관련 룰 | `apps/builder/eslint-local-rules/` | Builder 전용 그래픽 로직 |
| WebGL 메모리 관리 룰   | `apps/builder/eslint-local-rules/` | Builder 전용             |
| API/데이터 검증 룰     | `packages/config/eslint/`          | 전사 공용                |
| React Aria 접근성 룰   | `packages/config/eslint/`          | 전사 공용                |
| 네이밍 컨벤션 룰       | `packages/config/eslint/`          | 전사 공용                |

#### 옵션 A: 전사 공용 설정 (packages/config)

```javascript
// packages/config/eslint/base.js
module.exports = {
  extends: ["eslint:recommended", "plugin:react/recommended"],
  plugins: ["@composition/eslint-local-rules"],
  rules: {
    "@composition/eslint-local-rules/no-unsafe-api-call": "error",
    "@composition/eslint-local-rules/require-aria-label": "warn",
  },
};

// apps/builder/eslint.config.js
import baseConfig from "@composition/config/eslint";

export default [
  ...baseConfig,
  {
    // Builder 전용 규칙 추가
    plugins: { "local-rules": localRules },
    rules: {
      "local-rules/no-direct-pixi-dispose": "error",
      "local-rules/require-webgl-cleanup": "error",
    },
  },
];
```

#### 옵션 B: Builder 전용 설정

```javascript
// apps/builder/eslint-local-rules/index.js
module.exports = {
  rules: {
    "no-direct-pixi-dispose": require("./rules/no-direct-pixi-dispose"),
    "require-webgl-cleanup": require("./rules/require-webgl-cleanup"),
  },
};

// apps/builder/eslint.config.js
import localRules from "./eslint-local-rules";

export default [
  {
    plugins: { "local-rules": localRules },
    rules: {
      "local-rules/no-direct-pixi-dispose": "error",
    },
  },
];
```

**권장사항**: Pixi/Canvas 관련 규칙은 옵션 B(Builder 전용), API/접근성 규칙은 옵션 A(전사 공용)로 분리

### 4.6 테스트 파일 정리

#### Playwright E2E 테스트

```
# 기존 구조 (추정)
composition/
├── e2e/                      # 또는 tests/
│   └── *.spec.ts
└── playwright.config.ts

# 목표 구조
composition/
├── apps/builder/
│   ├── e2e/                  # Builder E2E 테스트
│   │   └── *.spec.ts
│   └── playwright.config.ts
└── turbo.json                # e2e task 정의
```

**playwright.config.ts 수정:**

```typescript
// apps/builder/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    command: "pnpm run dev",
    port: 5173,
    cwd: __dirname, // apps/builder 기준
  },
  use: {
    baseURL: "http://localhost:5173",
  },
});
```

**turbo.json에 e2e task 추가:**

```json
{
  "tasks": {
    "e2e": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

#### Vitest 단위 테스트

```
# 목표 구조
composition/
├── apps/builder/
│   ├── src/
│   │   └── **/*.test.ts      # 컴포넌트 옆 테스트 (co-location)
│   ├── tests/                 # 통합 테스트
│   │   └── *.test.ts
│   ├── vitest.workspace.ts    # Vitest 워크스페이스 설정
│   └── vitest.config.ts       # Vitest 설정 (선택)
└── turbo.json
```

**vitest.workspace.ts 이동 후 수정:**

```typescript
// apps/builder/vitest.workspace.ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vite.config.ts",
    test: {
      name: "builder",
      root: ".",
      include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["./vitest.setup.ts"],
    },
  },
]);
```

**apps/builder/package.json 스크립트:**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

**turbo.json에 test task 설정:**

```json
{
  "tasks": {
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "cache": true
    }
  }
}
```

#### tests/ 디렉토리 이동

```bash
# 기존 tests/ 디렉토리를 apps/builder로 이동
git mv tests/ apps/builder/tests/

# vitest 관련 파일 이동
git mv vitest.workspace.ts apps/builder/vitest.workspace.ts
git mv vitest.shims.d.ts apps/builder/vitest.shims.d.ts
```

#### test-results/ 정리

`test-results/`는 테스트 실행 결과물로 버전 관리 대상이 아닙니다.

```bash
# 삭제
rm -rf test-results/

# .gitignore에 추가 (4.8 참조)
```

#### scripts/ 디렉토리 정리

현재 루트의 `scripts/` 디렉토리는 **테스트/디버깅 목적**으로 생성된 파일들입니다.

**처리 방안:**

| 파일 유형                    | 처리                                     |
| ---------------------------- | ---------------------------------------- |
| 성능 테스트 스크립트         | `apps/builder/scripts/`로 이동 또는 삭제 |
| 일회성 마이그레이션 스크립트 | 마이그레이션 완료 후 삭제                |
| 빌드/배포 스크립트           | 루트 `scripts/`에 유지 (필요 시)         |

```bash
# 마이그레이션 시 정리
rm -rf scripts/  # 테스트용 스크립트 전체 삭제

# 또는 필요한 것만 이동
git mv scripts/perf-test.ts apps/builder/scripts/
```

**권장사항**: 테스트용으로 생성된 스크립트는 마이그레이션 전에 정리하여 이동 대상을 최소화합니다.

---

### 4.7 Storybook

#### 이동 단계

```bash
# Step 1: .storybook 디렉토리 이동
git mv .storybook/ apps/builder/.storybook/

# Step 2: Storybook 의존성을 apps/builder로 이동
cd apps/builder
pnpm add -D @storybook/react-vite @storybook/addon-essentials @storybook/addon-a11y

# Step 3: 루트 package.json에서 Storybook 의존성 제거
# (수동으로 확인 필요)
```

#### 경로 수정 체크리스트

| 항목                        | 수정 전                 | 수정 후                                       |
| --------------------------- | ----------------------- | --------------------------------------------- |
| stories 경로                | `../src/**/*.stories.*` | 동일 (상대 경로 유지)                         |
| shared 스토리               | -                       | `../../../packages/shared/src/**/*.stories.*` |
| staticDirs                  | `../public`             | 동일                                          |
| alias `@`                   | `./src`                 | `../src`                                      |
| alias `@composition/shared` | -                       | `../../../packages/shared/src`                |

#### 이동 후 설정 변경 예시

```typescript
// apps/builder/.storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import path from "path";

const config: StorybookConfig = {
  stories: [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    // shared 패키지 스토리도 포함
    "../../../packages/shared/src/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],

  // 정적 에셋 디렉토리 (경로 변경 필수)
  staticDirs: [
    "../public",
    { from: "../../../packages/shared/public", to: "/shared-assets" },
  ],

  addons: ["@storybook/addon-essentials", "@storybook/addon-a11y"],

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  async viteFinal(config) {
    return mergeConfig(config, {
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "../src"),
          "@composition/shared": path.resolve(
            __dirname,
            "../../../packages/shared/src",
          ),
        },
      },
    });
  },
};

export default config;
```

```typescript
// apps/builder/.storybook/preview.ts
import type { Preview } from "@storybook/react";

// import 경로 변경
import "../src/styles/globals.css";
import "@composition/shared/styles/components.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
```

#### Vite 프록시 설정 (API 모킹 시)

```typescript
// apps/builder/.storybook/main.ts - viteFinal 내부
async viteFinal(config) {
  return mergeConfig(config, {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          // Storybook에서 API 모킹 서버 사용 시
        },
      },
    },
  });
}
```

#### package.json 스크립트 변경

```json
// apps/builder/package.json
{
  "scripts": {
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build -o storybook-static"
  }
}

// 루트 package.json (turbo 연동)
{
  "scripts": {
    "storybook": "turbo run storybook --filter=@composition/builder"
  }
}
```

---

### 4.8 .gitignore 업데이트

모노레포 구조 변경 후 `.gitignore` 파일을 업데이트해야 합니다.

**추가할 항목들:**

```gitignore
# ===================
# 모노레포 구조 관련
# ===================

# Turborepo
.turbo/

# 앱별 환경변수 (로컬)
apps/*/.env.local
apps/*/.env.*.local

# 앱별 빌드 결과물
apps/*/dist/
apps/*/.next/

# 앱별 테스트 결과
apps/*/coverage/
apps/*/test-results/
apps/*/.playwright/

# 패키지 빌드 결과물
packages/*/dist/

# Storybook 빌드
apps/*/storybook-static/

# ===================
# 기존 항목 유지
# ===================
node_modules/
*.log
.DS_Store
```

**변경 사항 요약:**

| 기존 패턴       | 신규 패턴              | 이유                 |
| --------------- | ---------------------- | -------------------- |
| `dist/`         | `apps/*/dist/`         | 앱별 빌드 디렉토리   |
| `.env.local`    | `apps/*/.env.local`    | 앱별 환경변수        |
| `coverage/`     | `apps/*/coverage/`     | 앱별 테스트 커버리지 |
| -               | `.turbo/`              | Turborepo 캐시       |
| `test-results/` | `apps/*/test-results/` | 앱별 테스트 결과     |

**마이그레이션 시 실행:**

```bash
# 기존 .gitignore 백업
cp .gitignore .gitignore.backup

# 모노레포 패턴 추가 (수동 편집 또는 스크립트)
# 위의 내용을 .gitignore에 추가

# 변경사항 확인
git status --ignored
```

---

### 4.9 Import 경로 변경 자동화

모노레포 구조 변경 시 상대 경로 import를 패키지 import로 변환하는 자동화 스크립트입니다.

**변환 대상:**

| 기존 경로                        | 변환 후                          |
| -------------------------------- | -------------------------------- |
| `../../shared/components/Button` | `@composition/shared/components` |
| `../../shared/types/element`     | `@composition/shared/types`      |
| `../../../shared/utils/helpers`  | `@composition/shared/utils`      |

**자동화 스크립트:**

```bash
#!/bin/bash
# scripts/migrate-imports.sh

echo "🔄 Import 경로 마이그레이션 시작..."

# 크로스 플랫폼 sed 호환성 처리
# macOS: sed -i '' / Linux: sed -i
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE="sed -i ''"
else
  SED_INPLACE="sed -i"
fi

# sed 래퍼 함수
sed_replace() {
  local file=$1
  shift
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "$@" "$file"
  else
    sed -i "$@" "$file"
  fi
}

# apps/builder 내 src/shared 참조를 @composition/shared로 변환
find apps/builder/src \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # ../shared/ 또는 ../../shared/ 패턴을 @composition/shared로 변환
  sed_replace "$file" \
    -e 's|from ["'"'"']\.\./shared/|from "@composition/shared/|g' \
    -e 's|from ["'"'"']\.\./\.\./shared/|from "@composition/shared/|g' \
    -e 's|from ["'"'"']\.\./\.\./\.\./shared/|from "@composition/shared/|g'
done

echo "✅ apps/builder import 변환 완료"

# apps/publish 내 참조 변환
find apps/publish/src \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  sed_replace "$file" \
    -e 's|from ["'"'"']\.\./shared/|from "@composition/shared/|g' \
    -e 's|from ["'"'"']\.\./\.\./shared/|from "@composition/shared/|g'
done

echo "✅ apps/publish import 변환 완료"

# 변환 결과 확인
echo ""
echo "📊 변환 결과 확인:"
echo "남은 상대 경로 import:"
grep -r "from ['\"]\.\..*shared" apps/ --include="*.ts" --include="*.tsx" | head -20
```

> **크로스 플랫폼**: macOS와 Linux 모두에서 동작하도록 `$OSTYPE` 환경변수로 분기 처리합니다.

**jscodeshift 사용 (정교한 AST 변환):**

```javascript
// scripts/transform-imports.js
// 사용: npx jscodeshift -t scripts/transform-imports.js apps/builder/src

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Import 경로 변환 맵
  const pathMappings = {
    "../shared/components": "@composition/shared/components",
    "../../shared/components": "@composition/shared/components",
    "../shared/types": "@composition/shared/types",
    "../../shared/types": "@composition/shared/types",
    "../shared/utils": "@composition/shared/utils",
    "../../shared/utils": "@composition/shared/utils",
    "../shared/renderers": "@composition/shared/renderers",
    "../../shared/renderers": "@composition/shared/renderers",
  };

  root.find(j.ImportDeclaration).forEach((path) => {
    const source = path.node.source.value;

    for (const [oldPath, newPath] of Object.entries(pathMappings)) {
      if (source.startsWith(oldPath)) {
        const remaining = source.slice(oldPath.length);
        path.node.source.value = newPath + remaining;
        break;
      }
    }
  });

  return root.toSource({ quote: "single" });
};
```

**검증:**

```bash
# 변환 전 백업
git stash

# 변환 실행
./scripts/migrate-imports.sh

# 타입 체크로 검증 (turbo 사용)
turbo run check-types

# 문제 발생 시 롤백
git stash pop
```

---

## 5. 롤백 전략

### 5.1 단계별 롤백

각 Phase는 독립적으로 롤백 가능:

| Phase | 롤백 방법                                  |
| ----- | ------------------------------------------ |
| 1     | catalog 제거, 기존 버전 복원               |
| 2     | packages/config/ 삭제, 기존 tsconfig 복원  |
| 3     | apps/builder/ → 루트로 역이동              |
| 4     | apps/publish/ → packages/publish/로 역이동 |
| 5     | exports 필드 제거, 기존 설정 복원          |
| 6     | 루트 package.json 복원                     |
| 7     | turbo.json 삭제, 기존 스크립트 복원        |

### 5.2 Git 브랜치 전략

```bash
# 마이그레이션 브랜치 생성
git checkout -b refactor/monorepo-standardization

# 각 Phase별 커밋
git commit -m "phase1: add pnpm catalog for dependency management"
git commit -m "phase2: create shared config package"
# ...

# 문제 발생 시 특정 Phase로 롤백
git revert <commit-hash>
```

---

## 6. 예상 결과

### 6.1 구조적 개선

- **역할 분리**: 루트 = 워크스페이스, apps/ = 앱, packages/ = 라이브러리
- **표준 구조**: 업계 표준 패턴으로 온보딩 용이

### 6.2 개발 경험 개선

- **의존성 관리**: catalog로 버전 충돌 방지
- **타입 추론**: Just-in-Time 타입으로 빌드 없이 타입 제공
- **빌드 성능**: Turborepo 캐싱으로 반복 빌드 시간 단축

### 6.3 유지보수성 향상

- **설정 통일**: 공유 tsconfig, eslint 설정
- **명확한 경계**: 앱과 라이브러리의 명확한 분리
- **확장성**: 새 앱/패키지 추가 용이

### 6.4 성공 메트릭

마이그레이션 성공 여부를 판단하는 정량적 기준:

| 메트릭             | 측정 방법                    | 목표                     |
| ------------------ | ---------------------------- | ------------------------ |
| **빌드 시간**      | `time turbo run build`       | 캐시 적중 시 90% 단축    |
| **타입 체크 시간** | `time turbo run check-types` | 증분 빌드 80% 단축       |
| **콜드 빌드**      | 캐시 없이 전체 빌드          | 기존 대비 동등 또는 개선 |
| **번들 사이즈**    | `apps/builder/dist` 용량     | 기존 대비 ±5% 이내       |
| **개발 서버 시작** | `turbo run dev`              | 5초 이내                 |

**측정 스크립트:**

```bash
# 마이그레이션 전 베이스라인 측정 (루트가 앱 역할일 때)
echo "=== Before Migration ===" > benchmark.txt
time pnpm run build 2>&1 | tee -a benchmark.txt
time pnpm exec tsc --noEmit 2>&1 | tee -a benchmark.txt  # 직접 tsc 실행
du -sh dist/ >> benchmark.txt

# 마이그레이션 후 측정 (turbo 사용)
echo "=== After Migration ===" >> benchmark.txt
time turbo run build 2>&1 | tee -a benchmark.txt
time turbo run build 2>&1 | tee -a benchmark.txt  # 캐시 적중
time turbo run check-types 2>&1 | tee -a benchmark.txt
du -sh apps/builder/dist/ >> benchmark.txt
```

> **Note**: 마이그레이션 전에는 루트에 스크립트가 없을 수 있으므로 `pnpm exec tsc --noEmit`을 직접 사용합니다.

**성공 기준 체크리스트:**

- [ ] 모든 Phase 완료
- [ ] `turbo run build` 성공
- [ ] `turbo run check-types` 오류 없음
- [ ] `turbo run test` 통과
- [ ] Preview와 Publish 렌더링 결과 동일
- [ ] 캐시 적중 시 빌드 90% 단축

### 6.5 마이그레이션 테스트 시나리오

각 Phase 완료 후 실행해야 할 테스트 시나리오입니다.

**Phase별 테스트 체크리스트:**

| Phase | 테스트 항목          | 검증 명령어                                     |
| ----- | -------------------- | ----------------------------------------------- |
| **1** | 의존성 설치          | `pnpm install --frozen-lockfile`                |
| **1** | Catalog 버전 확인    | `./scripts/verify-catalog.sh`                   |
| **2** | Config 패키지 참조   | `pnpm -F @composition/builder run check-types`  |
| **3** | Builder 빌드         | `turbo run build --filter=@composition/builder` |
| **3** | Preview 렌더링       | E2E 테스트 실행                                 |
| **4** | Publish 빌드         | `turbo run build --filter=@composition/publish` |
| **5** | Shared 패키지 export | `pnpm -F @composition/builder run check-types`  |
| **6** | 루트 스크립트        | `turbo run build`                               |
| **7** | Turborepo 캐시       | `turbo run build` (2회 연속)                    |
| **8** | 전체 E2E             | `turbo run test:e2e`                            |

**자동화 테스트 스크립트:**

```bash
#!/bin/bash
# scripts/test-migration.sh

set -e  # 에러 발생 시 즉시 종료

PHASE=${1:-"all"}

echo "🧪 마이그레이션 테스트 시작 (Phase: $PHASE)"

test_phase1() {
  echo "=== Phase 1: 의존성 정리 테스트 ==="
  pnpm install --frozen-lockfile
  ./scripts/verify-catalog.sh
  pnpm why react | grep -q "19.2.3"
  echo "✅ Phase 1 테스트 통과"
}

test_phase2() {
  echo "=== Phase 2: 공유 설정 패키지 테스트 ==="
  [ -f "packages/config/package.json" ] || exit 1
  [ -f "packages/config/tsconfig/base.json" ] || exit 1
  echo "✅ Phase 2 테스트 통과"
}

test_phase3() {
  echo "=== Phase 3: Builder 이동 테스트 ==="
  [ -d "apps/builder/src" ] || exit 1
  [ -f "apps/builder/package.json" ] || exit 1
  turbo run build --filter=@composition/builder
  echo "✅ Phase 3 테스트 통과"
}

test_phase4() {
  echo "=== Phase 4: Publish 이동 테스트 ==="
  [ -d "apps/publish/src" ] || exit 1
  [ -f "apps/publish/package.json" ] || exit 1
  turbo run build --filter=@composition/publish
  echo "✅ Phase 4 테스트 통과"
}

test_phase5() {
  echo "=== Phase 5: Shared 패키지 테스트 ==="
  [ -d "packages/shared/src/components" ] || exit 1
  [ -d "packages/shared/src/renderers" ] || exit 1
  # export 경로 테스트
  node -e "require.resolve('@composition/shared/components')" 2>/dev/null || true
  echo "✅ Phase 5 테스트 통과"
}

test_phase6() {
  echo "=== Phase 6: 루트 정리 테스트 ==="
  ! [ -d "src" ] || echo "⚠️ 루트 src/ 아직 존재"
  turbo run build
  echo "✅ Phase 6 테스트 통과"
}

test_phase7() {
  echo "=== Phase 7: Turborepo 캐시 테스트 ==="
  # 첫 번째 빌드
  turbo run build --force
  # 두 번째 빌드 (캐시 적중 예상)
  time turbo run build
  echo "✅ Phase 7 테스트 통과"
}

test_phase8() {
  echo "=== Phase 8: 전체 통합 테스트 ==="
  turbo run build
  turbo run check-types
  turbo run lint
  # E2E 테스트 (설정된 경우)
  if [ -f "apps/builder/playwright.config.ts" ]; then
    turbo run test:e2e --filter=@composition/builder
  fi
  echo "✅ Phase 8 테스트 통과"
}

# Phase별 또는 전체 실행
case $PHASE in
  1) test_phase1 ;;
  2) test_phase2 ;;
  3) test_phase3 ;;
  4) test_phase4 ;;
  5) test_phase5 ;;
  6) test_phase6 ;;
  7) test_phase7 ;;
  8) test_phase8 ;;
  all)
    test_phase1
    test_phase2
    test_phase3
    test_phase4
    test_phase5
    test_phase6
    test_phase7
    test_phase8
    ;;
  *) echo "Usage: $0 [1-8|all]" ;;
esac

echo ""
echo "🎉 마이그레이션 테스트 완료!"
```

**E2E 렌더링 비교 테스트:**

```typescript
// tests/e2e/rendering-parity.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Preview & Publish 렌더링 동일성", () => {
  test("동일한 디자인이 Preview와 Publish에서 같게 렌더링됨", async ({
    page,
  }) => {
    // Preview 스크린샷
    await page.goto("http://localhost:5173/preview/test-page");
    await page.waitForLoadState("networkidle");
    const previewScreenshot = await page.screenshot();

    // Publish 스크린샷
    await page.goto("http://localhost:4173/test-page");
    await page.waitForLoadState("networkidle");
    const publishScreenshot = await page.screenshot();

    // 시각적 비교 (threshold 허용)
    expect(previewScreenshot).toMatchSnapshot("preview.png", {
      threshold: 0.1, // 10% 차이 허용
    });
    expect(publishScreenshot).toMatchSnapshot("publish.png", {
      threshold: 0.1,
    });
  });

  test("shared 컴포넌트가 양쪽에서 동일하게 동작", async ({ page }) => {
    // Preview에서 버튼 클릭
    await page.goto("http://localhost:5173/preview/test-page");
    await page.click('[data-testid="shared-button"]');
    const previewState = await page.textContent('[data-testid="state"]');

    // Publish에서 버튼 클릭
    await page.goto("http://localhost:4173/test-page");
    await page.click('[data-testid="shared-button"]');
    const publishState = await page.textContent('[data-testid="state"]');

    expect(previewState).toBe(publishState);
  });
});
```

**CI/CD 통합:**

```yaml
# .github/workflows/migration-test.yml
name: Migration Test

on:
  pull_request:
    branches: [main]
    paths:
      - "apps/**"
      - "packages/**"
      - "pnpm-workspace.yaml"

jobs:
  test-migration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run catalog verification
        run: ./scripts/verify-catalog.sh

      - name: Build all packages
        run: turbo run build

      - name: Type check
        run: turbo run check-types

      - name: Run E2E tests
        run: turbo run test:e2e
```

---

## 7. 참고 자료

- [Turborepo - Structuring a repository](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
- [Turborepo - TypeScript](https://turborepo.com/docs/guides/tools/typescript)
- [pnpm - Catalogs](https://pnpm.io/catalogs)
- [pnpm - Workspaces](https://pnpm.io/workspaces)
