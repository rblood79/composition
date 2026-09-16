import { defineConfig } from "tsup";

// ADR-201 HC1 — esm/cjs 3 entry (`.` / `./react` / `./vanilla`) + IIFE 1개 (JSP `<script>` 단독 사용).
// react 는 `./react` entry 의 optional peer 라 external, 나머지 런타임 의존 0.
export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.ts",
      "vanilla/index": "src/vanilla/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    target: "es2020",
    external: ["react"],
    treeshake: true,
  },
  {
    entry: { "composition-upload": "src/vanilla/index.ts" },
    format: ["iife"],
    globalName: "CompositionUpload",
    minify: true,
    target: "es2017",
    sourcemap: false,
    outExtension: () => ({ js: ".iife.js" }),
  },
]);
