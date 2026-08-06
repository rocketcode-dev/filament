import { suite } from 'node:test';
import { ResponseImpl } from '../src/response.js';
import { testWithOneTimeServer } from './lib/simple-server.js';

function throws(fn: () => void) {
  try {
    fn();
    return false; // did not throw
  } catch (e) {
    return true; // threw an error
  }
}

suite('ResponseImpl', () => {
  suite('status', () => {
    testWithOneTimeServer(
      'should set status code and return response for chaining',
      async (battery, res) => {
        const result = res.status(404);
        battery.test('should return same instance for chaining')
          .value(result).value(res).equal;
        battery.test('should set status code')
          .value(res.statusCode).value(404).equal;
      }
    );

    testWithOneTimeServer(
      'should default to 200 status code',
      async (battery, res) => {
        battery.test('should default to 200')
          .value(res.statusCode).value(200).equal;
      }
    );

    testWithOneTimeServer(
      'should allow changing status code multiple times',
      async (battery, res) => {
        res.status(404);
        battery.test('should set to 404')
          .value(res.statusCode).value(404).equal;
        res.status(500);
        battery.test('should update to 500')
          .value(res.statusCode).value(500).equal;
      }
    );
  });

  suite('setHeader', () => {
    testWithOneTimeServer(
      'should set a single header',
      async (battery, res) => {
        const result = res.setHeader('Content-Type', 'application/json');
        battery.test('should return same instance for chaining')
          .value(result).value(res).equal;
        battery.test('should set header')
          .value(res.getHeader('Content-Type')).value('application/json').equal;
      }
    );

    testWithOneTimeServer(
      'should set multiple headers',
      async (battery, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('X-Custom', 'value');
        battery.test('should have content-type')
          .value(res.getHeader('Content-Type')).value('application/json').equal;
        battery.test('should have custom header')
          .value(res.getHeader('X-Custom')).value('value').equal;
      }
    );

    testWithOneTimeServer(
      'should set header with array value',
      async (battery, res) => {
        res.setHeader('Set-Cookie', ['cookie1=value1', 'cookie2=value2']);
        battery.test('should set array header')
          .value(res.getHeader('Set-Cookie'))
          .value(['cookie1=value1', 'cookie2=value2']).deepEqual;
      }
    );

    testWithOneTimeServer(
      'should throw error if headers already sent',
      async (battery, res) => {
        res.send('test');
        battery.test('should throw error when headers sent')
          .value(throws(() => res.setHeader('Content-Type', 'text/plain')))
          .is.true;
      }
    );

    testWithOneTimeServer(
      'should allow chaining status and setHeader',
      async (battery, res) => {
        res.status(201).setHeader('Content-Type', 'application/json');
        battery.test('should have status code')
          .value(res.statusCode).value(201).equal;
        battery.test('should have header')
          .value(res.getHeader('Content-Type')).value('application/json').equal;
      }
    );
  });

  suite('json', () => {
    testWithOneTimeServer(
      'should set content-type header and send JSON',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });

        const data = { message: 'hello', count: 42 };
        await res.json(data);

        battery.test('should set content-type')
          .value(res.getHeader('Content-Type')).value('application/json').equal;
        battery.test('should fire event when sending data')
          .value(sentResponse).is.not.nil;
        battery.test('should data')
          .value(sentResponse).value(JSON.stringify(data)).equal;
        battery.test('should mark headers as sent')
          .value(res.headersSent).is.true;
        battery.test('should call onSend callback')
          .value(sentResponse ? sentResponse.toString() : undefined)
          .value(JSON.stringify(data)).equal;
      }
    );

    testWithOneTimeServer(
      'should handle null in JSON',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });
        await res.json(null);

        battery.test('should stringify null')
          .value(sentResponse?.toString() || '"WRONG"')
          .value('null').equal;
      }
    );

    testWithOneTimeServer(
      'should handle undefined in JSON',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });
        await res.json(undefined);

        battery.test('should stringify undefined as undefined')
          .value(sentResponse?.toString() || '"WRONG"')
          .value('undefined').equal;
      }
    );

    testWithOneTimeServer(
      'should handle arrays in JSON',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });
        const data = [1, 2, 3];
        
        await res.json(data);
        battery.test('should stringify array')
          .value(sentResponse).value(JSON.stringify(data)).equal;
      }
    );
  });

  suite('send', () => {
    testWithOneTimeServer(
      'should send string data',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });

        await res.send('Hello World');
        battery.test('should set body')
          .value(sentResponse).value('Hello World').equal;
        battery.test('should mark headers as sent')
          .value(res.headersSent).is.true;
      }
    );

    testWithOneTimeServer(
      'should send buffer data',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
        });
        const buffer = Buffer.from('test data');
        await res.send(buffer);
        battery.test('should set buffer as body')
          .value(sentResponse).value(buffer).equal;
        battery.test('should mark headers as sent')
          .value(res.headersSent).is.true;
    });

    testWithOneTimeServer(
      'should throw error if response already sent',
      async (battery, res) => {
        res.send('first');
        battery.test('should throw error on double send')
          .value(throws(() => res.send('second'))).is.true;
    });

    testWithOneTimeServer(
      'should not call onSend callback if not provided',
      async (battery, res) => {
        res.send('test');
        battery.test('should still mark headers as sent')
          .value(res.headersSent).is.true;
      }
    );
  });

  suite('end', () => {
    testWithOneTimeServer(
      'should mark response as closed when sent without body',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        let sentCallbackCalled = false;
        let endCallbackCalled = false;
        res.on('send', (data: Buffer) => {
          sentResponse = data;
          sentCallbackCalled = true;
        });
        res.on('end', () => {
          endCallbackCalled = true;
        });

        await res.end();

        battery.test('should mark headers as sent')
          .value(res.headersSent).is.true;
        battery.test('should not have body')
          .value(sentResponse).is.undefined;
        battery.test('should not call `send` callback')
          .value(sentCallbackCalled).is.false;
        battery.test('should call `end` callback')
          .value(endCallbackCalled).is.true;
        battery.test('should be closed')
          .value(res.closed).is.true;
      }
    );

    testWithOneTimeServer(
      'should have idempotency in res.end()',
      async (battery, res) => {
        let ends = 0;
        let duped = 0;
        res.on('end', () => {
          ends++
        });

        await res.end();
        try {
          await res.end();
        } catch {
          duped++;
        }

        battery.test('should call end only once')
          .value(ends).value(1).equal;
        battery.test('should not throw if called again.')
          .value(duped).value(0).equal;
        battery.test('should still be marked as sent')
          .value(res.headersSent).is.true;
        battery.test('should still be marked as closed')
          .value(res.closed).is.true;
      }
    );

    testWithOneTimeServer(
      'should throw if res.send() called more than once',
      async (battery, res) => {
        let sends = 0;
        let throws = 0;
        let sentData:string[] = [];
        res.on('send', (d) => {
          sends++;
          sentData.push(d.toString());
        });

        await res.send('hello');
        try {
          await res.send('goodbye');
        } catch {
          throws++;
        }

        battery.test('should call end only once')
          .value(sends).value(1).equal;
        battery.test('should throw if end is called again')
          .value(throws).value(1).equal;
        battery.test('should still be marked as sent')
          .value(res.headersSent).is.true;
        battery.test('should still be marked as closed')
          .value(res.closed).is.true;
        battery.test('data not sent should not fire an event')
          .value(sentData.join('')).value('hello').equal;
      }
    );
  });

  suite('integration scenarios', () => {
    testWithOneTimeServer(
      'should support status + json workflow',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', d => {
          sentResponse = d;
        });

        await res.status(201).json({ created: true });

        battery.test('should have status')
          .value(res.statusCode).value(201).equal;
        battery.test('should have content-type')
          .value(res.getHeader('Content-Type')).value('application/json').equal;
        battery.test('should have json body')
          .value(sentResponse?.toString())
          .value(JSON.stringify({ created: true })).equal;
        battery.test('should be sent')
          .value(res.closed).is.true;
      }
    );

    testWithOneTimeServer(
      'should support status + headers + send workflow',
      async (battery, res) => {
        let sentResponse:Buffer|undefined;
        res.on('send', d => {
          sentResponse = d;
        });

        await res.status(200).setHeader('X-Custom', 'value').send('Hello');

        battery.test('should have status')
          .value(res.statusCode).value(200).equal;
        battery.test('should have custom header')
          .value(res.getHeader('X-Custom')).value('value').equal;
        battery.test('should have body')
          .value(sentResponse).value('Hello').equal;
        battery.test('should be sent')
          .value(res.headersSent).is.true;
      }
    );

    testWithOneTimeServer(
      'should prevent modifications after send',
      async (battery, res) => {
        await res.send('data');

        battery.test('should throw on setHeader')
          .value(throws(() => res.setHeader('X-Test', 'value'))).is.true;
        battery.test('should throw on second send')
          .value(throws(() => res.send('more'))).is.true;
        battery.test('status unchanged')
          .value(res.statusCode).value(200).equal;
      }
    );
  });
});
