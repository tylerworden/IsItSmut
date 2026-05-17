import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IsItSmut",
  description: "Find out if it's smut.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
