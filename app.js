const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // You can adjust the limit as needed

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

app.post('/generate-pdf', async (req, res) => {
    // const html = req.body.html;
    const htmlHeader = req.body.htmlHeader;
    const htmlFooter = req.body.htmlFooter;
    const htmlBody = req.body.htmlBody;
    const fullHtml = req.body.fullHtml;
    const letterhead = req.body.letterhead;
    const styleBlock = letterhead ? createStyleBlock(letterhead) : '';

    try {
        const browser = await puppeteer.launch({args: ['--no-sandbox']});
        const page = await browser.newPage();

        await page.setContent(fullHtml, {waitUntil: 'networkidle0'});
        // get the height in pixels of the elemendt with id #header-content so we can use it to set the margin-top avoiding the header to be cut off or overleaf
        // const teste = await page.$eval('#header-content', el => 'offsetHeight: ' + el.offsetHeight + 'clientHeight: ' + el.clientHeight + 'scrollHeight: ' + el.scrollHeight + 'offsetTop: ' + el.offsetTop + 'clientTop: ' + el.clientTop + 'scrollTop: ' + el.scrollTop + 'offsetLeft: ' + el.offsetLeft + 'clientLeft: ' + el.clientLeft + 'scrollLeft: ' + el.scrollLeft + 'offsetWidth: ' + el.offsetWidth + 'clientWidth: ' + el.clientWidth + 'scrollWidth: ' + el.scrollWidth + 'offsetParent: ' + el.offsetParent + 'style: ' + el.style + 'style.height: ' + el.style.height + 'style.width: ' + el.style.width + 'style.top: ' + el.style.top + 'style.left: ' + el.style.left + 'style.bottom: ' + el.style.bottom + 'style.right: ' + el.style.right + 'style.padding: ' + el.style.padding + 'style.margin: ' + el.style.margin + 'style.border: ' + el.style.border + 'style.position: ' + el.style.position + 'style.overflow: ' + el.style.overflow + 'style.overflowX: ' + el.style.overflowX + 'style.overflowY: ' + el.style.overflowY + 'style.display: ' + el.style.display + 'style.visibility: ' + el.style.visibility + 'style.zIndex: ' + el.style.zIndex + 'style.transform: ' + el.style.transform + 'style.transformOrigin: ' + el.style.transformOrigin + 'style.transformStyle: ' + el.style.transformStyle + 'style.transformBox: ' + el.style.transformBox + 'style.transformOrigin: ' + el.style.transformOrigin);
        // console.log("teste: ", teste)


        const headerContent = await page.$eval('#header-content', el => el.outerHTML);
        const headerHeightA = await page.$eval('#header-content', el => el.offsetHeight || 0);
        const footerContent = await page.$eval('#footer-content', el => el.outerHTML);
        const footerHeightA = await page.$eval('#footer-content', el => el.offsetHeight || 0);

        const headerHeight = await getElementHeight(page, '#header-content');
        const footerHeight = await getElementHeight(page, '#footer-content');

        console.log("headerHeightA: ", headerHeightA, "footerHeightA: ", footerHeightA, "headerHeight: ", headerHeight, "footerHeight: ", footerHeight)

        // console.log("headerHeight: ", headerHeight, "footerHeight: ", footerHeight)

        // Remove the original header and footer content from the page
        await page.evaluate(() => {
            const header = document.querySelector('#header-content');
            const footer = document.querySelector('#footer-content');
            if (header) header.remove();
            if (footer) footer.remove();
        });

        await page.addStyleTag({path: 'css/pdf.css'});
        // await page.addStyleTag({path: 'css/bootstrap.min.css'});
        await page.addStyleTag({path: 'css/normalize.min.css'});
        await page.addStyleTag({path: 'css/patient-interface.css'});
        await page.addStyleTag({path: 'css/jquery.gridster-0-5-6.css'});

        // console.log("styleBlock: ", styleBlock)

        await page.addStyleTag({ content: styleBlock });
        await page.addStyleTag({content: `@import url('https://fonts.googleapis.com/css?family=Open+Sans:400,700');`});
        await page.addStyleTag({content: `@import url('https://pro.fontawesome.com/releases/v5.15.4/css/all.css');`});

        await page.addStyleTag({
            content: `@page {margin-top: ${(headerHeight) + 5}px; margin-bottom: ${(footerHeight) * 1.5}px; margin-left: 7mm; margin-right: 7mm;}`
        });


        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate:`<style>#header, #footer { padding: 0 !important; margin-left: 5mm; margin-right: 5mm; }</style><div class="header" style="width: 100%; border:1px solid;">${headerContent}</div>`,
            footerTemplate:`</style><div class="footer" style="width: 100%; border:1px solid;">${footerContent}</div>`,
            // margin: { top: `${(headerHeight) * 1.5 + 10}px`, bottom: `${(footerHeight + letterhead.mBottom) * 1.5}px`, left: '7mm', right: '7mm' },
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        await browser.close();

        res.contentType('application/pdf');
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send({ message: 'Error generating PDF', error });
    }


});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PDF service listening on port ${PORT}`));
