import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getSessionFromRequest } from '@/server/auth/session'

type ChangePasswordPayload = {
  currentPassword?: string
  newPassword?: string
}

type MemberCredentialRow = {
  id: string
  group_id: string
  player_identifier: string | null
  password: string | null
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Session invalide.' }, { status: 401 })
    if (session.isAdmin || session.groupId === 'admin') return NextResponse.json({ error: 'Action non autorisée.' }, { status: 403 })
    if (!session.memberId) return NextResponse.json({ error: 'Aucun compte membre actif pour cette session.' }, { status: 403 })

    const body = (await request.json()) as ChangePasswordPayload
    const currentPassword = String(body.currentPassword || '').trim()
    const newPassword = String(body.newPassword || '').trim()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Mot de passe actuel et nouveau mot de passe requis.' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caractères.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { data: member, error: memberError } = await supabase
      .from('group_members')
      .select('id,group_id,player_identifier,password')
      .eq('id', session.memberId)
      .eq('group_id', session.groupId)
      .maybeSingle<MemberCredentialRow>()

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
    if (!member) return NextResponse.json({ error: 'Membre introuvable.' }, { status: 404 })

    if ((member.password || '') !== currentPassword) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 })
    }

    const identifier = (member.player_identifier || '').trim()
    if (!identifier) {
      return NextResponse.json({ error: 'Identifiant membre manquant. Contactez un administrateur.' }, { status: 400 })
    }

    const { data: conflictRows, error: conflictError } = await supabase
      .from('group_members')
      .select('id,group_id')
      .eq('player_identifier', identifier)
      .eq('password', newPassword)
      .neq('id', member.id)

    if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 500 })

    const conflict = (conflictRows ?? []).some((row) => row.group_id !== session.groupId)
    if (conflict) {
      return NextResponse.json({ error: 'Ce mot de passe pour cet identifiant est déjà utilisé dans un autre groupe.' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('group_members')
      .update({ password: newPassword })
      .eq('id', member.id)
      .eq('group_id', session.groupId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Payload invalide.' }, { status: 400 })
  }
}
