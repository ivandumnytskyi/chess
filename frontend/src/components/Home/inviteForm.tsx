import { useState } from "react";
import { useInvites } from "../../lib/invite";
import OptionPicker from "../Sheared/OptionPicker";
import { TIME_CONTROL_OPTIONS, type TimeControlId } from "../../constants/timeControls";
import { COLOR_OPTIONS, type ColorOptionId } from "../../constants/colorOptions";

const InviteForm = ({ onClose }: { onClose: () => void }) => {
  const { send } = useInvites();
  const [username, setUsername] = useState("");
  const [timeControl, setTimeControl] = useState<TimeControlId>("10+0");
  const [color, setColor] = useState<ColorOptionId>("random");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send({ username, timeControl, color });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6 text-white">
      <div className="flex flex-col items-center gap-2">
        <label htmlFor="username" className="text-xl">Username</label>
        <input
          type="text"
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border-2 border-white rounded-lg px-3 py-2 bg-black text-white"
        />
      </div>
      <OptionPicker
        name="time-control"
        legend="Choose time control"
        options={TIME_CONTROL_OPTIONS}
        value={timeControl}
        onChange={setTimeControl}
      />
      <OptionPicker
        name="color"
        legend="Choose color"
        options={COLOR_OPTIONS}
        value={color}
        onChange={setColor}
      />
      <button type="submit" className="px-6 py-2 bg-ruby text-white rounded">Send invite</button>
    </form>
  );
};

export default InviteForm;