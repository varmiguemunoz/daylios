/** Iniciales en un círculo neutro (no hay fotos de contactos). */
export function Initials({ name, size = 32 }: { name: string; size?: number }): React.JSX.Element {
  const letters = name
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-ob-active text-[11px] font-semibold text-ob-muted"
    >
      {letters || '·'}
    </span>
  )
}
