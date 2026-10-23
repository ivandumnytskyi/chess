export type BoardTheme = {
  name: string;
  light: string;
  dark: string;
};

export const boardThemes: BoardTheme[] = [
  {
    name: "Classic",
    light: "bg-[#f0d9b5]",
    dark: "bg-[#b58863]",
  },
  {
    name: "Green",
    light: "bg-[#7a6a56]",
    dark: "bg-[#1a2b20]",
  },
  {
    name: "Blue",
    light: "bg-[#8e8b95]",
    dark: "bg-[#132343]",
  },
];