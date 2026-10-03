import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Unmount what each test rendered. Testing Library registers this itself only when vitest
 * globals are on (they are off here); without it the trees stay mounted until the file's
 * environment is torn down, and a pending MutationObserver callback (`useActiveScope`) then runs
 * with `document` gone — an unhandled error that fails the run after every test passed.
 */
afterEach(() => cleanup());
