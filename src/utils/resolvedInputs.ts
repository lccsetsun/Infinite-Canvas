export function findResolvedStringInput(
  resolvedInputs: Record<string, unknown> | undefined,
  candidateKeys: string[]
) {
  if (!resolvedInputs) return null;
  for (const candidateKey of candidateKeys) {
    const value = resolvedInputs[candidateKey];
    if (typeof value === "string" && value.trim()) return { key: candidateKey, value };
  }
  return null;
}
