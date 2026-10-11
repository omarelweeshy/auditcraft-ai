import type { Metadata } from "next";
import "./style.css";
export const metadata: Metadata = {
  title: "AuditCraft AI | Interactive portfolio demo",
  description:
    "Explore a real captured website audit, review evidence, and build a proposal. Fictional data. No signup required.",
  robots: { index: true, follow: true },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
