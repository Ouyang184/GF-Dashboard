# Mastercard Agent — web server

Runs the same Mastercard search/chat/print/log agent as the Electron app
(shared logic lives in [`mastercard-core/`](../mastercard-core)), but served
as a normal web page instead of a downloadable .exe. Whoever opens the URL
gets the app; nothing to install on their end.

## Requirements on the machine that runs this

Everything the app does is real local automation, so the **server machine**
itself needs:

- Node.js (same version this repo targets)
- **Excel installed** — Mastercards are read/printed via Excel COM automation
  (`mastercard-core/read-mastercard.ps1`, `print-mastercard.ps1`)
- **Network access to the Mastercard file shares** (`I:\Department Files\...`
  by default — see `MASTERCARD_SEARCH_ROOTS` below if this server should use
  different paths)
- **Ollama installed and running**, with the `qwen3.5:9b` model pulled. The
  browser never talks to Ollama directly — only this server does, over
  `127.0.0.1` by default (see `MASTERCARD_OLLAMA_HOST` if Ollama runs
  elsewhere on this same machine)
- **Printers** installed/shared the same way they are on the machine the
  Electron app currently runs on, since printing still happens via this
  server's PowerShell/`Get-Printer` the same way it always has

None of this is optional — it's the same reason the Electron app only ever
worked on a Windows PC with Excel and Ollama, just centralized onto one
machine now instead of everyone's own PC.

## Running it

```
npm install
npm run build              # builds the frontend into dist/
copy server\.env.example server\.env   # then edit server\.env if needed
npm run agent:server       # starts the server on MASTERCARD_SERVER_PORT (default 4100)
```

Then share `http://<this-machine's-hostname>:4100/?desktopAgent=1` with
whoever needs it.

## Keeping it running

A plain `node server/mastercard-agent-server.cjs` in a console window dies
the moment that console/RDP session closes. To keep it running persistently
(across reboots and logoffs), install it as a Windows service with one of:

- [NSSM](https://nssm.cc/) — `nssm install "Mastercard Agent" node.exe
  "C:\path\to\server\mastercard-agent-server.cjs"`
- [pm2](https://pm2.keymetrics.io/) + `pm2-windows-startup` —
  `pm2 start server/mastercard-agent-server.cjs --name mastercard-agent`
  then `pm2 save` and `pm2-startup install`

Either way, after any code change: `npm run build` (rebuilds `dist/`) and
restart the service — the running server always serves whatever is
currently in `dist/`.

## Config

All of `server/.env` is optional — see `.env.example` for the full list
(port, Ollama host/model, OnFloor destination text, search root folders).
Anything left unset falls back to the same defaults the Electron app has
always used.
