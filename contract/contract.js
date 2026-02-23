/**
 * TracSwitch — Contract
 * Deterministic state machine. Runs identically on every peer.
 *
 * A Switch has:
 *   - A secret message (encrypted or plain)
 *   - One or more recipients (Trac addresses)
 *   - A check-in interval (e.g. every 24h)
 *   - A deadline (last_checkin + checkin_interval)
 *
 * If the owner does NOT check in before the deadline,
 * the timer feature triggers the switch and delivers the message.
 *
 * Switch states:
 *   armed   → owner is checking in regularly, message held
 *   triggered → owner missed deadline, message delivered to recipients
 *   disarmed  → owner manually cancelled the switch
 */

'use strict'

const crypto = require('crypto')

const STATE = {
  ARMED:     'armed',
  TRIGGERED: 'triggered',
  DISARMED:  'disarmed',
}

// Minimum/maximum check-in intervals
const MIN_INTERVAL = 60          // 1 minute (for testing)
const MAX_INTERVAL = 365 * 24 * 3600 // 1 year

class Contract {

  constructor (db) {
    this.db = db
  }

  /* ─── CREATE ────────────────────────────────────────────────────────────── */

  async switch_create ({ owner, message, recipients, checkin_interval, label }) {
    if (!message || message.trim().length < 1)
      throw new Error('message is required')
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0)
      throw new Error('at least one recipient address is required')
    if (recipients.length > 20)
      throw new Error('maximum 20 recipients')
    if (!checkin_interval || checkin_interval < MIN_INTERVAL || checkin_interval > MAX_INTERVAL)
      throw new Error('checkin_interval must be between ' + MIN_INTERVAL + ' and ' + MAX_INTERVAL + ' seconds')

    const id         = crypto.randomUUID()
    const now        = Date.now()
    const deadline   = now + checkin_interval * 1000

    const sw = {
      id,
      owner,
      label:            (label || 'Untitled Switch').trim(),
      message:          message.trim(),
      recipients,
      checkin_interval, // seconds
      last_checkin:     now,
      deadline,         // ms timestamp — if now > deadline → trigger
      state:            STATE.ARMED,
      checkin_count:    0,
      triggered_at:     null,
      disarmed_at:      null,
      created_at:       now,
      updated_at:       now,
    }

    await this.db.put('switch:' + id, JSON.stringify(sw))
    await this._index_add(id, owner, STATE.ARMED)

