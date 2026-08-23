import { randomInt } from 'node:crypto';
import { STATUS_CODES } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { isIP } from 'node:net';
import type { Response } from './response.js';
import type {
  ContextMeta,
  FrameworkMeta,
  NegativeObservability,
  NegativeObservabilityForStatus,
  Observability,
  ObservabilityForStatus,
  ObservedInfo,
  PolicyType,
  Request,
  ResponseEndStatus,
} from './types.js';

const observationFields = [
  'origin',
  'method',
  'path',
  'search',
  'statusCode',
  'trace',
  'statusText',
  'requestHeaders',
  'requestBody',
  'responseHeaders',
  'responseBody',
] as const;

type ObservationField = typeof observationFields[number];
type ObservationSettings = Record<ObservationField, boolean>;

function headerStrings(value: string|string[]|undefined): string[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function normalizeAddress(value: string): string | undefined {
  let address = value.trim();
  if (address.startsWith('"') && address.endsWith('"')) {
    address = address.slice(1, -1).replace(/\\(.)/g, '$1');
  }
  if (!address || address.toLowerCase() === 'unknown' || address[0] === '_') {
    return undefined;
  }

  const bracketed = address.match(/^\[([^\]]+)](?::\d+)?$/);
  if (bracketed) address = bracketed[1];

  const mappedIpv4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mappedIpv4 && isIP(mappedIpv4)) return mappedIpv4;
  if (isIP(address)) return address;

  const ipv4WithPort = address.match(/^(\d+\.\d+\.\d+\.\d+):\d+$/)?.[1];
  return ipv4WithPort && isIP(ipv4WithPort) ? ipv4WithPort : undefined;
}

function forwardedOrigin(value: string|string[]|undefined): string | undefined {
  for (const header of headerStrings(value)) {
    for (const element of header.split(',')) {
      for (const directive of element.split(';')) {
        const match = directive.match(/^\s*for\s*=\s*(.+?)\s*$/i);
        const address = match && normalizeAddress(match[1]);
        if (address) return address;
      }
    }
  }
  return undefined;
}

function commaSeparatedOrigin(
  value: string|string[]|undefined,
): string | undefined {
  for (const header of headerStrings(value)) {
    for (const entry of header.split(',')) {
      const address = normalizeAddress(entry);
      if (address) return address;
    }
  }
  return undefined;
}

/** @internal Resolves the originating client address recorded for a request. */
export function requestOrigin(req: IncomingMessage): string | undefined {
  return forwardedOrigin(req.headers.forwarded)
    ?? commaSeparatedOrigin(req.headers['x-forwarded-for'])
    ?? commaSeparatedOrigin(req.headers['x-real-ip'])
    ?? normalizeAddress(req.socket.remoteAddress ?? '');
}

const defaultSettings: ObservationSettings = {
  origin: true,
  method: true,
  path: true,
  search: true,
  statusCode: true,
  trace: true,
  statusText: false,
  requestHeaders: false,
  requestBody: false,
  responseHeaders: false,
  responseBody: false,
};

function mergeSettings(
  base: ObservationSettings,
  override?: ObservabilityForStatus,
): ObservationSettings {
  return { ...base, ...override };
}

function statusSettings(
  observability: Observability,
  statusCode: number,
): ObservationSettings {
  const success = mergeSettings(defaultSettings, observability.success);
  const outcome = statusCode < 400
    ? success
    : observability.failure
      ? mergeSettings(success, observability.failure)
      : success;
  return mergeSettings(outcome, observability[statusCode]);
}

function maximumSettings(observability: Observability): ObservationSettings {
  const settings = observationFields.reduce((result, field) => {
    result[field] = false;
    return result;
  }, {} as ObservationSettings);

  const candidates = [
    statusSettings(observability, 200),
    statusSettings(observability, 500),
  ];
  for (const key of Object.keys(observability)) {
    if (/^\d+$/.test(key)) {
      candidates.push(statusSettings(observability, Number(key)));
    }
  }
  for (const candidate of candidates) {
    for (const field of observationFields) {
      settings[field] ||= candidate[field];
    }
  }
  return settings;
}

