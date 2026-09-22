#!/usr/bin/env node
/**
 * Local setup for AutGRC.
 *
 * Checks the toolchain, installs dependencies, builds the client, creates the
 * demonstration database if there isn't one, and prints how to start.
 *
 *   node scripts/setup.mjs             install, build and seed if empty
 *   node scripts/setup.mjs --reset     rebuild the demonstration data (destructive)
 *   node scripts/setup.mjs --reset -y  the same, without the confirmation prompt
 *   node scripts/setup.mjs --no-build  skip the client build (dev mode only)
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import readline from 'node:readline/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const reset = args.has('--reset');
const skipBuild = args.has('--no-build');
const assumeYes = args.has('--yes') || args.has('-y');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m'
};
const ok = (m) => console.log(`${c.green}✓${c.reset} ${m}`);
const warn = (m) => console.log(`${c.yellow}!${c.reset} ${m}`);
const info = (m) => console.log(`${c.dim}  ${m}${c.reset}`);
const step = (m) => console.log(`\n${c.bold}${c.cyan}${m}${c.reset}`);

function fail(message, remedies = []) {
  console.error(`\n${c.red}${c.bold}Setup stopped:${c.reset} ${message}`);
  for (const r of remedies) console.error(`  ${c.dim}·${c.reset} ${r}`);
  console.error('');
  process.exit(1);
}

function run(command, label) {
  try {
    execSync(command, { cwd: ROOT, stdio: 'inherit' });
  } catch {
    fail(`${label} failed.`, ['Scroll up for the underlying error.']);
  }
}

function portBusy(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', (err) => resolve(err.code === 'EADDRINUSE'))
      .once('listening', () => server.close(() => resolve(false)))
      .listen(port, '127.0.0.1');
  });
}

console.log(`\n${c.bold}AutGRC — local setup${c.reset}\n${c.dim}${ROOT}${c.reset}`);

// ------------------------------------------------------------- toolchain --
step('1/5  Checking the toolchain');

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 20) {
  fail(`Node ${process.versions.node} is too old. AutGRC needs Node 20 or newer.`, [
    'Install the current LTS from https://nodejs.org',
    'Or with nvm:  nvm install --lts && nvm use --lts'
  ]);
}
ok(`Node ${process.versions.node}`);

try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  ok(`npm ${npmVersion}`);
} catch {
  fail('npm was not found on PATH.', ['Reinstall Node.js, which bundles npm.']);
}

// ---------------------------------------------------------- dependencies --
step('2/5  Installing dependencies');

if (existsSync(path.join(ROOT, 'node_modules'))) {
  ok('node_modules already present — skipping install');
  info('Run "npm install" yourself if you have changed a package.json.');
} else {
  info('This takes a minute or two the first time.');
  run('npm install --no-audit --no-fund', 'npm install');
  ok('Dependencies installed');
}

// better-sqlite3 is the one native dependency; check it actually loaded.
step('3/5  Verifying the database driver');
try {
  const { default: Database } = await import('better-sqlite3');
  const probe = new Database(':memory:');
  probe.exec('create table t (a integer)');
  probe.close();
  ok('better-sqlite3 works');
} catch (err) {
  fail(`better-sqlite3 could not be loaded: ${err.message}`, [
    'It ships prebuilt binaries for Node 20, 22 and 24 — a mismatch usually means an unusual Node build.',
    'macOS:   xcode-select --install',
    'Windows: npm install --global windows-build-tools   (or install "Desktop development with C++" in Visual Studio Build Tools)',
    'Linux:   sudo apt-get install -y build-essential python3',
    'Then:    npm rebuild better-sqlite3'
  ]);
}

// ---------------------------------------------------------------- client --
step('4/5  Building the client');
if (skipBuild) {
  ok('Skipped (--no-build). Use "npm run dev" for the Vite dev server.');
} else if (existsSync(path.join(ROOT, 'client', 'dist', 'index.html'))) {
  ok('Client already built — skipping');
  info('Run "npm run build" after changing anything under client/src.');
} else {
  run('npm run build', 'Client build');
  ok('Client built into client/dist');
}

// ------------------------------------------------------------------ data --
step('5/5  Preparing the demonstration data');

const dataDir = path.join(ROOT, 'server', 'data');
mkdirSync(dataDir, { recursive: true });
const dbFile = path.join(dataDir, 'autgrc.db');

if (existsSync(dbFile) && !reset) {
  ok('Database already exists — leaving your data alone');
  info('Run "npm run reset" to rebuild it from scratch.');
} else {
  if (existsSync(dbFile)) {
    // Seeding on top of an existing database would duplicate the controls and
    // evidence rather than rebuilding them, so the file is removed first.
    warn('This deletes server/data/autgrc.db and everything you have created in it.');
    if (!assumeYes) {
      if (!process.stdin.isTTY) {
        fail('Refusing to delete the database without confirmation.', [
          'Re-run interactively, or pass --yes:  npm run reset -- --yes'
        ]);
      }
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question('  Continue? (y/N) ')).trim().toLowerCase();
      rl.close();
      if (answer !== 'y' && answer !== 'yes') {
        console.log('\nCancelled. Nothing was changed.\n');
        process.exit(0);
      }
    }
    for (const suffix of ['', '-wal', '-shm']) {
      rmSync(`${dbFile}${suffix}`, { force: true });
    }
    ok('Previous database removed');
  }
  run('npm run seed', 'Seeding');
  ok('Demonstration data created');
}

// ----------------------------------------------------------------- ready --
const seedPassword = (() => {
  const envFile = path.join(ROOT, '.env');
  if (!existsSync(envFile)) return 'Autgrc#2025';
  const match = readFileSync(envFile, 'utf8').match(/^SEED_PASSWORD=(.+)$/m);
  return match ? match[1].trim() : 'Autgrc#2025';
})();

const apiBusy = await portBusy(4000);
const viteBusy = await portBusy(5173);

console.log(`\n${c.green}${c.bold}Ready.${c.reset}\n`);

if (apiBusy || viteBusy) {
  warn(`Port ${[apiBusy && 4000, viteBusy && 5173].filter(Boolean).join(' and ')} already in use.`);
  info('Stop whatever is listening, or set PORT=4100 in a .env file.');
  console.log('');
}

console.log(`${c.bold}Start it${c.reset}`);
console.log(`  ${c.cyan}npm start${c.reset}      one process, serves everything on ${c.bold}http://localhost:4000${c.reset}`);
console.log(`  ${c.cyan}npm run dev${c.reset}    development mode with hot reload on ${c.bold}http://localhost:5173${c.reset}`);
console.log(`\n${c.bold}Sign in${c.reset}`);
console.log(`  grc@autgrc.demo    ${c.dim}GRC Manager — generate, edit, publish${c.reset}`);
console.log(`  ciso@autgrc.demo   ${c.dim}Approver — approve documents${c.reset}`);
console.log(`  admin@autgrc.demo  ${c.dim}Administrator — full access${c.reset}`);
console.log(`  password:  ${c.bold}${seedPassword}${c.reset}`);
console.log(`\n${c.dim}Everything runs on this machine. The database is a single file at${c.reset}`);
console.log(`${c.dim}server/data/autgrc.db and nothing is sent anywhere.${c.reset}\n`);
