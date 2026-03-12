import { redirect } from 'next/navigation'

export default function DroguesPage() {
  redirect('/items?view=tools')
}
