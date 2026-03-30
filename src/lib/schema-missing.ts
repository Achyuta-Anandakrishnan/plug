import "server-only";

export function isSchemaMissingError(error: unknown, patterns: Array<string | RegExp>) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return patterns.some((pattern) => (
    typeof pattern === "string" ? message.includes(pattern) : pattern.test(message)
  ));
}
