// The content mapper process: tsc spawns `node dist/mapper.js` (see package.json#typescript) and
// speaks JSON-RPC over stdio.
import { runContentMapper } from "ts-content-mapper";
import { emit } from "./emit.ts";
import { extract } from "./extract.ts";
import { type Options, type RawOptions, resolveOptions } from "./options.ts";

runContentMapper<RawOptions, Options>({
  diagnosticSource: "css-modules",

  openProject(params) {
    const { options, diagnostics } = resolveOptions(params.options);
    return diagnostics.length > 0 ? { project: options, optionDiagnostics: diagnostics } : { project: options };
  },

  transform(params, context) {
    return emit(params.content, extract(params.content, params.fileName), context.project, context.positionEncoding);
  },
});
