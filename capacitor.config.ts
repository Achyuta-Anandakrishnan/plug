import "dotenv/config";
import type { CapacitorConfig } from "@capacitor/cli";

function resolveServerUrl() {
  return (
    process.env.CAPACITOR_SERVER_URL
    ?? process.env.NEXT_PUBLIC_APP_URL
    ?? "http://localhost:3000"
  );
}

function resolveAllowNavigation(serverUrl: string) {
  try {
    return [new URL(serverUrl).hostname];
  } catch {
    return [];
  }
}

const serverUrl = resolveServerUrl();

const config: CapacitorConfig = {
  appId: process.env.CAPACITOR_APP_ID ?? "com.vyre.app",
  appName: process.env.CAPACITOR_APP_NAME ?? "Vyre",
  webDir: "mobile-shell",
  backgroundColor: "#f6f9ff",
  appendUserAgent: " VyreIOSApp/1.0",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
    errorPath: "index.html",
    allowNavigation: resolveAllowNavigation(serverUrl),
  },
  ios: {
    backgroundColor: "#f6f9ff",
    contentInset: "automatic",
    preferredContentMode: "mobile",
  },
};

export default config;
