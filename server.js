var express = require("express");

app = express();

const http = require('http'),
      fs = require('fs'),
      PORT = 81;


// let images = fs.readdir(__dirname + '/public/img', (img)=>{console.log(img)})

// Sets up the Express app to handle data parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// set public directory for assetts
app.use(express.static('public'));

var exphbs = require("express-handlebars");

// app.engine("handlebars", exphbs({ defaultLayout: "main" }));
// app.set("view engine", "handlebars");

  
// // Use Handlebars to render the main index.html page with the coyotes in it.
app.get("/", function(req, res) {
    res.render("index", {});
});


app.get('/', (req, res) => {
  res.send('Now using https..');
});
let options = {},
    server = http.createServer(options, app);

server.listen(PORT, () => {
 console.log("server starting on port : " + PORT)
});