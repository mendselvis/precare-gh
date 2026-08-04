// scripts/setup-caspian.mjs
//
// Run once after deploying (and again any time the deploy URL changes):
//
//   CASPIAN_API_KEY=... TELEGRAM_BOT_TOKEN=... \
//   CASPIAN_WEBHOOK_SECRET=... \
//   node scripts/setup-caspian.mjs https://precare-gh.vercel.app
//
// This connects email + Telegram (idempotent - safe to re-run) and points
// Caspian's hosted gateway at your deployed webhook route. Local dev doesn't
// need this: without a registered webhook, inbound Telegram messages simply
// won't be delivered anywhere, but outbound (emailHospital / messagePatient
// with an already-linked conversation) still works fine.

import { CommClient } from 'caspian-sdk'

const deployUrl = process.argv[2]
if (!deployUrl) {
  console.error('Usage: node scripts/setup-caspian.mjs https://your-deploy-url.vercel.app')
  process.exit(1)
}

const client = new CommClient() // reads CASPIAN_API_KEY / CASPIAN_BASE_URL from env

const email = await client.connectEmail({ displayName: 'PreCare GH Triage' })
console.log('Email connected:', email.address)

if (process.env.TELEGRAM_BOT_TOKEN) {
  const telegram = await client.connectTelegram({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    displayName: 'PreCare GH Triage',
  })
  console.log('Telegram connected:', telegram.id)
} else {
  console.warn('TELEGRAM_BOT_TOKEN not set - skipping Telegram (get one from @BotFather)')
}

const webhookUrl = `${deployUrl.replace(/\/$/, '')}/api/caspian/webhook`
await client.setWebhook(webhookUrl, process.env.CASPIAN_WEBHOOK_SECRET)
console.log('Webhook registered:', webhookUrl)
console.log('\nDone. Set the same CASPIAN_API_KEY / TELEGRAM_BOT_TOKEN / CASPIAN_WEBHOOK_SECRET')
console.log('as env vars on your Vercel project so the deployed app can use them too.')