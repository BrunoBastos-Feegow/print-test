const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({limit: '50mb'})); // You can adjust the limit as needed

function createStyleBlock(letterhead) {
    return `
    <style>
      .main, .report-content-cell {
        padding-left: ${letterhead.mLeft}px;
        padding-right: ${letterhead.mRight}px;
      }

      .divHeader {
        padding-top: ${letterhead.mTop}px;
        padding-left: ${letterhead.mLeft}px;
        padding-right: ${letterhead.mRight}px;
      }

      .divFooter {
        padding-left: ${letterhead.mLeft}px;
        padding-right: ${letterhead.mRight}px;
        padding-bottom: ${letterhead.mBottom}px;
      }

      .divFooter .rodape {
        text-align: center;
        padding-top: 10px !important;
      }

      /*.report-container page * {*/
      .report-container * {
        font-size: ${letterhead["font-size"] || '17'}px !important;
      }

      /*.report-container page * {*/
      .report-container * {
        line-height: ${letterhead["line-height"]}px;
      }

      /*.report-container page * {*/
      .report-container * {
        color: ${letterhead.color};
      }

      /*.report-container page * {*/
      .report-container * {
        font-family: '${letterhead["font-family"]}' !important;
      }
    </style>
  `;
}

async function getElementHeight(page, selector) {
    return await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const marginTop = parseFloat(style.marginTop) || 0;
        const marginBottom = parseFloat(style.marginBottom) || 0;
        return rect.height + marginTop + marginBottom;
    }, selector);
}

async function getElementWidth(page, selector) {
    return await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        const marginLeft = parseFloat(style.marginLeft) || 0;
        const marginRight = parseFloat(style.marginRight) || 0;
        return rect.width + marginLeft + marginRight;
    }, selector);
}

app.post('/generate-pdf', async (req, res) => {
    // const html = req.body.html;
    // const htmlHeader = req.body.htmlHeader;
    // const htmlFooter = req.body.htmlFooter;
    // const htmlBody = req.body.htmlBody;
    const fullHtml = req.body.fullHtml;
    const letterhead = req.body.letterhead;
    const styleBlock = letterhead ? createStyleBlock(letterhead) : '';

    try {
        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();


        // importing css files
        await page.addStyleTag({path: 'css/pdf.css'});
        // see why bootstrap is messing up the pdf
        await page.addStyleTag({path: 'css/bootstrap.min.css'});
        await page.addStyleTag({path: 'css/normalize.min.css'});
        await page.addStyleTag({path: 'css/patient-interface.css'});
        await page.addStyleTag({path: 'css/jquery.gridster-0-5-6.css'});
        await page.addStyleTag({content: styleBlock});
        await page.addStyleTag({content: `@import url('https://fonts.googleapis.com/css?family=Open+Sans:400,700');`});
        await page.addStyleTag({content: `@import url('https://pro.fontawesome.com/releases/v5.15.4/css/all.css');`});

        // try to adjust size of the page
        await page.addStyleTag({content: `.report-container {max-width: 595.28pt;margin: auto;}`});
        // await page.addStyleTag({content: `img {max-width: 100%;height: auto;}`});
        await page.addStyleTag({content: `#header-content img {max-width: 100% !important;height: auto !important;}`});

        await page.setContent(fullHtml, {waitUntil: 'networkidle0'});

        // evaluate the page and add max-width and height to all the images
        const img_test = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            images.forEach((img) => {
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
            });
            return images[2].src;
        });
        console.log("img_test: ", img_test);


        const {
            headerContent,
            footerContent,
            headerHeight,
            footerHeight,
            headerWidth,
            footerWidth
        } = await page.evaluate(() => {
            // Get header and footer content
            const headerContent = document.querySelector('#header-content').outerHTML;
            const footerContent = document.querySelector('#footer-content').outerHTML;

            // Get header and footer dimensions
            const headerElement = document.querySelector('#header-content');
            const footerElement = document.querySelector('#footer-content');
            const headerRect = headerElement.getBoundingClientRect();
            const footerRect = footerElement.getBoundingClientRect();
            const headerHeight = headerRect.height;
            const footerHeight = footerRect.height;
            const headerWidth = headerRect.width;
            const footerWidth = footerRect.width;

            document.querySelector('#header-content').remove();
            document.querySelector('#footer-content').remove();

            return {headerContent, footerContent, headerHeight, footerHeight, headerWidth, footerWidth};
        });

        console.log("headerHeight: ", headerHeight, "headerWidth: ", headerWidth, "footerHeight: ", footerHeight, "footerWidth: ", footerWidth)
        await page.addStyleTag({
            content: `@page {margin-top: ${(headerHeight) + 5}px; margin-bottom: ${(footerHeight) * 1.5}px; margin-left: 7mm; margin-right: 7mm;}`
        });

        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<style>#header, #footer { padding: 0 !important; margin-left: 5mm; margin-right: 5mm; }</style>
                <div class="header" style="width: 100%;">${headerContent}</div>
            `,
            footerTemplate: `</style><div class="footer" style="width: 100%;">${footerContent}</div>`,
            // margin: { top: `${(headerHeight) * 1.5 + 10}px`, bottom: `${(footerHeight + letterhead.mBottom) * 1.5}px`, left: '7mm', right: '7mm' },
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();

        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send({message: 'Error generating PDF', error});
    }


});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF service listening on port ${PORT}`));
