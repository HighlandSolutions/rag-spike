import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Q&A Application",
  description: "Perplexity-style Q&A application with RAG",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

