import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/server/auth/requireSession'
import { sessionCanAccessPrefix, sessionCanManageSensitiveGroupSettings } from '@/server/auth/access'
import { isValidDiscordWebhookUrl, readGroupWebhookStatus } from '@/server/logs/service'

function toText(value: unknown) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length ? v : null
}

export async function POST(request: Request) {
  try {
    const session = await requireSession(request)
    if (!sessionCanAccessPrefix(session, '/logs')) {
      return NextResponse.json({ error: 'Permission logs requise.' }, { status: 403 })
    }
    if (!sessionCanManageSensitiveGroupSettings(session)) {
      return NextResponse.json({ error: 'Permission insuffisante pour tester le webhook.' }, { status: 403 })
    }

    const supabase = getSupabaseAdmin()
    const { data: group, error: groupError } = await supabase
      .from('tenant_groups')
      .select('discord_webhook_url,name')
      .eq('id', session.groupId)
      .maybeSingle<{ discord_webhook_url: string | null; name: string | null }>()

    if (groupError) throw groupError
    const webhook = toText(group?.discord_webhook_url)
    if (!webhook || !isValidDiscordWebhookUrl(webhook)) {
      return NextResponse.json({ error: 'Webhook non configuré ou invalide.' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const payload = {
      embeds: [{
        title: 'Test webhook • Centre d’audit',
        color: 0x38bdf8,
        fields: [
          { name: 'Groupe', value: group?.name || session.groupName, inline: true },
          { name: 'Membre', value: session.memberName || '—', inline: true },
          { name: 'Action', value: 'test webhook', inline: true },
          { name: 'Date', value: new Date(now).toLocaleString('fr-FR'), inline: false },
        ],
        timestamp: now,
      }],
    }

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    await supabase
      .from('tenant_groups')
      .update({ discord_webhook_valid: response.ok, discord_webhook_last_error: response.ok ? null : `HTTP ${response.status}`, discord_webhook_updated_at: now })
      .eq('id', session.groupId)

    await supabase.from('app_logs').insert({
      group_id: session.groupId,
      group_name: session.groupName,
      user_id: session.memberId ?? null,
      actor_name: session.memberName ?? null,
      user_name: session.memberName ?? null,
      actor_source: 'admin',
      source: 'discord',
      area: 'discord.webhook',
      category: 'discord',
      action: 'test',
      action_type: 'webhook_test',
      message: response.ok ? 'Test webhook Discord envoyé' : `Test webhook Discord en erreur (${response.status})`,
      note: response.ok ? 'test envoyé' : `HTTP ${response.status}`,
    })

    if (!response.ok) {
      return NextResponse.json({ error: `Échec Discord (${response.status}).` }, { status: 400 })
    }

    return NextResponse.json({ ok: true, status: await readGroupWebhookStatus(session.groupId) })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de tester le webhook.' }, { status: 400 })
  }
}
