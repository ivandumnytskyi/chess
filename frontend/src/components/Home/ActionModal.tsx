import type { ReactNode } from "react";

type ActionModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const ActionModal = ({ title, onClose, children }: ActionModalProps) => {
  return (
    <>
      <div className="fixed inset-0 z-200 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed flex flex-col gap-4 rounded-lg items-center justify-center
      text-white text-2xl z-300 bg-black border border-gray-700 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
      px-4 py-4"
      >
        <p>{title}</p>
        {children}
      </div>
    </>
  );
};

export default ActionModal;
