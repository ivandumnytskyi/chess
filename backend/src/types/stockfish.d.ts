declare module "stockfish" {
  export type StockfishVariant = "full" | "full-single" | "lite" | "lite-single" | "asm";

  export interface StockfishEngine {
    processCommand(command: string): void;
    terminate(): void;
    listener: (line: string) => void;
  }

  export default function createStockfish(
    variant: StockfishVariant,
    onMessage: (line: string) => void,
  ): StockfishEngine;
}