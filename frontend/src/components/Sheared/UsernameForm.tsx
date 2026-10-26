import { useEffect, useState } from "react";
import { changeUsername, getUsername } from "../../lib/profile";

const UsernameForm = () => {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getUsername()
      .then((username) => {
        if (active) setValue(username ?? "");
      })
      .catch(() => {
        if (active) setStatus("Could not load username");
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const saved = await changeUsername(value);
      setValue(saved);
      setStatus("Username saved");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not change username");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col justify-center items-center gap-2 w-full mt-4">
      <label htmlFor="username" className="text-2xl">
        Set Username
      </label>
      <div className="flex gap-2">
        <input
          id="username"
          className="p-2 border border-gray-300 rounded-full px-4 text-base"
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setStatus(null);
          }}
          pattern="[A-Za-z0-9_]{3,20}"
          title="3-20 letters, numbers or underscores"
          required={true}
        />
        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-lg text-base">
          Save
        </button>
      </div>
      {status && <p className="text-base">{status}</p>}
    </form>
  );
};

export default UsernameForm;
