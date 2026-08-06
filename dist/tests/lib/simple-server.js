import { createApp } from '../../src/application.js';
import { Readable } from 'stream';
import TestBattery from 'test-battery';
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {
        promise,
        resolve,
        reject,
    };
}
export async function oneTimeServer(method, body, path = '/') {
    const app = createApp({});
    const responseDeferred = deferred();
    const finishedDeferred = deferred();
    let finished = false;
    const finish = () => {
        if (finished) {
            return;
        }
        finished = true;
        finishedDeferred.resolve();
    };
    app[method](path, async (req, res) => {
        // repeat the data sent in the request to the response
        if (req.method !== 'GET') {
            const ct = req.headers.getHeader('Content-Type');
            ct && res.setHeader('Content-Type', ct);
            if (ct === 'application/json') {
                const o = JSON.parse(req.body?.toString() || '');
                res.json(o);
            }
            else {
                // TODO support chunked data
                if (req.body) {
                    res.send(req.body);
                }
                else {
                    res.end();
                }
            }
        }
        responseDeferred.resolve(res);
        await finishedDeferred.promise;
        await res.end();
    });
    const port = await app.listen(0);
    const request = makeSelfRequest(port, method, body, path).catch(error => {
        responseDeferred.reject(error);
        throw error;
    });
    return {
        close: () => app.close(),
        port,
        response: responseDeferred.promise,
        request,
        finish,
    };
}
async function makeSelfRequest(port, method, body, path) {
    let requestBody;
    const headers = {
        'Content-Type': 'application/octet-stream',
        'Connection': 'close'
    };
    if (method === 'post' || method === 'put') {
        if (Array.isArray(body)) {
            const chunks = [...body];
            requestBody = new Readable({
                read() {
                    this.push(chunks.shift() ?? null);
                },
            });
        }
        else if (typeof body === 'object') {
            if (body !== null) {
                requestBody = Buffer.from(JSON.stringify(body));
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = String(requestBody.byteLength);
            }
        }
        else if (body !== null) {
            const buffer = typeof body === 'string'
                ? Buffer.from(body)
                : body;
            requestBody = buffer;
            headers['Content-Length'] = String(buffer.byteLength);
        }
    }
    const options = {
        method,
        headers
    };
    if (requestBody !== undefined) {
        options.body = requestBody;
        /*
         * Required by Node's fetch implementation when streaming a request body.
         */
        if (requestBody instanceof Readable) {
            options.duplex = 'half';
        }
    }
    const response = await fetch(`http://localhost:${port}${path}`, { ...options });
    await response.text();
}
export function testWithOneTimeServer(should, testFn, call = {}) {
    TestBattery.test(should, async (battery) => {
        const server = await oneTimeServer(call.method ?? (call.body ? 'post' : 'get'), call.body ?? null, call.path ?? '/');
        try {
            const res = await server.response;
            await testFn(battery, res, server.close, server.port);
        }
        catch (e) {
            battery.fail('exception in test', e);
        }
        finally {
            server.finish();
            try {
                await server.request;
            }
            finally {
                await server.close();
            }
        }
    });
}
//# sourceMappingURL=simple-server.js.map