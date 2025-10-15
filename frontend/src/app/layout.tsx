import type { Metadata } from "next";
import { UserProvider } from '@auth0/nextjs-auth0/client';
import "./globals.css";

export const metadata: Metadata = {
  title: "ESG Copilot - AI-Powered Sustainability Compliance",
  description: "Automate ESG compliance with AI agents secured by Auth0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
