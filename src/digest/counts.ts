import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type NightCounts = { ok: number; retry: number; fail: number; badLines: number };

// Log lines per status for one night (lines, not jobs). Same line validation as readNight.
// null = no file for that night.
export function nightCounts(runsDir: string, night: string): NightCounts | null {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const counts: NightCounts = { ok: 0, retry: 0, fail: 0, badLines: 0 };
  for (const raw of text.split('\n')) {
    const lineText = raw.replace(/\r$/, '');
    if (lineText.trim() === '') continue;
    const line = parseLine(lineText);
    if (line) counts[line.status]++;
    else counts.badLines++;
  }
  return counts;
}
