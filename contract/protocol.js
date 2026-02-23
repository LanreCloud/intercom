/**
 * TracSwitch — Protocol
 * Routes /tx --command '{ "op": "..." }' to contract methods.
 */

'use strict'

class Protocol {

  constructor (contract, peer) {
    this.contract = contract
    this.peer     = peer
  }

  async exec (tx) {
    const { op, ...args } = tx.command
    const signer = tx.signer

    switch (op) {

      case 'switch_create': {
        const result = await this.contract.switch_create({ owner: signer, ...args })
        await this._sc({
          type:            'switch_created',
          owner:           signer,
          label:           result.switch.label,
          deadline:        result.switch.deadline,
          recipient_count: result.switch.recipients.length,
        })
        return result
      }

      case 'switch_checkin': {
        const result = await this.contract.switch_checkin({ owner: signer, ...args })
        await this._sc({
          type:         'switch_checkin',
          owner:        signer,
          switch_id:    args.switch_id,
          new_deadline: result.new_deadline,
        })
        return result
      }

      case 'checkin_all': {
        const result = await this.contract.checkin_all({ owner: signer })
        return result
      }

      case 'switch_disarm': {
        const result = await this.contract.switch_disarm({ owner: signer, ...args })
        await this._sc({
          type:      'switch_disarmed',
          owner:     signer,
          switch_id: args.switch_id,
          label:     result.label,
        })
        return result
      }

      case 'switch_list':
        return this.contract.switch_list({ owner: signer })

      case 'switch_get':
        return this.contract.get_switch(args.switch_id)

      case 'inbox':
        return this.contract.inbox({ address: signer })

      default:
        throw new Error('Unknown op: ' + op)
    }
  }

  async _sc (data) {
    try {
      await this.peer.sidechannel('tracswitch-activity', JSON.stringify(data))
    } catch (_) {}
  }
}

module.exports = Protocol
