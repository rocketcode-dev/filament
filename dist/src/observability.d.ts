import type { IncomingMessage } from 'node:http';
import type { Response } from './response.js';
import type { ContextMeta, FrameworkMeta, Observability, ObservedInfo, PolicyType, Request } from './types.js';
/** @internal Resolves the originating client address recorded for a request. */
export declare function requestOrigin(req: IncomingMessage): string | undefined;
/** @internal Creates process-local, time-sortable request identifiers. */
export declare class RequestIdFactory {
    readonly serviceId: string;
    private lastTimestamp;
    private sequence;
    constructor(podName?: string);
    create(timestamp?: number): string;
}
export declare function registeredPolicyName(handler: Function, type: Exclude<PolicyType, 'system' | 'route' | 'finalizer'>, index: number): string;
export declare function routePolicyName(handler: Function, method: string, path: string): string;
/** @internal Owns collection and policy resolution for one request. */
export declare class RequestObserver<T extends FrameworkMeta, C extends ContextMeta> {
    private readonly req;
    readonly observed: ObservedInfo;
    private observability?;
    private maximum?;
    private fixedStatus?;
    private configured;
    private systemFinished;
    private stopped;
    private responseChunks;
    constructor(req: Request<T, C>, requestIdFactory: RequestIdFactory, startTime: number);
    get isConfigured(): boolean;
    configure(observability: Observability | undefined, origin: string | undefined, search: string, res: Response): void;
    captureRequestBody(body: Buffer): void;
    finishSystem(res: Response): void;
    policyEnded(type: PolicyType, name: string | undefined, res: Response): void;
    /** Resolve the final policy and prune before application finalizers consume. */
    prepareForFinalizers(res: Response): void;
    private collectionAllowed;
    private canCollect;
    private effectiveSettings;
    private requestInfo;
    private responseInfo;
    private responseHeadersSent;
    private responseData;
    private responseEnded;
    private prune;
    private removeCollectedDetails;
}
//# sourceMappingURL=observability.d.ts.map