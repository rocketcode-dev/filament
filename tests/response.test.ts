import { suite } from 'node:test';
import TestBattery from 'test-battery';
import { ResponseImpl } from '../src/response.js';

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
    TestBattery.test('should set status code and return response for chaining', (battery) => {
      const res = new ResponseImpl();
      const result = res.status(404);
      battery.test('should return same instance for chaining')
        .value(result).value(res).equal;
      battery.test('should set status code')
        .value(res.statusCode).value(404).equal;
    });

    TestBattery.test('should default to 200 status code', (battery) => {
      const res = new ResponseImpl();
      battery.test('should default to 200')
        .value(res.statusCode).value(200).equal;
    });

    TestBattery.test('should allow changing status code multiple times', (battery) => {
      const res = new ResponseImpl();
      res.status(404);
      battery.test('should set to 404')
        .value(res.statusCode).value(404).equal;
      res.status(500);
      battery.test('should update to 500')
        .value(res.statusCode).value(500).equal;
    });
  });

  suite('setHeader', () => {
    TestBattery.test('should set a single header', (battery) => {
      const res = new ResponseImpl();
      const result = res.setHeader('Content-Type', 'application/json');
      battery.test('should return same instance for chaining')
        .value(result).value(res).equal;
      battery.test('should set header')
        .value(res.headers['Content-Type']).value('application/json').equal;
    });

    TestBattery.test('should set multiple headers', (battery) => {
      const res = new ResponseImpl();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Custom', 'value');
      battery.test('should have content-type')
        .value(res.headers['Content-Type']).value('application/json').equal;
      battery.test('should have custom header')
        .value(res.headers['X-Custom']).value('value').equal;
    });

    TestBattery.test('should set header with array value', (battery) => {
      const res = new ResponseImpl();
      res.setHeader('Set-Cookie', ['cookie1=value1', 'cookie2=value2']);
      battery.test('should set array header')
        .value(res.headers['Set-Cookie']).value(['cookie1=value1', 'cookie2=value2']).deepEqual;
    });

    TestBattery.test('should throw error if headers already sent', (battery) => {
      const res = new ResponseImpl();
      res.send('test');
      battery.test('should throw error when headers sent')
        .value(throws(() => res.setHeader('Content-Type', 'text/plain')))
        .is.true;
    });

    TestBattery.test('should allow chaining status and setHeader', (battery) => {
      const res = new ResponseImpl();
      res.status(201).setHeader('Content-Type', 'application/json');
      battery.test('should have status code')
        .value(res.statusCode).value(201).equal;
      battery.test('should have header')
        .value(res.headers['Content-Type']).value('application/json').equal;
    });
  });

  suite('json', () => {
    TestBattery.test('should set content-type header and send JSON', (battery) => {
      let sentResponse;
      const res = new ResponseImpl((r) => {
        sentResponse = r;
      });

      const data = { message: 'hello', count: 42 };
      res.json(data);

      battery.test('should set content-type')
        .value(res.headers['Content-Type']).value('application/json').equal;
      battery.test('should stringify data')
        .value(res.body).value(JSON.stringify(data)).equal;
      battery.test('should mark headers as sent')
        .value(res.headersSent).is.true;
      battery.test('should call onSend callback')
        .value(sentResponse).value(res).equal;
    });

    TestBattery.test('should handle null and undefined in JSON', (battery) => {
      const res1 = new ResponseImpl();
      res1.json(null);
      battery.test('should stringify null')
        .value(res1.body).value('null').equal;

      const res2 = new ResponseImpl();
      res2.json(undefined);
      battery.test('should stringify undefined as undefined')
        .value(res2.body).value(undefined).equal;
    });

    TestBattery.test('should handle arrays in JSON', (battery) => {
      const res = new ResponseImpl();
      const data = [1, 2, 3];
      res.json(data);
      battery.test('should stringify array')
        .value(res.body).value(JSON.stringify(data)).equal;
    });
  });

  suite('send', () => {
    TestBattery.test('should send string data', (battery) => {
      let sentResponse;
      const res = new ResponseImpl((r) => {
        sentResponse = r;
      });

      res.send('Hello World');
      battery.test('should set body')
        .value(res.body).value('Hello World').equal;
      battery.test('should mark headers as sent')
        .value(res.headersSent).is.true;
      battery.test('should call onSend callback')
        .value(sentResponse).value(res).equal;
    });

    TestBattery.test('should send buffer data', (battery) => {
      const res = new ResponseImpl();
      const buffer = Buffer.from('test data');
      res.send(buffer);
      battery.test('should set buffer as body')
        .value(res.body).value(buffer).equal;
      battery.test('should mark headers as sent')
        .value(res.headersSent).is.true;
    });

    TestBattery.test('should throw error if response already sent', (battery) => {
      const res = new ResponseImpl();
      res.send('first');
      battery.test('should throw error on double send')
        .value(throws(() => res.send('second'))).is.true;
    });

    TestBattery.test('should not call onSend callback if not provided', (battery) => {
      const res = new ResponseImpl();
      res.send('test');
      battery.test('should still mark headers as sent')
        .value(res.headersSent).is.true;
    });
  });

  suite('end', () => {
    TestBattery.test('should mark response as sent without body', (battery) => {
      let sentResponse;
      const res = new ResponseImpl((r) => {
        sentResponse = r;
      });

      res.end();
      battery.test('should mark headers as sent')
        .value(res.headersSent).is.true;
      battery.test('should not have body')
        .value(res.body).value(undefined).equal;
      battery.test('should call onSend callback')
        .value(sentResponse).value(res).equal;
    });

    TestBattery.test('should be idempotent', (battery) => {
      let callCount = 0;
      const res = new ResponseImpl(() => {
        callCount++;
      });

      res.end();
      res.end();
      res.end();

      battery.test('should call onSend only once')
        .value(callCount).value(1).equal;
      battery.test('should still be marked as sent')
        .value(res.headersSent).is.true;
    });

    TestBattery.test('should not override existing body', (battery) => {
      const res = new ResponseImpl();
      res.body = 'existing content';
      res.end();
      battery.test('should preserve existing body')
        .value(res.body).value('existing content').equal;
    });
  });

  suite('integration scenarios', () => {
    TestBattery.test('should support status + json workflow', (battery) => {
      let sentResponse;
      const res = new ResponseImpl((r) => {
        sentResponse = r;
      });

      res.status(201).json({ created: true });

      battery.test('should have status')
        .value(res.statusCode).value(201).equal;
      battery.test('should have content-type')
        .value(res.headers['Content-Type']).value('application/json').equal;
      battery.test('should have json body')
        .value(res.body).value(JSON.stringify({ created: true })).equal;
      battery.test('should be sent')
        .value(sentResponse).value(res).equal;
    });

    TestBattery.test('should support status + headers + send workflow', (battery) => {
      const res = new ResponseImpl();
      res.status(200).setHeader('X-Custom', 'value').send('Hello');

      battery.test('should have status')
        .value(res.statusCode).value(200).equal;
      battery.test('should have custom header')
        .value(res.headers['X-Custom']).value('value').equal;
      battery.test('should have body')
        .value(res.body).value('Hello').equal;
      battery.test('should be sent')
        .value(res.headersSent).is.true;
    });

    TestBattery.test('should prevent modifications after send', (battery) => {
      const res = new ResponseImpl();
      res.send('data');

      battery.test('should throw on setHeader')
        .value(throws(() => res.setHeader('X-Test', 'value'))).is.true;
      battery.test('should throw on second send')
        .value(throws(() => res.send('more'))).is.true;
      battery.test('status unchanged')
        .value(res.statusCode).value(200).equal;
    });
  });
});
