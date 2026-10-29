interface Props {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function TextInput({ value, disabled = false, onChange }: Props) {
  return (
    <label>
      描述希望生成的图样或形状
      <textarea
        value={value}
        disabled={disabled}
        maxLength={500}
        rows={5}
        placeholder="例如：在扇面中央生成一个绿色闭合三角形"
        onChange={(event) => onChange(event.target.value)}
      />
      <span>{value.length}/500</span>
    </label>
  );
}

