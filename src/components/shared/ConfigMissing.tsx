export function ConfigMissing() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-cyan-100 via-pink-50 to-pink-200 p-8">
      <div className="max-w-lg bg-white rounded-xl shadow-lg p-8 border-2 border-amber-300">
        <h1 className="text-xl font-bold text-gray-900 mb-3">LnkLokr needs configuration</h1>
        <p className="text-sm text-gray-700 mb-4">
          Create a <code className="bg-gray-100 px-1 rounded">.env</code> file in the project
          folder (copy from <code className="bg-gray-100 px-1 rounded">.env.example</code>) and
          set:
        </p>
        <ul className="text-sm text-gray-800 list-disc pl-5 space-y-1 mb-4">
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_ANON_KEY</li>
        </ul>
        <p className="text-sm text-gray-600 mb-2">
          Then restart: <code className="bg-gray-100 px-1 rounded">npm run dev</code>
        </p>
        <p className="text-sm text-gray-600">
          On Vercel, add the same variables under Project Settings → Environment Variables,
          then redeploy (disable build cache if the app still shows a blank page).
        </p>
      </div>
    </div>
  )
}
