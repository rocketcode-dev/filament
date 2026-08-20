import { suite } from 'node:test';
import TestBattery from 'test-battery';
import { Response } from '../src/response.js';
class ControlledServerResponse {
    constructor() {
        this.writes = [];
        this.heads = [];
        this.writeCallbacks = [];
        this.endCallbacks = [];
        this.endCalls = 0;
    }
    writeHead(status, headers) {
        this.heads.push({ status, headers });
        return this;
    }
    write(data, callback) {
        this.writes.push(Buffer.from(data));
        this.writeCallbacks.push(callback);
        return true;
    }
    end(callback) {
        this.endCalls++;
        if (callback) {
            this.endCallbacks.push(callback);
        }
        return this;
    }
    finishWrite(error) {
        const callback = this.writeCallbacks.shift();
        if (!callback)
            throw new Error('No pending write');
        callback(error);
    }
    finishEnd() {
        const callback = this.endCallbacks.shift();
        if (!callback)
            throw new Error('No pending end');
        callback();
    }
}
function response(streaming) {
    const native = new ControlledServerResponse();
    const res = new Response(native);
    res.streaming = streaming;
    return { native, res };
}
function unlockedResponse(context = {}) {
    const native = new ControlledServerResponse();
    const res = new Response(native, context);
    return { native, res };
}
async function isSettled(promise) {
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    return settled;
}
suite('Response lifecycle timing', () => {
    suite('mode selection', () => {
        TestBattery.test('derives streaming defaults from transformer context', battery => {
            const noContext = unlockedResponse().res;
            const withoutTransformers = unlockedResponse({
                hasTransformers: false,
            }).res;
            const withTransformers = unlockedResponse({
                hasTransformers: true,
            }).res;
            battery.test('streams unless transformers require buffering')
                .value([
                noContext.streaming,
                withoutTransformers.streaming,
                withTransformers.streaming,
            ])
                .value([true, true, false]).deepEqual;
            battery.test('does not expose a body before mode is locked')
                .value(withTransformers.body).is.null;
        });
        TestBattery.test('prevents changing a locked streaming mode', async (battery) => {
            const { native, res } = response(true);
            const chunk = res.sendChunk('data');
            res.streaming = true;
            let changedMode = false;
            try {
                res.streaming = false;
            }
            catch {
                changedMode = true;
            }
            native.finishWrite();
            await chunk;
            battery.test('same mode remains valid while the opposite mode throws')
                .value([res.streaming, changedMode]).value([true, true]).deepEqual;
        });
    });
    suite('streaming mode', () => {
        TestBattery.test('send waits for write and native end', async (battery) => {
            const { native, res } = response(true);
            const sent = res.send('complete');
            battery.test('logically closes before write completes')
                .value(res.closed).is.true;
            battery.test('does not resolve before write completes')
                .value(await isSettled(sent)).is.false;
            battery.test('is not committed before native end')
                .value(res.committed).is.false;
            native.finishWrite();
            await Promise.resolve();
            battery.test('starts native end after write')
                .value(native.endCalls).value(1).equal;
            battery.test('does not resolve before native end completes')
                .value(await isSettled(sent)).is.false;
            native.finishEnd();
            await sent;
            battery.test('commits after native end')
                .value(res.committed).is.true;
            battery.test('writes the complete payload')
                .value(Buffer.concat(native.writes).toString())
                .value('complete').equal;
        });
        TestBattery.test('chunks remain open until end', async (battery) => {
            const { native, res } = response(true);
            const first = res.sendChunk('one');
            battery.test('chunk remains pending during native write')
                .value(await isSettled(first)).is.false;
            battery.test('chunk does not close response')
                .value(res.closed).is.false;
            native.finishWrite();
            await first;
            const ending = res.end();
            battery.test('end is pending during native end')
                .value(await isSettled(ending)).is.false;
            native.finishEnd();
            await ending;
            battery.test('end closes and commits')
                .value([res.closed, res.committed]).value([true, true]).deepEqual;
        });
        TestBattery.test('repeated end shares native completion', async (battery) => {
            const { native, res } = response(true);
            const first = res.end();
            const second = res.end();
            battery.test('only ends native response once')
                .value(native.endCalls).value(1).equal;
            battery.test('both calls remain pending')
                .value([
                await isSettled(first),
                await isSettled(second),
            ]).value([false, false]).deepEqual;
            native.finishEnd();
            await Promise.all([first, second]);
        });
        TestBattery.test('send rejects a native write failure', async (battery) => {
            const { native, res } = response(true);
            const sent = res.send('complete');
            native.finishWrite(new Error('write failed'));
            const message = await sent.then(() => undefined, error => error instanceof Error ? error.message : String(error));
            battery.test('propagates the write failure without ending natively')
                .value({ message, endCalls: native.endCalls, committed: res.committed })
                .value({ message: 'write failed', endCalls: 0, committed: false })
                .deepEqual;
        });
        TestBattery.test('sendChunk rejects a native write failure', async (battery) => {
            const { native, res } = response(true);
            const sent = res.sendChunk('chunk');
            native.finishWrite(new Error('chunk failed'));
            const message = await sent.then(() => undefined, error => error instanceof Error ? error.message : String(error));
            battery.test('propagates the chunk failure and remains open')
                .value({ message, closed: res.closed })
                .value({ message: 'chunk failed', closed: false }).deepEqual;
        });
    });
    suite('buffered mode', () => {
        TestBattery.test('chunks resolve without native IO', async (battery) => {
            const { native, res } = response(false);
            await res.sendChunk('one');
            await res.sendChunk('two');
            battery.test('chunks do not write before commit')
                .value([native.writes.length, native.endCalls])
                .value([0, 0]).deepEqual;
            battery.test('chunks remain available to transformers')
                .value(res.body?.toString()).value('onetwo').equal;
            battery.test('response remains open')
                .value(res.closed).is.false;
        });
        TestBattery.test('send closes logically but commit owns IO', async (battery) => {
            const { native, res } = response(false);
            await res.send('original');
            battery.test('send closes without native IO')
                .value([res.closed, res.committed, native.writes.length])
                .value([true, false, 0]).deepEqual;
            res.body = 'transformed';
            res.status(202).headers.set('X-Transformed', 'true');
            const committed = res.commit();
            battery.test('commit waits for buffered write')
                .value(await isSettled(committed)).is.false;
            battery.test('commit is not reported before native completion')
                .value(res.committed).is.false;
            battery.test('writes transformed body')
                .value(Buffer.concat(native.writes).toString())
                .value('transformed').equal;
            battery.test('writes transformed status and headers')
                .value(native.heads[0])
                .value({
                status: 202,
                headers: [
                    'Content-Length', '11',
                    'X-Transformed', 'true',
                ],
            }).deepEqual;
            native.finishWrite();
            await Promise.resolve();
            battery.test('waits for native end after write')
                .value(await isSettled(committed)).is.false;
            native.finishEnd();
            await committed;
            battery.test('reports committed after native end')
                .value(res.committed).is.true;
        });
        TestBattery.test('repeated commit shares native completion', async (battery) => {
            const { native, res } = response(false);
            await res.send('body');
            const first = res.commit();
            const second = res.commit();
            battery.test('only writes once')
                .value(native.writes.length).value(1).equal;
            battery.test('both commits remain pending')
                .value([
                await isSettled(first),
                await isSettled(second),
            ]).value([false, false]).deepEqual;
            native.finishWrite();
            native.finishEnd();
            await Promise.all([first, second]);
        });
        TestBattery.test('commits an empty buffered response', async (battery) => {
            const { native, res } = response(false);
            await res.end();
            const committed = res.commit();
            battery.test('writes an empty buffer and waits for completion')
                .value({
                writes: native.writes.length,
                bytes: Buffer.concat(native.writes).length,
                endCalls: native.endCalls,
                settled: await isSettled(committed),
            })
                .value({ writes: 1, bytes: 0, endCalls: 0, settled: false }).deepEqual;
            native.finishWrite();
            native.finishEnd();
            await committed;
            battery.test('reports committed after native end')
                .value(res.committed).is.true;
        });
        TestBattery.test('commit rejects a native write failure', async (battery) => {
            const { native, res } = response(false);
            await res.send('body');
            const committed = res.commit();
            native.finishWrite(new Error('commit failed'));
            const message = await committed.then(() => undefined, error => error instanceof Error ? error.message : String(error));
            battery.test('propagates failure without ending or committing')
                .value({ message, endCalls: native.endCalls, committed: res.committed })
                .value({ message: 'commit failed', endCalls: 0, committed: false })
                .deepEqual;
        });
        TestBattery.test('keeps Content-Length synchronized until headers freeze', battery => {
            const { res } = response(false);
            res.headers.set('Content-Length', '1');
            res.body = 'longer';
            const updatedLength = res.headers.get('Content-Length');
            res.headers.frozen = true;
            let replacedAfterFreeze = false;
            try {
                res.body = 'replacement';
            }
            catch {
                replacedAfterFreeze = true;
            }
            battery.test('updates mutable length and rejects stale frozen length')
                .value({ updatedLength, replacedAfterFreeze })
                .value({ updatedLength: '6', replacedAfterFreeze: true }).deepEqual;
        });
        TestBattery.test('rejects body replacement after commit', async (battery) => {
            const { native, res } = response(false);
            await res.send('body');
            const committed = res.commit();
            native.finishWrite();
            native.finishEnd();
            await committed;
            let replaced = false;
            try {
                res.body = 'replacement';
            }
            catch {
                replaced = true;
            }
            battery.test('committed response remains immutable')
                .value(replaced).is.true;
        });
        TestBattery.test('commit rejects an open response', async (battery) => {
            const { res } = response(false);
            let threw = false;
            try {
                res.commit();
            }
            catch {
                threw = true;
            }
            battery.test('open commit throws synchronously')
                .value(threw).is.true;
        });
    });
});
//# sourceMappingURL=response-lifecycle.test.js.map