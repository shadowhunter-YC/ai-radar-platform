// Explicitly run to make one paid generation request through the local app.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { readSSE } from '../lib/daily-report.mjs';
const base = 'http://127.0.0.1:3100';
const config = await (await fetch(`${base}/api/reports`)).json();
assert.equal(config.configured, true, 'API key not configured');
const library = await (await fetch(`${base}/api/articles`)).json();
const selected = library.data.slice(0, 2);
assert.equal(selected.length, 2);
const started = Date.now();
const response = await fetch(`${base}/api/reports`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base },
  body: JSON.stringify({ articleIds: selected.map(a => a.id), mode: library.mode, style: 'brief' }),
  signal: AbortSignal.timeout(180000)
});
console.log(JSON.stringify({ status: response.status, contentType: response.headers.get('content-type'), model: config.model, selectedIds: selected.map(a => a.id), mode: library.mode }));
if (!response.ok) { console.log(await response.text()); process.exitCode = 1; }
else {
  let content = '', meta, complete, chunks = 0, firstTextMs;
  for await (const line of readSSE(response.body)) {
    const event = JSON.parse(line);
    if (event.type === 'start') meta = event;
    if (event.type === 'error') throw new Error(event.error);
    if (event.type === 'delta') {
      if (!firstTextMs) { firstTextMs = Date.now() - started; console.log(JSON.stringify({ firstTextMs })); }
      chunks++; content += event.text;
    }
    if (event.type === 'complete') complete = event;
  }
  assert.ok(complete, 'Missing completion event');
  assert.ok(content.length > 100, 'Report too short');
  assert.deepEqual(meta.sources.map(s => s.id), selected.map(a => a.id));
  const result = { testedAt: new Date().toISOString(), model: meta.model, mode: meta.mode, durationMs: Date.now() - started, firstTextMs, chunks, characters: content.length, hasCitations: /\[[12]\]/.test(content), hasSampleNotice: /示例|演示/.test(content), sections: ['今日概览', '重点新闻', '影响与建议'].map(title => ({ title, present: content.includes(title) })) };
  await mkdir('qa', { recursive: true });
  await writeFile('qa/daily-report-live-result.json', JSON.stringify(result, null, 2));
  await writeFile('qa/daily-report-live-sample.txt', content + '\n\n来源\n' + meta.sources.map(s => `[${s.number}] ${s.title} ${s.url || ''}`).join('\n'));
  console.log(JSON.stringify(result, null, 2));
}
