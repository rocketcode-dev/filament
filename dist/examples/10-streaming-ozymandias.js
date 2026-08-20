import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { createApp } from '../src/index.js';
const { values } = parseArgs({
    options: {
        port: { type: 'string' },
        interval: { type: 'string' },
        silent: { type: 'boolean' },
    },
});
const port = Number(values.port ?? 0);
const interval = Number(values.interval ?? 500);
const silent = values.silent ?? false;
const lines = [
    'I met a traveller from an antique land,',
    'Who said—“Two vast and trunkless legs of stone',
    'Stand in the desert. . . . Near them, on the sand,',
    'Half sunk a shattered visage lies, whose frown,',
    'And wrinkled lip, and sneer of cold command,',
    'Tell that its sculptor well those passions read',
    'Which yet survive, stamped on these lifeless things,',
    'The hand that mocked them, and the heart that fed;',
    'And on the pedestal, these words appear:',
    'My name is Ozymandias, King of Kings;',
    'Look on my Works, ye Mighty, and despair!',
    'Nothing beside remains. Round the decay',
    'Of that colossal Wreck, boundless and bare',
    'The lone and level sands stretch far away.”',
];
const app = createApp({});
// Streaming endpoint: lock the response into streaming mode before headers or
// body data are sent, then await every chunk so native backpressure is honored.
app.get('/poem', async (_req, res) => {
    res.streaming = true;
    res.headers.set('Content-Type', 'text/plain; charset=utf-8');
    res.headers.set('Cache-Control', 'no-store');
    for (let index = 0; index < lines.length; index += 1) {
        if (index > 0)
            await delay(interval);
        const line = lines[index];
        await res.sendChunk(`${line}\n`);
    }
    await res.end();
});
app.listen(port).then(actualPort => {
    if (!silent) {
        console.log(`\n📜 Streaming Ozymandias example running on http://127.0.0.1:${actualPort}`);
        console.log('\nEndpoints:');
        console.log('  GET /poem   - Stream one line of Ozymandias at a time');
        console.log('\nTry:');
        console.log(`  curl --no-buffer http://127.0.0.1:${actualPort}/poem`);
        console.log(`\nCurrent interval: ${interval}ms between lines\n`);
    }
});
//# sourceMappingURL=10-streaming-ozymandias.js.map