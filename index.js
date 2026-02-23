/**
 * TracSwitch — Dead Man's Switch on Trac Network
 * Fork of: https://github.com/Trac-Systems/intercom
 *
 * Schedule a secret message to be delivered to recipients
 * automatically if you fail to check in before the deadline.
 * Check in regularly to keep the switch disarmed.
 *
 * Run: pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel tracswitch-v1
 */

'use strict'

const { Tracy } = require('trac-peer')

const tracy = new Tracy({
  contract : require('./contract/contract'),
  protocol : require('./contract/protocol'),
  features : [
    require('./features/timer'),
  ],
})

tracy.on('ready', (info) => {
  console.log('')
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║   TracSwitch — Dead Man\'s Switch             ║')
  console.log('║   Your message delivers itself if you don\'t  ║')
  console.log('╚══════════════════════════════════════════════╝')
  console.log('')
  console.log('Peer address : ' + info.address)
  console.log('Channel      : tracswitch-v1')
  console.log('')
  console.log('── Commands ──────────────────────────────────────')
  console.log('')
  console.log('  Create a switch (arms it immediately):')
  console.log('    /tx --command \'{ "op": "switch_create", "message": "My secret message", "recipients": ["trac1..."], "checkin_interval": 86400, "label": "My Will" }\'')
  console.log('')
  console.log('  Check in (resets your countdown):')
  console.log('    /tx --command \'{ "op": "switch_checkin", "switch_id": "<id>" }\'')
  console.log('')
  console.log('  Check in ALL your switches at once:')
  console.log('    /tx --command \'{ "op": "checkin_all" }\'')
  console.log('')
  console.log('  View your switches:')
  console.log('    /tx --command \'{ "op": "switch_list" }\'')
  console.log('')
  console.log('  Disarm a switch (cancel it):')
  console.log('    /tx --command \'{ "op": "switch_disarm", "switch_id": "<id>" }\'')
  console.log('')
  console.log('  Check switches sent TO you:')
  console.log('    /tx --command \'{ "op": "inbox" }\'')
  console.log('')
  console.log('  Watch live activity:')
  console.log('    /sc_join --channel "tracswitch-activity"')
  console.log('')
  console.log('──────────────────────────────────────────────────')
  console.log('')
})

tracy.on('sidechannel', (msg) => {
  try {
    const d = JSON.parse(msg.data)
    switch (d.type) {
      case 'switch_created':
        console.log('\n🔒 [tracswitch] Switch armed by ' + d.owner.slice(0,10) + '… — "' + d.label + '" — deadline: ' + new Date(d.deadline).toISOString())
        break
      case 'switch_checkin':
        console.log('\n✅ [tracswitch] Check-in by ' + d.owner.slice(0,10) + '… — new deadline: ' + new Date(d.new_deadline).toISOString())
        break
      case 'switch_triggered':
        console.log('\n🚨 [tracswitch] TRIGGERED: "' + d.label + '" by ' + d.owner.slice(0,10) + '… — message delivered to ' + d.recipient_count + ' recipient(s)')
        break
      case 'switch_disarmed':
        console.log('\n🔓 [tracswitch] Switch "' + d.label + '" disarmed by ' + d.owner.slice(0,10) + '…')
        break
    }
  } catch (_) {}
})

tracy.start()
