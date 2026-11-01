import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UTH Smart Assets | โรงพยาบาลอุดรธานี",
  description: "ต้นแบบระบบบริหารครุภัณฑ์โรงพยาบาลอุดรธานี โดย Pacific Plus IT — ข้อมูลจำลอง",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
