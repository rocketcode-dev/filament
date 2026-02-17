import { describe } from 'node:test';
import TestBattery from 'test-battery';
import { pathToRegex, matchPath } from '../src/router.js';
describe('Router utilities', () => {
    describe('pathToRegex', () => {
        TestBattery.test('should convert simple path without parameters', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users');
            battery.test('should have no param names')
                .value(paramNames.length).value(0).equal;
            battery.test('should match exact path')
                .value(pattern.test('/users')).is.true;
            battery.test('should not match longer path')
                .value(pattern.test('/users/123')).is.false;
        });
        TestBattery.test('should convert path with single parameter', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:id');
            battery.test('should extract param name')
                .value(paramNames).value(['id']).deepEqual;
            battery.test('should match path with id')
                .value(pattern.test('/users/123')).is.true;
            battery.test('should match path with string id')
                .value(pattern.test('/users/abc')).is.true;
            battery.test('should not match without id')
                .value(pattern.test('/users')).is.false;
            battery.test('should not match longer path')
                .value(pattern.test('/users/123/posts')).is.false;
        });
        TestBattery.test('should convert path with multiple parameters', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:userId/posts/:postId');
            battery.test('should extract all param names')
                .value(paramNames).value(['userId', 'postId']).deepEqual;
            battery.test('should match path with both parameters')
                .value(pattern.test('/users/123/posts/456')).is.true;
            battery.test('should not match with missing parameter')
                .value(pattern.test('/users/123/posts')).is.false;
        });
        TestBattery.test('should handle root path', (battery) => {
            const { pattern, paramNames } = pathToRegex('/');
            battery.test('should have no param names')
                .value(paramNames.length).value(0).equal;
            battery.test('should match root path')
                .value(pattern.test('/')).is.true;
            battery.test('should not match other paths')
                .value(pattern.test('/users')).is.false;
        });
        TestBattery.test('should handle complex nested paths', (battery) => {
            const { pattern, paramNames } = pathToRegex('/api/v1/users/:userId/posts/:postId/comments');
            battery.test('should extract param names')
                .value(paramNames).value(['userId', 'postId']).deepEqual;
            battery.test('should match full path')
                .value(pattern.test('/api/v1/users/123/posts/456/comments')).is.true;
        });
    });
    describe('matchPath', () => {
        TestBattery.test('should return null for non-matching paths', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users');
            const match = matchPath('/posts', pattern, paramNames);
            battery.test('should return null for non-match')
                .value(match).value(null).equal;
        });
        TestBattery.test('should extract single parameter from path', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:id');
            const match = matchPath('/users/123', pattern, paramNames);
            battery.test('should match path')
                .value(match !== null).is.true;
            battery.test('should extract id parameter')
                .value(match?.params).value({ id: '123' }).deepEqual;
        });
        TestBattery.test('should extract multiple parameters from path', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:userId/posts/:postId');
            const match = matchPath('/users/123/posts/456', pattern, paramNames);
            battery.test('should match path')
                .value(match !== null).is.true;
            battery.test('should extract all parameters')
                .value(match?.params).value({ userId: '123', postId: '456' }).deepEqual;
        });
        TestBattery.test('should handle parameter values with special characters', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:id');
            const match = matchPath('/users/user-123', pattern, paramNames);
            battery.test('should match path')
                .value(match !== null).is.true;
            battery.test('should extract hyphenated id')
                .value(match?.params).value({ id: 'user-123' }).deepEqual;
        });
        TestBattery.test('should not match paths that are too long', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users/:id');
            const match = matchPath('/users/123/extra', pattern, paramNames);
            battery.test('should not match longer path')
                .value(match).value(null).equal;
        });
        TestBattery.test('should handle paths with no parameters', (battery) => {
            const { pattern, paramNames } = pathToRegex('/users');
            const match = matchPath('/users', pattern, paramNames);
            battery.test('should match path')
                .value(match !== null).is.true;
            battery.test('should have empty params object')
                .value(match?.params).value({}).deepEqual;
        });
    });
});
//# sourceMappingURL=router.test.js.map