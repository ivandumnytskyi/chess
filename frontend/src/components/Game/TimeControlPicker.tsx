import { SOLO_TIME_CONTROL_OPTIONS, type SoloTimeControlId } from "../../constants/timeControls";
import OptionPicker from "../Sheared/OptionPicker";

type TimeControlPickerProps = {
  value: SoloTimeControlId;
  onChange: (value: SoloTimeControlId) => void;
  onStart: () => void;
};

const TimeControlPicker = ({ value, onChange, onStart }: TimeControlPickerProps) => {
  return (
    <div className="flex flex-col items-center gap-6 text-white">
      <OptionPicker
        name="time-control"
        legend="Choose time control"
        options={SOLO_TIME_CONTROL_OPTIONS}
        value={value}
        onChange={onChange}
      />
      <button className="px-6 py-2 bg-ruby text-white rounded" onClick={onStart}>
        Start game
      </button>
    </div>
  );
};

export default TimeControlPicker;
