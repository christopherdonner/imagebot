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

function preProcessImage(image) {
  console.log(image);
}

let id = 0,
  caption = "",
  directoryList = [],
  directoryListSimple = [],
  assetPath = "./public/img/";

fs.readdir('./public/img/', (err, files) => {

  for (let file of tqdm(files)) {
    console.log(file)
    let isDir = fs.existsSync(`${assetPath}${file}`) && fs.lstatSync(`${assetPath}${file}`).isDirectory();
    console.log(isDir);
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
  for (let dir of directoryList) {
    console.log(dir);
    let dirImagesArray = [];
      app.get(`/${directoryListSimple[directoryList.indexOf(dir)]}`, (req, res) => {
        res.render("index", { directoryListSimple: directoryListSimple, images: dirImagesArray });
      })
    let dirFiles = fs.readdirSync(dir);
    for (let file of dirFiles) {
      // console.log(file);
      console.log(file);
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
  res.render("about", { directoryListSimple: directoryListSimple, images: imagesArray });
});



let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});