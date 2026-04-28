import './globals.css';
import { appConfig } from '../data/deals';

export const metadata = {
  title: `${appConfig.name} | Curated cheap-flight trips`,
  description: appConfig.strapline,
  metadataBase: new URL(appConfig.baseUrl),
  openGraph: {
    title: `${appConfig.name} | Curated cheap-flight trips`,
    description: appConfig.strapline,
    type: 'website'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
