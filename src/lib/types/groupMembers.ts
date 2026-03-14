export type GroupMemberGrade = {
  id: string
  group_id: string
  name: string
  permissions: string[]
  created_at: string
  updated_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  player_name: string
  player_identifier: string | null
  grade_id: string | null
  created_at: string
  updated_at: string
  grade: GroupMemberGrade | null
}

export type GroupMemberCandidate = {
  value: string
  label: string
}

export type GroupMembersGradesPayload = {
  grades: GroupMemberGrade[]
  members: GroupMember[]
  playerCandidates: GroupMemberCandidate[]
}
