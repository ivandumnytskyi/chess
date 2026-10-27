import { useState } from "react";
import { useInvites } from "../../lib/invite";

const InviteForm = () => {
  const { send } = useInvites();
  const [username, setUsername] = useState("");
  const [timeControl, setTimeControl] = useState<"10+0" | "2+1" | "1+0" >("10+0");
  const [color, setColor] = useState<"white" | "black" | "random">("random");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send({ username, timeControl, color });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="username">Username:</label>
        <input type="text" id="username" name="username" value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div>
        <label htmlFor="timeControl">Time Control:</label>
        <select id="timeControl" name="timeControl" value={timeControl} onChange={(e) => setTimeControl(e.target.value as "10+0" | "2+1" | "1+0")}>
          <option value="10+0">10+0</option>
          <option value="2+1">2+1</option>
          <option value="1+0">1+0</option>
        </select>
      </div>
      <div>
        <label htmlFor="color">Color:</label>
        <select id="color" name="color" value={color} onChange={(e) => setColor(e.target.value as "white" | "black" | "random")}>
          <option value="white">White</option>
          <option value="black">Black</option>
          <option value="random">Random</option>
        </select>
      </div>
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded cursor-pointer">Send Invite</button>
    </form>
  );
};

export default InviteForm;