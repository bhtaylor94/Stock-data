import './globals.css';

export const metadata = {
  title: 'FlowHunter',
  description: 'Institutional-grade options flow scanner',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
