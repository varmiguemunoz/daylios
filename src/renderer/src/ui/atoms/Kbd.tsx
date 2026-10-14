import type { ReactNode } from 'react'

export function Kbd({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <kbd className="ui-kbd inline-grid h-5 min-w-5 place-items-center rounded-[6px] bg-surface-raised px-1 font-sans text-micro font-bold text-milk-soft">
      {children}
    </kbd>
  )
}
