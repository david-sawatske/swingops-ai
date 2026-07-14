export function isShaftFlexApplicable(
  category: string | null | undefined
): boolean {
  return category?.trim().toUpperCase() !== "PUTTER";
}
