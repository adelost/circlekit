import { constants } from 'node:fs';
import { mkdtemp, open, lstat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { requireThat } from './util.mjs';

const ticketShape = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value);

/** The launcher passes only this path in the child's environment, never the secret. */
export async function storeTicketFile(ticket) {
  requireThat(ticketShape(ticket),'live.ticket','Expected one 256-bit pairing ticket.');
  const directory=await mkdtemp(path.join(os.tmpdir(),'v1d-live-ticket-'));
  const file=path.join(directory,'ticket');
  const handle=await open(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
  try { await handle.writeFile(ticket,'utf8'); }
  finally { await handle.close(); }
  return file;
}

/** Read once in the debug bootstrap. Symlinks and group-readable files are refused. */
export async function consumeTicketFile(file) {
  requireThat(typeof file==='string' && path.isAbsolute(file),'live.ticket-file','Use an absolute private ticket path.');
  const info=await lstat(file);
  requireThat(info.isFile() && info.size<=128 && (info.mode&0o077)===0
    && (typeof process.getuid!=='function'||info.uid===process.getuid()),
  'live.ticket-file','Ticket file must be a small private 0600 regular file owned by this user.');
  const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const ticket=await handle.readFile('utf8');
    requireThat(ticketShape(ticket),'live.ticket-file','Ticket file has an invalid one-time secret.');
    await unlink(file);
    return ticket;
  } finally { await handle.close(); }
}
