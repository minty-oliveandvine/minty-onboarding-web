// Unit and component tests. Playwright lives in e2e/ and is NOT run from here --
// the preset's `test.exclude` keeps the two runners apart, because a .spec.ts written
// against Playwright's `test`/`expect` would otherwise be collected by vitest and fail
// with an error about the wrong runner rather than about the code.
//
// Everything is @minty/shared/vitest's, the same in every app: jsdom, the `@` alias,
// @minty/shared inlined (Vitest does not read next.config's transpilePackages),
// ./test/setup.ts, and `esbuild: { jsx: 'automatic' }` instead of @vitejs/plugin-react
// (Fast Refresh is useless in a test run, and its current major needs a newer vite than
// vitest ships).
//
//   npm test          once, no browser -- the per-commit gate
//   npm run test:watch
//   npm run test:e2e  Playwright, needs the whole stack up (see e2e/README.md)
import { mintyVitest } from "@minty/shared/vitest";

export default mintyVitest(import.meta.url);
