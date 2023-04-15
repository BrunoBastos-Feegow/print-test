const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // You can adjust the limit as needed

app.post('/generate-pdf', async (req, res) => {
    // const { htmlContent } = req.body;
    const htmlHeader = req.body.htmlHeader;
    const htmlFooter = req.body.htmlFooter;
    const htmlBody = req.body.htmlBody;

    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();

    await page.setContent(htmlBody, { waitUntil: 'networkidle0' });
    await page.addStyleTag({ path: './pdf.css' });

    const pdfOptions = {
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
      <div class="header">
        <!-- Your header content here --> 
        ${htmlHeader}
      </div>
    `,
        footerTemplate: `
      <div class="footer">
        <!-- Your footer content here --> 
        ${htmlFooter}
      </div>
    `,
        margin: { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' },
    };

    const pdfBuffer = await page.pdf(pdfOptions);
    await browser.close();

    res.contentType('application/pdf');
    res.send(pdfBuffer);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF service listening on port ${PORT}`));
