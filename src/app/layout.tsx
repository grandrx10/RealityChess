import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cross Reality Chess",
  description: "Bughouse across a chess board and a xiangqi board.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