function negativeSettings(
  observability: NegativeObservability | undefined,
  statusCode: number,
): NegativeObservabilityForStatus {
  if (!observability) return {};
  const success = observability.success ?? {};
  const outcome = statusCode < 400
    ? success
    : { ...success, ...observability.failure };
  return { ...outcome, ...observability[statusCode] };
}

function makeServiceId(podName = process.env.POD_NAME): string {
  const podSuffix = podName?.match(/-[0-9a-z]{10}-([0-9a-z]{5})$/)?.[1];
  return podSuffix ?? randomInt(36 ** 5).toString(36).padStart(5, '0');
}

function formatRequestId(
  timestamp: number,
  sequence: number,
  serviceId: string,
) {
  const iso = new Date(timestamp).toISOString();
  const date = iso.slice(0, 10).replace(/-/g, '');
  const time = iso.slice(11, 19).replace(/:/g, '');
  const milliseconds = iso.slice(20, 23);
  return `${date}-${time}-${milliseconds}${sequence}-${serviceId}`;
}

/** @internal Creates process-local, time-sortable request identifiers. */
export class RequestIdFactory {
  readonly serviceId: string;
  private lastTimestamp = -1;
  private sequence = 0;

  constructor(podName?: string) {
    this.serviceId = makeServiceId(podName);
  }

  create(timestamp = Date.now()): string {
    if (timestamp > this.lastTimestamp) {
      this.lastTimestamp = timestamp;
      this.sequence = 0;
    } else if (this.sequence < 9) {
      this.sequence += 1;
    } else {
      // Preserve uniqueness and ordering after all ten sequence slots for the
      // logical millisecond have been used.
      this.lastTimestamp += 1;
      this.sequence = 0;
    }
    return formatRequestId(this.lastTimestamp, this.sequence, this.serviceId);
  }
}

function policyName(handler: Function, fallback: string): string {
  return handler.name || fallback;
}

export function registeredPolicyName(
  handler: Function,
  type: Exclude<PolicyType, 'system'|'route'|'finalizer'>,
  index: number,
): string {
  return policyName(handler, `${type}[${index}]`);
}

export function routePolicyName(
  handler: Function,
  method: string,
  path: string,
): string {
  return policyName(handler, `${method} ${path}`);
}

function responseEndStatus(res: Response): ResponseEndStatus {
  if (res.committed) return 'committed';
  if (res.closed) return 'closed';
  if (res.headers.frozen) return 'headers';
  return 'open';
}

/** @internal Owns collection and policy resolution for one request. */
export class RequestObserver<
  T extends FrameworkMeta,
  C extends ContextMeta,
