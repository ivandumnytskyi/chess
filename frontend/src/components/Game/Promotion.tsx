import type { Color, PromotionPiece } from "../../types";

const OPTIONS: { code: string; piece: PromotionPiece }[] = [
  { code: "Q", piece: "queen" },
  { code: "R", piece: "rook" },
  { code: "B", piece: "bishop" },
  { code: "N", piece: "knight" },
];

type PromotionProps = {
  color: Color;
  theme: string;
  column: number;
  onSelect: (piece: PromotionPiece) => void;
};

const Promotion = ({ color, theme, column, onSelect }: PromotionProps) => {
  return (
    <div
      className={`absolute z-50 w-[12.5%] h-1/2 flex bg-white rounded-lg overflow-hidden ${
        color === "white" ? "top-0 flex-col" : "bottom-0 flex-col-reverse"
      }`}
      style={{ left: `${column * 12.5}%` }}
    >
      {OPTIONS.map(({ code, piece }) => (
        <img
          key={piece}
          src={`/pieceThems/${theme}/${color[0] + code}.svg`}
          alt={`${color} ${piece}`}
          onClick={() => onSelect(piece)}
          className="w-full flex-1 min-h-0 object-contain cursor-pointer hover:scale-110 transition-transform"
        />
      ))}
    </div>
  );
};

export default Promotion;
