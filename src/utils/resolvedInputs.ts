export function findResolvedStringInput(
  resolvedInputs: Record<string, unknown> | undefined,
  candidateKeys: string[]
) {
  const stringifyValue = (value: unknown) => {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    return "";
  };

  if (!resolvedInputs) return null;
  for (const candidateKey of candidateKeys) {
    const value = stringifyValue(resolvedInputs[candidateKey]);
    if (value.trim()) return { key: candidateKey, value };
  }
  return null;
}
