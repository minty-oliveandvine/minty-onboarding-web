// @minty/shared/eslint: next/core-web-vitals + typescript and the folders no app lints.
//
// No `no-undef` stanza for .js/.jsx any more, and none is needed: every file under
// app/, components/ and lib/ is TypeScript now and `tsc --noEmit` catches an undefined
// identifier at the compiler. The stanza that used to live here existed only because
// .jsx was unchecked -- the `toIsoDate is not defined` defect is what created it.
import { defineConfig } from "eslint/config";
import minty from "@minty/shared/eslint";

export default defineConfig([...minty]);
