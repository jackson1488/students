/**
 * Module: scripts/setup-pwa.js
 *
 * Purpose:
 * - Script for preparing web/PWA files and installation metadata.
 *
 * Module notes:
 * - Imports count: 0.
 * - This header is written for beginners: read purpose first, then function map below.
 *
 * Function map:
 * - ensureDir: Helper function used by this module business logic.
 * - copyIcons: Helper function used by this module business logic.
 * - writeManifestAndSw: Helper function used by this module business logic.
 * - patchHtml: Helper function used by this module business logic.
 * - setupForDir: Applies value updates to state/configuration.
 */

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const ASSETS_DIR = path.join(PROJECT_ROOT, "assets");

const ICON_SOURCES = {
  "icon-192.png": path.join(ASSETS_DIR, "web-icon-192.png"),
  "icon-512.png": path.join(ASSETS_DIR, "web-icon-512.png"),
  "apple-touch-icon.png": path.join(ASSETS_DIR, "apple-touch-icon.png"),
  "favicon.png": path.join(ASSETS_DIR, "favicon.png"),
};

const MANIFEST = {
  name: "EDU Kernel",
  short_name: "EDU Kernel",
  start_url: "/",
  scope: "/",
  display: "standalone",
  display_override: ["standalone", "minimal-ui", "browser"],
  orientation: "portrait",
  background_color: "#f5f5f0",
  theme_color: "#121212",
  description: "EDU Kernel — student accounting system",
  icons: [
    {
      src: "/icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any maskable",
    },
    {
      src: "/icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any maskable",
    },
  ],
};

const SW_CONTENT = `const CACHE_NAME = "edu-kernel-pwa-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/index.html")))
  );
});
`;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyIcons(targetDir) {
  Object.entries(ICON_SOURCES).forEach(([targetName, sourcePath]) => {
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing icon source: ${sourcePath}`);
    }
    fs.copyFileSync(sourcePath, path.join(targetDir, targetName));
  });
}

function writeManifestAndSw(targetDir) {
  fs.writeFileSync(path.join(targetDir, "manifest.webmanifest"), `${JSON.stringify(MANIFEST, null, 2)}\n`);
  fs.writeFileSync(path.join(targetDir, "sw.js"), SW_CONTENT);
}

function patchHtml(targetDir) {
  const htmlPath = path.join(targetDir, "index.html");
  if (!fs.existsSync(htmlPath)) return;

  let html = fs.readFileSync(htmlPath, "utf8");

  const tags = [
    { check: 'name="theme-color"', tag: '<meta name="theme-color" content="#121212">' },
    { check: 'name="mobile-web-app-capable"', tag: '<meta name="mobile-web-app-capable" content="yes">' },
    { check: 'name="apple-mobile-web-app-capable"', tag: '<meta name="apple-mobile-web-app-capable" content="yes">' },
    {
      check: 'name="apple-mobile-web-app-status-bar-style"',
      tag: '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    },
    { check: 'name="apple-mobile-web-app-title"', tag: '<meta name="apple-mobile-web-app-title" content="EDU Kernel">' },
    { check: 'rel="manifest"', tag: '<link rel="manifest" href="/manifest.webmanifest" />' },
    { check: 'rel="apple-touch-icon"', tag: '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />' },
    { check: 'href="/favicon.png"', tag: '<link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />' },
  ];

  tags.forEach(({ check, tag }) => {
    if (!html.includes(check)) {
      html = html.replace("</head>", `${tag}\n</head>`);
    }
  });

  // Remove duplicate theme-color tags if any were previously inserted.
  const themeColorTag = '<meta name="theme-color" content="#121212">';
  const firstThemeIdx = html.indexOf(themeColorTag);
  if (firstThemeIdx !== -1) {
    const before = html.slice(0, firstThemeIdx + themeColorTag.length);
    const after = html.slice(firstThemeIdx + themeColorTag.length).replace(new RegExp(themeColorTag, "g"), "");
    html = before + after;
  }

  const swScript = `<script>
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
</script>`;

  if (!html.includes("serviceWorker.register")) {
    html = html.replace("</body>", `${swScript}\n</body>`);
  }

  fs.writeFileSync(htmlPath, html);
}

function setupForDir(targetDir) {
  if (!fs.existsSync(targetDir)) {
    return;
  }
  ensureDir(targetDir);
  copyIcons(targetDir);
  writeManifestAndSw(targetDir);
  patchHtml(targetDir);
  console.log(`PWA ready: ${targetDir}`);
}

const explicitTarget = process.argv[2];
if (explicitTarget) {
  setupForDir(path.resolve(PROJECT_ROOT, explicitTarget));
} else {
  setupForDir(path.join(PROJECT_ROOT, "dist"));
  setupForDir(path.join(PROJECT_ROOT, "dist-web"));
}
