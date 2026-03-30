/**
 * Stealth Init Script Patches
 *
 * Comprehensive browser fingerprint overrides applied via Playwright
 * addInitScript(). Inspired by puppeteer-extra-plugin-stealth but
 * implemented as native Playwright calls with no runtime dependency.
 *
 * Covers:
 * - navigator.webdriver removal
 * - Proper PluginArray / MimeType objects
 * - chrome.loadTimes() / chrome.csi() realistic values
 * - navigator.connection (NetworkInformation)
 * - Error stack scrubbing (removes CDP/automation frames)
 * - Permissions API comprehensive handling
 * - WebGL vendor/renderer spoofing
 * - Canvas fingerprint noise
 * - Hardware properties (hardwareConcurrency, deviceMemory)
 */

import type { BrowserContext } from 'patchright';
import type { StealthProfile } from './stealth-profile.js';

/**
 * Apply all stealth patches to a browser context using the given profile.
 */
export async function applyStealthPatches(
  context: BrowserContext,
  profile: StealthProfile,
): Promise<void> {
  // Pass profile data into the page context
  await context.addInitScript(
    (p: {
      userAgent: string;
      platform: string;
      webglVendor: string;
      webglRenderer: string;
      hardwareConcurrency: number;
      deviceMemory: number;
    }) => {
      // ── 1. navigator.webdriver ──────────────────────────────────────
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true,
      });

      // Also delete the property from the prototype
      delete (Object.getPrototypeOf(navigator) as Record<string, unknown>).webdriver;

      // ── 2. Proper PluginArray & MimeType objects ────────────────────
      // Real Chrome has a PluginArray with PDF-related plugins.
      // The old patch used [1,2,3,4,5] which is trivially detectable.

      const PLUGIN_DATA = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
      ];

      const makeMimeType = (pluginRef: Plugin): MimeType => {
        const mt = Object.create(MimeType.prototype);
        Object.defineProperties(mt, {
          type: { get: () => 'application/pdf', enumerable: true },
          suffixes: { get: () => 'pdf', enumerable: true },
          description: { get: () => 'Portable Document Format', enumerable: true },
          enabledPlugin: { get: () => pluginRef, enumerable: true },
        });
        return mt;
      };

      const makePlugin = (data: { name: string; filename: string; description: string }): Plugin => {
        const plugin = Object.create(Plugin.prototype);
        const mt = makeMimeType(plugin);
        Object.defineProperties(plugin, {
          name: { get: () => data.name, enumerable: true },
          filename: { get: () => data.filename, enumerable: true },
          description: { get: () => data.description, enumerable: true },
          length: { get: () => 1, enumerable: true },
          0: { get: () => mt },
        });
        plugin.item = (i: number) => (i === 0 ? mt : null);
        plugin.namedItem = (name: string) => (name === 'application/pdf' ? mt : null);
        return plugin;
      };

      const plugins = PLUGIN_DATA.map(makePlugin);
      const pluginArray = Object.create(PluginArray.prototype);
      for (let i = 0; i < plugins.length; i++) {
        Object.defineProperty(pluginArray, i, { get: () => plugins[i], enumerable: true });
      }
      Object.defineProperties(pluginArray, {
        length: { get: () => plugins.length, enumerable: true },
      });
      pluginArray.item = (i: number) => plugins[i] ?? null;
      pluginArray.namedItem = (name: string) => plugins.find((pl: Plugin) => pl.name === name) ?? null;
      pluginArray.refresh = () => {};
      pluginArray[Symbol.iterator] = function* () { yield* plugins; };

      Object.defineProperty(navigator, 'plugins', {
        get: () => pluginArray,
        configurable: true,
      });

      // ── 3. navigator.mimeTypes ─────────────────────────────────────
      const mimeTypes = Object.create(MimeTypeArray.prototype);
      const allMimeTypes = plugins.map((pl: Plugin) => pl[0] as MimeType);
      for (let i = 0; i < allMimeTypes.length; i++) {
        Object.defineProperty(mimeTypes, i, { get: () => allMimeTypes[i], enumerable: true });
      }
      Object.defineProperties(mimeTypes, {
        length: { get: () => allMimeTypes.length, enumerable: true },
      });
      mimeTypes.item = (i: number) => allMimeTypes[i] ?? null;
      mimeTypes.namedItem = (name: string) => allMimeTypes.find((mt: MimeType) => mt.type === name) ?? null;
      mimeTypes[Symbol.iterator] = function* () { yield* allMimeTypes; };

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => mimeTypes,
        configurable: true,
      });

      // ── 4. navigator.languages ─────────────────────────────────────
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true,
      });

      // ── 5. chrome object with realistic methods ────────────────────
      const navigationStart = performance.timing?.navigationStart ?? Date.now() - 2500;
      const loadTime = navigationStart + 800 + Math.random() * 1200;

      const win = window as unknown as Record<string, unknown>;
      win['chrome'] = {
        app: {
          isInstalled: false,
          InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
          RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
          getDetails: () => null,
          getIsInstalled: () => false,
        },
        runtime: {
          OnInstalledReason: {
            CHROME_UPDATE: 'chrome_update', INSTALL: 'install',
            SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update',
          },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          PlatformArch: {
            ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64',
            X86_32: 'x86-32', X86_64: 'x86-64',
          },
          PlatformNaclArch: {
            ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64',
          },
          PlatformOs: {
            ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac',
            OPENBSD: 'openbsd', WIN: 'win',
          },
          RequestUpdateCheckStatus: {
            NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available',
          },
          connect: () => {},
          sendMessage: () => {},
          id: undefined,
        },
        loadTimes: () => ({
          commitLoadTime: loadTime / 1000,
          connectionInfo: 'h2',
          finishDocumentLoadTime: (loadTime + 200 + Math.random() * 300) / 1000,
          finishLoadTime: (loadTime + 500 + Math.random() * 500) / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: (loadTime + 100 + Math.random() * 200) / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'h2',
          requestTime: navigationStart / 1000,
          startLoadTime: navigationStart / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
        }),
        csi: () => ({
          onloadT: loadTime,
          pageT: Date.now() - navigationStart,
          startE: navigationStart,
          tran: 15,
        }),
      };

      // ── 6. navigator.connection (NetworkInformation) ───────────────
      if (!('connection' in navigator)) {
        const conn = {
          effectiveType: '4g',
          downlink: 10 + Math.random() * 15,
          rtt: 50 + Math.floor(Math.random() * 50),
          saveData: false,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
        };
        Object.defineProperty(navigator, 'connection', {
          get: () => conn,
          configurable: true,
        });
      }

      // ── 7. Error stack scrubbing (remove CDP frames) ───────────────
      const originalPrepareStackTrace = (Error as unknown as Record<string, unknown>).prepareStackTrace as
        ((err: Error, stack: NodeJS.CallSite[]) => string) | undefined;

      (Error as unknown as Record<string, unknown>).prepareStackTrace = (
        err: Error,
        stack: Array<{ getFileName: () => string | null; toString: () => string }>,
      ) => {
        // Filter out CDP/DevTools/puppeteer frames
        const filtered = stack.filter((frame) => {
          const filename = frame.getFileName?.() ?? '';
          return (
            !filename.includes('pptr:') &&
            !filename.includes('__puppeteer') &&
            !filename.includes('DevTools') &&
            !filename.includes('chrome-devtools:') &&
            !filename.includes('extensions::')
          );
        });

        if (originalPrepareStackTrace) {
          return originalPrepareStackTrace(err, filtered as unknown as NodeJS.CallSite[]);
        }
        return `${err.name}: ${err.message}\n${filtered.map((f) => `    at ${f.toString()}`).join('\n')}`;
      };

      // ── 8. Permissions API ─────────────────────────────────────────
      // Handle all permission names, not just 'notifications'
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (desc: PermissionDescriptor) => {
        const name = desc.name;
        // Return realistic permission states
        const permissionMap: Record<string, PermissionState> = {
          'notifications': 'denied',
          'geolocation': 'prompt',
          'camera': 'prompt',
          'microphone': 'prompt',
          'persistent-storage': 'prompt',
          'push': 'denied',
          'midi': 'prompt',
          'clipboard-read': 'prompt',
          'clipboard-write': 'granted',
          'payment-handler': 'prompt',
          'background-sync': 'granted',
          'accelerometer': 'granted',
          'gyroscope': 'granted',
          'magnetometer': 'granted',
          'screen-wake-lock': 'prompt',
        };

        if (name in permissionMap) {
          return Promise.resolve({
            state: permissionMap[name]!,
            name,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          } as PermissionStatus);
        }

        // Fall through to browser default for unknown permissions
        return originalQuery(desc);
      };

      // ── 9. WebGL vendor/renderer spoofing ──────────────────────────
      const getParameterProto = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (param: GLenum) {
        const UNMASKED_VENDOR = 0x9245;  // UNMASKED_VENDOR_WEBGL
        const UNMASKED_RENDERER = 0x9246;  // UNMASKED_RENDERER_WEBGL
        if (param === UNMASKED_VENDOR) return p.webglVendor;
        if (param === UNMASKED_RENDERER) return p.webglRenderer;
        return getParameterProto.call(this, param);
      };

      // Also patch WebGL2
      if (typeof WebGL2RenderingContext !== 'undefined') {
        const getParameterProto2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (param: GLenum) {
          const UNMASKED_VENDOR = 0x9245;
          const UNMASKED_RENDERER = 0x9246;
          if (param === UNMASKED_VENDOR) return p.webglVendor;
          if (param === UNMASKED_RENDERER) return p.webglRenderer;
          return getParameterProto2.call(this, param);
        };
      }

      // ── 10. Canvas fingerprint noise ───────────────────────────────
      // Add subtle 1-bit pixel shifts to prevent cross-scan fingerprint correlation
      const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
            // Flip a few random low bits in the first few pixels
            for (let i = 0; i < Math.min(imageData.data.length, 64); i += 4) {
              if (Math.random() < 0.1) {
                imageData.data[i] = imageData.data[i]! ^ 1;  // Flip LSB of red
              }
            }
            ctx.putImageData(imageData, 0, 0);
          } catch {
            // SecurityError on cross-origin canvases — ignore
          }
        }
        return origToDataURL.call(this, type, quality);
      };

      const origToBlob = HTMLCanvasElement.prototype.toBlob;
      HTMLCanvasElement.prototype.toBlob = function (
        callback: BlobCallback,
        type?: string,
        quality?: number,
      ) {
        const ctx = this.getContext('2d');
        if (ctx && this.width > 0 && this.height > 0) {
          try {
            const imageData = ctx.getImageData(0, 0, Math.min(this.width, 16), Math.min(this.height, 16));
            for (let i = 0; i < Math.min(imageData.data.length, 64); i += 4) {
              if (Math.random() < 0.1) {
                imageData.data[i] = imageData.data[i]! ^ 1;
              }
            }
            ctx.putImageData(imageData, 0, 0);
          } catch {
            // SecurityError — ignore
          }
        }
        return origToBlob.call(this, callback, type, quality);
      };

      // ── 11. Hardware properties ────────────────────────────────────
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => p.hardwareConcurrency,
        configurable: true,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => p.deviceMemory,
        configurable: true,
      });

      // ── 12. navigator.platform consistency ─────────────────────────
      const platformMap: Record<string, string> = {
        macOS: 'MacIntel',
        Windows: 'Win32',
        Android: 'Linux armv8l',
      };
      Object.defineProperty(navigator, 'platform', {
        get: () => platformMap[p.platform] ?? 'Win32',
        configurable: true,
      });

      // ── 13. Iframe contentWindow bypass ────────────────────────────
      // Prevent detection via iframe.contentWindow.chrome check
      try {
        const iframeProto = HTMLIFrameElement.prototype;
        const origContentWindow = Object.getOwnPropertyDescriptor(iframeProto, 'contentWindow');
        if (origContentWindow?.get) {
          const origGet = origContentWindow.get;
          Object.defineProperty(iframeProto, 'contentWindow', {
            get: function () {
              const cw = origGet.call(this);
              if (cw) {
                try {
                  if (!(cw as unknown as Record<string, unknown>)['chrome']) {
                    (cw as unknown as Record<string, unknown>)['chrome'] = win['chrome'];
                  }
                } catch {
                  // Cross-origin — ignore
                }
              }
              return cw;
            },
            configurable: true,
          });
        }
      } catch {
        // Not critical
      }
    },
    {
      userAgent: profile.userAgent,
      platform: profile.platform,
      webglVendor: profile.webglVendor,
      webglRenderer: profile.webglRenderer,
      hardwareConcurrency: profile.hardwareConcurrency,
      deviceMemory: profile.deviceMemory,
    },
  );
}
