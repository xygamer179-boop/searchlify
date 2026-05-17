
import "./globals.css";

export const metadata = {
  title: "Searchlify",
  description: "Your AI powered search engine!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
