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
    fs.readFile(`./public/img/${file}.thumb.png`, 'utf8', (err, data) => {
      if (!data) {
        (async () => {
          const image = await resizeImg(fs.readFileSync(`./public/img/${file}`), {
            height: 128
          });

          fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
          imagesArray.push(`${file}.thumb.png`);

        })();
      }
    })

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