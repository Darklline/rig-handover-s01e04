import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(
    join(dir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T01:00:00+01:00', 'zeta/job', 'ok'),
      line('2026-01-01T01:05:00+01:00', 'alpha/job', 'retry'),
      line('2026-01-01T01:10:00+01:00', 'alpha/job', 'ok'),
      '',
    ].join('\n'),
  );
  writeFileSync(join(dir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(dir, '2026-01-03.jsonl'),
    [line('2026-01-03T02:00:00+01:00', 'beta/job', 'ok'), 'not json at all', line('2026-01-03T02:30:00+01:00', 'alpha/job', 'fail'), ''].join('\n'),
  );
  app = createApp({ adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: dir });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const page = (night: string) => app.request(`/digest/${night}`);
const api = (night: string) => app.request(`/api/digest/${night}`);

describe.each([
  ['page', page],
  ['json', api],
])('%s', (_name, get) => {
  it('200 for a night with a file', async () => {
    expect((await get('2026-01-01')).status).toBe(200);
  });
  it('404 for a night with no file', async () => {
    expect((await get('2026-01-09')).status).toBe(404);
  });
});

describe('page', () => {
  it('lists jobs for a normal night', async () => {
    const html = await (await page('2026-01-01')).text();
    expect(html).toContain('alpha/job');
    expect(html).toContain('zeta/job');
    expect(html).not.toContain('could not be read');
  });
  it('says "nothing ran" for the empty night', async () => {
    const res = await page('2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });
  it('shows the bad-line note', async () => {
    const html = await (await page('2026-01-03')).text();
    expect(html).toContain('1 line could not be read');
    expect(html).toContain('beta/job');
  });
  it('404 page names the night', async () => {
    expect(await (await page('2026-01-09')).text()).toContain('no run log');
  });
});

describe('json', () => {
  it('returns rows for a normal night', async () => {
    const body = (await (await api('2026-01-01')).json()) as Night;
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'zeta/job']);
  });
  it('rows [] for the empty night', async () => {
    const res = await api('2026-01-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });
  it('badLines 1 with rows still there', async () => {
    const body = (await (await api('2026-01-03')).json()) as Night;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha/job', 'beta/job']);
  });
  it('404 carries an error message', async () => {
    const body = (await (await api('2026-01-09')).json()) as { error: string };
    expect(body.error).toContain('2026-01-09');
  });
});

describe('page and JSON agree', () => {
  it.each(['2026-01-01', '2026-01-03'])('same jobs, same order for %s', async (night) => {
    const body = (await (await api(night)).json()) as Night;
    const html = await (await page(night)).text();
    const fromPage = [...html.matchAll(/<tbody>[\s\S]*?<\/tbody>/g)]
      .flatMap((m) => [...m[0].matchAll(/<tr[^>]*><td>(?:⚠ )?([^<]*)<\/td>/g)])
      .map((m) => m[1]);
    expect(fromPage).toEqual(body.rows.map((r) => r.job));
    expect(fromPage.length).toBeGreaterThan(0);
  });
});
