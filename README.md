# Ragnarok Timeline

A standalone macOS activity viewer extracted from Ragnarok. See supported coding agents' command receipts, reported file operations, and Codex MCP/web tool metadata in one searchable timeline. Filter by agent, inspect an event, or copy it as text/an image.

**Early test build.** This is an observer, not an agent, sandbox, permissions system, or guarantee of correct work. No account, backend, database, server, telemetry, or network connection is required by this app or its hooks. Your coding agents still use their own services normally.

## Install on another Mac

Requires **macOS 14+**, **Node.js 20+** available in Terminal, and at least one supported agent. The app can be built for Apple silicon and Intel. Compiling from source requires Apple's command-line developer tools; the prepared ZIP includes the app.

Download/unzip the test package or clone this repository. In Terminal, `cd` into its folder and run:

```sh
./install.sh claude codex
```

Select only the agents you use: `./install.sh claude` or `./install.sh codex`. Optional `gemini` configuration is also available, with adapter tests but no live Gemini run verified here. Omitting arguments selects Claude and Codex.

The installer:

1. Copies the local observer scripts to `~/Library/Application Support/Ragnarok Timeline/hooks/`.
2. Backs up existing JSON configs next to the originals and adds only this app's post-tool handlers. It preserves other handlers/settings.
3. Installs the app at `~/Applications/Ragnarok Timeline.app`.
4. Opens the viewer. **Restart selected agents. Review/trust new hooks through the agent's normal interface.** It does not change agent permissions, enable unattended approvals, or approve its own hooks.

Codex hooks are in `~/.codex/hooks.json`; Claude hooks are in `~/.claude/settings.json`. Their post-tool matchers cover all tools; shell/file tools have narrow summaries, and other tools retain name/status metadata only. See [Codex hook documentation](https://learn.chatgpt.com/docs/hooks) and [Claude hook documentation](https://code.claude.com/docs/en/hooks).

The test app is ad-hoc signed, **not Developer ID signed or notarized**. macOS may require an explicit user decision to open a downloaded test app. Do not disable Gatekeeper. Building locally from reviewed source is another option.

## First test with your brother

Use a temporary empty project, then ask his agent to:

- Run `pwd` and `ls`.
- Create `timeline-test.txt` containing `test`.
- Read that file.
- Run `false` and report its exit status.
- If available, use one MCP tool.

Check that events appear under the selected agent and that the failed shell command is not labeled successful. A file operation is **reported by the hook**, not independently verified against the disk. Command read/change labels are heuristics and can be wrong, especially for scripts, subprocesses and remote commands.

Do not put real secrets in a test. The command text is recorded after pattern/exact-value masking, but redaction cannot guarantee removal of every sensitive value. See [PRIVACY.md](PRIVACY.md).

```sh
node scripts/doctor.mjs
```

Doctor checks local hook configuration, event-file permissions/capacity, the last event time, and the hook syntax. It does **not** establish that an agent has loaded or trusted its hook; a real observed test command does that.

## What is captured

| Path | Captures | Limits |
|---|---|---|
| Claude/Codex post-tool hooks | Shell command text, provided exit code, tool/file-operation names, session and actor | Only events supplied by the client; cached/untrusted/disabled hooks can miss actions |
| Codex local session metadata | Completed MCP calls and extension/web tool events | Reads recent `.codex/sessions` files; metadata only; no tool arguments/results |
| Gemini adapter | AfterTool shell/read/write metadata | Fixture-tested; live compatibility unverified |
| Grok/Antigravity adapter | CamelCase payload normalization | Fixture-tested; manual client-specific hook setup needed |

Codex transcript metadata supplements command hooks rather than claiming that the tool hook covers every tool. The viewer imports only each file's recent tail and then follows it. Agent messages, prompts and reasoning are not imported. The app keeps up to 10,000 events in memory.

This initial package has no shell-profile modification, SSH collector, raw OS audit feed, model API, database, automatic launch job, updater, or unrelated Ragnarok features. Events from generic hooks and transcript metadata can describe the same MCP call; source labels retain that provenance rather than silently deduplicating uncertain matches.

## Storage and removal

Data: `~/Library/Application Support/Ragnarok Timeline/`, directory permissions `0700`; `events.jsonl` permissions `0600`. Records have random IDs, not a cryptographic audit chain. Attribution is installer-specified and can be forged by software running as your account.

The event file stops accepting new records once it reaches 20 MiB (a final concurrent append may exceed the limit). Hooks fail open to avoid breaking agents. Doctor reports capacity and any saved hook failure marker. Stop agents before archiving the file; the viewer notices replacement/truncation.

```sh
./uninstall.sh
```

This removes only the exact hook commands installed by this app, preserving subsequent unrelated edits. Restart agents afterward. It retains logs, backups, and scripts because a running client can still have a cached hook. Close the app and move it to Trash separately. Your existing Ragnarok installation is untouched.

## Build and tests

```sh
./scripts/check.sh       # Node fixture/installer tests and Swift core tests
./scripts/build-app.sh   # universal app under dist/
./scripts/package.sh     # checked app, sources, installer and docs in release/ ZIP
```

No Swift packages or npm packages are downloaded. Test installation uses temporary home/data directories, not real agent configuration. Tests do not invoke a paid model.

## License and release status

No public license has been chosen yet. Choose an appropriate license before a public release. The sources are extracted/adapted from the author's own Ragnarok code; no SwiftTerm or other third-party implementation is bundled. Building and packaging locally does not publish to GitHub.
