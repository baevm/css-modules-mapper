// `exportLocalsConvention`, matching css-loader (`camel-case-only`) and Vite (`camelCaseOnly`) spellings.

export type Convention = "asIs" | "camelCase" | "camelCaseOnly" | "dashes" | "dashesOnly";

const ALIASES: Record<string, Convention> = {
  asIs: "asIs",
  "as-is": "asIs",
  camelCase: "camelCase",
  "camel-case": "camelCase",
  camelCaseOnly: "camelCaseOnly",
  "camel-case-only": "camelCaseOnly",
  dashes: "dashes",
  dashesOnly: "dashesOnly",
  "dashes-only": "dashesOnly",
};

export const CONVENTION_NAMES = Object.keys(ALIASES);

export function parseConvention(value: string): Convention | undefined {
  return Object.hasOwn(ALIASES, value) ? ALIASES[value] : undefined;
}

/** The export keys a local name produces, original first, without duplicates. */
export function exportNames(name: string, convention: Convention): string[] {
  switch (convention) {
    case "asIs":
      return [name];
    case "camelCase":
      return unique([name, camelCase(name)]);
    case "camelCaseOnly":
      return [camelCase(name)];
    case "dashes":
      return unique([name, dashesCamelCase(name)]);
    case "dashesOnly":
      return [dashesCamelCase(name)];
  }
}

export function camelCase(name: string): string {
  const joined = name
    .replace(/^[-_.\s]+|[-_.\s]+$/g, "")
    .replace(/[-_.\s]+(.)/g, (_, char: string) => char.toUpperCase());
  return joined.charAt(0).toLowerCase() + joined.slice(1);
}

export function dashesCamelCase(name: string): string {
  return name.replace(/-+(\w)/g, (_, char: string) => char.toUpperCase());
}

function unique(names: string[]) {
  return [...new Set(names)];
}
