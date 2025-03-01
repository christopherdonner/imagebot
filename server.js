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

  
// // Use Handlebars to render the main index.html page with the coyotes in it.


app.get('/', (req, res) => {
  // res.send("'Now using http..'");
  fs.readdir('./src/public/img/', (err, files)=>{
    console.log(files);
    for(file of files){}
    res.render("index", {images: files});
  })

  
});
let options = {},
    server = http.createServer(options, app);

server.listen(PORT, () => {
 console.log("server starting on port : " + PORT)
});