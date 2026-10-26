import { useEffect, useRef, useState } from "react";
import type { Color } from "../../types";

type PieceProps = {
  pieceType: string;
  color: Color;
  theme: string;
  // Where the piece starts, as a percentage of its own size, when it has just moved here.
  offset?: { x: number; y: number };
};

const Piece = ({ pieceType, color, theme, offset }: PieceProps) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [settled, setSettled] = useState(offset === undefined);

  // Reading layout forces the start position to be applied before the transition target is set.
  useEffect(() => {
    if (settled) return;
    imgRef.current?.getBoundingClientRect();
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [settled]);

  const abr =
    pieceType === "knight" ? "N" : pieceType.toString()[0].toUpperCase();
  const conwertPiece = color[0] + abr + ".svg";
  const imgSrc = `/pieceThems/${theme}/${conwertPiece}`;
  const transform =
    settled || !offset
      ? "translate(0, 0)"
      : `translate(${offset.x}%, ${offset.y}%)`;
  return (
    <img
      ref={imgRef}
      className="w-full h-full cursor-pointer z-10 relative"
      style={{
        transform,
        transition: settled ? "transform 200ms ease-out" : "none",
      }}
      src={imgSrc}
      alt={theme}
    />
  );
};

export default Piece;