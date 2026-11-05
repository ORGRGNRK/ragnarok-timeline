# Local verification, 2026-11-04

Verified on an Apple M2 Mac with macOS 27.0.1:

- Twelve Node tests: classification, explicit actor attribution, unknown exit handling, payload omission, secret masking, private event-file modes, fail-open malformed input, symlink protection, installer idempotence, uninstall preserving unrelated hooks, invalid config preservation, and execution through a path containing spaces/quotes.
- Six Swift tests: actor/kind parsing, unknown exits (including JSON null), display redaction, Codex metadata filtering, partial UTF-8 tail reads/truncation, and rotated files.
- Standalone viewer opened locally; actor filters, live Codex tool metadata, and event details were inspected. No hook installation was performed on the real user account.
- App builds for arm64 and x86_64. Both Mach-O slices declare macOS 14.0 minimum. Ad-hoc signature verification passes.
- No live coding-model requests and no installation into real Claude/Codex settings were made while testing this standalone package. Temporary directories were used.

Still unverified: installation and hook approval on a second Mac; live Gemini/Grok/Antigravity integration; Intel runtime execution; Developer ID signing/notarization; complete capture of every possible client tool. An Apple silicon build does not prove Intel runtime behavior.

The main Heimdall coverage audit is separate: at a fixed 17:30:16 Pacific cutoff, this Codex chat had 121 completed shell command records matching 121 individual Bash receipts. Twenty-eight computer-use call records and seven web-tool events were absent from those receipts. The metadata reader now makes those tool types visible. These counts do not imply the events all succeeded or that the transcript is a complete OS audit.
