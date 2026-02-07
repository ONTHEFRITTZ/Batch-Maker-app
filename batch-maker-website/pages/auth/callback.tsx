import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseClient } from '../../lib/supabase'
const supabase = getSupabaseClient()

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Auth callback error:', error)
          router.push('/login?error=auth_failed')
          return
        }

        if (session) {
          router.push('/dashboard')
        } else {
          router.push('/login')
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        router.push('/login')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <p>Signing you in...</p>
    </div>
  )
}