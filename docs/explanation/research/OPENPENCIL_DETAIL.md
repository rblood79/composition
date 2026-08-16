# OpenPencil의 언어/기술 스택 상세 설명

**OpenPencil**은 **v0.7.5** 이후 TypeScript + Electron 기반을 완전히 버리고, **Rust를 중심으로 재작성**된 프로젝트입니다.  
현재 제품의 핵심은 **Rust workspace**이며, 웹 쪽은 얇은 **WASM 기반 SDK**로 분리되어 있습니다.

---

## 1. 전체 아키텍처 개요

| 구분 | 기술 | 역할 |
|------|------|------|
| **코어 엔진** | Rust (`crates/`) | 편집기 상태, 위젯, 호스트, MCP, AI, 코드 생성 등 **제품 전체** |
| **렌더링** | GPU Skia | 네이티브: `skia-safe` (GL)<br>브라우저: **CanvasKit** (WASM + WebGL2) |
| **UI 프레임워크** | `jian` (vendored) | 순수 Rust GPU-Skia 기반 위젯/레이아웃/이벤트/핫 리로드 |
| **윈도우** | `winit` (casement fork) | 네이티브 창 관리 |
| **데스크톱** | 네이티브 바이너리 | Chromium/Electron **없음** (단일 바이너리 ~55.5 MB) |
| **웹 SDK** | TypeScript + WASM | 읽기 전용 `.op` 뷰어 (`op-web-sdk` + React/Vue 어댑터) |
| **CLI** | Rust (`op`) | 터미널에서 디자인 제어 |

핵심 철학은 **“하나의 Rust 코어 → 여러 타깃으로 컴파일”**입니다.
- 네이티브 데스크톱/모바일
- 브라우저 (WASM)
- CLI

동일한 편집기 상태와 렌더링 로직을 공유합니다.

---

## 2. Rust 코어 엔진 (`crates/`)

제품의 본체는 Cargo workspace로 구성됩니다.

### 주요 크레이트 구조

```
crates/
├── op-editor-core/       # 핵심: `.op`(PenDocument) 상태 + EditorCommand + 디자인 변수
├── op-editor-ui/         # 플랫폼 독립 위젯 + RenderBackend 추상화 (wasm32-clean)
├── op-editor-host-core/  # 모든 호스트가 공유하는 상태 머신
├── op-host-native/       # 네이티브 호스트 (winit + skia-safe GL) — 데스크톱/모바일
├── op-host-web/          # 브라우저 번들: wasm32 cdylib + CanvasKit 렌더러
├── op-host-desktop/      # 데스크톱 바이너리 `openpencil-desktop` (+ --serve-web 데몬)
├── op-cli/               # `op` 명령줄 도구
├── op-mcp / op-ai / op-codegen / op-orchestrator ...  # MCP, AI, 코드생성 등
└── ...
```

### 렌더링 통일
- **네이티브**: `skia-safe`로 OpenGL 컨텍스트에 그림
- **브라우저**: 같은 로직을 **CanvasKit**(Skia의 WASM 포트)로 WebGL2에 그림  
→ 동일한 그리기 코드, 동일한 결과물

### 성능/크기 이점 (공식 비교)

| 항목 | 이전 (TS + Electron) | 현재 (Rust) |
|------|----------------------|-------------|
| 데스크톱 런타임 | Chromium + Node.js | 네이티브 (winit + Skia) |
| 데스크톱 크기 | 큰 Chromium 포함 | ~55.5 MB 단일 바이너리 |
| 웹 페이로드 | JS + WASM | ~8.2 MB WASM / gzip ~2.18 MB |
| 렌더링 | 웹만 CanvasKit | **모든 플랫폼** GPU Skia |
| 메모리 | JS GC 일시 정지 | 소유권 모델, GC 없음 |
| 코드 공유 | 플랫폼별 분리 필요 | **하나의 코어**로 네이티브 + WASM |

---

## 3. WASM 기반 웹 SDK (`packages/`)

웹 쪽은 **얇은 TypeScript 레이어**입니다.

```
packages/
├── op-web-sdk/           # 읽기 전용 `.op` 뷰어 SDK (op-host-web WASM 번들을 래핑)
├── op-web-sdk-react/     # React 19 어댑터
└── op-web-sdk-vue/       # Vue 3 어댑터
```

- `op-host-web` 크레이트가 `wasm32-unknown-unknown` 타깃으로 컴파일되어 CanvasKit과 함께 브라우저에서 실행됩니다.
- SDK는 이 WASM을 감싸서 **외부 앱에 임베드 가능한 읽기 전용 뷰어**를 제공합니다.
- Bun + Node.js는 **SDK 빌드/린트용**으로만 필요하며, 제품 본체 빌드에는 필요하지 않습니다.

웹 개발 서버 예시:
```bash
bash scripts/start-web-rust.sh   # CanvasKit WASM 번들 빌드 후 headless web host 실행
```

---

## 4. 왜 Rust로 전환했는가? (공식 이유)

| 항목 | 이전 (TS + Electron) | 현재 (Rust) |
|------|----------------------|-------------|
| 데스크톱 런타임 | Chromium + Node.js | 네이티브 (winit + Skia) |
| 데스크톱 크기 | 큰 Chromium 포함 | ~55.5 MB 단일 바이너리 |
| 웹 페이로드 | JS + WASM | ~8.2 MB WASM |
| 렌더링 | 웹만 CanvasKit | **모든 플랫폼** GPU Skia |
| 메모리 | JS GC 일시 정지 | 소유권 모델, GC 없음 |
| 코드 공유 | 플랫폼별 분리 필요 | **하나의 코어**로 네이티브 + WASM |

**한 줄 요약**:  
“더 작고, 더 빠르고, 더 많은 플랫폼을 하나의 코드베이스로”.

---

## 5. 개발/빌드 환경

- **제품 본체**: Rust (stable) + Cargo
- **웹 SDK**: Bun ≥ 1.0 + Node.js ≥ 18 (`packages/` 전용)
- **서브모듈**:
  - `jian` — GPU-Skia UI 프레임워크
  - `casement` — winit fork
  - `agent` — agent-rs (AI 런타임)

### 주요 실행 명령어

```bash
# 데스크톱 앱 실행
cargo run -p op-host-desktop

# 웹 개발 서버 (CanvasKit WASM 번들 빌드 포함)
bash scripts/start-web-rust.sh

# 전체 워크스페이스 빌드
cargo build --workspace --release
```

---

## 정리

OpenPencil은 **Rust를 단일 소스로 삼아** 편집기·렌더링·AI·MCP를 모두 구현하고,  
웹에서는 그 코어를 **WASM(CanvasKit)으로 컴파일**해 브라우저에서 돌리며,  
외부 통합을 위해 얇은 **TypeScript SDK**를 제공하는 구조입니다.

이전 TypeScript/Electron 코드는 `v0.7.5` 이후 완전히 폐기되었고,  
현재 저장소는 **순수 Rust workspace**입니다.

---

*문서 생성일: 2026년 8월 17일*  
*출처: [ZSeven-W/openpencil](https://github.com/ZSeven-W/openpencil) 공식 README 및 CLAUDE.md*