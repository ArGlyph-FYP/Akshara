import type { Metadata } from "next";
import { Noto_Sans, Noto_Sans_Sinhala, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans({ variable: "--font-noto-sans", subsets: ["latin"] });
const notoSinhala = Noto_Sans_Sinhala({ variable: "--font-noto-sinhala", subsets: ["sinhala"] });
const notoTamil = Noto_Sans_Tamil({ variable: "--font-noto-tamil", subsets: ["tamil"] });

export const metadata: Metadata = {
  title: "Akshara Registry",
  description: "Handwriting collection, survey and rating for the Akshara study",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${notoSans.variable} ${notoSinhala.variable} ${notoTamil.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
