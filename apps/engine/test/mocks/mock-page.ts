import { vi } from 'vitest';
import type { Page, BrowserContext, Response } from 'playwright';

export interface MockPageOptions {
  url?: string;
  content?: string;
  cookies?: Array<{ name: string; value: string; domain: string; path: string }>;
  performanceTiming?: Record<string, number>;
  consoleMessages?: Array<{ type: string; text: string }>;
  globals?: Record<string, unknown>;
}

export function createMockPage(options: MockPageOptions = {}): Page {
  const {
    url = 'https://example.com',
    content = '<html><body></body></html>',
    cookies = [],
    performanceTiming = {},
    consoleMessages = [],
    globals = {},
  } = options;

  const consoleCallbacks: Array<(msg: any) => void> = [];

  const mockContext = {
    cookies: vi.fn().mockResolvedValue(cookies),
    clearCookies: vi.fn().mockResolvedValue(undefined),
    addCookies: vi.fn().mockResolvedValue(undefined),
  } as unknown as BrowserContext;

  const mockPage = {
    url: vi.fn().mockReturnValue(url),
    goto: vi.fn().mockResolvedValue({
      status: vi.fn().mockReturnValue(200),
      headers: vi.fn().mockReturnValue({}),
    } as unknown as Response),
    content: vi.fn().mockResolvedValue(content),
    title: vi.fn().mockResolvedValue('Example Page'),

    evaluate: vi.fn().mockImplementation(async (fn: Function) => {
      if (fn.toString().includes('performance.timing')) {
        return performanceTiming;
      }
      if (fn.toString().includes('window')) {
        return globals;
      }
      return undefined;
    }),

    evaluateHandle: vi.fn().mockResolvedValue({
      jsonValue: vi.fn().mockResolvedValue({}),
      dispose: vi.fn(),
    }),

    on: vi.fn().mockImplementation((event: string, callback: Function) => {
      if (event === 'console') {
        consoleCallbacks.push(callback as any);
      }
      return mockPage;
    }),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),

    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    hover: vi.fn().mockResolvedValue(undefined),
    scroll: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue({
      isVisible: vi.fn().mockResolvedValue(true),
      textContent: vi.fn().mockResolvedValue(''),
      getAttribute: vi.fn().mockResolvedValue(null),
      click: vi.fn().mockResolvedValue(undefined),
      boundingBox: vi.fn().mockResolvedValue({ x: 0, y: 0, width: 100, height: 50 }),
    }),
    waitForLoadState: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    waitForResponse: vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      status: vi.fn().mockReturnValue(200),
    }),

    $: vi.fn().mockResolvedValue(null),
    $$: vi.fn().mockResolvedValue([]),
    locator: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(0),
      first: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue([]),
      isVisible: vi.fn().mockResolvedValue(false),
      textContent: vi.fn().mockResolvedValue(''),
      getAttribute: vi.fn().mockResolvedValue(null),
      click: vi.fn().mockResolvedValue(undefined),
      fill: vi.fn().mockResolvedValue(undefined),
      scrollIntoViewIfNeeded: vi.fn().mockResolvedValue(undefined),
    }),

    route: vi.fn().mockResolvedValue(undefined),
    unroute: vi.fn().mockResolvedValue(undefined),

    context: vi.fn().mockReturnValue(mockContext),

    screenshot: vi.fn().mockResolvedValue(Buffer.from('')),

    viewportSize: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
    setViewportSize: vi.fn().mockResolvedValue(undefined),

    close: vi.fn().mockResolvedValue(undefined),
    isClosed: vi.fn().mockReturnValue(false),
  } as unknown as Page;

  // Simulate console messages after a tick
  if (consoleMessages.length > 0) {
    setTimeout(() => {
      consoleMessages.forEach((msg) => {
        consoleCallbacks.forEach((cb) =>
          cb({
            type: () => msg.type,
            text: () => msg.text,
            location: () => ({ url: '', lineNumber: 0, columnNumber: 0 }),
            args: () => [],
          }),
        );
      });
    }, 0);
  }

  return mockPage;
}
