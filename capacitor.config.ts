import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.fbf8d1fcf2504b7699cb7af913d34b5a',
  appName: 'SK Coder',
  webDir: 'dist',
  server: {
    url: "https://fbf8d1fc-f250-4b76-99cb-7af913d34b5a.lovableproject.com?forceHideBadge=true",
    cleartext: true
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#1e1e2e',
      style: 'DARK'
    }
  }
};

export default config;