    return { ok: true, switch_id: id, switch: sw, deadline_iso: new Date(deadline).toISOString() }
  }

  /* ─── CHECK IN ──────────────────────────────────────────────────────────── */

  async switch_checkin ({ owner, switch_id }) {
    const sw = await this._require_switch(switch_id)

    if (sw.owner !== owner)          throw new Error('only the switch owner can check in')
    if (sw.state !== STATE.ARMED)    throw new Error('switch is not armed (state: ' + sw.state + ')')

    const now          = Date.now()
    sw.last_checkin    = now
    sw.deadline        = now + sw.checkin_interval * 1000
    sw.checkin_count  += 1
    sw.updated_at      = now

    await this.db.put('switch:' + switch_id, JSON.stringify(sw))

    return { ok: true, switch_id, checkin_count: sw.checkin_count, new_deadline: sw.deadline, new_deadline_iso: new Date(sw.deadline).toISOString() }
  }

  /* ─── CHECK IN ALL ──────────────────────────────────────────────────────── */

  async checkin_all ({ owner }) {
    const index   = await this._get_index()
    const results = []

    for (const [id, meta] of Object.entries(index)) {
      if (meta.owner !== owner || meta.state !== STATE.ARMED) continue
      const result = await this.switch_checkin({ owner, switch_id: id })
      results.push({ switch_id: id, new_deadline_iso: result.new_deadline_iso })
    }

    return { ok: true, checked_in: results.length, results }
  }

  /* ─── DISARM ────────────────────────────────────────────────────────────── */

  async switch_disarm ({ owner, switch_id }) {
    const sw = await this._require_switch(switch_id)

    if (sw.owner !== owner)        throw new Error('only the switch owner can disarm it')
    if (sw.state !== STATE.ARMED)  throw new Error('switch is not armed (state: ' + sw.state + ')')

    sw.state       = STATE.DISARMED
    sw.disarmed_at = Date.now()
    sw.updated_at  = Date.now()

    await this.db.put('switch:' + switch_id, JSON.stringify(sw))
    await this._index_update(switch_id, STATE.DISARMED)

    return { ok: true, switch_id, label: sw.label }
  }

  /* ─── TRIGGER (called by timer feature only) ────────────────────────────── */

  async switch_trigger ({ switch_id }) {
    const sw = await this._require_switch(switch_id)

    if (sw.state !== STATE.ARMED) return { ok: false, reason: 'not_armed' }

    sw.state        = STATE.TRIGGERED
    sw.triggered_at = Date.now()
    sw.updated_at   = Date.now()

    await this.db.put('switch:' + switch_id, JSON.stringify(sw))
    await this._index_update(switch_id, STATE.TRIGGERED)

    // Deliver message to each recipient's inbox
    for (const recipient of sw.recipients) {
      const inbox_key = 'inbox:' + recipient
      const raw       = await this.db.get(inbox_key)
      const inbox     = raw ? JSON.parse(raw) : []
      inbox.push({
        from:         sw.owner,
        switch_id:    sw.id,
        label:        sw.label,
        message:      sw.message,
        delivered_at: sw.triggered_at,
      })
      await this.db.put(inbox_key, JSON.stringify(inbox))
    }

    return { ok: true, switch_id, label: sw.label, recipients: sw.recipients, message: sw.message }
  }

  /* ─── READS ─────────────────────────────────────────────────────────────── */

  async switch_list ({ owner }) {
    const index = await this._get_index()
    const list  = []

    for (const [id, meta] of Object.entries(index)) {
      if (meta.owner !== owner) continue
      const sw = await this.get_switch(id)
      if (sw) list.push(this._summary(sw))
    }

    return list.sort((a, b) => b.created_at - a.created_at)
  }

  async inbox ({ address }) {
    const raw = await this.db.get('inbox:' + address)
    return raw ? JSON.parse(raw) : []
  }

  async get_switch (switch_id) {
    const raw = await this.db.get('switch:' + switch_id)
    return raw ? JSON.parse(raw) : null
  }

  /* ─── INTERNAL ──────────────────────────────────────────────────────────── */

  _summary (sw) {
    const now         = Date.now()
    const ms_left     = Math.max(0, sw.deadline - now)
    const hours_left  = Math.floor(ms_left / 3600000)
    const mins_left   = Math.floor((ms_left % 3600000) / 60000)

    return {
      id:               sw.id,
      label:            sw.label,
      state:            sw.state,
      recipients:       sw.recipients.length,
      checkin_interval: sw.checkin_interval,
      last_checkin_iso: new Date(sw.last_checkin).toISOString(),
      deadline_iso:     new Date(sw.deadline).toISOString(),
      time_remaining:   hours_left + 'h ' + mins_left + 'm',
      checkin_count:    sw.checkin_count,
      created_at:       sw.created_at,
    }
  }

  async _require_switch (id) {
    const sw = await this.get_switch(id)
    if (!sw) throw new Error('switch not found: ' + id)
    return sw
  }

  async _get_index () {
    const raw = await this.db.get('index:switches')
    return raw ? JSON.parse(raw) : {}
  }

  async _index_add (id, owner, state) {
    const idx = await this._get_index()
    idx[id]   = { owner, state }
    await this.db.put('index:switches', JSON.stringify(idx))
  }

  async _index_update (id, state) {
    const idx = await this._get_index()
    if (idx[id]) {
      idx[id].state = state
      await this.db.put('index:switches', JSON.stringify(idx))
    }
  }
}

module.exports = Contract
