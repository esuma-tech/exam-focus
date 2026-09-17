import LiveManager from '../../components/LiveManager'

export default function InstructorLive() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-navy-900">Live classes</h1>
        <p className="mt-1 text-slate-500">
          See every class you've scheduled, share the join key with students, and start or edit sessions.
        </p>
      </div>
      <LiveManager />
    </div>
  )
}