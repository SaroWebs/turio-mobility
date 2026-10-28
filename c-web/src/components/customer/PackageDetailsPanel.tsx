import { Icon } from '../Icon'

function DetailList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'included' | 'excluded'
}) {
  const included = tone === 'included'

  return (
    <section className={`rounded-[22px] border p-5 ${included ? 'border-[#b9ddd5] bg-[#edf8f5]' : 'border-[#ead5c5] bg-[#fff8f1]'}`}>
      <p className={`mb-4 mt-0 text-xs font-black uppercase tracking-[0.14em] ${included ? 'text-[#0b615a]' : 'text-[#9a4f16]'}`}>
        {title}
      </p>
      <ul className="m-0 grid list-none gap-3 p-0">
        {items.map((item) => (
          <li className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-3 leading-6 text-[#34413b]" key={item}>
            <span className={`mt-0.5 grid h-6 w-6 place-items-center rounded-full ${included ? 'bg-[#cfece4] text-[#0b615a]' : 'bg-[#f6dfcd] text-[#9a4f16]'}`}>
              <Icon name={included ? 'check' : 'x'} />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PackageDetailsPanel({
  inclusions,
  exclusions,
}: {
  inclusions: string[]
  exclusions: string[]
}) {
  if (!inclusions.length && !exclusions.length) return null

  return (
    <section className="mt-[18px] rounded-3xl border border-[#ded8ca] bg-white p-5 sm:p-6">
      <div className="mb-6 max-w-[700px]">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#9a4f16]">Package details</p>
        <h2 className="m-0 text-[clamp(1.7rem,3vw,2.4rem)] tracking-[-0.04em]">What is covered before you reserve</h2>
        <p className="mb-0 mt-3 leading-7 text-[#5f6b64]">The client brief is kept visible here so transport, stays, meals, permits, and personal costs are clear before checkout.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {inclusions.length ? <DetailList items={inclusions} title="Included" tone="included" /> : null}
        {exclusions.length ? <DetailList items={exclusions} title="Not included" tone="excluded" /> : null}
      </div>
    </section>
  )
}
