import { Barlow, Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const barlow = Barlow({
  subsets: ["latin"],
  weight: "500",
});

const main_font = inter;
const money_font = barlow;
const title_font = inter;

export { main_font, money_font, title_font };
