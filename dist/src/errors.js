/**
 * An HTTP failure detected by Filament before or during route execution.
 */
export class HttpError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
    }
}
export default HttpError;
//# sourceMappingURL=errors.js.map