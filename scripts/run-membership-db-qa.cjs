// Disposable schema-only integration runner. Never reads .env or production.
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { createRequire } = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const runtime = path.join(os.tmpdir(), 'classa-bundle-runtime');
const runtimeRequire = createRequire(path.join(runtime, 'package.json'));
const databaseUrl = 'postgresql://postgres:local-real-membership@127.0.0.1:55433/postgres';
const token = 'local-real-membership-backend-key-20261123';
const keep = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'APPDATA', 'LOCALAPPDATA', 'USERPROFILE', 'SYSTEMDRIVE', 'OS', 'PROCESSOR_ARCHITECTURE']);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => keep.has(key.toUpperCase())));
Object.assign(env, {
  DATABASE_URL: databaseUrl, NODE_ENV: 'development',
  // prisma.config.ts imports dotenv/config; force it away from the real .env.
  DOTENV_CONFIG_PATH: path.join(runtime, 'NO-REAL-ENV-FOR-MEMBERSHIP-QA.env'),
  NEXTAUTH_SECRET: 'isolated-real-membership-qa-no-provider-login',
  NEXTAUTH_URL: 'http://127.0.0.1:3112', NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3112',
  TIKKIES_API_ENABLED: 'true', TIKKIES_API_KEY_SHA256: createHash('sha256').update(token).digest('hex'),
  TIKKIES_CUSTOMER_RATE_LIMIT_PER_MINUTE: '6000', TIKKIES_RATE_LIMIT_PER_MINUTE: '6000',
  MEMBERSHIP_QA_TOKEN: token, MEMBERSHIP_QA_ISOLATED: 'true',
  CHECKPOINT_DISABLE: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1',
});

function portUnused(port) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); reject(new Error(`Refusing occupied isolated QA port ${port}`)); });
    socket.once('error', error => error.code === 'ECONNREFUSED' ? resolve() : reject(error));
    socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Could not check isolated port')); });
  });
}

async function main() {
  await Promise.all([55433, 3112].map(portUnused));
  const { PGlite } = runtimeRequire('@electric-sql/pglite');
  const { PGLiteSocketServer } = runtimeRequire('@electric-sql/pglite-socket');
  let db, server, child, timer;
  let interrupted = false;
  const stop = () => { interrupted = true; child?.kill(); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    const sql = execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema', path.join(root, 'prisma/schema.prisma'), '--script'], {
      cwd: root, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
    db = await PGlite.create(); // No data directory: always a fresh in-memory DB.
    await db.exec(sql);
    // Prisma's adapter replaces a socket after a constraint error; leave room
    // for the closing socket. The test's actual pg pool remains max=1.
    server = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55433, maxConnections: 16 });
    await server.start();
    console.log('Fresh in-memory PGlite schema ready on isolated 127.0.0.1:55433; synthetic fixtures only.');
    child = spawn(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), path.join(root, process.argv[2] || 'scripts/check-real-membership-db.ts')], { cwd: root, env, stdio: 'inherit', windowsHide: true });
    timer = setTimeout(() => { console.error('Isolated QA timeout'); child.kill(); }, 180_000);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', code => resolve(code)); });
    if (code !== 0 || interrupted) throw new Error('Isolated membership DB checks failed');
  } finally {
    clearTimeout(timer);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    if (child && child.exitCode === null && !child.killed) child.kill();
    if (server) await server.stop();
    if (db) await db.close();
    console.log('Closed isolated socket and discarded in-memory membership QA database.');
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

