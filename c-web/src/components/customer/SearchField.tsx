import type { HTMLInputTypeAttribute } from 'react'

type SearchFieldProps = {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: HTMLInputTypeAttribute
}

export function SearchField({ label, name, value, onChange, placeholder, type = 'text' }: SearchFieldProps) {
  return (
    <label className="grid gap-1 px-3 py-2">
      <span className="text-xs font-black uppercase text-[#5f6b64]">{label}</span>
      <input className="min-h-[30px] w-full border-0 bg-transparent p-0 text-sm font-bold text-[#17211d] outline-none placeholder:font-medium placeholder:text-[#7b857f]" name={name} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  )
}
