import React from 'react';

export type ExpiryDateInputProps = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

export default function ExpiryDateInput({ label, value, onChange, disabled }: ExpiryDateInputProps) {
  return <input type="date" aria-label={label} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} style={{ minHeight: 48, padding: 12, border: '1px solid #cbd5e1', borderRadius: 12, fontSize: 16, color: '#0f172a', background: '#fff', boxSizing: 'border-box', width: '100%' }} />;
}
