export function InfoBlock({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  const ListTag = ordered ? 'ol' : 'ul'

  return (
    <section className="mt-[18px] rounded-2xl border border-[#ded8ca] bg-white p-[22px]">
      <h2>{title}</h2>
      <ListTag>
        {items.map((item) => (
          <li className="my-2.5" key={item}>{item}</li>
        ))}
      </ListTag>
    </section>
  )
}
