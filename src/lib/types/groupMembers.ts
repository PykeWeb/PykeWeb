export type GroupMemberRole = {
  id: string
  group_id: string
  name: string
  permissions: string[]
  created_at: string
  updated_at: string
}

// Compat alias kept to avoid breaking older imports.
export type GroupMemberGrade = GroupMemberRole

export type GroupMember = {
  id: string
  group_id: string
  player_name: string
  player_identifier: string | null
  grade_id: string | null
  created_at: string
  updated_at: string
  grade: GroupMemberRole | null
}

export type GroupMemberCandidate = {
  value: string
  label: string
}

export type GroupMembersGradesPayload = {
  grades: GroupMemberRole[]
  members: GroupMember[]
  playerCandidates: GroupMemberCandidate[]
}
