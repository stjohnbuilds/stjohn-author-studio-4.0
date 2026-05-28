import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCloudErrorMessage } from '../packages/cloud-sync/error-message.js';

test('formatCloudErrorMessage hides raw Cloudflare outage HTML', () => {
  const message = formatCloudErrorMessage({
    message: '<!DOCTYPE html><html><head><title>supabase.co | 521: Web server is down</title></head></html>',
  });

  assert.equal(
    message,
    'Supabase is temporarily unreachable. Your local work is still saved; try Resync again in a few minutes.'
  );
});
