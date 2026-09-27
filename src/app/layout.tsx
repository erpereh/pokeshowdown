import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Inter } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "PokeShowdown", template: "%s · PokeShowdown" },
  description: "Combates Pokémon competitivos contra la CPU con el motor de Pokémon Showdown.",
};

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${chakra.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
