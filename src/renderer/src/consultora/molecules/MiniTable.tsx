export interface MiniTableData {
  columns: string[]
  rows: string[][]
}

export function MiniTable({
  label,
  data
}: {
  label: string
  data: MiniTableData
}): React.JSX.Element {
  return (
    <table aria-label={label} className="w-full border-collapse text-[12px]">
      <thead>
        <tr className="border-b border-ob-border">
          {data.columns.map((c, i) => (
            <th
              key={c}
              scope="col"
              className={`h-6 px-1 font-medium text-ob-muted ${i ? 'text-right' : 'text-left'}`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.rows.map((row, r) => (
          <tr key={r} className="border-b border-ob-border">
            {row.map((cell, i) => (
              <td
                key={i}
                className={`h-6 truncate px-1 ${i ? 'text-right text-ob-muted tabular-nums' : 'text-ob-text'}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
