/**
 * TracSwitch — Timer Feature
 * Runs every 60 seconds on indexer/bootstrap nodes.
 * Scans all armed switches and triggers any whose deadline has passed.
 * This is the core of the Dead Man's Switch — the automated enforcer.
 */

'use strict'

const TICK_MS = 60_000 // every 60 seconds

class TimerFeature {

  constructor (peer, contract) {
    this.peer     = peer
    this.contract = contract
    this._timer   = null
  }

  start () {
    console.log('[TimerFeature] started — checking deadlines every 60s')
    this.tick()
    this._timer = setInterval(() => this.tick(), TICK_MS)
  }

  stop () {
    if (this._timer) clearInterval(this._timer)
  }

  async tick () {
    try {
      const now   = Date.now()
      const index = await this.contract._get_index()

      for (const [switch_id, meta] of Object.entries(index)) {
        if (meta.state !== 'armed') continue

        const sw = await this.contract.get_switch(switch_id)
        if (!sw || sw.state !== 'armed') continue

        if (now > sw.deadline) {
          console.log('[TimerFeature] 🚨 Triggering switch ' + switch_id.slice(0, 8) + '… — "' + sw.label + '"')

          const result = await this.contract.switch_trigger({ switch_id })

          if (result.ok) {
            // Broadcast trigger to sidechannel
            try {
              await this.peer.sidechannel('tracswitch-activity', JSON.stringify({
                type:            'switch_triggered',
                owner:           sw.owner,
                switch_id,
                label:           sw.label,
                recipient_count: sw.recipients.length,
              }))
            } catch (_) {}

            console.log('[TimerFeature] ✓ Delivered to ' + sw.recipients.length + ' recipient(s)')
          }
        }
      }
    } catch (err) {
      console.error('[TimerFeature] tick error:', err.message)
    }
  }
}

module.exports = TimerFeature
