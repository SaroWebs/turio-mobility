export type DateTimeFieldProps = {
  label: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  mode?: 'date' | 'datetime';
  minimumDate?: Date;
  minimumLeadMinutes?: number;
  maximumDate?: Date;
  placeholder?: string;
  clearable?: boolean;
  clearLabel?: string;
};
