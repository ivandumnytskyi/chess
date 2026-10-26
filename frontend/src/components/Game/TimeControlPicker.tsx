import { TIME_CONTROL_OPTIONS, type TimeControlId } from "../../constants/timeControls";

type TimeControlPickerProps = {
  value: TimeControlId;
  onChange: (value: TimeControlId) => void;
  onStart: () => void;
};

const TimeControlPicker = ({ value, onChange, onStart }: TimeControlPickerProps) => {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-6 text-white">
      <fieldset className="flex flex-wrap justify-center gap-4">
        <legend className="w-full text-center pb-4 text-xl">Choose time control</legend>
        {TIME_CONTROL_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`cursor-pointer border-2 px-4 py-2 rounded-lg ${
              value === option.id ? "border-blue-500" : "border-white"
            }`}
          >
            <input
              type="radio"
              name="time-control"
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <button className="px-6 py-2 bg-blue-500 text-white rounded" onClick={onStart}>
        Start game
      </button>
    </div>
  );
};

export default TimeControlPicker;
