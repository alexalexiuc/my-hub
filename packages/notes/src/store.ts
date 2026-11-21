import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { UserInputError, logger } from '@my-hub/shared/utils';

const run = promisify(execFile);

const pathExists = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/** Validates a repo-relative note path (`category/slug.md`): no traversal, lowercase-safe segments, `.md` only. */
export function assertNotePath(path: string): void {
  const ok =
    /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*\.md$/i.test(path) && !path.includes('..') && !path.startsWith('.');
  if (!ok) throw new UserInputError(`Invalid note path "${path}". Expected "<category>/<slug>.md".`);
}

/**
 * The Markdown files of one user: a git repo directory. Every write is one commit. Writes are serialised through
 * a promise chain so concurrent tool calls cannot race on files, git's index lock or the search index.
 */
export class NoteStore {
  private queue: Promise<unknown> = Promise.resolve();
  private initialised: Promise<void> | null = null;

  constructor(
    readonly dir: string,
    private readonly gitRemote: string = '',
  ) {}

  /** Runs `fn` after all previously queued writes finish. */
  serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Creates the directory and `git init`s it on first use. */
  init(): Promise<void> {
    this.initialised ??= (async () => {
      await mkdir(this.dir, { recursive: true });
      if (!(await pathExists(join(this.dir, '.git')))) {
        await this.git(['init', '-b', 'main']);
        if (this.gitRemote) await this.git(['remote', 'add', 'origin', this.gitRemote]);
      }
    })();
    return this.initialised;
  }

  private resolveNote(path: string): string {
    assertNotePath(path);
    const abs = resolve(this.dir, path);
    if (!abs.startsWith(resolve(this.dir) + sep)) throw new UserInputError(`Invalid note path "${path}".`);
    return abs;
  }

  async exists(path: string): Promise<boolean> {
    return pathExists(this.resolveNote(path));
  }

  /** File contents, or null when the note does not exist. */
  async read(path: string): Promise<string | null> {
    return readFile(this.resolveNote(path), 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null;
      throw err;
    });
  }

  /** Writes the file atomically (temp file + rename). Does not commit. */
  async write(path: string, content: string): Promise<void> {
    const abs = this.resolveNote(path);
    await mkdir(dirname(abs), { recursive: true });
    const tmp = `${abs}.${process.pid}.tmp`;
    await writeFile(tmp, content, 'utf8');
    await rename(tmp, abs);
  }

  /** Deletes one note file (no error when it is already gone). Does not commit. */
  async remove(path: string): Promise<void> {
    await rm(this.resolveNote(path), { force: true });
  }

  /** Commits everything pending with one message. A no-op commit is skipped. */
  async commit(message: string): Promise<void> {
    await this.git(['add', '-A']);
    const { stdout } = await this.git(['status', '--porcelain']);
    if (!stdout.trim()) return;
    await this.git(['commit', '-m', message, '--no-gpg-sign']);
  }

  /** All note paths (`category/slug.md`), sorted. Skips `.git` and dot-directories. */
  async listPaths(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (abs: string): Promise<void> => {
      const entries = await readdir(abs, { withFileTypes: true }).catch((err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') return [];
        throw err;
      });
      for (const e of entries) {
        if (e.name.startsWith('.')) continue;
        const full = join(abs, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile() && e.name.endsWith('.md')) out.push(relative(this.dir, full).split(sep).join('/'));
      }
    };
    await walk(this.dir);
    return out.sort();
  }

  /** Pushes `main` to `origin`. Failures are logged and returned, never thrown: backups must not block writes. */
  async push(): Promise<{ ok: boolean; message: string }> {
    try {
      const { stdout } = await this.git(['remote']);
      if (!stdout.includes('origin')) return { ok: false, message: 'No git remote configured (NOTES_GIT_REMOTE).' };
      await this.git(['push', '-u', 'origin', 'main']);
      return { ok: true, message: 'pushed' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[notes] backup push failed: ${message}`);
      return { ok: false, message };
    }
  }

  /** Deletes the user's whole notes directory (the "delete all my data" path). */
  async destroy(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
    this.initialised = null;
  }

  private git(args: string[]) {
    return run(
      'git',
      ['-c', 'user.name=my-hub notes', '-c', 'user.email=notes@my-hub.local', '-c', 'core.quotepath=off', ...args],
      { cwd: this.dir, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } },
    );
  }
}
