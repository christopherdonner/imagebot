let express = require("express"),
    app = express(),
    exphbs = require("express-handlebars"),
    imagesArray = [],
    resizeImg = require('resize-img');

const http = require('http'),
  fs = require('fs'),
  PORT = 81;


// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");

fs.readdir('./public/img/', (err, files) => {
  files.forEach((file)=>{
    console.log(file);


    (async () => {
        // let nuImage = fs.readFileSync(`./public/img/${file}`);
        const image = await resizeImg(fs.readFileSync(`./public/img/${file}`), {
          width: 128,
          height: 128
      });
      console.log(image);
  //  console.log(nuImage);
      
      fs.writeFileSync(`./public/img/${file}.thumb.png`, image);
      imagesArray.push(`${file}.thumb.png`);

  })();

  })
})


app.get('/', (req, res) => {
  // get the directory listing of the images folder
  // fs.readdir('./public/img/', (err, files) => {
    res.render("index", { images: imagesArray });
  // })
});
let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});