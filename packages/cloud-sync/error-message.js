export function formatCloudErrorMessage(error) {
  const raw = error?.message || String(error || '');
  if (!raw) return 'The cloud could not be reached. Try again in a few minutes.';

  const lower = raw.toLowerCase();
  if (lower.includes('error code 521') || lower.includes('web server is down')) {
    return 'Supabase is temporarily unreachable. Your local work is still saved; try Resync again in a few minutes.';
  }
  if (lower.includes('<!doctype html') || lower.includes('<html')) {
    return 'The cloud returned an error page instead of data. Your local work is still saved; try Resync again in a few minutes.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'The cloud could not be reached. Check the connection and try Resync again.';
  }
  return raw.length > 300 ? `${raw.slice(0, 300)}...` : raw;
}
