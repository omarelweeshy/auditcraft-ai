import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AuditCraft AI | Evidence into opportunity",
  description: "Evidence-led website audits and human-reviewed proposals.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
