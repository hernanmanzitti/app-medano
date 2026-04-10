import type { Metadata } from "next";
import { DM_Sans, Barlow_Condensed } from 'next/font/google'
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-display',
})

export const metadata: Metadata = {
  title: "app.medano.co - WhatsApp Review SaaS",
  description: "Solicita reseñas vía WhatsApp Business API",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
