import type { Metadata } from "next";
import { AccessibilityFocusManager } from "@/components/accessibility-focus";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: { default: "On-Time", template: "%s · On-Time" },
  description: "On Time all the time",
  applicationName: "On-Time",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  openGraph: { title: "On-Time", description: "On Time all the time", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><AccessibilityFocusManager />{children}</body></html>;
}
