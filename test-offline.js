import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });
  
  page.on('pageerror', err => {
    console.log(`[Browser EXCEPTION] ${err.message}`);
  });

  try {
    console.log('Navigating to http://localhost:4173/ ...');
    await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' });
    console.log('Page loaded successfully online.');

    console.log('Setting offline mode...');
    // Enable offline mode
    await page.setOfflineMode(true);
    
    // Test if we can reload the page offline (PWA SW check)
    // In Vite Dev Mode this will fail! Let's check how it fails.
    console.log('Reloading page while offline...');
    await page.reload({ waitUntil: 'networkidle0' });
    console.log('Reloaded while offline.');
    
    // Capture screenshot
    await page.screenshot({ path: 'offline-test.png' });
    console.log('Screenshot saved to offline-test.png');
    
    // Check page text
    const text = await page.evaluate(() => document.body.innerText);
    console.log('Page body text length: ' + text.length);
    console.log('Page body text: ' + text.slice(0, 200));

  } catch (err) {
    console.log(`[Test Failed] ${err.message}`);
  } finally {
    await browser.close();
  }
})();
