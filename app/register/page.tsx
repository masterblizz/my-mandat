'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/utils/supabase/client'

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/kawasan')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white">
      <form onSubmit={handleRegister} className="w-full max-w-sm space-y-4 p-6 border border-cyan-500/30 rounded-lg">
        <h1 className="text-xl font-bold text-cyan-400">Daftar Akaun</h1>

        {error && (
          <p className="text-red-400 text-sm bg-red-950/50 p-2 rounded">{error}</p>
        )}

        <div>
          <label className="text-sm text-gray-400">Nama Pengguna</label>
          <input
            type="text"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Emel</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400">Kata Laluan</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 p-2 bg-gray-900 border border-gray-700 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-cyan-500 text-black font-semibold rounded hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading ? 'Mendaftar...' : 'Daftar'}
        </button>

        <p className="text-sm text-gray-400 text-center">
          Dah ada akaun?{' '}
          <a href="/login" className="text-cyan-400 hover:underline">Log Masuk</a>
        </p>
      </form>
    </div>
  )
}