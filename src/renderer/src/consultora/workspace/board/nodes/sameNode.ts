import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../flow'

export const sameNode = (a: NodeProps<BoardNode>, b: NodeProps<BoardNode>): boolean =>
  a.id === b.id &&
  a.data === b.data &&
  a.selected === b.selected &&
  a.width === b.width &&
  a.height === b.height &&
  a.isConnectable === b.isConnectable
