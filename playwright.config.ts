// End-to-end tests. These run against a STACK THAT IS ALREADY UP -- they start nothing.
//
// Deliberately no `webServer` block: the wizard needs Next (3030), Flask (8000), the
// onboarding Django service (8030) and a real Postgres, and three of those four live in
// other repos. Booting them from here would hide which one is broken when a test fails,
// and would make a failure to start look like a failed assertion. Specs check the stack
// is reachable first and skip with a readable reason when it is not.
//
// One worker (@minty/shared/playwright's, like the rest of the shared settings). The
// authenticated specs write to a shared dev database and restore what they changed;
// running them concurrently would interleave those writes.
//
//   npm run test:e2e
//
// See e2e/README.md for the environment variables the authenticated specs need and for
// what this layer deliberately does NOT cover.

import { mintyPlaywright } from "@minty/shared/playwright";
import { BASE_URL } from "./e2e/urls";

export default mintyPlaywright({ port: 3030, baseURL: BASE_URL, timeout: 30_000 });
