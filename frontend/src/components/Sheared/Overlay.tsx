type OverlayProps = {
  onClick?: () => void;
};

const Overlay = ({ onClick }: OverlayProps) => {
  return (
   <div className="w-full h-full absolute bg-black z-200 opacity-40" onClick={onClick}></div>
  );
};

export default Overlay;