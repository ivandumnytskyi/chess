type OptionPickerProps<T extends string> = {
  name: string;
  legend: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

const OptionPicker = <T extends string>({ name, legend, options, value, onChange }: OptionPickerProps<T>) => {
  return (
    <fieldset className="flex flex-wrap justify-center gap-4">
      <legend className="w-full text-center pb-4 text-xl">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.id}
          className={`cursor-pointer border-2 px-4 py-2 rounded-lg ${
            value === option.id ? "border-ruby" : "border-white"
          }`}
        >
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
};

export default OptionPicker;
