export type VdfValue = string | VdfObject;
export type VdfObject = { [key: string]: VdfValue };

/**
 * Minimal Valve Data Format (VDF) parser for libraryfolders / appmanifest / localconfig.
 * Duplicate keys: last value wins. Objects under the same key are shallow-merged.
 */
export function parseVdf(text: string): VdfObject {
  const tokens = tokenize(text);
  let i = 0;

  const peek = (): string | undefined => tokens[i];
  const next = (): string => {
    const token = tokens[i++];
    if (token === undefined) throw new Error("Unexpected end of VDF");
    return token;
  };

  const parseValue = (): VdfValue => {
    const token = peek();
    if (token === "{") {
      next();
      return parseObject();
    }
    return next();
  };

  const parseObject = (): VdfObject => {
    const obj: VdfObject = {};
    while (peek() !== undefined && peek() !== "}") {
      const key = next();
      if (key === "}") break;
      const value = parseValue();
      const existing = obj[key];
      if (
        existing &&
        typeof existing === "object" &&
        typeof value === "object"
      ) {
        obj[key] = { ...existing, ...value };
      } else {
        obj[key] = value;
      }
    }
    if (peek() === "}") next();
    return obj;
  };

  // File may start with a root key then an object, or a bare object.
  if (peek() === "{") {
    next();
    return parseObject();
  }

  const root: VdfObject = {};
  while (peek() !== undefined) {
    const key = next();
    const value = parseValue();
    root[key] = value;
  }
  return root;
}

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    if (ch === "/" && text[i + 1] === "/") {
      while (i < len && text[i] !== "\n") i++;
      continue;
    }

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "{" || ch === "}") {
      tokens.push(ch);
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      let value = "";
      while (i < len) {
        const c = text[i];
        if (c === "\\" && i + 1 < len) {
          value += text[i + 1];
          i += 2;
          continue;
        }
        if (c === '"') {
          i++;
          break;
        }
        value += c;
        i++;
      }
      tokens.push(value);
      continue;
    }

    // Unquoted token (rare in Steam files)
    let value = "";
    while (i < len && !/\s/.test(text[i]) && text[i] !== "{" && text[i] !== "}") {
      value += text[i++];
    }
    if (value) tokens.push(value);
  }

  return tokens;
}

export function vdfString(obj: VdfObject | undefined, ...pathKeys: string[]): string | undefined {
  let current: VdfValue | undefined = obj;
  for (const key of pathKeys) {
    if (!current || typeof current === "string") return undefined;
    current = current[key];
  }
  return typeof current === "string" ? current : undefined;
}

export function vdfObject(obj: VdfObject | undefined, ...pathKeys: string[]): VdfObject | undefined {
  let current: VdfValue | undefined = obj;
  for (const key of pathKeys) {
    if (!current || typeof current === "string") return undefined;
    current = current[key];
  }
  return current && typeof current === "object" ? current : undefined;
}
