# SKILL.md — TracSwitch (Dead Man's Switch on Trac Network)

> Fork of: https://github.com/Trac-Systems/intercom
> Full agent instructions for working with the TracSwitch codebase.

---

## What TracSwitch Does

TracSwitch is a fully P2P Dead Man's Switch built on Trac Network.

You create a switch with a secret message and a list of recipients. You must check in before the deadline. If you miss the deadline — the message is automatically delivered to your recipients by the network. No central server. No trust required.

```
You create switch → message: "My seed phrase is..." → recipients: [trac1...]
         ↓
You check in every 24h → deadline resets → message stays held
         ↓
You MISS a check-in → deadline passes → message auto-delivers
```

**Use cases:**
- Digital will / estate instructions
- Whistleblower dead drop
- Secret key handover
- Proof of life for agents
- Automated contingency messages

---

## Runtime — CRITICAL

**Always use Pear. Never `node index.js`.**

```bash
npm install -g pear
npm install
pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel tracswitch-v1
```

Second peer (for testing delivery):
```bash
pear run --tmp-store --no-pre . --peer-store-name peer2 --msb-store-name peer2-msb --subnet-channel tracswitch-v1
```

---

## All Commands

Every command uses: `/tx --command '{ "op": "...", ...args }'`

### Create a switch (arms immediately)
```
/tx --command '{ "op": "switch_create", "label": "My Will", "message": "My instructions are...", "recipients": ["trac1abc...", "trac1xyz..."], "checkin_interval": 86400 }'
```
- `label` — human-readable name for this switch
- `message` — the content delivered if you miss a check-in
- `recipients` — array of Trac addresses who receive the message (max 20)
- `checkin_interval` — seconds between required check-ins (min 60, max 31536000)

### Check in (resets your deadline)
```
/tx --command '{ "op": "switch_checkin", "switch_id": "<uuid>" }'
```

### Check in ALL your switches at once
```
/tx --command '{ "op": "checkin_all" }'
```
Use this as your daily habit — one command resets all active switches.

### List your switches
```
/tx --command '{ "op": "switch_list" }'
```
Shows state, time remaining, last check-in, deadline for each switch.

### Get one switch
```
/tx --command '{ "op": "switch_get", "switch_id": "<uuid>" }'
```

### Disarm a switch (cancel it permanently)
```
/tx --command '{ "op": "switch_disarm", "switch_id": "<uuid>" }'
```

### Check your inbox (messages delivered to you)
```
/tx --command '{ "op": "inbox" }'
```

### Watch live activity
```
/sc_join --channel "tracswitch-activity"
```

---

## Switch Lifecycle

```
armed ──(owner checks in)──▶ armed (deadline reset)
      ──(owner disarms)────▶ disarmed
      ──(deadline passes)──▶ triggered (message delivered to recipients)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `index.js` | Entry point — boots peer, prints commands, handles sidechannel display |
| `contract/contract.js` | State machine — switches, check-ins, inbox delivery |
| `contract/protocol.js` | Op router — maps `/tx` commands to contract methods |
| `features/timer/index.js` | **The enforcer** — scans deadlines every 60s, triggers fired switches |

The timer feature is what makes this a real Dead Man's Switch — it runs independently on indexer nodes and cannot be stopped by the switch owner.

---

## Data Model

### Switch
```json
{
  "id": "uuid",
  "owner": "trac1...",
  "label": "My Will",
  "message": "My instructions are...",
  "recipients": ["trac1abc...", "trac1xyz..."],
  "checkin_interval": 86400,
  "last_checkin": 1234567890000,
  "deadline": 1234654290000,
  "state": "armed | triggered | disarmed",
  "checkin_count": 7,
  "triggered_at": null,
  "disarmed_at": null,
  "created_at": 1234567890000
}
```

### Inbox message (delivered to recipient)
```json
{
  "from": "trac1...",
  "switch_id": "uuid",
  "label": "My Will",
  "message": "My instructions are...",
  "delivered_at": 1234567890000
}
```

---

## Rules

- Only the switch **owner** can check in or disarm
- Once **triggered**, a switch cannot be reset — message is already delivered
- Once **disarmed**, a switch cannot be re-armed (create a new one)
- Recipients cannot read the message until the switch triggers
- The timer feature runs on **indexer/bootstrap nodes only** — it cannot be blocked by the owner

---

## Good First Tasks for Agents

1. Add `message_encrypt` — encrypt message with recipient's public key so only they can read it
2. Add `checkin_interval` update — allow owner to change the interval before next deadline
3. Add `grace_period` — a short window after deadline before triggering (in case of network issues)
4. Add `trigger_count` per recipient — how many switches have been delivered to this address
5. Add `switch_preview` — show metadata (label, deadline) to recipients without revealing message

---

## Do Not

- Never run with `node index.js` — always `pear run ...`
- Never allow recipients to read the message before triggering
- Never allow the owner to trigger their own switch manually (defeats the purpose)
- Never allow re-arming a triggered or disarmed switch
- Never skip the timer tick — it is the core enforcement mechanism
