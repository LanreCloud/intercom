# ⚰️ TracSwitch — Dead Man's Switch on Trac Network

> Fork of: https://github.com/Trac-Systems/intercom
> Competition: https://github.com/Trac-Systems/awesome-intercom

**Trac Address:** bc1p5nl38pkejgz36lnund59t8s5rqlv2p2phj4y6e3nfqy8a9wqe9dseeeqzn

---

## What Is TracSwitch?

TracSwitch is a fully peer-to-peer **Dead Man's Switch** built on Trac Network.

You create a switch with a secret message and a list of recipients. Check in regularly before your deadline. If you ever miss a check-in — the network automatically delivers your message to your recipients. No central server. No trust required.

```
You create switch
  message: "My seed phrase is stored at..."
  recipients: [trac1abc..., trac1xyz...]
  check-in every: 24 hours
         ↓
You check in daily → deadline resets → message stays locked
         ↓
You miss a check-in → deadline passes → message auto-delivers to recipients
```

---

## Use Cases

- 🏛️ Digital will — deliver instructions to family if you go offline
- 🔑 Key handover — pass access credentials to a trusted agent
- 📢 Whistleblower dead drop — release information if you disappear
- 🤖 Agent proof-of-life — automated contingency for AI agents
- 📋 Contingency instructions — "if you're reading this, do X"

---

## Why This Is New

No other Intercom fork has built a Dead Man's Switch. It's a completely different primitive — not a swap, not a scanner, not an inbox. It's a **time-locked secret delivery system** enforced by the network itself.

---

## Quickstart

```bash
git clone https://github.com/YOUR_USERNAME/intercom
cd intercom
npm install -g pear
npm install
pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel tracswitch-v1
```

Second peer (to test delivery):
```bash
pear run --tmp-store --no-pre . --peer-store-name peer2 --msb-store-name peer2-msb --subnet-channel tracswitch-v1
```

---

## Commands

### Create a switch
```
/tx --command '{ "op": "switch_create", "label": "My Will", "message": "My instructions are...", "recipients": ["trac1abc..."], "checkin_interval": 86400 }'
```
- `checkin_interval` in seconds: `3600` = 1h · `86400` = 24h · `604800` = 7 days

### Check in (reset deadline)
```
/tx --command '{ "op": "switch_checkin", "switch_id": "<id>" }'
```

### Check in ALL at once
```
/tx --command '{ "op": "checkin_all" }'
```

### List your switches
```
/tx --command '{ "op": "switch_list" }'
```

### Disarm a switch
```
/tx --command '{ "op": "switch_disarm", "switch_id": "<id>" }'
```

### Check your inbox
```
/tx --command '{ "op": "inbox" }'
```

### Watch live activity
```
/sc_join --channel "tracswitch-activity"
```

---

## How It Works

```
switch_create  →  state: armed, deadline = now + checkin_interval
switch_checkin →  deadline resets to now + checkin_interval
[timer ticks]  →  if now > deadline → switch_trigger → message → recipient inboxes
switch_disarm  →  state: disarmed, message never delivered
```

The **Timer Feature** runs every 60 seconds on indexer nodes. It scans all armed switches and triggers any whose deadline has passed. This process is independent — the owner cannot stop or delay it.

---

## Switch States

```
armed ──(check in)──────▶ armed (deadline reset)
      ──(disarm)──────────▶ disarmed (cancelled)
      ──(miss deadline)───▶ triggered (message delivered)
```

---

## Architecture

```
tracswitch/
├── index.js                    ← Entry point, sidechannel display
├── contract/
│   ├── contract.js             ← State machine (switches, checkins, inbox)
│   └── protocol.js             ← Op router
├── features/
│   └── timer/
│       └── index.js            ← Scans deadlines every 60s, triggers switches
├── screenshots/                ← Proof screenshots (rule 4)
│   └── proof.png
├── SKILL.md                    ← Full agent instructions
└── package.json
```

---

## Proof of Work

See `screenshots/proof.png` for terminal proof the app works end-to-end:
- Switch created and armed
- Check-in resets deadline
- Deadline passes → timer triggers switch
- Message appears in recipient's inbox

---

## Roadmap

- [ ] Message encryption (recipient's public key)
- [ ] Grace period after missed deadline before triggering
- [ ] Multiple messages per switch (different recipients get different messages)
- [ ] Recurring switches (auto re-arm after trigger)
- [ ] Desktop UI

---

## License

MIT — based on the Intercom reference implementation by Trac Systems.
