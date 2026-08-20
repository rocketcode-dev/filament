/**
 * Filament - A TypeScript API framework with metadata-driven middleware
 */

export {
  Application,
  RouteContext,
  createApp,
  createRouteContext
} from './application.js';

export type {
  FrameworkMeta,
  HttpMethod,
  Request,
  AsyncRequestHandler,
  ErrorHandler,
  Finalizer,
  ResponseTransformer,
  NextFunction,
} from './types.js';

export { Response } from './response.js';
export { Headers } from './headers.js';
