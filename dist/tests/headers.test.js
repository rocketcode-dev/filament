import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Headers } from '../src/headers.js';
describe('Headers', () => {
    test('constructs headers from records, pairs, and lists', () => {
        const headers = new Headers('response', { 'content-type': 'text/plain', 'x-tag': ['one', 'two'] }, ['set-cookie', ['a=1', 'b=2']], [
            ['x-trace', 'first'],
            ['x-trace', 'second'],
        ]);
        assert.equal(headers.get('CONTENT-TYPE'), 'text/plain');
        assert.deepEqual(headers.get('X-Tag'), ['one', 'two']);
        assert.deepEqual(headers.get('Set-Cookie'), ['a=1', 'b=2']);
        assert.deepEqual(headers.get('X-Trace'), ['first', 'second']);
    });
    test('adds repeatable headers and replaces non-repeatable headers', () => {
        const headers = new Headers('response');
        assert.equal(headers.add('X-Tag', 'one'), headers);
        headers.add('x-tag', ['two', 'three']);
        headers.add('Content-Type', 'text/plain');
        headers.add('content-type', 'application/json');
        assert.deepEqual(headers.get('x-tag'), ['one', 'two', 'three']);
        assert.equal(headers.get('Content-Type'), 'application/json');
        assert.equal(headers.get('Content-Length'), null);
        assert.deepEqual(headers.get('X-Missing'), []);
    });
    test('sets and removes individual and bulk headers fluently', () => {
        const headers = new Headers('response');
        assert.equal(headers.set('X-Tag', 'old'), headers);
        headers.set('X-Tag', ['one', 'two']);
        assert.deepEqual(headers.get('X-Tag'), ['one', 'two']);
        assert.equal(headers.addMany(['X-Trace', 'trace-1'], { 'X-Trace': 'trace-2', 'Content-Type': 'text/plain' }), headers);
        assert.deepEqual(headers.get('X-Trace'), ['trace-1', 'trace-2']);
        assert.equal(headers.setMany(['X-Trace', ['trace-3', 'trace-4']], { 'X-Tag': ['three', 'four'], 'Content-Type': 'application/json' }), headers);
        assert.deepEqual(headers.get('X-Trace'), ['trace-3', 'trace-4']);
        assert.deepEqual(headers.get('X-Tag'), ['three', 'four']);
        assert.equal(headers.get('Content-Type'), 'application/json');
        assert.equal(headers.remove('Content-Type'), headers);
        assert.equal(headers.get('Content-Type'), null);
        assert.equal(headers.removeMany('X-Trace', ['X-Tag', 'Missing']), headers);
        assert.deepEqual(headers.get('X-Trace'), []);
        assert.deepEqual(headers.get('X-Tag'), []);
    });
    test('honors configured repeatability and its precedence', () => {
        const headers = new Headers({
            defaultNonRepeatableSet: 'response',
            nonRepeatable: ['X-Request-Id', 'X-Mode'],
            repeatable: ['Content-Type', 'X-Mode'],
        });
        assert.equal(headers.isRepeatable('x-request-id'), false);
        assert.equal(headers.isRepeatable('X-Mode'), true);
        assert.equal(headers.isRepeatable('content-type'), true);
        assert.equal(headers.isRepeatable('ETag'), false);
        assert.equal(headers.isRepeatable('X-Custom'), true);
        headers.add('X-Request-Id', 'first').add('X-Request-Id', 'second');
        headers.add('Content-Type', 'text/plain').add('Content-Type', 'text/html');
        assert.equal(headers.get('X-Request-Id'), 'second');
        assert.deepEqual(headers.get('Content-Type'), ['text/plain', 'text/html']);
    });
    test('uses HTTP list and singleton semantics for request headers', () => {
        const headers = new Headers('request');
        for (const name of [
            'Authorization',
            'Content-Length',
            'Content-Type',
            'Cookie',
            'Host',
            'If-Modified-Since',
            'Origin',
            'Range',
        ]) {
            assert.equal(headers.isRepeatable(name), false, name);
        }
        for (const name of [
            'Accept',
            'Accept-Encoding',
            'Cache-Control',
            'TE',
            'Trailer',
            'Transfer-Encoding',
            'Upgrade',
            'Via',
        ]) {
            assert.equal(headers.isRepeatable(name), true, name);
        }
    });
    test('preserves repeatable response fields including Set-Cookie', () => {
        const headers = new Headers('response');
        for (const name of [
            'Content-Length',
            'Content-Type',
            'Date',
            'ETag',
            'Location',
            'Retry-After',
        ]) {
            assert.equal(headers.isRepeatable(name), false, name);
        }
        for (const name of [
            'Allow',
            'Proxy-Authenticate',
            'Set-Cookie',
            'Vary',
            'WWW-Authenticate',
        ]) {
            assert.equal(headers.isRepeatable(name), true, name);
        }
        headers.add('Set-Cookie', 'session=one');
        headers.add('Set-Cookie', 'theme=dark');
        assert.deepEqual(headers.get('Set-Cookie'), [
            'session=one',
            'theme=dark',
        ]);
    });
    test('changes repeatability and can restore the default', () => {
        const headers = new Headers('response');
        headers.setRepeatable(true, 'Content-Type');
        assert.equal(headers.isRepeatable('content-type'), true);
        headers.setRepeatable(false, ['Content-Type', 'X-Tag']);
        assert.equal(headers.isRepeatable('content-type'), false);
        assert.equal(headers.isRepeatable('x-tag'), false);
        headers.setRepeatable('default', 'Content-Type', 'X-Tag');
        assert.equal(headers.isRepeatable('content-type'), false);
        assert.equal(headers.isRepeatable('x-tag'), true);
    });
    test('changes configured repeatability case-insensitively', () => {
        const headers = new Headers({
            defaultNonRepeatableSet: 'response',
            repeatable: ['Content-Type'],
            nonRepeatable: ['X-Tag'],
        });
        headers.setRepeatable('default', 'content-type', 'x-tag');
        assert.equal(headers.isRepeatable('Content-Type'), false);
        assert.equal(headers.isRepeatable('X-Tag'), true);
    });
    test('returns canonical, immutable snapshots', () => {
        const headers = new Headers('response');
        headers.add('x-api-key', 'first');
        headers.add('X-API-Key', 'second');
        headers.setRepeatable(false, 'X-API-Key');
        assert.deepEqual(headers.headers, { 'X-API-Key': 'second' });
        assert.deepEqual(headers.headerPairs, [['X-API-Key', 'second']]);
        assert.equal(headers.toString(), 'X-API-Key: second');
        assert.equal(Object.isFrozen(headers.headerPairs), true);
        assert.equal(Object.isFrozen(headers.headerPairs[0]), true);
    });
    test('freezes permanently and rejects every mutation', () => {
        const headers = new Headers('response', ['X-Tag', 'one']);
        headers.frozen = true;
        assert.equal(headers.frozen, true);
        assert.throws(() => { headers.frozen = false; }, /Cannot unfreeze/);
        assert.throws(() => headers.add('X-Tag', 'two'), /frozen/);
        assert.throws(() => headers.addMany(['X-Tag', 'two']), /frozen/);
        assert.throws(() => headers.set('X-Tag', 'two'), /frozen/);
        assert.throws(() => headers.setMany(['X-Tag', 'two']), /frozen/);
        assert.throws(() => headers.remove('X-Tag'), /frozen/);
        assert.throws(() => headers.removeMany('X-Tag'), /frozen/);
        assert.throws(() => headers.setRepeatable(false, 'X-Tag'), /frozen/);
    });
});
//# sourceMappingURL=headers.test.js.map