const puppeteer = require("puppeteer");
const request = require("request-promise");
const cheerio = require("cheerio");
const fs = require("fs");
const { performance } = require("perf_hooks");

const getProfile = async (USERNAME, verbose) => {
  // Get profile from script tag
  let profileTime0;
  if (verbose) {
    profileTime0 = performance.now();
  }
  BASE_URL = `https://instagram.com/${USERNAME}`;

  try {
    let response = await request(BASE_URL, {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "accept-language":
        "en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
    });

    let $ = cheerio.load(response);

    let script = $("script")
      .eq(4)
      .html();

    if (/window\._sharedData = (.+);/g.exec(script) === null) {
      script = $("script")
        .eq(3)
        .html();
    }

    let {
      entry_data: {
        ProfilePage: {
          [0]: {
            graphql: { user }
          }
        }
      }
    } = JSON.parse(/window\._sharedData = (.+);/g.exec(script)[1]);

    const { full_name, biography, profile_pic_url_hd } = user;

    const profile = {
      username: USERNAME,
      full_name: full_name,
      biography: biography,
      profile_pic: profile_pic_url_hd
    };
    if (verbose) {
      const profileTime1 = performance.now();
      console.log(`Profile fetch time : ${profileTime1 - profileTime0} ms`);
    }

    return profile;
  } catch (err) {
    console.error(err.message);
    console.error(`Cannot fetch ${USERNAME}'s data`);
  }
};

const getPosts = async (USERNAME, postsToFetch, verbose) => {
  // get posts with puppeteer
  let postsTime0;
  if (verbose) {
    postsTime0 = performance.now();
  }
  const url = `https://instagram.com/${USERNAME}`;
  const browser = await puppeteer.launch({});

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US"
  });

  await page.goto(url, {
    waitUntil: "networkidle0"
  });
  if (verbose) console.log(`Going to ${url}...`);

  if (await page.$(`.dialog-404`)) {
    process.exit();
  }

  let media = [];
  let previousHeight;
  let scrollHeight;

  try {
    let toBreak = false;
    while (
      (await page.evaluate(`document.body.scrollHeight`)) <
        postsToFetch * 200 ||
      media.length < postsToFetch
    ) {
      // Fetch links to individual posts
      const allLinks = await page.evaluate(() => {
        const links = document.querySelectorAll(
          `article > div > div > div > div > a`
        );
        return [].map.call(links, link => link.href);
      });

      if (allLinks.length < 24) {
        postsToFetch = allLinks.length - 1;
        toBreak = true;
      }

      for (let i = 0; i < allLinks.length; i++) {
        media.push(allLinks[i]);
      }

      if (toBreak) return media;

      // Scroll Page
      previousHeight = await page.evaluate(`document.body.scrollHeight`);
      await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
      await page.waitForFunction(
        `document.body.scrollHeight > ${previousHeight}`
      );
      scrollHeight = await page.evaluate(`document.body.scrollHeight`);
    }
  } catch (err) {
    console.error(err.message);
  }

  await browser.close();
  return media;
};

const getPostData = async (post, verbose) => {
  // get post data from script tags
  let postDataTime0;
  if (verbose) {
    postDataTime0 = performance.now();
  }

  try {
    let response = await request(post, {
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "accept-encoding": "gzip, deflate, br",
      "accept-language":
        "en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3",
      "cache-control": "max-age=0",
      "upgrade-insecure-requests": "1",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
    });

    let $ = cheerio.load(response);

    let script = $("script")
      .eq(4)
      .html();

    if (/window\._sharedData = (.+);/g.exec(script) === null) {
      script = $("script")
        .eq(3)
        .html();
    }

    const likes = $("meta[name='description']")
      .attr("content")
      .split(",")[0];
    const {
      entry_data: {
        PostPage: {
          [0]: {
            graphql: {
              shortcode_media: {
                display_url,
                edge_media_to_caption: {
                  edges: {
                    [0]: {
                      node: { text }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } = JSON.parse(/window\._sharedData = (.+);/g.exec(script)[1]);

    let count;
    const JSONObj = JSON.parse(/window\._sharedData = (.+);/g.exec(script)[1]);

    if (
      typeof JSONObj.entry_data.PostPage[0].graphql.shortcode_media
        .edge_media_to_parent_comment === "undefined"
    ) {
      count = "";
    } else {
      count =
        JSONObj.entry_data.PostPage[0].graphql.shortcode_media
          .edge_media_to_parent_comment.count;
    }

    metaObj = {
      pic: display_url,
      text: text,
      numberOfComments: count,
      likes
    };
    if (verbose) {
      const postDataTime1 = performance.now();
      console.log(
        `Time to fetch post data : ${postDataTime1 - postDataTime0} ms`
      );
    }

    return metaObj;
  } catch (err) {
    console.error(err.message);
    console.log(post);
  }
};

const getFollowers = async (USERNAME, verbose) => {
  let followTime0;
  if (verbose) {
    followTime0 = performance.now();
  }

  const url = `https://instagram.com/${USERNAME}`;
  const browser = await puppeteer.launch({});

  const page = await browser.newPage();

  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US"
  });

  await page.goto(url, {
    waitUntil: "networkidle0"
  });

  if (await page.$(`.dialog-404`)) {
    process.exit();
  }

  try {
    const follows = await page.evaluate(() => {
      const nodes = document.querySelectorAll(".g47SY");
      return [].map.call(nodes, node => node.innerText);
    });
    await browser.close();
    var followObj = {};
    followObj.numberOfPosts = follows[0];
    followObj.followers = follows[1];
    followObj.following = follows[2];
    if (verbose) {
      const followTime1 = performance.now();
      console.log(`Followers time taken: ${followTime1 - followTime0} ms`);
    }

    return followObj;
  } catch (err) {
    console.error(err.message);
  }
};

const scraperApp = async (
  user,
  postsToFetch = 20,
  writeFile = false,
  verbose = false
) => {
  if (verbose) var t0 = performance.now();

  const profile = await getProfile(user, verbose);
  const posts = await getPosts(user, postsToFetch, verbose);
  const follows = await getFollowers(user, verbose);
  const { username, full_name, biography, profile_pic } = profile;
  const { numberOfPosts, followers, following } = follows;

  var postsObj = {
    username: username,
    full_name: full_name,
    biography: biography,
    profile_pic: profile_pic,
    numberOfPosts: numberOfPosts,
    followers: followers,
    following: following
  };

  postsObj.items = [];

  for (var post of posts) {
    const p = await getPostData(post);
    postsObj.items.push(p);
  }

  if (writeFile) {
    if (!fs.existsSync("./json")) {
      fs.mkdirSync("./json");
    }

    fs.writeFileSync(`./json/${user}.json`, JSON.stringify(postsObj));
  }
  if (verbose) {
    var t1 = performance.now();
    console.log(`Total time taken ${(t1 - t0) / 1000} s`);
  }

  return postsObj;
};

module.exports.getProfile = getProfile;
module.exports.getPosts = getPosts;
module.exports.getPostData = getPostData;
module.exports.getFollowers = getFollowers;
module.exports.scraperApp = scraperApp;
