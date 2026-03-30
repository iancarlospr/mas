/**
 * Test what Facebook Ad Library h3 badge text actually looks like
 * for Oriental Bank's page.
 */
import { chromium } from 'patchright';

const PAGE_ID = '545678865442644'; // Oriental Bank

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&media_type=all&search_type=page&view_all_page_id=${PAGE_ID}`;
  console.log('Navigating to:', url);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(5_000);

  // Dump ALL h3 text content
  const h3Texts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h3')).map(h => ({
      text: h.textContent?.trim() ?? '',
      innerHTML: h.innerHTML.substring(0, 200),
    }));
  });

  console.log('\n=== All <h3> elements ===');
  for (const h of h3Texts) {
    console.log(`  text: "${h.text}"`);
    console.log(`  html: ${h.innerHTML}`);
    console.log();
  }

  // Also check for any element containing "result" text
  const resultTexts = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const matches: string[] = [];
    for (const el of all) {
      const text = el.textContent?.trim() ?? '';
      if (/\d+\s*results?/i.test(text) && text.length < 50) {
        matches.push(`<${el.tagName.toLowerCase()}> "${text}"`);
      }
    }
    return [...new Set(matches)].slice(0, 20);
  });

  console.log('=== Elements with "result" text ===');
  for (const t of resultTexts) console.log(`  ${t}`);

  // Check for any element with ad count patterns
  const adCountTexts = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const matches: string[] = [];
    for (const el of all) {
      const text = el.textContent?.trim() ?? '';
      if (/~?\d[\d,]*[KkMm]?\s*(ads?|results?|anuncios?)/i.test(text) && text.length < 80 && el.children.length === 0) {
        matches.push(`<${el.tagName.toLowerCase()}> "${text}"`);
      }
    }
    return [...new Set(matches)].slice(0, 20);
  });

  console.log('\n=== Elements with ad/result count patterns ===');
  for (const t of adCountTexts) console.log(`  ${t}`);

  await browser.close();
}

main().catch(console.error);
