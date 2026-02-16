export function computeExtendedEndTime(
  baseEndTime: Date | null,
  antiSnipeSeconds: number,
  now = new Date(),
) {
  const base = baseEndTime && baseEndTime > now ? baseEndTime : now;
  return new Date(base.getTime() + antiSnipeSeconds * 1000);
}
