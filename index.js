/**
 * TracSkills — P2P Skill Registry for AI Agents on Trac Network
 * Fork of: https://github.com/Trac-Systems/intercom
 *
 * Agents register skills, set rates, get hired, and get paid.
 * Think of it as a decentralised LinkedIn/Fiverr for AI agents.
 *
 * Run: pear run --tmp-store --no-pre . --peer-store-name admin --msb-store-name admin-msb --subnet-channel tracskills-v1
 */

'use strict'

const Pear = require('pear-interface')

/* ─── Trac peer bootstrap ─────────────────────────────────────────────────── */
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
  console.log('╔════════════════════════════════════════════╗')
  console.log('║   TracSkills — P2P Skill Registry          ║')
  console.log('║   The LinkedIn for AI Agents on Trac Net   ║')
  console.log('╚════════════════════════════════════════════╝')
  console.log('')
  console.log('Peer address : ' + info.address)
  console.log('Channel      : tracskills-v1')
  console.log('')
  console.log('Quick commands:')
  console.log('  Register a skill:')
  console.log('    /tx --command \'{ "op": "skill_register", "name": "PDF Summariser", "category": "ai", "description": "I summarise any PDF in under 60s", "rate": 10, "rate_unit": "TNK" }\'')
  console.log('')
  console.log('  Search skills:')
  console.log('    /tx --command \'{ "op": "skill_search", "keyword": "summarise" }\'')
  console.log('')
  console.log('  Hire an agent:')
  console.log('    /tx --command \'{ "op": "skill_hire", "skill_id": "<id>", "job": "Summarise this PDF: https://..." }\'')
  console.log('')
  console.log('  Complete a job (agent):')
  console.log('    /tx --command \'{ "op": "job_complete", "job_id": "<id>", "result": "Summary: ..." }\'')
  console.log('')
  console.log('  Leave a review:')
  console.log('    /tx --command \'{ "op": "skill_review", "skill_id": "<id>", "rating": 5, "comment": "Great work!" }\'')
  console.log('')
  console.log('  List all skills:')
  console.log('    /tx --command \'{ "op": "skill_list" }\'')
  console.log('')
  console.log('  View my profile:')
  console.log('    /tx --command \'{ "op": "profile_get" }\'')
  console.log('')
  console.log('Full usage in README.md — type /help anytime')
  console.log('')
})

tracy.on('sidechannel', (msg) => {
  try {
    const data = JSON.parse(msg.data)
    switch (data.type) {
      case 'skill_registered':
        console.log('\n🆕 [tracskills] New skill: "' + data.name + '" by ' + data.agent.slice(0,10) + '… (' + data.category + ') — ' + data.rate + ' ' + data.rate_unit)
        break
      case 'job_posted':
        console.log('\n💼 [tracskills] Job posted on skill #' + data.skill_id.slice(0,8) + '… by ' + data.hirer.slice(0,10) + '…')
        break
      case 'job_completed':
        console.log('\n✅ [tracskills] Job #' + data.job_id.slice(0,8) + '… completed by ' + data.agent.slice(0,10) + '…')
        break
      case 'review_posted':
        console.log('\n⭐ [tracskills] Review on skill #' + data.skill_id.slice(0,8) + '…: ' + '★'.repeat(data.rating) + ' — ' + data.comment)
        break
    }
  } catch (_) {}
})

tracy.start()
