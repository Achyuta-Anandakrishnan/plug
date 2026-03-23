import "dotenv/config";
import type { CapacitorConfig } from "@capacitor/cli";

function resolveServerUrl() {
  return (
    process.env.CAPACITOR_SERVER_URL
    ?? "https://plug-chi.vercel.app"
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
  appId: "com.dalow.app",
  appName: "dalow",
  webDir: "mobile-shell",
  backgroundColor: "#f6f9ff",
  appendUserAgent: " DalowIOSApp/1.0",
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
