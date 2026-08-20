import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deepMerge, normalizeHeaderName } from '../src/tools.js';

describe('tools', () => {
  test('deepMerge recursively merges objects without mutating its inputs', () => {
    interface Config {
      auth: {
        required: boolean;
        roles: string[];
        limits: { daily?: number; hourly?: number };
      };
      label: string | undefined;
    }
    const target: Config = {
      auth: { required: false, roles: ['reader'], limits: { daily: 10 } },
      label: 'default',
    };
    const source = {
      auth: { roles: ['editor'], limits: { hourly: 2 } },
      label: undefined,
    } as unknown as Partial<Config>;

    const result = deepMerge(target, source);

    assert.deepEqual(result, {
      auth: {
        required: false,
        roles: ['editor'],
        limits: { daily: 10, hourly: 2 },
      },
      label: undefined,
    });
    assert.deepEqual(target, {
      auth: { required: false, roles: ['reader'], limits: { daily: 10 } },
      label: 'default',
    });
    assert.notEqual(result, target);
    assert.notEqual(result.auth, target.auth);
  });

  test('deepMerge handles missing objects, nulls, and arrays', () => {
    const result = deepMerge<{
      nested?: { enabled: boolean };
      nullable: string | null;
      values: number[];
    }>(
      { nullable: 'present', values: [1, 2] },
      { nested: { enabled: true }, nullable: null, values: [3] },
    );

    assert.deepEqual(result, {
      nested: { enabled: true },
      nullable: null,
      values: [3],
    });
  });

  test('normalizeHeaderName canonicalizes common input styles', () => {
    assert.equal(normalizeHeaderName('content-type'), 'Content-Type');
    assert.equal(normalizeHeaderName('contentType'), 'Content-Type');
    assert.equal(normalizeHeaderName(' content  type'), 'Content-Type');
    assert.equal(normalizeHeaderName('ETAG'), 'ETag');
    assert.equal(normalizeHeaderName('te'), 'TE');
    assert.equal(normalizeHeaderName('x-api-key'), 'X-API-Key');
    assert.equal(normalizeHeaderName('content-md5'), 'Content-MD5');
    assert.equal(normalizeHeaderName('www-authenticate'), 'WWW-Authenticate');
    assert.equal(normalizeHeaderName('x-xss-protection'), 'X-XSS-Protection');
    assert.equal(normalizeHeaderName('x-rate-limit-remaining'), 'X-RateLimit-Remaining');
  });
});
