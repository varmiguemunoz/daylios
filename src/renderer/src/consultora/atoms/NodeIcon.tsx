import { icons, type LucideProps } from 'lucide-react'

export function NodeIcon({ name, ...props }: { name: string } & LucideProps): React.JSX.Element {
  const Icon = icons[name as keyof typeof icons] ?? icons.Circle
  return <Icon aria-hidden {...props} />
}
