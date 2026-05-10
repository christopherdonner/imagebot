let express = require("express"),
  app = express(),
  exphbs = require("express-handlebars"),
  imagesArray = [],
  resizeImg = require('resize-img');

const http = require('http'),
  fs = require('fs'),
  tqdm = require('tqdm');
PORT = 80;

const util = require('util');
const exec = util.promisify(require('child_process').exec);

let id = 0,
  caption = "",
  directoryList = [],
  directoryListSimple = [],
  assetPath = "./public/img/";
  
// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");


async function blip(file) {
  const { stdout, stderr } = await exec(`py blip.py ./public/img/${file}`);
  console.log(file + ':' + stdout);
  return stdout;
}

fs.readdir('./public/img/', (err, files) => {
console.log("building home page gallery...")
  for (let file of tqdm(files)) {
    let isDir = fs.existsSync(`${assetPath}${file}`) && fs.lstatSync(`${assetPath}${file}`).isDirectory();
    if (isDir) {
      directoryList.push(`${assetPath}${file}`);
      directoryListSimple.push(file);
    }
    else if (!file.includes('thumb.png')) {
      (async () => {
        const image = await resizeImg(fs.readFileSync(`${assetPath}${file}`), {
          width: 128,
          height: 128
        });
        imagesArray.unshift({
          name: file,
          image: `img/${file}`,
          thumb: `img/${file}.thumb.png`,
          description: caption.trim(),
          id: id
        });
        id++;

        fs.writeFileSync(`./public/img/${file}.thumb.png`, image);

      })();
    }
  }
  if (directoryList.length > 0) {
    console.log("building sub-galleries...")
  for (let dir of tqdm(directoryList)) {
    let dirImagesArray = [];
      app.get(`/${directoryListSimple[directoryList.indexOf(dir)]}`, (req, res) => {
        res.render("index", { directoryListSimple: directoryListSimple, images: dirImagesArray });
      })
    let dirFiles = fs.readdirSync(dir);
    for (let file of tqdm(dirFiles)) {
      if (!file.includes('thumb.png')) {
        (async () => {
          const image = await resizeImg(fs.readFileSync(`${dir}/${file}`), {
            width: 128,
            height: 128
          });

          dirImagesArray.unshift({
            name: file.split("_")[0],
            image: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}`,
            thumb: `img/${directoryListSimple[directoryList.indexOf(dir)]}/${file}.thumb.png`,
            description: caption.trim(),
            id: id
          });
          id++;
          fs.writeFileSync(`${dir}/${file}.thumb.png`, image);
          // fs.writeFileSync(`./public/img/${dir}/${file}.thumb.png`, image);
        })();
      }
    
    }

  }
}

})

app.get('/', (req, res) => {
  res.render("index", { directoryListSimple: directoryListSimple, images: imagesArray });
});

app.get('/about', (req, res) => {
  res.render("about", { directoryListSimple: directoryListSimple });
});

app.get('/cv', (req, res) => {
  res.render("cv", { directoryListSimple: directoryListSimple, images: imagesArray });
});

app.get('/contact', (req, res) => {
  res.render("contact", { directoryListSimple: directoryListSimple});
});

let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});