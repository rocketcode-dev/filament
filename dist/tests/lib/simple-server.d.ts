import { ResponseImpl } from '../../src/response.js';
import { Response } from '../../src/types.js';
import TestBattery from 'test-battery';
interface OneTimeServer {
    close: () => Promise<void>;
    port: number;
    response: Promise<Response>;
    request: Promise<void>;
    finish: () => void;
}
export declare function oneTimeServer(method: 'get' | 'post' | 'put', body: string | Buffer | (string | Buffer)[] | object | null, path?: string): Promise<OneTimeServer>;
export declare function testWithOneTimeServer(should: string, testFn: (battery: TestBattery, res: ResponseImpl, close: () => Promise<void>, port: number) => Promise<void>, call?: {
    method?: 'get' | 'post' | 'put';
    body?: string | Buffer | (string | Buffer)[] | object;
    path?: string;
}): void;
export {};
//# sourceMappingURL=simple-server.d.ts.map