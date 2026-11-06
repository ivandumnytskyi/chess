import { useState } from "react";
import { useNavigate } from "react-router";
import TimeControlPicker from "../Game/TimeControlPicker";
import { DEFAULT_TIME_CONTROL, type SoloTimeControlId } from "../../constants/timeControls";

const PlayAloneForm = () => {
  const navigate = useNavigate();
  const [timeControl, setTimeControl] = useState<SoloTimeControlId>(DEFAULT_TIME_CONTROL);

  return (
    <TimeControlPicker
      value={timeControl}
      onChange={setTimeControl}
      onStart={() => navigate("/game", { state: { timeControl } })}
    />
  );
};

export default PlayAloneForm;