> {
  readonly observed: ObservedInfo;
  private observability?: Observability;
  private maximum?: ObservationSettings;
  private fixedStatus?: number;
  private configured = false;
  private systemFinished = false;
  private stopped = false;
  private responseChunks: Buffer[] = [];

  constructor(
    private readonly req: Request<T, C>,
    requestIdFactory: RequestIdFactory,
    startTime: number,
  ) {
    this.observed = {
      requestId: requestIdFactory.create(startTime),
      startTime,
    };
    const context = req.context as ContextMeta;
    context.application ??= {};
    context.application.observed = this.observed;
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  configure(
    observability: Observability | undefined,
    origin: string | undefined,
    search: string,
    res: Response,
  ): void {
    if (this.configured) return;
    this.configured = true;
    this.observability = observability;
    if (!observability?.enabled || !this.collectionAllowed()) return;

    this.maximum = maximumSettings(observability);
    const settings = this.effectiveSettings();
    if (settings.origin && origin !== undefined) {
      this.requestInfo().origin = origin;
    }
    if (settings.method) this.requestInfo().method = this.req.method;
    if (settings.path) this.requestInfo().path = this.req.path;
    if (settings.search) this.requestInfo().search = search;
    if (settings.requestHeaders) {
      this.requestInfo().headers = this.req.headers.headers;
    }

    res.on('headers', () => this.responseHeadersSent(res));
    res.on('send', data => this.responseData(data, res));
    res.on('sendChunk', data => this.responseData(data, res));
    res.on('end', () => this.responseEnded(res));
  }

  captureRequestBody(body: Buffer): void {
    if (!this.canCollect() || !this.effectiveSettings().requestBody) return;
    this.requestInfo().body = body.toString();
  }

  finishSystem(res: Response): void {
    if (this.systemFinished) return;
    this.systemFinished = true;
    this.policyEnded('system', 'request', res);
  }

  policyEnded(type: PolicyType, name: string | undefined, res: Response): void {
    if (this.stopped || !this.canCollect()) return;
    const settings = this.effectiveSettings(this.fixedStatus);
    if (settings.trace) {
      (this.observed.trace ??= []).push({
        type,
        name,
        endTime: Date.now(),
        endStatus: responseEndStatus(res),
        mode: res.streaming ? 'streaming' : 'buffered',
      });
    }
    // The policy that commits a response may record its terminal state. No
    // later policy or response event is allowed to add information.
    if (res.committed) this.stopped = true;
  }

  /** Resolve the final policy and prune before application finalizers consume. */
  prepareForFinalizers(res: Response): void {
    if (!this.observability?.enabled || !this.collectionAllowed()) {
      this.removeCollectedDetails();
      this.stopped = true;
      return;
    }
    const settings = this.effectiveSettings(res.statusCode);
    this.prune(settings);
    this.stopped = true;
  }

  private collectionAllowed(): boolean {
    return (this.req.context as ContextMeta).application
      ?.observability?.enabled !== false;
  }

  private canCollect(): boolean {
    if (!this.observability?.enabled || !this.collectionAllowed()) {
      if (!this.collectionAllowed()) {
        this.removeCollectedDetails();
        this.stopped = true;
      }
      return false;
    }
    return true;
  }

  private effectiveSettings(statusCode?: number): ObservationSettings {
    const positive = statusCode === undefined || !this.observability
      ? this.maximum ?? { ...defaultSettings }
      : statusSettings(this.observability, statusCode);
    const negative = statusCode === undefined
      ? {}
      : negativeSettings(
          (this.req.context as ContextMeta).application?.observability,
          statusCode,
        );
    return { ...positive, ...negative };
  }

  private requestInfo() {
    return this.observed.requestInfo ??= {};
  }

  private responseInfo() {
    return this.observed.responseInfo ??= {};
  }

  private responseHeadersSent(res: Response): void {
    if (this.stopped || !this.canCollect()) return;
    this.fixedStatus = res.statusCode;
    const settings = this.effectiveSettings(this.fixedStatus);
    const info = this.responseInfo();
    if (settings.statusCode) info.statusCode = res.statusCode;
    if (settings.statusText) info.statusText = STATUS_CODES[res.statusCode] ?? '';
    if (settings.responseHeaders) info.headers = res.headers.headers;
    if (settings.responseBody && !res.streaming) {
      info.body = res.body?.toString() ?? '';
    }
    this.prune(settings);
  }

  private responseData(data: Buffer, res: Response): void {
    if (this.stopped || !this.canCollect()) return;
    const settings = this.effectiveSettings(this.fixedStatus);
    if (!settings.responseBody || !res.streaming) return;
    this.responseChunks.push(Buffer.from(data));
  }

  private responseEnded(res: Response): void {
    if (this.stopped || !this.canCollect()) return;
    const settings = this.effectiveSettings(this.fixedStatus);
    if (!settings.responseBody || !res.streaming) return;
    this.responseInfo().body = Buffer.concat(this.responseChunks).toString();
  }

  private prune(settings: ObservationSettings): void {
    const request = this.observed.requestInfo;
    if (request) {
      if (!settings.origin) delete request.origin;
      if (!settings.method) delete request.method;
      if (!settings.path) delete request.path;
      if (!settings.search) delete request.search;
      if (!settings.requestHeaders) delete request.headers;
      if (!settings.requestBody) delete request.body;
      if (!Object.keys(request).length) delete this.observed.requestInfo;
    }

    const response = this.observed.responseInfo;
    if (response) {
      if (!settings.statusCode) delete response.statusCode;
      if (!settings.statusText) delete response.statusText;
      if (!settings.responseHeaders) delete response.headers;
      if (!settings.responseBody) delete response.body;
      if (!Object.keys(response).length) delete this.observed.responseInfo;
    }
    if (!settings.trace) delete this.observed.trace;
    if (!settings.responseBody) this.responseChunks.length = 0;
  }

  private removeCollectedDetails(): void {
    delete this.observed.requestInfo;
    delete this.observed.responseInfo;
    delete this.observed.trace;
  }
}
