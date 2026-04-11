import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { requireSession } from '@/server/auth/requireSession'
import { sessionCanAccessPrefix, sessionCanManageSensitiveGroupSettings } from '@/server/auth/access'
import { isValidDiscordWebhookUrl, readGroupWebhookStatus } from '@/server/logs/service'


async function writeWebhookAuditLog(args: { session: Awaited<ReturnType<typeof requireSession>>; action: string; message: string }) {
  const supabase = getSupabaseAdmin()
  await supabase.from('app_logs').insert({
    group_id: args.session.groupId,
    group_name: args.session.groupName,
    user_id: args.session.memberId ?? null,
    actor_name: args.session.memberName ?? null,
    user_name: args.session.memberName ?? null,
    actor_source: 'admin',
    source: 'admin',
    area: 'discord.webhook',
    category: 'discord',
    action: args.action,
    action_type: 'webhook_configuration',
    message: args.message,
  })
}

function toText(value: unknown) {
  if (typeof value !== 'string') return null
  const v = value.trim()
  return v.length ? v : null
}

function ensureLogsPermission(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!sessionCanAccessPrefix(session, '/logs')) {
    return NextResponse.json({ error: 'Permission logs requise.' }, { status: 403 })
  }
  return null
}

function ensureSensitivePermission(session: Awaited<ReturnType<typeof requireSession>>) {
  if (!sessionCanManageSensitiveGroupSettings(session)) {
    return NextResponse.json({ error: 'Permission insuffisante pour modifier le webhook.' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request)
    const forbidden = ensureLogsPermission(session)
    if (forbidden) return forbidden

    return NextResponse.json(await readGroupWebhookStatus(session.groupId))
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de lire le webhook.' }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession(request)
    const forbidden = ensureLogsPermission(session)
    if (forbidden) return forbidden
    const restricted = ensureSensitivePermission(session)
    if (restricted) return restricted

    const body = (await request.json()) as { webhookUrl?: string }
    const webhookUrl = toText(body.webhookUrl)
    if (!webhookUrl || !isValidDiscordWebhookUrl(webhookUrl)) {
      return NextResponse.json({ error: 'Webhook Discord invalide.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('tenant_groups')
      .update({ discord_webhook_url: webhookUrl, discord_webhook_valid: null, discord_webhook_last_error: null, discord_webhook_updated_at: new Date().toISOString() })
      .eq('id', session.groupId)
    if (error) throw error

    void writeWebhookAuditLog({ session, action: 'configure', message: 'Webhook Discord configuré' })

    return NextResponse.json(await readGroupWebhookStatus(session.groupId))
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de mettre à jour le webhook.' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request)
    const forbidden = ensureLogsPermission(session)
    if (forbidden) return forbidden
    const restricted = ensureSensitivePermission(session)
    if (restricted) return restricted

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('tenant_groups')
      .update({ discord_webhook_url: null, discord_webhook_valid: null, discord_webhook_last_error: null, discord_webhook_updated_at: new Date().toISOString() })
      .eq('id', session.groupId)
    if (error) throw error

    void writeWebhookAuditLog({ session, action: 'delete', message: 'Webhook Discord supprimé' })

    return NextResponse.json(await readGroupWebhookStatus(session.groupId))
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Impossible de supprimer le webhook.' }, { status: 400 })
  }
}
