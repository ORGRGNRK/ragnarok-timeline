# Second-Mac acceptance record

Fill this in after the brother's test. Leave untested items unchecked.

- Mac processor / macOS version:
- Agent name / version:
- Install method (ZIP or source):
- [ ] Installs without developer-specific paths or server settings.
- [ ] Existing agent settings/hooks remain in place.
- [ ] Agent restarts and the user reviews/trusts its hook if required.
- [ ] `pwd` / `ls` appear under the correct actor.
- [ ] A file creation and a read appear with their reported tool types.
- [ ] A failing command shows its actual provided exit code.
- [ ] An MCP call appears (if this agent supports it).
- [ ] A known synthetic credential pattern is redacted (never use a real secret).
- [ ] Doctor reports configuration/storage without claiming complete coverage.
- [ ] Uninstall removes only this app's handlers and leaves other hooks intact.
- [ ] Agent continues working after uninstall and restart.

Record missing/duplicate events, time lag and confusing labels. This acceptance test does not establish market demand, grading accuracy of an AI, or a complete security audit.
