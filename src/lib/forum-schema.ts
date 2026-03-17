import "server-only";

export async function ensureForumSchema() {
  return;
}

export function isForumSchemaMissing(_error?: unknown) {
  void _error;
  return false;
}

export function isForumVoteSchemaMissing(_error?: unknown) {
  void _error;
  return false;
}
