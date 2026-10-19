export function TestResult({
  result
}: {
  result: { ok: boolean; message: string } | null
}): React.JSX.Element | null {
  if (!result) return null
  return (
    <p
      className={`rounded-[6px] border-l-2 px-3 py-2 text-[13px] ${result.ok ? 'border-ob-green bg-ob-green/10 text-ob-green' : 'border-ob-red bg-ob-red/10 text-ob-red'}`}
    >
      {result.message}
    </p>
  )
}
