import { describe, it, expect } from "vitest";
import { chromeIntentUrl, detectInAppBrowser } from "@/app/[locale]/login/in-app-browser";

describe("detectInAppBrowser (MOV-11)", () => {
  it.each([
    ["Mozilla/5.0 (iPhone) AppleWebKit Instagram 300.0.0", false],
    ["Mozilla/5.0 (iPhone) AppleWebKit [FBAN/FBIOS;FBAV/450.0]", false],
    ["Mozilla/5.0 (Linux; Android 13) Chrome/120 musical_ly_2023 BytedanceWebview", true],
    ["Mozilla/5.0 (iPhone) AppleWebKit TikTok 32.0", false],
    ["Mozilla/5.0 (iPhone) AppleWebKit Twitter for iPhone", false],
    // LinkedIn, Threads y cualquier WebView de Android (Google bloquea todos).
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [LinkedInApp]", false],
    ["Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Barcelona 300.0.0", false],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A; wv) AppleWebKit/537.36 Version/4.0 Chrome/120 Mobile Safari/537.36", true],
  ])("detecta %s", (ua, android) => {
    expect(detectInAppBrowser(ua)).toEqual({ android });
  });

  it("no salta en navegadores normales", () => {
    expect(detectInAppBrowser("Mozilla/5.0 (iPhone) Version/17.0 Mobile Safari/604.1")).toBeNull();
    expect(detectInAppBrowser("Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36")).toBeNull();
    expect(detectInAppBrowser("")).toBeNull();
    expect(detectInAppBrowser(null)).toBeNull();
  });
});

describe("chromeIntentUrl", () => {
  it("conserva ruta y query y lleva fallback", () => {
    const url = chromeIntentUrl("https://kulturaapp.vercel.app/es/login?mode=register");
    expect(url).toBe(
      "intent://kulturaapp.vercel.app/es/login?mode=register#Intent;scheme=https;package=com.android.chrome;" +
        "S.browser_fallback_url=https%3A%2F%2Fkulturaapp.vercel.app%2Fes%2Flogin%3Fmode%3Dregister;end"
    );
  });

  it("rechaza lo que no es http(s)", () => {
    expect(chromeIntentUrl("javascript:alert(1)")).toBeNull();
    expect(chromeIntentUrl("no es una url")).toBeNull();
  });
});
