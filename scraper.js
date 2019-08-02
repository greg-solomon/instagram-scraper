const puppeteer = require('puppeteer');
const fs = require('fs');


async function getPosts(user, postsToFetch) {
  url = `https://instagram.com/${user}`;
  let media = [];
  let previousHeight;
  try {
    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US"
    });

    await page.goto(url, {
      waitUntil: "networkidle2"
    });

    if (await page.$(".dialog-404")) {
      console.error("The username you provided may be wrong or the link is broken");
      process.exit();
    }

    while (media.length < postsToFetch) {
      try {
        previousHeight = await page.evaluate(`document.body.scrollHeight`);
        await page.evaluate(`window.scrollTo(0, document.body.scrollHeight)`);



        const allLinks = await page.evaluate(() => {
          const links = document.querySelectorAll('a');
          return [].map.call(links, link => link.href);
        });


        const linkRegEx = /.........................\/p\/..........*/gi;

        const picLinks = await allLinks.filter(link => {

          return link.match(linkRegEx);
        });

        if (picLinks.length < postsToFetch) {
          postsToFetch = picLinks.length;
        }

        picLinks.forEach(element => {
          
          if (media.length < postsToFetch) media.push(element);
        });

      } catch (err) {
        console.error(err);
        break;
      }
      await browser.close();
      return media;
    }
  } catch (err) {
    console.error(err.message);
    process.exit();
  }
}

async function getNameAndProfilePicture(user) {
  const url = `https://instagram.com/${user}`;
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US"
    });

    await page.goto(url, {
      waitUntil: "networkidle2"
    });

    if (await page.$(".dialog-404")) {
      console.error("The username you provided may be wrong or the link is broken");
      process.exit();
    }



    let name = await page.evaluate(() => {
      return document.querySelector("h1.rhpdm").innerHTML;
    });

    let profilePicture = await page.evaluate(() => {
      return document.querySelector("img._6q-tv").src;
    });

    await browser.close();
    

    let obj = {
      name: await name,
      displayPic: await profilePicture
    }

    return obj;
  } catch (err) {
    console.error(err.message);
    process.exit();
  }


}

async function getPostData(url) {
  // for each post, go to url, extract img src, caption, and likes
 
  try {

    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US"
    });


    await page.goto(url, {
      waitUntil: "networkidle2"
    });

    if (await page.$(".dialog-404")) {
      console.error("The username you provided may be wrong or the link is broken");
      process.exit();
    }

    const imgSrc = await page.evaluate(() => {
      if (document.querySelectorAll("div.KL4Bh > img")) {
        const tmp = document.querySelectorAll("div.KL4Bh > img");
        return [].map.call(tmp, img => img.src);
      } else {
        return 'Video';
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
      if (document.querySelector('div.Nm9Fw > button > span') !== null) {
        let temp = document.querySelector('div.Nm9Fw > button > span').innerHTML;
        let numStr = temp.replace(/,/g, "");
        let num = parseInt(numStr);
        return num + 1;
      }

    });
    // console.log(await likes);
    var obj = {};

    obj.src = imgSrc;
    obj.text = text;
    obj.likes = likes;

    await browser.close();
    
    return obj;
  } catch (err) {
    console.error(err.message);
  }

}


const app = async (user, postsToFetch) => {
  try {
    const nameAndPicture = await getNameAndProfilePicture(user);
    const posts = await getPosts(user, postsToFetch);

    postData = {};

    for (var post of posts) {
      

      var obj = await getPostData(post);
      
      postData[post] = obj;

    }

    if (!fs.existsSync(`./json`)) {
      fs.mkdirSync(`./json`);
    }

    finalObj = {};
    finalObj.user = user;
    finalObj.name = nameAndPicture.name;
    finalObj.profilePicture = nameAndPicture.displayPic;
    finalObj.posts = postData;


    fs.writeFileSync(`./json/${user}_nodes.json`, JSON.stringify(finalObj));

    console.log('JSON written');

  } catch (err) {
    console.error(err.message);
  }

}
