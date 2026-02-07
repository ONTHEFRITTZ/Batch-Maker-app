import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseClient } from '../lib/supabase'

const supabase = getSupabaseClient()

export default function Home() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        router.push('/dashboard')
      } else {
        setLoading(false)
      }
    }

    checkUser()
  }, [router])

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Batch Maker</h1>
        <p className="text-gray-600 mb-8">Organize recipes and batches</p>
        <div className="space-x-4">
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-blue-600 text-white rounded"
          >
            Login
          </button>
          <button 
            onClick={() => router.push('/register')}
            className="px-6 py-2 bg-gray-200 rounded"
          >
            Register
          </button>
        </div>
      </div>
    </main>
  )
}