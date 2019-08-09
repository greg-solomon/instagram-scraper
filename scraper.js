const puppeteer = require('puppeteer');
const request = require('request-promise');
const cheerio = require('cheerio');
const fs = require('fs');

const getProfile = async (USERNAME) => {
    // Get profile from script tag
    BASE_URL = `https://instagram.com/${USERNAME}`;

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


        let script = $("script").eq(4).html();
        if (/window\._sharedData = (.+);/g.exec(script) === null) {
            script = $("script").eq(3).html();
        }


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

        const profile = {
            username: USERNAME,
            full_name: full_name,
            biography: biography,
            profile_pic: profile_pic_url_hd
        };

        return profile;
    } catch (err) {
        console.error(err.message);
        console.error(`Cannot fetch ${USERNAME}'s data`);
    }
}

const getPosts = async (USERNAME, postsToFetch) => {
    // get posts with puppeteer
    const url = `https://instagram.com/${USERNAME}`;
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
    while (await page.evaluate(`document.body.scrollHeight`) < postsToFetch * 200 || media.length < postsToFetch) {

        // Scroll Page
        previousHeight = await page.evaluate(`document.body.scrollHeight`);
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
        await page.waitForFunction(
            `document.body.scrollHeight > ${previousHeight}`
        );
        scrollHeight = await page.evaluate(`document.body.scrollHeight`);


        // Fetch links to individual posts
        const allLinks = await page.evaluate(() => {
            const links = document.querySelectorAll(
                `article > div > div > div > div > a`
            );
            return [].map.call(links, link => link.href);
        });


        for (let i = 0; i < allLinks.length; i++) {
            media.push(allLinks[i]);
        }
    }

    await browser.close();
    return media;
}

const getPostData = async (post) => {

    // get post data from script tags
    let response = await request(post, {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3",
        "cache-control": "max-age=0",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36"
    });

    let $ = cheerio.load(response);

    let script = $("script").eq(4).html();


    let {
        entry_data: {
            PostPage: {
                [0]: {
                    graphql: {
                        shortcode_media: {
                            display_url
                        }
                    }
                }
            }
        }
    } = JSON.parse(/window\._sharedData = (.+);/g.exec(script)[1]);

    let meta = $("script").eq(3).html();
    let {
        description
    } = JSON.parse(meta);

    metaObj = {
        pic: display_url,
        desc: description
    };


    return metaObj;

}


const app = async (user, postsToFetch) => {
    const profile = await getProfile(user);
    const posts = await getPosts(user, postsToFetch);
    const {
        username,
        full_name,
        biography,
        profile_pic
    } = profile;

    var postsObj = {
        username: username,
        full_name: full_name,
        biography: biography,
        profile_pic: profile_pic
    }

    postsObj.items = [];

    for (var post of posts) {
        const p = await getPostData(post);
        postsObj.items.push(p);
    }

    if (!fs.existsSync('./json')) {
        fs.mkdirSync('./json');
    }
    console.log(postsObj);
    fs.writeFileSync(`./json/${user}.json`, JSON.stringify(postsObj));
}