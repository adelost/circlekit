# @v1d/push

The push protocol's shared command. A repository installs one version and runs it as `npm run push`:

```json
"scripts": { "push": "v1d-push", "lint": "… && v1d-push-check" },
"push": { "cache": "<name>-pre-push", "gates": "<its pre-push script, or node_modules/@v1d/push/dist/gates.mjs>", "run": ["lint"],
          "tidy": [], "tidyFiles": [], "locks": ["package-lock.json"], "docs": "docs/", "tell": ["<command that hears a red tip on stdin>"],
          "overCode": [["node", "<its arch-check wrapper>", "--sums"]] }
```

- The gates run in the pusher's own tree before a place in the host's line is taken; the line only rebases and pushes.
- A clean rebase over other code keeps the gates' verdict, but first runs `overCode` on the rebased tree in the place (0.1.5): rules that sum over
  many files (@v1d/arch-check 0.20.0's `--sums`) can be red for two pushes each green alone. Red gives the place back and the gates run again.
- A push is one commit carrying `Pushed-through: npm run push`; the check on the tip says red for a commit of code without it.
- The check on the tip runs the gates again after a push that went over other code; the same check red twice, and green on the master before, takes
  the push back with one revert through the same door. Each tip's verdict is kept by sha in the cache's `tip/`, for a release to read.
- Its pre-push hook (`dist/hook.mjs`) refuses a code push to main or master that the command did not start, with one line, and runs `push.gates`
  for every other push. The command installs it where no hook stands.
- `v1d-push-check` is the lint: red where `npm run push` is not this command, no settings stand, or the hook is not its own.

Built from Cutkit's `tools/push` by its `tools/dev/publish-push.mjs`; this directory keeps the manifest and the gate, never the files.
