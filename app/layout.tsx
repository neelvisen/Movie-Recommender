import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Recommender",
  description: "Movie recommendations based on your Letterboxd taste, filtered to what you can actually stream.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
