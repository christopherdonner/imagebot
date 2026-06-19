require('dotenv').config();

const express = require("express"),
  app = express(),
  exphbs = require("express-handlebars"),
  resizeImg = require('resize-img'),
  http = require('http'),
  fs = require('fs'),
  path = require('path'),
  tqdm = require('tqdm'),
  util = require('util'),
  exec = util.promisify(require('child_process').exec),
  PORT = 80;

const { initializeVisitorLog, makeVisitorLogEntry, appendVisitorLog } = require('./visitorLogger');

let id = 0,
  caption = "",
  directoryList = [],
  imagesArray = [],
  directoryListSimple = [],
  assetPath = "./public/img/";

// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main", partialsDir: __dirname + "/views/" }));
app.set("view engine", "handlebars");

initializeVisitorLog();

async function blip(file) {
  const { stdout, stderr } = await exec(`py blip.py ./public/img/${file}`);
  return stdout;
}

function deleteOldThumbnails(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.lstatSync(fullPath);

    if (stat.isDirectory()) {
      deleteOldThumbnails(fullPath);
    } else if (file.endsWith('.thumb.png')) {
      try {
        fs.unlinkSync(fullPath);
      } catch (error) {
        console.warn(`Could not remove old thumbnail ${fullPath}:`, error.message);
      }
    }
  }
}

deleteOldThumbnails('./public/img/');

async function buildGallery() {
  return new Promise((resolve, reject) => {
    fs.readdir('./public/img/', async (err, files) => {
      if (err) {
        console.error('Error reading gallery directory:', err);
        reject(err);
        return;
      }

      console.log("building home page gallery...");

      for (let file of tqdm(files)) {
        let isDir = fs.existsSync(`${assetPath}${file}`) && fs.lstatSync(`${assetPath}${file}`).isDirectory();
        if (isDir) {
          directoryList.push(`${assetPath}${file}`);
          directoryListSimple.push(file);
        }
        else if (!file.includes('thumb.png')) {
          try {
            const image = await resizeImg(fs.readFileSync(`${assetPath}${file}`), {
              width: 256,
              height: 256
            });

            // Call blip for auto-captioning
            const caption = await blip(file);

            imagesArray.unshift({
              name: file,
              image: `img/${file}`,
              thumb: `img/${file}.thumb.png`,
              description: caption.trim(),
              id: id
            });
            id++;

            fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
          } catch (error) {
            console.error(`Error processing file ${file}:`, error.message);
          }
        }
      }

      if (directoryList.length > 0) {
        console.log(`building ${directoryList.length} sub-galleries...`);
        for (let dir of directoryList) {
          let dirImagesArray = [];
          app.get(`/${directoryListSimple[directoryList.indexOf(dir)]}`, (req, res) => {
            res.render("index", { directoryListSimple: directoryListSimple, images: dirImagesArray });
          });

          let dirFiles = fs.readdirSync(dir);
          for (let file of tqdm(dirFiles)) {
            if (!file.includes('thumb.png')) {
              try {
                const image = await resizeImg(fs.readFileSync(`${dir}/${file}`), {
                  width: 128,
                  height: 128
                });

                // Call blip for auto-captioning
                const caption = await blip(`${directoryListSimple[directoryList.indexOf(dir)]}/${file}`);

                dirImagesArray.unshift({
                  name: file.split("_")[0],
                  image: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}`,
                  thumb: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}.thumb.png`,
                  description: caption.trim(),
                  id: id
                });
                id++;
                fs.writeFileSync(`${dir}/${file}.thumb.png`, image);
              } catch (error) {
                console.error(`Error processing file ${file}:`, error.message);
              }
            }
          }
        }
      }

      resolve();
    });
  });
}

buildGallery().catch(err => console.error('Gallery build failed:', err));

app.get('/', (req, res) => {
  res.render("index", { directoryListSimple: directoryListSimple, images: imagesArray });
  const logEntry = makeVisitorLogEntry(req);
  appendVisitorLog(logEntry);
});

app.get('/about', (req, res) => {
  res.render("about", { directoryListSimple: directoryListSimple });
});

app.get('/cv', (req, res) => {
  res.render("cv", { directoryListSimple: directoryListSimple, images: imagesArray });
});

app.get('/contact', (req, res) => {
  res.render("contact", { directoryListSimple: directoryListSimple });
});

let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});