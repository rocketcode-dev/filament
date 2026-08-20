import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deepMerge, normalizeByteSize, normalizeHeaderName, } from '../src/tools.js';
describe('tools', () => {
    test('deepMerge recursively merges objects without mutating its inputs', () => {
        const defaultMeta = {
            auth: { required: false, roles: ['reader'], limits: { daily: 10 } },
            label: 'default',
        };
        const source = {
            auth: { roles: ['editor'], limits: { hourly: 2 } },
            label: undefined,
        };
        const result = deepMerge(defaultMeta, source, { auth: { limits: { daily: 20 } } });
        assert.deepEqual(result, {
            auth: {
                required: false,
                roles: ['editor'],
                limits: { daily: 20, hourly: 2 },
            },
            label: undefined,
        });
        assert.deepEqual(defaultMeta, {
            auth: { required: false, roles: ['reader'], limits: { daily: 10 } },
            label: 'default',
        });
        assert.notEqual(result, defaultMeta);
        assert.notEqual(result.auth, defaultMeta.auth);
        assert.notEqual(result.auth.roles, defaultMeta.auth.roles);
    });
    test('deepMerge handles missing objects, nulls, and arrays', () => {
        const result = deepMerge({ nullable: 'present', values: [1, 2] }, { nested: { enabled: true }, nullable: null, values: [3] });
        assert.deepEqual(result, {
            nested: { enabled: true },
            nullable: null,
            values: [3],
        });
    });
    test('deepMerge can deeply freeze its cloned result', () => {
        const defaultMeta = {
            nested: { enabled: true },
            values: ['default'],
        };
        const result = deepMerge(defaultMeta, { values: ['route'] }, true);
        assert.equal(Object.isFrozen(result), true);
        assert.equal(Object.isFrozen(result.nested), true);
        assert.equal(Object.isFrozen(result.values), true);
        assert.throws(() => result.values.push('mutated'), TypeError);
        assert.deepEqual(defaultMeta.values, ['default']);
    });
    test('normalizeByteSize accepts binary and familiar byte suffixes', () => {
        for (const value of ['2Mi', '2MiB', '2Mb', '2 MB']) {
            assert.equal(normalizeByteSize(value), 2097152);
        }
        assert.equal(normalizeByteSize(512), 512);
        assert.equal(normalizeByteSize('1.5KiB'), 1536);
        assert.throws(() => normalizeByteSize('two megabytes'), /Invalid/);
        assert.throws(() => normalizeByteSize(-1), /non-negative/);
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
//# sourceMappingURL=tools.test.js.map