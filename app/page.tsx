import { redirect } from 'next/navigation'

// Root redirect → login
export default function Home() {
  redirect('/login')
}
