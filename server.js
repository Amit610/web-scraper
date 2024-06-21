const puppeteer = require('puppeteer-extra')
const express = require("express");
const chromium = require("@sparticuz/chromium");
const xlsx = require("xlsx");
const path = require("path");
require("dotenv").config();
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function getCompData(url, page) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); 
  await page.goto(url);
  const name = await page.$eval(
    ".table tbody td:nth-child(2) p",
    (p) => p.textContent
  );
  const status = await page.$eval(
    ".table tbody tr:nth-child(2) td:nth-child(2) p",
    (p) => p.textContent
  );
  const cat = await page.$eval(
    ".table tbody tr:nth-child(5) td:nth-child(2) p",
    (p) => p.textContent
  );
  const coc = await page.$eval(
    ".table tbody tr:nth-child(7) td:nth-child(2) p",
    (p) => p.textContent
  );
  const doi = await page.$eval(
    ".table tbody tr:nth-child(8) td:nth-child(2) p",
    (p) => p.textContent
  );
  const director = await page.$eval(
    "tr#package1 td:nth-child(2) p a",
    (a) => a.textContent
  );
  // PaidupCapital  and AuthorisedCapital
  // const tables = await page.$$(".table.table-striped");
  // let authorisedCapital = "";
  // let paidUpCapital = "";

  // for (const table of tables) {
  //   const rows = await table.$$("tr");
  //   for (const row of rows) {
  //     const cells = await row.$$eval("td p", (tds) =>
  //       tds.map((td) => td.textContent.trim())
  //     );
  //     if (cells.length === 2) {
  //       const [key, value] = cells;
  //       if (key === "Authorised Capital") {
  //         authorisedCapital = value;
  //       } else if (key === "Paid up capital") {
  //         paidUpCapital = value;
  //       }
  //     }
  //   }
  // }
  // Extracting Cloudflare protected email attribute string
  const cfEmailElement = await page.$("a.__cf_email__");
  let decodedEmail = "";

  if (cfEmailElement) {
    const cfEmailEncodedString = await page.evaluate(
      (element) => element.getAttribute("data-cfemail"),
      cfEmailElement
    );

    // Decoding Cloudflare protected email
    function cfDecodeEmail(encodedString) {
      let email = "";
      const r = parseInt(encodedString.substr(0, 2), 16);
      for (let n = 2; n < encodedString.length; n += 2) {
        const charCode = parseInt(encodedString.substr(n, 2), 16) ^ r;
        email += String.fromCharCode(charCode);
      }
      return email;
    }

    decodedEmail = cfDecodeEmail(cfEmailEncodedString);
  }

  return {
    Name: name,
    IsActive: status,
    catagory: cat,
    Director: director,
    isGovernment: coc,
    inougration: doi,
    Email: decodedEmail,
    // AuthorisedCapital: authorisedCapital,
    // PaidUpCapital: paidUpCapital,
  };
}

async function getLinks(url, page) {
  
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 }); // Increased timeout to 120 seconds

  
  // Add more debugging information
  console.log("Waiting for .table selector");

  
 // Check if the selector exists on the page
 const tableExists = await page.$('.table') !== null;
 console.log("Table exists:", tableExists);

 if (!tableExists) {
   console.log("Table not found on the page");
   return [];
 }

 await page.waitForSelector('.table a', { timeout: 120000, visible: true }); // Wait for the table to be visible

 console.log("Selector found, extracting links");
  
  return await page.$$eval(".table a", (links) => links.map((a) => a.href));
}

app.post("/scrape", async (req, res) => {
  const { url } = req.body;
  let browser;
  try {
    console.log("Launching browser...");
    browser = await  puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        // "--disable-dev-shm-usage",
        // "--disable-accelerated-2d-canvas",
        // "--no-first-run",
        "--no-zygote",
        // "--single-process",
        "--disable-gpu",
      ],
      executablePath:
        process.env.NODE_ENV === "production"
          ? process.env.PUPPETEER_EXECUTABLE_PATH
          : puppeteer.executablePath(),
      // args: chromium.args,
      // defaultViewport: chromium.defaultViewport,
      // executablePath: await chromium.executablePath(),
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    console.log(`Navigating to ${url}`);
    const allLinks = await getLinks(url, page);
    console.log(`Found ${allLinks.length} links`);

    const scrappedData = [];
    for (const link of allLinks) {
      console.log(`Scraping data from ${link}`);
      const data = await getCompData(link, page);
      scrappedData.push(data);
    }
    console.log("Scraping completed, creating Excel file.");
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(scrappedData);
    xlsx.utils.book_append_sheet(wb, ws, "Sheet1");

    // Write workbook to base64
    const wbout = xlsx.write(wb, { type: "base64", bookType: "xlsx" });

    res.json({ file: wbout });
  } catch (error) {
    res
      .status(500)
      .json({ message: `An error occurred during scraping: ${error.message}` });
  } finally {
    if (browser) await browser.close();
  }
});

app.get("/download", (req, res) => {
  const file = path.join(__dirname, req.query.file);
  res.download(file);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {});
