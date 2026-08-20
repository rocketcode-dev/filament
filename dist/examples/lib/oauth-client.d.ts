export declare function clientBaseUrl(): string;
export declare function postForm(url: string, values: Record<string, string>, headers?: Record<string, string>): Promise<any>;
export declare function jsonResponse(response: globalThis.Response): Promise<any>;
export declare function bearer(accessToken: string): Record<string, string>;
//# sourceMappingURL=oauth-client.d.ts.map