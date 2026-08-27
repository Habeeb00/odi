// Route handlers echo thrown messages straight back to the client so that
// deliberate domain errors ("Vote on pending cases first") reach the UI.
// Infrastructure failures must not: a Prisma error's message is a
// multi-line stack carrying server file paths and the database host, and
// the pages render whatever they're handed verbatim.
//
// Deliberate errors are plain `new Error("short sentence")` — anything with
// a subclass name, a newline, or essay length came from a library.
export function clientMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (err.name !== "Error") return fallback;
  if (err.message.includes("\n") || err.message.length > 200) return fallback;
  return err.message || fallback;
}
