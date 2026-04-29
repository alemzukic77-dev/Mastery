import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mastery — Smart Document Processing",
  description:
    "Upload, extract, validate, and review business documents with AI-powered structured extraction.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
