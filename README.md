# css-modules-mapper

Type-checks CSS module imports against the CSS itself, using TypeScript 7.1 [content mappers](https://github.com/microsoft/TypeScript/pull/63936).

```css
/* Button.module.css */
.btn { }
.btn-primary:hover :global(.icon) { }
@keyframes spin { }
```

```ts
import styles from "./Button.module.css";

styles.btn;            // string
styles["btn-primary"]; // string
styles.spin;           // string
styles.icon;           // error: :global, not exported
styles.missing;        // error TS2339
```

There are no generated `.d.ts` files to commit or keep up to date. Types come straight from the CSS every time `tsc` or the editor runs. Go-to-definition on `styles.btn` jumps to `.btn` in the stylesheet, and CSS syntax errors are reported as `css-modules1` diagnostics.

This package only provides types. Your bundler (Next.js, Vite, webpack `css-loader`, esbuild `local-css`) still handles CSS modules at runtime.

> [!IMPORTANT]
> Content mappers need TypeScript 7.1 (currently `typescript@beta`). tsc runs them only with `--runExternalCode`.

## Setup

```bash
npm i -D css-modules-mapper typescript@beta
```

```jsonc
// tsconfig.json
{
  "compilerOptions": { /* ... */ },
  "contentMappers": [
    { "package": "css-modules-mapper", "extensions": [".module.css"] }
  ]
}
```

```bash
tsc --noEmit --runExternalCode
```

Once `contentMappers` is in your tsconfig, a plain `tsc` run without `--runExternalCode` fails with `TS18068`. Add the flag to every script that type-checks, for example `"typecheck": "tsc --noEmit --runExternalCode"`.

You can keep an existing `declare module "*.module.css"` ambient declaration for other tools. For files the mapper handles, the mapped file takes priority over it.

### Next.js

`next build` can't pass `--runExternalCode`, so run the type check as a separate step. Set `typescript.ignoreBuildErrors` in `next.config` if you don't want Next to type-check twice.

## Options

Options go under `"options"` in the `contentMappers` entry. Match them to your bundler's config.

| Option | Default | Description |
| --- | --- | --- |
| `namedExports` | `false` | `true` emits one named export per class (`import * as styles` / `import { btn }`), as css-loader v7 does by default. It drops the default export. A class named `default` is reported as an error (`css-modules3`). |
| `exportLocalsConvention` | `"asIs"` | `asIs`, `camelCase`, `camelCaseOnly`, `dashes` or `dashesOnly`. The css-loader spellings `as-is`, `camel-case`, `camel-case-only` and `dashes-only` also work. |

```jsonc
{
  "package": "css-modules-mapper",
  "extensions": [".module.css"],
  "options": { "namedExports": true, "exportLocalsConvention": "camel-case-only" }
}
```

Invalid options are reported in `tsconfig.json` as `css-modules5`.

## What gets exported

- **Class selectors are local by default.** That includes rules inside `@media`, `@supports`, `@layer`, CSS nesting, and `:is()` / `:not()` / `:has()`.
- **`:global(.x)` and bare `:global` are skipped.** `:local(.x)` and bare `:local` are included.
- **Local `@keyframes` names are exported.** `@keyframes :global(x)` is not.
- **Escaped names are unescaped.** `.sm\:flex` becomes `styles["sm:flex"]`.
- **Values are typed `string`.** Hashed class names depend on the bundler, so they're never literal types.

### Diagnostic codes

| Code | Meaning |
| --- | --- |
| `css-modules1` | CSS syntax error. The import is typed `any`, so this is the only error. |
| `css-modules2` | A selector that can't be parsed. |
| `css-modules3` | A name that can't be a named export. |
| `css-modules5` | An invalid option in `tsconfig.json`. |

## Not supported yet

`.module.scss` / `.module.less`, `@value` exports, and keys added through `composes`.

## License

[MIT](./LICENSE)
