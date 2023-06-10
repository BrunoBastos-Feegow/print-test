const fs = require('fs');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({limit: '50mb'})); // You can adjust the limit as needed

function createStyleBlock(letterhead) {
    const mLeft = letterhead.mLeft || 0;
    const mRight = letterhead.mRight || 0;
    const mTop = letterhead.mTop || 0;
    const mBottom = letterhead.mBottom || 0;
    const fontSize = letterhead["font-size"] || 14;
    const lineHeight = letterhead["line-height"]|| 1.1;
    const color = letterhead.color || '#000';
    const fontFamily = letterhead["font-family"] || '"Open Sans", sans-serif';

    return `
    <style>
      .main, .report-content-cell {
        padding-left: ${mLeft}px;
        padding-right: ${mRight}px;
      }

      .divHeader {
        padding-top: ${mTop}px;
        padding-left: ${mLeft}px;
        padding-right: ${mRight}px;
      }

      .divFooter {
        padding-left: ${mLeft}px;
        padding-right: ${mRight}px;
        padding-bottom: ${mBottom}px;
      }

      .rodape {
        text-align: center;
        padding-top: 10px !important;
        font-size: 10px !important;
      }

      .report-container * {
        font-size: ${fontSize}px !important;
        line-height: ${lineHeight}rem !important;
        color: ${color} !important;
        font-family: ${fontFamily} !important;
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
    const fullHtml = req.body.fullHtml;
    const letterhead = req.body.letterhead;
    const styleBlock = letterhead ? createStyleBlock(letterhead) : '';

    try {
        const browser = await puppeteer.launch({headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
                '--hide-scrollbars',
                '--disable-web-security',
            ]});
        const page = await browser.newPage();
        //set the recieved html as the page content
        await page.setContent(fullHtml, {waitUntil: 'networkidle0'});
        // await page.goto('data:text/html;charset=UTF-8,' + fullHtml, {waitUntil: 'networkidle0'});

        await page.addStyleTag({content: styleBlock});
        //// importing css files
        await page.addStyleTag({path: 'css/pdf.css'});
        //// see why bootstrap is messing up the pdf
        await page.addStyleTag({path: 'css/bootstrap.min.css'});
        await page.addStyleTag({path: 'css/normalize.min.css'});
        await page.addStyleTag({path: 'css/patient-interface.css'});
        await page.addStyleTag({path: 'css/jquery.gridster-0-5-6.css'});
        await page.addStyleTag({path: 'css/open-sans.css'});
        await page.addStyleTag({path: 'css/fontawesome-all.css'});

        //// try to adjust size of the page
        // await page.addStyleTag({content: `.report-container {max-width: 595.28pt;margin: auto;}`});
        // await page.addStyleTag({content: `img {max-width: 100%;height: auto;}`});
        // await page.addStyleTag({content: `img {max-width: 100%;}`});
        // await page.addStyleTag({content: `#header-content img {max-width: 100% !important;height: auto !important;}`});

        // evaluate the page and add max-width and height to all the images that exceed the page width
        await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const pageWidth = document.querySelector('.report-container').offsetWidth;
            images.forEach((img) => {
                const imgWidth = img.width || window.getComputedStyle(img).getPropertyValue('width');
                if(imgWidth >= pageWidth) {
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                }
            });
        });

        const {
            headerContent,
            footerContent,
            headerHeight,
            footerHeight,
        } = await page.evaluate(async () => {
            // Wait for all images to load
            const headerImages = Array.from(document.querySelectorAll('#header-content img'));
            const footerImages = Array.from(document.querySelectorAll('#footer-content img'));
            const imagePromises = [...headerImages, ...footerImages].map(img => {
                if (img.complete) return;
                return new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });
            });
            await Promise.all(imagePromises);

            // Get header and footer content
            const headerContent = document.querySelector('#header-content').outerHTML;
            const footerContent = document.querySelector('#footer-content').outerHTML;
            // Get header and footer dimensions
            const headerElement = document.querySelector('#header-content');
            const footerElement = document.querySelector('#footer-content');

            const headerStyle = window.getComputedStyle(headerElement);
            const footerStyle = window.getComputedStyle(footerElement);

            //get the element height
            let headerTmpHeight = headerElement.offsetHeight;
            if(headerTmpHeight === 0) {
                const img = headerElement.querySelector('img');
                headerTmpHeight = (img.offsetHeight || img.height) * 1.3;
            }
            const headerHeight = headerTmpHeight +
                parseFloat(headerStyle.marginTop) +
                parseFloat(headerStyle.marginBottom) +
                parseFloat(headerStyle.borderTopWidth) +
                parseFloat(headerStyle.borderBottomWidth);

            let footerTmpHeight = footerElement.offsetHeight;
            if(footerTmpHeight === 0) {
                const img = footerElement.querySelector('img');
                footerTmpHeight = (img.offsetHeight || img.height) * 1.3;
            }
            const footerHeight = footerTmpHeight +
                parseFloat(footerStyle.marginTop) +
                parseFloat(footerStyle.marginBottom) +
                parseFloat(footerStyle.borderTopWidth) +
                parseFloat(footerStyle.borderBottomWidth);

            //remove the header and footer
            document.querySelector('#header-content').remove();
            document.querySelector('#footer-content').remove();

            return {headerContent, footerContent, headerHeight, footerHeight};
        });

        const inchHeaderHeight = headerHeight / 96 + 0.5; // convert pixel to inches
        const inchFooterHeight = footerHeight / 96 + 0.5; // convert pixel to inches
        console.log(headerHeight, inchHeaderHeight, footerHeight, inchFooterHeight);
        //no need of marging as the header and footer are hidden and will keep the space
        await page.addStyleTag({
            // content: `@page:first {margin-top: ${headerHeight * 1.2}px; margin-bottom: ${footerHeight * 1.2}px; margin-left: 7mm; margin-right: 7mm;}@page {margin-top: ${(headerHeight * 1.2)}px; margin-bottom: ${footerHeight * 1.2}px; margin-left: 7mm; margin-right: 7mm;}`
            content: `@page:first {margin-top: ${inchHeaderHeight}in; margin-bottom: ${inchFooterHeight}in; margin-left: 7mm; margin-right: 7mm;}@page {margin-top: ${(inchHeaderHeight + 0.5)}in; margin-bottom: ${inchFooterHeight}in; margin-left: 7mm; margin-right: 7mm;}`
        });

        await page.addStyleTag({content: `div.gridster ul li { list-style: none !important; }`});
        await page.addScriptTag({path: 'js/jquery-3.3.1.min.js'});
        await page.addScriptTag({path: 'js/jquery.gridster-0-5-6.js'});
        const inlineScripts = await page.$$eval('script', scripts => scripts.map(s => s.innerHTML));
        for (const inlineScript of inlineScripts) {
            await page.evaluate(inlineScript);
        }

        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: `<style>#header, #footer { padding: 0 !important; margin-left: 5mm; margin-right: 5mm; }</style>
                <div class="header" style="width: 100%;">${headerContent}</div>
            `,
            footerTemplate: `</style><div class="footer" style="width: 100%;">${footerContent}</div>`,
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