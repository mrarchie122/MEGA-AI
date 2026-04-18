# ARCHIE-MD-WEB-BOT

<p align="center">
  <img alt="ARCHIE-MD-WEB-BOT" src="https://i.ibb.co/GfD6jbqM/5987667264192318439-121.jpg" width="360" />
</p>

Production-ready WhatsApp multi-device bot with plugin system, web manager, pair-code + QR onboarding, and multi-session runtime.

## Credits
- All credits: ARCHIETECH NEXUS

## Official Channels
- https://whatsapp.com/channel/0029Vb6dgrn3rZZXIpZFOz1x
- https://whatsapp.com/channel/0029VbBguIyDTkK7HNKtY81w
- https://whatsapp.com/channel/0029VaYpDLx4tRrrrXsOvZ3U

## Contact
- https://wa.me/message/M2QIPWNRZTNHF1

## Current Architecture
- Web manager service: Express + SSE dashboard
- Session manager: per-session worker supervision
- Worker runtime: Baileys socket lifecycle, reconnect strategy, plugin dispatch
- Plugin system: command routing, hooks, before/all/command handlers

## Pairing Flow (Updated)
- Default mode: Pair Code
- Phone input: available from dashboard for direct pair-code request
- QR mode: available via one-click switch when needed
- Pair code UX: copy button enabled directly in dashboard

## Main Menu Behavior (Updated)
- `.menu` now uses the `Menu2` layout by default
- Legacy simple menu remains available through classic aliases

## Quick Start
1. Install dependencies:

```bash
npm install
```

2. Configure env values:
- `OWNERS`
- `BOTNAME`
- `OWNER_NAME`
- `SESSION_ID`
- `PORT` (default is `3015`)

3. Start manager:

```bash
npm start
```

4. Open dashboard:
- http://localhost:3015

## Notes
- Multi-session auth data is stored under `sessions/<sessionId>/auth`.
- For clean commits, avoid pushing generated session/auth/log artifacts.

## License
- Apache-2.0
