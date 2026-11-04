# token-meter

A Claude Code mod that shows two always-visible rows above the prompt:

```
Last turn    Input 312.4k · Output 3.1k · 48 tok/s
Session      Input 1.24M (cache 1.10M) · Output 45.2k · avg 55 tok/s · Context 34% (68.0k/200.0k)
```

- **Last turn**: input and output tokens from your last message to the end of the response (subagents included), and the average generation speed. While Claude is answering it becomes **Current turn**, with live tokens per second (an estimate: about 4 characters per token).
- **Session**: total input tokens (with the part served by the prompt cache), total output tokens, average tokens per second, and how much of the context window is in use.

Tokens per second count only the main thread's generation time, leaving out the wait for the first token and tool execution. After `/clear` the counters start again from zero.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install token-meter --marketplace jessegaletta/token-meter
```

Answer `y` to add the marketplace and pick the **user** scope (the first one, with Enter): the mod starts right away and in every later session.

From a shell, without opening Claude Code:

```
claude plugin install token-meter --marketplace jessegaletta/token-meter
```

In the desktop app: **+** next to the prompt box → **Plugins** → **Add marketplace** with `jessegaletta/token-meter` → **Add plugin**.

If the repository is private, the computer must already have git access to GitHub (an SSH key, or `gh auth login` followed by `gh auth setup-git`).

## Update

```
claude plugin marketplace update token-meter
claude plugin update token-meter@token-meter
```

## License

MIT
