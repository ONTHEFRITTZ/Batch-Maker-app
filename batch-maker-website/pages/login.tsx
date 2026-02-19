import { useState } from 'react'
import { useRouter } from 'next/router'
import { getSupabaseClient } from '../lib/supabase'
import Link from 'next/link'

const supabase = getSupabaseClient()

async function getRedirectPath(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin'
  return isPremium ? '/dashboard' : '/account'
}

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleAppleLogin = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else if (data.session) {
      const redirectPath = await getRedirectPath(data.session.user.id)
      router.push(redirectPath)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={styles.background}>
      <div className="max-w-md w-full bg-white p-4 rounded-lg shadow">
        <div className="text-center mb-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <img
              src="/assets/images/batch-maker-logo.png"
              alt="Batch Maker"
              className="h-10 w-10 object-contain"
            />
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-2">Sign in to Batch Maker</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            <img src="/assets/icons/google-icon.png" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
          <button
            onClick={handleAppleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-black rounded-lg text-white hover:bg-gray-900 transition-colors font-medium disabled:opacity-50"
          >
            <img src="/assets/icons/apple-icon.png" alt="Apple" className="w-5 h-5 invert" />
            Continue with Apple
          </button>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-gray-400">or</span>
          </div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8C5B5] text-sm"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A8C5B5] text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#A8C5B5] hover:bg-[#8FB5A0] text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{' '}
          <Link href="/register" className="text-[#A8C5B5] hover:text-[#8FB5A0] font-medium">
            Sign up free
          </Link>
        </p>
      </div>
    </main>
  )
}

const styles = {
  background: {
    backgroundColor: '#f3f4f6',
  } as React.CSSProperties,
}