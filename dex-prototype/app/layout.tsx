import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "DEX · Digital Estate Extended", description: "Connected estate planning and field operations — illustrative M1/M2 workshop." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
