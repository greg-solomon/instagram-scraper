/*jshint esversion: 8 */
const puppeteer = require("puppeteer");
const fs = require("fs");
const chalk = require("chalk");

class Scraper {
  constructor(userName, numberOfPosts = 25) {
    this.userName = userName;
    this.name = "";
    if (numberOfPosts > 50) {
      this.numberOfPosts = 50;
      console.log(`Maximum number of posts to fetch is 50`);
    } else {
      this.numberOfPosts = numberOfPosts;
    }
    this.url = `https://instagram.com/` + userName;
    this.items = [];
    this.start();
  }

  async start() {
    console.log(
      `username : ${chalk.green(
        this.userName
      )} \nnumber of posts to fetch : ${chalk.green(
        this.numberOfPosts
      )}\n URL @ : ${chalk.green(this.url)}`
    );
    this.browser = await puppeteer.launch();

    this.page = await this.browser.newPage();

    await this.page.setExtraHTTPHeaders({
      "Accept-Language": "en-US"
    });

    await this.page.goto(this.url, {
      waitUntil: "networkidle2"
    });

    if (await this.page.$(".dialog-404")) {
      console.error(
        "The username you provided may be wrong or the link is broken"
      );
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
      process.exit();
    }
    await this.fetchMetaData();
  }

  async loadPage() {
    const maxItems = this.numberOfPosts;
    var page = this.page;
    let previousHeight;
    var media = new Set();
    var index = `.`;

    // this code block is adapted code from https://github.com/adimango/insights-for-instagram-scraper
    while (maxItems == null || media.size < maxItems) {
      try {
        previousHeight = await page.evaluate(`document.body.scrollHeight`);
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);

        await page.waitFor(1000);

        const nodes = await page.evaluate(() => {
          const links = document.querySelectorAll(`a`);
          return [].map.call(links, link => link.href);
        });

        this.name = await page.evaluate(() => {
          return document.querySelector("h1.rhpdm").innerHTML;
        });

        const linkRegEx = /\/(p)\/............/gim;
        const links = await nodes.filter(link => {
          return link.match(linkRegEx);
        });
        links.forEach(element => {
          if (media.size < maxItems) {
            media.add(element);
          }
        });
      } catch (error) {
        console.error(error);
        break;
      }
      return media;
    }
  }

  async buildJSON(posts) {
    console.log(chalk.yellow(`Writing JSON...`));
    var tmp = {};

    tmp.username = this.userName;
    tmp.name = this.name;
    tmp.posts = posts;

    if (!fs.existsSync('./json')) {
      fs.mkdirSync('./json');
    }
    fs.writeFileSync(`./json/${this.userName}_nodes.json`, JSON.stringify(tmp));
    await this.page.close();
    await this.browser.close();
  }

  async fetchMetaData() {
    let posts = {};

    console.log(chalk.red(`Fetching data from individual posts...`));

    let items = this.items;
    for (var item of items) {
      await this.page.goto(item, {
        waitUntil: "networkidle2"
      });

      if (await this.page.$(".dialog-404")) {
        console.error(
          "The username you provided may be wrong or the link is broken"
        );
        process.exit();
      }

      // TEXT QUERY   --> div.C4VMK > span
      // LIKES QUERY  --> div.Nm9Fw > button > span
      // IMG SRC      --> div.KL4BH > img.src
      let sources = await this.page.evaluate(() => {
        const tmp = document.querySelectorAll("div.KL4Bh > img");
        return [].map.call(tmp, img => img.src);
      });

      let text = await this.page.evaluate(() => {
        if (document.querySelector("div.C4VMK > span") === null) {
          return "";
        } else {
          return document.querySelector("div.C4VMK > span").innerHTML;
        }
      });


      let likes = await this.page.evaluate(() => {
        if (document.querySelector("div.Nm9Fw") !== null) {
          let tmp = document
            .querySelector("div.Nm9Fw")
            .innerHTML.slice(
              55,
              document.querySelector("div.Nm9Fw").innerHTML.length - 17
            );
          let num = tmp.replace(/,/g, "");
          num = parseInt(num);
          return num + 1;
        }
      });

      // if likes is null, then it is a video, not a picture

      var obj = {};
      obj.src = sources[0];
      obj.text = text;
      obj.likes = likes;
      posts[item] = obj;
    }

    await this.buildJSON(posts);
  }
}

module.exports = Scraper;