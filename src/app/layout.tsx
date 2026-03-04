import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaHub – DYAI Media Upload",
  description: "Upload and host media files on medien.dyai.cloud",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-gray-950 text-gray-100">
        {children}
      </body>
    </html>
  );
}
