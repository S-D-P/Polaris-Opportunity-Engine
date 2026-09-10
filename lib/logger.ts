type Level = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: Level;
  scope: string;
  message: string;
  meta?: Record<string, unknown>;
}

// Structured logger. Never pass raw user content (profile text, notes) in `meta` —
// callers are responsible for keeping meta to identifiers, counts, and error messages.
function log({ level, scope, message, meta }: LogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (scope: string, message: string, meta?: Record<string, unknown>) =>
    log({ level: "debug", scope, message, meta }),
  info: (scope: string, message: string, meta?: Record<string, unknown>) =>
    log({ level: "info", scope, message, meta }),
  warn: (scope: string, message: string, meta?: Record<string, unknown>) =>
    log({ level: "warn", scope, message, meta }),
  error: (scope: string, message: string, meta?: Record<string, unknown>) =>
    log({ level: "error", scope, message, meta }),
};
