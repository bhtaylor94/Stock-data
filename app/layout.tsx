export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body style={{ fontFamily: 'sans-serif' }}>{children}</body>
    </html>
  );
}
