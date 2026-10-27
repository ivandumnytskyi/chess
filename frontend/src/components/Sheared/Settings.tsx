import Selection from "./Selection";
import UsernameForm from "./UsernameForm";
import { signOut } from "../../lib/auth";

type SettingsProps = {
  onClose: () => void;
};

const Settings = ({ onClose }: SettingsProps) => {
  const handleLogOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-200 bg-black/70 backdrop-blur-sm" onClick={() => onClose()} />
      <div
        className="fixed flex flex-col rounded-lg items-center justify-center 
      text-white text-2xl z-300 bg-black border border-gray-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
      px-4 py-4"
      >
        <p>Settings</p>
        <UsernameForm />
        <Selection />
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
          onClick={() => handleLogOut()}
        >
          Log Out
        </button>
      </div>
    </>
  );
};

export default Settings;
