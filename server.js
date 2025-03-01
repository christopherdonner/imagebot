var express = require("express");

app = express();

const http = require('http'),
  fs = require('fs'),
  PORT = 81;

// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

var exphbs = require("express-handlebars");

app.engine("handlebars", exphbs({ defaultLayout: "main" }));
app.set("view engine", "handlebars");


app.get('/', (req, res) => {
  // get the directory listing of the images folder
  fs.readdir('./public/img/', (err, files) => {
    res.render("index", { images: files });
  })
});
let options = {},
  server = http.createServer(options, app);

server.listen(PORT, () => {
  console.log("server starting on port : " + PORT)
});