// scripts/plotly_puppet.ts
import puppeteer, { Browser, Page } from 'puppeteer';

async function renderPlotlyImage(data: any, layout: any, width = 1000, height = 500): Promise<Buffer> {
    let browser: Browser | undefined;
    try {
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser', // Specify executable path for non-standard Chromium installations
            headless: 'new', // Use new headless mode
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Recommended for Docker/Linux environments
        });
        const page: Page = await browser.newPage();

        await page.setViewport({ width, height });

        const html = `
        <html>
          <head>
            <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          </head>
          <body>
            <div id="chart" style="width: ${width}px; height: ${height}px;"></div>
            <script>
              const data = ${JSON.stringify(data)};
              const layout = ${JSON.stringify(layout)};
              Plotly.newPlot('chart', data, layout).then(() => {
                window.renderDone = true;
              });
            </script>
          </body>
        </html>
      `;

        await page.setContent(html);
        await page.waitForFunction('window.renderDone === true', { timeout: 10000 }); // Add timeout for waitForFunction

        const element = await page.$('#chart');
        if (!element) {
            throw new Error('Chart element not found on page.');
        }
        const buffer = await element.screenshot();

        return buffer;
    } catch (error) {
        console.error('Error rendering Plotly image:', error);
        throw error; // Re-throw to indicate failure
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

export default renderPlotlyImage;