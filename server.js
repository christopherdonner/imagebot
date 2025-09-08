let express = require("express"),
shell = require("shelljs"),
  app = express(),
  exphbs = require("express-handlebars"),
  imagesArray = [],
  resizeImg = require('resize-img');

const http = require('http'),
  fs = require('fs'),
  PORT = 88;

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
  // console.log('stdout:', stdout);
  // console.log('stderr:', stderr);
  return stdout;
}

fs.readdir('./public/img/', (err, files) => {
  for (let file of files) {
    
    if (!file.includes('thumb.png')) {


      (async () => {
    console.log(file);

       let caption = await blip(file);
       console.log(caption);
        const image = await resizeImg(fs.readFileSync(`./public/img/${file}`), {
          width: 128,
          height: 128
        });
       
        fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
        imagesArray.push({
          name: file,
          image: `img/${file}`,
          thumb: `img/${file}.thumb.png`,
          description: caption
        });

      })();
    } 
  }

})


app.get('/', (req, res) => {
  res.render("index", { images: imagesArray });
});
let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});