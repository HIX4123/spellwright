// Canonical stat definitions live in data/stats.json.
export function resolveSystem(system, statsById) {
  if (!system.statRef) return system;
  const stat = statsById?.get(system.statRef);
  if (!stat) throw new Error(`Unknown character stat reference: ${system.statRef}`);
  return { ...system, definition: stat.definition, details: stat.details };
}
