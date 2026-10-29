// Contract for the morning digest (plan.md § 1). Section 2 builds against this file.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for one night. Times are the log's own strings, offset kept, never converted.
export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number; // lines for this job
  retries: number; // lines with status "retry"
  lastStatus: RunStatus;
  lastError: string | null; // `error` of the job's last line, if any
  first: string; // `at` of the job's first line
  last: string; // `at` of the job's last line
};

// A night read from runs/<night>.jsonl. Rows are sorted by job.
export type Night = {
  night: string; // YYYY-MM-DD, as in the file name
  rows: DigestRow[];
  badLines: number; // lines that didn't parse or had the wrong shape
};

// null = no file for that night (404). An empty file gives a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
