const request = require("request-promise");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");

const fetchProfile = async (USERNAME) => {
  const BASE_URL = `https://www.instagram.com/${USERNAME}/`;

  // Fetch the easy to grab data, code block from https://learnscraping.com/scraping-instagram-profile-data-with-nodejs/
  try {
    let response = await request(BASE_URL, {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "accept-language": "en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
    });

    let $ = cheerio.load(response);

    let script = $("script")
      .eq(4)
      .html();

    let {
      entry_data: {
        ProfilePage: {
          [0]: {
            graphql: {
              user
            }
          }
        }
      }
    } = JSON.parse(/window\._sharedData = (.+);/g.exec(script)[1]);

    const {
      full_name,
      biography,
      profile_pic_url_hd
    } = user;

    // console.log(`${full_name}\n${biography}\n${profile_pic_url_hd}\n`);

    const profile = {
      username: USERNAME,
      full_name: full_name,
      biography: biography,
      profile_pic: profile_pic_url_hd
    };

    return profile;
  } catch (err) {
    console.error(`Can't fetch ${USERNAME}'s data`);
  }
};

const fetchPosts = async (postsToFetch, profile) => {
  const url = `https://instagram.com/${profile.username}`;
  const browser = await puppeteer.launch({});

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US"
  });

  await page.goto(url, {
    waitUntil: "networkidle0"
  });

  console.log(`Going to ${url}...`);

  if (await page.$(`.dialog-404`)) {
    process.exit();
  }

  let media = [];
  let previousHeight;
  let scrollHeight;
  while (
    (await page.evaluate(`document.body.scrollHeight`)) < postsToFetch * 200 &&
    media.length < postsToFetch
  ) {
    previousHeight = await page.evaluate(`document.body.scrollHeight`);
    await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await page.waitForFunction(
      `document.body.scrollHeight > ${previousHeight}`
    );
    scrollHeight = await page.evaluate(`document.body.scrollHeight`);

    // console.log(scrollHeight);

    const allLinks = await page.evaluate(() => {
      const links = document.querySelectorAll(
        `article > div > div > div > div > a`
      );
      return [].map.call(links, link => link.href);
    });

    const linkRegEx = /.........................\/p\/..........*/gi;
    const toAdd = allLinks.filter(link => {
      return link.match(linkRegEx);
    });

    for (let i = 0; i < toAdd.length; i++) {
      media.push(toAdd[i]);
    }
  }

  await browser.close();

  return media;
};

const fetchMetaData = async (posts) => {
  try {
    console.log(`fetching data from ${posts.length} posts...`);

    const browser = await puppeteer.launch();

    var allPosts = {};

    for (var url of posts) {
      const page = await browser.newPage();

      await page.setExtraHTTPHeaders({
        "Accept-Language": "en-US"
      });

      await page.goto(url, {
        waitUntil: "networkidle2"
      });

      const imgSrc = await page.evaluate(() => {
        if (document.querySelectorAll("div.KL4Bh > img")) {
          const tmp = document.querySelectorAll("div.KL4Bh > img");
          return [].map.call(tmp, img => img.src);
        } else {
          return "Video";
        }
      });

      const text = await page.evaluate(() => {
        if (document.querySelector("div.C4VMK > span") === null) {
          return "";
        } else {
          return document.querySelector("div.C4VMK > span").innerHTML;
        }
      });

      let likes = await page.evaluate(() => {
        if (document.querySelector("div.Nm9Fw > button > span") !== null) {
          let temp = document.querySelector("div.Nm9Fw > button > span")
            .innerHTML;
          let numStr = temp.replace(/,/g, "");
          let num = parseInt(numStr);
          return num + 1;
        }
      });

      var postObj = {};

      postObj.src = imgSrc;
      postObj.likes = likes;
      postObj.text = text;

      allPosts[url] = postObj;

      await page.close();
    }
    await browser.close();
    return allPosts;

  } catch (err) {
    console.error(err);
  }
};

const app = async () => {
  const profile = await fetchProfile("marniethedog");

  const posts = await fetchPosts(30, profile);

  const postData = await fetchMetaData(posts);


  if (!fs.existsSync("./json")) {
    fs.mkdir("./json");
  }

  var data = {};
  data.profile = profile;
  data.posts = postData;
  fs.writeFileSync(
    `./json/${profile.username}_nodes.json`,
    JSON.stringify(data)
  );

  console.log(`JSON written`);
  return data;

}

app();