import { Color } from "../../types/chess";

export function swapColor(color: Color):Color{
  return color==='white'? 'black': 'white'
}