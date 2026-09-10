import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { auth } from "@/lib/auth";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Nav } from "@/components/layout/nav";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Polaris: Find the opportunities meant for you",
  description:
    "Polaris discovers scholarships, fellowships, internships, jobs, and programs scattered across the web and matches them to you.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthSessionProvider session={session}>
          <Nav />
          <main className="flex-1">{children}</main>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
