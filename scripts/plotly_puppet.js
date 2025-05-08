const puppeteer = require('puppeteer');

async function renderPlotlyImage(data, layout, width = 1000, height = 500) {
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

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
    await page.waitForFunction('window.renderDone === true');

    const element = await page.$('#chart');
    const buffer = await element.screenshot();

    await browser.close();
    return buffer;
}

module.exports = renderPlotlyImage;