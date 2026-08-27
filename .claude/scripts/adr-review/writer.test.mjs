import { test } from "node:test";
import assert from "node:assert";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync as writeFileSyncRaw,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import matter from "gray-matter";
import { save } from "./writer.mjs";

function tmpDir() {
  return mkdtempSync(resolve(tmpdir(), "adr-review-"));
}

test("creates new file with round 1", () => {
  const dir = tmpDir();
  try {
    const result = save(
      {
        adr: 999,
        title: "Test ADR",
        issues: [
          { severity: "HIGH", category: "other", summary: "test issue" },
        ],
        bodyMd: "### [HIGH] test issue\n",
      },
      dir,
    );

    assert.strictEqual(result.round, 1);
    assert.strictEqual(result.malformed, undefined);
    const raw = readFileSync(result.path, "utf8");
    const parsed = matter(raw);
    assert.strictEqual(parsed.data.adr, 999);
    assert.strictEqual(parsed.data.title, "Test ADR");
    assert.strictEqual(parsed.data.reviews.length, 1);
    assert.strictEqual(parsed.data.reviews[0].round, 1);
    assert.strictEqual(parsed.data.reviews[0].issues[0].severity, "HIGH");
    assert.strictEqual(parsed.data.reviews[0].reviewer, "claude");
    assert.strictEqual(parsed.data.reviews[0].source, "live");
    assert.ok(parsed.content.includes("Round 1"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appends round 2 to existing file", () => {
  const dir = tmpDir();
  try {
    save(
      {
        adr: 999,
        title: "Test",
        issues: [{ severity: "HIGH", category: "other", summary: "first" }],
        bodyMd: "### [HIGH] first\n",
      },
      dir,
    );
    const result = save(
      {
        adr: 999,
        issues: [{ severity: "MEDIUM", category: "other", summary: "second" }],
        bodyMd: "### [MEDIUM] second\n",
      },
      dir,
    );

    assert.strictEqual(result.round, 2);
    const parsed = matter(readFileSync(result.path, "utf8"));
    assert.strictEqual(parsed.data.reviews.length, 2);
    assert.strictEqual(parsed.data.reviews[0].round, 1);
    assert.strictEqual(parsed.data.reviews[1].round, 2);
    assert.ok(parsed.content.includes("Round 1"));
    assert.ok(parsed.content.includes("Round 2"));
    assert.ok(parsed.content.includes("first"));
    assert.ok(parsed.content.includes("second"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("malformed existing frontmatter saves to separate file", () => {
  const dir = tmpDir();
  try {
    const corruptPath = resolve(dir, "999.md");
    writeFileSyncRaw(corruptPath, "---\nbroken: [unclosed\n---\nbody\n");

    const result = save(
      {
        adr: 999,
        title: "Test",
        issues: [{ severity: "LOW", category: "other", summary: "x" }],
        bodyMd: "### [LOW] x\n",
      },
      dir,
    );

    assert.strictEqual(result.malformed, true);
    assert.notStrictEqual(result.path, corruptPath);
    // Original corrupt file preserved
    assert.ok(existsSync(corruptPath));
    // New separate file created with timestamp suffix
    const files = readdirSync(dir);
    const recovered = files.find((f) => f.startsWith("999.") && f !== "999.md");
    assert.ok(recovered, "expected 999.{timestamp}.md to exist");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("integration: 2-round with different reviewers and multiple issues", () => {
  const dir = tmpDir();
  try {
    save(
      {
        adr: 999,
        title: "Integration Test",
        reviewer: "claude",
        issues: [
          {
            severity: "HIGH",
            category: "evidence-missing",
            summary: "r1 high",
          },
        ],
        bodyMd: "### [HIGH] r1 high\n",
      },
      dir,
    );
    const result = save(
      {
        adr: 999,
        reviewer: "codex",
        issues: [
          {
            severity: "CRITICAL",
            category: "ssot-violation",
            summary: "r2 crit",
          },
          {
            severity: "MEDIUM",
            category: "phase-split-late",
            summary: "r2 med",
          },
        ],
        bodyMd: "### [CRITICAL] r2 crit\n\n### [MEDIUM] r2 med\n",
      },
      dir,
    );

    assert.strictEqual(result.round, 2);
    const parsed = matter(readFileSync(result.path, "utf8"));
    assert.strictEqual(parsed.data.reviews.length, 2);
    assert.strictEqual(parsed.data.reviews[0].reviewer, "claude");
    assert.strictEqual(parsed.data.reviews[1].reviewer, "codex");
    assert.strictEqual(parsed.data.reviews[0].issues.length, 1);
    assert.strictEqual(parsed.data.reviews[1].issues.length, 2);
    assert.strictEqual(parsed.data.reviews[1].issues[0].severity, "CRITICAL");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hate/prism optional fields are preserved in round frontmatter", () => {
  const dir = tmpDir();
  try {
    const hate = {
      assumption: "A",
      root: "R",
      axis: "analogy",
      first_nail: "N",
      verdict: "issue:m1",
    };
    const prism = {
      lenses: [{ lens: "cost", verdict: "unclear", reason: "no measurement" }],
      convergence: "불일치",
      question: "Q?",
    };
    const result = save(
      { adr: 998, title: "HP", issues: [], bodyMd: "x", hate, prism },
      dir,
    );
    const parsed = matter(readFileSync(result.path, "utf8"));
    assert.deepStrictEqual(parsed.data.reviews[0].hate, hate);
    assert.deepStrictEqual(parsed.data.reviews[0].prism, prism);
    const r2 = save({ adr: 998, issues: [], bodyMd: "y" }, dir);
    const parsed2 = matter(readFileSync(r2.path, "utf8"));
    assert.strictEqual(parsed2.data.reviews[1].hate, undefined);
    assert.strictEqual(parsed2.data.reviews[1].prism, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
