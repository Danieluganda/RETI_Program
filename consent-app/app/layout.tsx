import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "10X Consent App",
  description: "Program participant consent collection MVP",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
