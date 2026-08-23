/**
 * An HTTP failure detected by Filament before or during route execution.
 */
export declare class HttpError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string);
}
export default HttpError;
//# sourceMappingURL=errors.d.ts.map