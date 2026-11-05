# Local data and trust boundaries

- Hooks write shell command text, tool name, file-operation paths, provided exit code, actor, timestamps and session IDs. Commands/paths may reveal personal information even after secret masking.
- File contents, tool output, prompts, conversations, screenshots and model reasoning are not intentionally saved by these hooks. Unknown and MCP tools store their names rather than arbitrary arguments.
- Codex's existing session files are scanned locally for tool completion metadata. Other records, including user/assistant messages and reasoning, are ignored and are not added to the timeline.
- No data is uploaded. The viewer makes no network connections and cannot execute an agent's proposed action. Opening the app does not start an MCP server or a model.
- Redaction is best effort, using known credential patterns and secret-named environment values. For additional exact values, put one per line in `~/Library/Application Support/Ragnarok Timeline/scrub-values` and use `chmod 600` on that file. Never commit it.
- A screenshot/copied event can contain private commands or paths. Inspect it before sharing. Do not publish live logs or agent settings with the repository.
- The same OS user can modify these logs, forge actor names, disable hooks, or bypass the viewer. These files are not independent proof, hardware attestation, or a complete system audit.
- Unknown exit codes remain unknown. A reported post-tool event is not proof that a task succeeded, a file's final state is correct, or a model followed instructions.
- Installation changes only the selected clients' post-tool configuration. It never auto-approves hooks or alters model/tool permission policies. It does not edit `.zshenv`.
