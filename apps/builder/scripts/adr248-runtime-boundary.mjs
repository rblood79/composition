import { build } from "vite";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

// 제품 번들에 실제로 남은 모듈을 검사한다. barrel이 읽히기만 하고 tree-shake된 경우는 제외한다.
const builderRoot = fileURLToPath(new URL("../", import.meta.url));
for (const relative of [
  "../package.json",
  "../../../packages/shared/package.json",
  "../../publish/package.json",
]) {
  const pkg = JSON.parse(
    await readFile(new URL(relative, import.meta.url), "utf8"),
  );
  if (
    [pkg.dependencies, pkg.devDependencies, pkg.peerDependencies].some(
      (deps) => deps && "@composition/specs" in deps,
    )
  )
    throw new Error(
      `${pkg.name}: Builder/shared must not depend on @composition/specs`,
    );
}
const forbidden = [
  /\/packages\/specs\//,
  /\/catalog\/resolvers\/resolve(?:EditContract|MergedStyle)\.ts$/,
  /\/canvas\/(?:styleConversion\/tagSpecMap|layout\/engines\/tagSpecLookup)\.ts$/,
];
for (const app of ["builder", "publish"]) {
const root = app === "builder" ? builderRoot : fileURLToPath(new URL("../../publish/", import.meta.url));
await build({
  root,
  configFile: `${root}vite.config.ts`,
  logLevel: "error",
  build: {
    write: false,
    minify: false,
    reportCompressedSize: false,
    sourcemap: false,
  },
  plugins: [
    {
      name: "adr248-runtime-boundary",
      generateBundle(_options, bundle) {
        const violations = new Set();
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          for (const [id, module] of Object.entries(output.modules)) {
            if (
              module.renderedLength > 0 &&
              (forbidden.some((pattern) => pattern.test(id)) || (app === "publish" && /\/apps\/builder\//.test(id)))
            ) {
              violations.add(id);
            }
          }
        }
        if (violations.size)
          this.error(
            `ADR-248 runtime boundary:\n${[...violations].join("\n")}`,
          );
        console.log(
          `ADR-248 ${app} runtime boundary PASS — specs / legacy edit resolvers / spec registry 0`,
        );
      },
    },
  ],
});

}
