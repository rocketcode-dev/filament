import { Request } from '../../src/index.js';
export interface AccessToken {
    subject: string;
    scope: string[];
    expiresAt: number;
}
export declare function randomToken(bytes?: number): string;
export declare function sha256Base64Url(value: string): string;
export declare function formBody(req: Request): URLSearchParams;
export declare function header(req: Request, name: string): string | undefined;
export declare function basicCredentials(req: Request): [string, string] | undefined;
export declare function sameSecret(actual: string, expected: string): boolean;
export declare function bearerToken(req: Request): string | undefined;
export declare function activeToken(req: Request, tokens: ReadonlyMap<string, AccessToken>, requiredScope: string): AccessToken | undefined;
export declare function issueToken(tokens: Map<string, AccessToken>, subject: string, scope: string[]): {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    scope: string;
};
//# sourceMappingURL=oauth.d.ts.map