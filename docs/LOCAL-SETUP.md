# Running AutGRC on your own machine

Everything runs locally. The database is a single file on your disk, and with
the default configuration nothing is sent anywhere.

## What you need

**Node.js 20 or newer** — that is the only prerequisite. Check with:

```bash
node --version
```

If it prints something older than `v20`, or the command is not found, install
the current LTS from [nodejs.org](https://nodejs.org).

## Setup

```bash
git clone https://github.com/helah20/AutGRC.git
cd AutGRC
git checkout claude/grc-documentation-platform-qovrtf
npm run setup
```

`npm run setup` checks your toolchain, installs dependencies, builds the
interface, creates the demonstration database and tells you how to start. It
is safe to run again — it skips work that is already done.

Then:

```bash
npm start
```

Open **<http://localhost:4000>** and sign in:

| Email | Role |
| --- | --- |
| `grc@autgrc.demo` | GRC Manager — generate, edit, publish |
| `ciso@autgrc.demo` | Approver — approve documents |
| `analyst@autgrc.demo` | Cybersecurity User |
| `reviewer@autgrc.demo` | Reviewer |
| `auditor@autgrc.demo` | Auditor |
| `admin@autgrc.demo` | Administrator |
| `viewer@autgrc.demo` | Read Only |

Password for all of them: `Autgrc#2025`

## Windows

The commands above work unchanged in PowerShell, Command Prompt, Git Bash and
WSL. If PowerShell blocks `npm` with an execution-policy error:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## The two ways to run it

| Command | What it does | Use it when |
| --- | --- | --- |
| `npm start` | One process on `http://localhost:4000`, serving the API and the built interface | Normal use |
| `npm run dev` | API on `:4000`, Vite dev server on `http://localhost:5173` with hot reload | You are changing the code |

After editing anything under `client/src`, run `npm run build` before
`npm start` picks it up. `npm run dev` reloads automatically.

## Using it in Arabic

Click the globe in the top bar, or pick العربية on the login screen before you
sign in. The choice is remembered on that browser.

The interface, navigation, table columns, statuses, domains and roles are
Arabic, and the layout mirrors.

Generating with Arabic selected produces an Arabic package — policy, standard,
procedure, roles, RACI and control matrix — for the five domains that are
translated: identity and access, asset management, incident management,
vulnerability management and third-party security. Pick another domain and it
generates in English and records the document's language as English, rather
than calling a half-translated document Arabic.

Framework requirement text stays in the publisher's own wording in either
language. It is marked as reference material rather than machine-translated,
and the reasoning is in the README under "Arabic and right-to-left support".

Exporting a document to Word with Arabic selected produces a genuine
right-to-left document that Word shapes and reorders correctly. PDF export
stays in English — the PDF engine cannot join Arabic letters, so the platform
refuses rather than producing something unreadable. Export to Word and save as
PDF from there.


## Your data

| Path | Contents |
| --- | --- |
| `server/data/autgrc.db` | Every document, control, role, mapping and audit entry |
| `server/data/uploads/` | Files you import |
| `server/data/.jwt-secret` | Generated on first run, used to sign sessions |

All of it is git-ignored, so your content is never committed.

**Back up** by copying `server/data/`.

**Start over** with `npm run reset`. This deletes the database and rebuilds
the demonstration data, so it asks you to confirm first. In a script, pass
`npm run reset -- --yes` to skip the prompt.

To keep the database somewhere else, create a `.env` file in the project root:

```
AUTGRC_DATA_DIR=/Users/you/Documents/autgrc-data
```

## Optional: Claude-assisted generation

AutGRC works fully offline using a built-in knowledge engine — no API key, no
network calls. To use Claude for generation and review instead, add to `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=anthropic
```

Restart the server. Settings → System shows which engine is active. With a key
set, document content is sent to the Anthropic API; without one, nothing
leaves your machine.

## Troubleshooting

**`EADDRINUSE` — port 4000 already in use.** Something else is on that port.
Either stop it, or put `PORT=4100` in `.env` and open `http://localhost:4100`.

**`npm run dev` shows a blank page or API errors.** Use
`http://localhost:5173` in dev mode, not `:4000`. The Vite dev server proxies
the API for you.

**"The client has not been built yet".** Run `npm run build`.

**better-sqlite3 fails to install or load.** It normally installs a prebuilt
binary. If your platform needs to compile it:

- macOS — `xcode-select --install`
- Windows — install *Desktop development with C++* from the
  [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Linux — `sudo apt-get install -y build-essential python3`

Then `npm rebuild better-sqlite3`.

**Sign-in fails after pulling new code.** Run `npm run reset` to rebuild the
demonstration accounts. This deletes your data, so it asks first.

**Forgotten password.** An administrator can reset any password under
Settings → Users. If no administrator account is reachable, `npm run reset`
restores every demonstration account to `Autgrc#2025` — at the cost of your
data.

## Confirming it works

```bash
npm test
```

The nine quality-engine tests run on their own. The end-to-end suite needs a
running server, so start one in another terminal first:

```bash
npm start           # terminal 1
npm test            # terminal 2 — 31 tests
```

Without a server it reports that suite as skipped rather than failing.

The end-to-end tests drive a live server through the whole workflow: generate
a governance package, map controls to framework requirements, run the quality
review, catch the seeded inconsistency, approve the document and export it to
Word, PDF and Excel.

## Running it for real

The demonstration data is a worked example, not a starting point for your own
organisation. When you are ready:

1. `npm run reset` to clear it.
2. Settings → Organisation — enter your real profile. The generator uses it,
   and records an explicit assumption wherever a field is blank.
3. Settings → Users — create real accounts and delete the demonstration ones.
4. Change every password. The seeded accounts all share one.
5. Frameworks — the catalogue is reference metadata for mapping. Verify
   entries against the official publications before relying on them for
   regulatory attestation.

For anything beyond a single user, put it behind HTTPS and set `JWT_SECRET` in
`.env` — the server refuses to start in production without one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
