import { TextField } from '@/components/ui/text-field';

export type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DateField({
  label,
  value,
  onChange,
  placeholder = 'YYYY-MM-DD',
}: DateFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      inputMode="numeric"
      hint="Format YYYY-MM-DD"
    />
  );
}
