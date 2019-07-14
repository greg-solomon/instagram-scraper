/*jshint esversion: 8 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const chalk = require('chalk');

class Scraper {
  constructor(userName, numberOfPosts = 25) {
    this.userName = userName;
    this.numberOfPosts = numberOfPosts;
    this.url = `https://instagram.com/` + userName;
    this.items;
    this.start();
  }

  async start() {
    console.log(`username : ${chalk.green(this.userName)} \nnumber of posts to fetch : ${chalk.green(this.numberOfPosts)}\n URL @ : ${chalk.green(this.url)}`);
    this.browser = await puppeteer.launch({
      headless: false
    });

    this.page = await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US'
    });

    await this.page.goto(this.url, {
      waitUntil: 'networkidle2'
    });

    if (await this.page.$('.dialog-404')) {
      console.error('The username you provided may be wrong or the link is broken');
      process.exit();
    }

    console.log(`Valid page found. Going to URL...`);
    this.evaluate();
  }

  async evaluate() {
    try {
      this.items = await this.loadPage(this.numberOfPosts);
    } catch (error) {
      console.error(chalk.red(`There was a problem parsing the page`));
    }

    await this.page.close();
    await this.browser.close();

  }

  async loadPage(maxItems) {
    let page = this.page;
    let previousHeight;
    let media = new Set();
    let index = `.`;
    var imageLinks;
    console.log(chalk.green(`Loading page...`));
    while (maxItems == null || imageLinks.length < maxItems) {
      try {
        previousHeight = await page.evaluate(`document.body.scrollHeight`);
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
        await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
        await page.waitFor(1000);

        console.log(chalk.red(`Scrolling${index}`));

        const links = await page.evaluate(() => {
          console.log('node selected');
          const nodes = document.querySelectorAll(`a`);
          return [].map.call(nodes, link => link.href);
        });

        imageLinks = await links.filter((link) => {
          const linkRegex = /\/(p)\/............/gim;
          // console.log(`Image parsed`);
          return link.match(linkRegex);
        });


        imageLinks.forEach(link => {
          if (media.size < this.maxItems) {
            media.add(link);
            console.log(link);
          }
        });
        index = index + `.`;
      } catch (error) {
        console.error(error);
        break;
      }
      this.items = media;
      this.buildJSON;


    }




    return imageLinks;
  }

  async fetchMetaData() {
    console.log(chalk.blue(`Fetching metadata...`));
    for (const link in imageLinks) {
      // go to each link, scrape the caption, number of likes, and get media type
      console.log(link);
      const linkPage = await this.browser.newPage(link);
      try {
        await linkPage.evaluate(() => {
          const text = document.getElementsByClassName('C4VMK > span').text;
          console.log(text);
          const likes = document.getElementsByClassName('Nm9Fw');
          console.log(likes);
          let mediaType;
          if (document.getElementsByClassName('QvAa1').length) {
            mediaType = "video";
          } else {
            mediaType = "photo";
          }

          let object = {
            link: link,
            text: text,
            likes: likes,
            mediaType: mediaType
          };

          media.add(object);

          linkPage.close();

        });
      } catch (error) {
        console.error(error);
      }
    }
  }

  async buildJSON() {
    var tmp = [];
    this.items.forEach(url => {
      tmp.push({
        "img": url
      });
    });
    fs.writeFileSync(`./json/${this.userName}_nodes.json`, JSON.stringify(tmp));
  }




}

module.exports = Scraper;