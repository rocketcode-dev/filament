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
} from './types.js';

export { Response } from './response.js';
export { Headers } from './headers.js';
export { HttpError } from './errors.js';
