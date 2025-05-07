let express = require("express"),
  app = express(),
  exphbs = require("express-handlebars"),
  imagesArray = [],
  resizeImg = require('resize-img');

const http = require('http'),
  fs = require('fs'),
  PORT = 80;


// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

fs.readdir('./public/img/', (err, files) => {
  for (let file of files) {
    console.log(file);
    if (!file.includes('thumb.png')) {

      (async () => {
        const image = await resizeImg(fs.readFileSync(`./public/img/${file}`), {
          width: 128,
          height: 128
        });
        console.log(`generating thumbnail for ${file}`);
        fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
        imagesArray.push(`${file}.thumb.png`);

      })();
    } else {
      console.log(`thumbnail for ${file} already exists`)
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