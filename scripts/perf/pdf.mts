export function makePdf(pages: number, title: string): Buffer {
  const objects: string[] = []
  const add = (body: string): number => objects.push(body)
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('')
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const kids: number[] = []
  for (let p = 1; p <= pages; p++) {
    const lines = [
      `BT /F1 28 Tf 72 720 Td (${title}) Tj ET`,
      `BT /F1 14 Tf 72 680 Td (Pagina ${p} de ${pages}) Tj ET`
    ]
    for (let l = 0; l < 30; l++)
      lines.push(
        `BT /F1 11 Tf 72 ${640 - l * 18} Td (Linea ${l + 1} de contenido de prueba para el board.) Tj ET`
      )
    const stream = lines.join('\n')
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
    kids.push(
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`
      )
    )
  }
  objects[1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${pages} >>`
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((body, i) => {
    offsets.push(out.length)
    out += `${i + 1} 0 obj\n${body}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}
