export function isDuplicateKeyError(error: unknown): boolean {
  const seen = new Set<unknown>();
  const visit = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    const record = value as {
      code?: unknown;
      codeName?: unknown;
      errmsg?: unknown;
      message?: unknown;
      cause?: unknown;
      errorResponse?: unknown;
      writeErrors?: unknown;
      keyPattern?: unknown;
      keyValue?: unknown;
    };
    if (record.code === 11000 || record.code === "11000" || record.code === 11001) return true;
    if (record.codeName === "DuplicateKey") return true;
    const text = [record.message, record.errmsg]
      .filter((item): item is string => typeof item === "string")
      .join(" ");
    if (text.includes("E11000") || text.includes("duplicate key")) return true;
    if (record.keyPattern || record.keyValue) {
      if (text.includes("E11000") || text.includes("dup key")) return true;
    }
    if (Array.isArray(record.writeErrors) && record.writeErrors.some(visit)) return true;
    if (visit(record.errorResponse)) return true;
    if (visit(record.cause)) return true;
    return false;
  };
  return visit(error);
}

export function isDuplicateJobError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return /job.*(already exists|already in queue)/i.test(message);
}
