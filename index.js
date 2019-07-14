const Scraper = require('./scraper.js');

let userName = process.argv[2];
let numberOfPosts = process.argv[3];
let scraper = new Scraper(userName, numberOfPosts);