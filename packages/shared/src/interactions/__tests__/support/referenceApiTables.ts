/**
 * ADR-287 — the reference API tables (the local official Agent Skill snapshots: RAC
 * `.claude/skills/react-aria/references/components/*.md` · S2
 * `.claude/skills/react-spectrum/references/components/*.md`) read as rows. Test-only: the tables are
 * the gate's oracle (the derivation reads the binding `accepts`), so there is no generated module.
 *
 * A file's `## API` section holds one table per component (`### Meter` · `### Label` …; an S2 file's
 * one table has no heading — it is the file's component). A row is
 * ``| `prop` | `type` | default | description |``. A row this cannot read is an error — the gate
 * keeps the file RED and the parser is fixed, the file is never dropped (ADR-287 M5). A file whose
 * `## API` section has no rows at all (the snapshot printed only the headings — RAC `Toast` · S2
 * `IllustratedMessage`) has no tables; the gate names those files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReferenceRow {
  prop: string;
  /** The TypeScript type as the table prints it (`number | undefined` · `"S" | "M"` · `ReactNode`). */
  type: string;
  default: string;
  description: string;
}

export interface ReferenceFile {
  file: string;
  /** Component name → its rows (an S2 file's heading-less table is under the file name). */
  tables: Map<string, ReferenceRow[]>;
  errors: string[];
}

/** ``| `prop` | `type` | default | description |`` (and the three-column form without a default). */
const ROW = /^\|\s*`([^`]+)`\s*\|\s*`(.*?)`\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/;
const ROW3 = /^\|\s*`([^`]+)`\s*\|\s*`(.*?)`\s*\|\s*(.*?)\s*\|\s*$/;

export function parseReferenceApi(
  markdown: string,
  file: string,
): ReferenceFile {
  const name = basename(file, ".md");
  const tables = new Map<string, ReferenceRow[]>();
  const errors: string[] = [];
  let inApi = false;
  let fence = false;
  let heading = name;
  let columns = 4;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("```")) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    if (line.startsWith("## ")) {
      inApi = line.trim() === "## API";
      heading = name;
      continue;
    }
    if (!inApi) continue;
    if (line.startsWith("### ")) {
      heading = line.slice(4).trim();
      continue;
    }
    // (A header row — `| Name | Type | Default | Description |` or a class's `| Parameter | … |`.)
    if (/^\| [A-Z][a-z]+ \|/.test(line)) {
      columns = line.split("|").length - 2;
      continue;
    }
    if (!line.startsWith("| `")) continue;
    const match = (columns === 3 ? ROW3 : ROW).exec(line);
    if (!match) {
      errors.push(`${name} › ${heading}: ${line.slice(0, 120)}`);
      continue;
    }
    const [, prop = "", type = "", ...rest] = match;
    const [fallback = "", description = ""] =
      columns === 3 ? ["", rest[0] ?? ""] : rest;
    const rows = tables.get(heading) ?? [];
    rows.push({ prop, type, default: fallback, description });
    tables.set(heading, rows);
  }
  return { file: name, tables, errors };
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../../../..");

export const REFERENCE_DIRS = {
  rac: join(ROOT, ".claude/skills/react-aria/references/components"),
  s2: join(ROOT, ".claude/skills/react-spectrum/references/components"),
} as const;

/** Every file of a snapshot that has an `## API` section (S2 has one overview page without). */
export function readReferenceFiles(dir: string): ReferenceFile[] {
  return readdirSync(dir)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => ({ entry, text: readFileSync(join(dir, entry), "utf8") }))
    .filter(({ text }) => /^## API\s*$/m.test(text))
    .map(({ entry, text }) => parseReferenceApi(text, entry));
}
