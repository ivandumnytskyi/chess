type PieceProps = {
  pieceType: string;
  color: string;
  theme: string;
};

const Piece = ({ pieceType, color, theme }: PieceProps) => {
  const abr = pieceType === 'knight' ? 'N' : pieceType.toString()[0].toUpperCase();
  const conwertPiece = color[0] + abr + '.svg';
  const imgSrc = `/pieceThems/${theme}/${conwertPiece}`; 
  return <img className="w-full h-full cursor-pointer z-10 relative" src={imgSrc} alt={theme} />;
};

export default Piece;