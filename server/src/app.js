const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')


var Post = require('../models/posts');

const app = express()
app.use(morgan('combined'))
app.use(bodyParser.json())
app.use(cors())


const path = require('path')
const fs = require('fs')
const multer = require('multer')
const mkdirp = require('mkdirp')

const uploadPath = 'uploaded'
const upload = multer({ dest: uploadPath })
const uuidv4 = require('uuid/v4')
mkdirp.sync(uploadPath)
const handleError = (err, res) => {
  res
    .status(500)
    .contentType('text/plain')
    .end('Oops! Something went wrong!')
}
var publicDir = require('path').join(__dirname,'../uploaded/');
app.use(express.static(publicDir));

// DB Setup
var mongoose = require('mongoose');

var DATABASE_URL = process.env.DATABASE_URL || 'http://localhost'
mongoose.connect(`mongodb://${DATABASE_URL}/posts`, { useNewUrlParser: true });

var db = mongoose.connection;

db.on('error', function (error) {
  // If first connect fails because server-database isn't up yet, try again.
  // This is only needed for first connect, not for runtime reconnects.
  // See: https://github.com/Automattic/mongoose/issues/5169
  if (error.message && error.message.match(/failed to connect to server .* on first connect/)) {
    setTimeout(function () {
      mongoose.connect(`mongodb://${DATABASE_URL}/posts`, { useNewUrlParser: true }).catch(() => {
        // empty catch avoids unhandled rejections
      });
    }, 20 * 1000);
  } else {
    // Some other error occurred.  Log it.
    console.error(new Date(), String(error));
  }
});

db.once('open', function(callback){
  console.log('Connection Succeeded');
});

app.post('/upload', upload.single('file'), (req, res) => {
    const tempPath = req.file.path
    const extName = path.extname(req.file.originalname).toLowerCase();
    const targetPath = path.join(__dirname, '../uploaded/' + uuidv4() + extName)
    if ( extName === '.png' || extName === '.jpg' || extName === '.jpeg' || extName === '.gif') {
      fs.rename(tempPath, targetPath, err => {
        if (err) return handleError(err, res)
        
        var title = req.file.originalname
        var description = req.body.description
        var db = req.db

        var newPost = new Post({
          url: targetPath,
          description: description,
          likes: 0,
          data: new Date()
        })
 
 
        newPost.save(function(error) {
          if (error) return handleError(error, res);
          res
            .status(200)
            .contentType('text/plain')
            .end('File uploaded!')
        })
      

      });
    } else {
      fs.unlink(tempPath, err => {
        if (err) return handleError(err, res);

        res
          .status(403)
          .contentType('text/plain')
          .end('Only .png|.jpg|.gif files are allowed!');
      });
    }
  }
);

// SERVER Setup
app.get('/posts', (req, res) => {
  Post.find({}, 'url description likes date', function (error, posts) {
    if (error) { console.error(error); }
    res.send({
      posts: posts
    })
  }).sort({_id:-1})
});


// Post Endpoints
app.post('/posts', (req, res) => {
  var db = req.db;
  var title = req.body.title;
  var description = req.body.description;
  var new_post = new Post({
    title: title,
    description: description
  })

  new_post.save(function (error) {
    if (error) {
      console.log(error)
    }
    res.send({
      success: true,
      message: 'Post saved successfully!'
    })
  })
})

// Fetch single post
app.get('/post/:id', (req, res) => {
  var db = req.db;
  Post.findById(req.params.id, 'title description', function (error, post) {
    if (error) { console.error(error); }
    res.send(post)
  })
})

// Update a post
app.put('/posts/:id', (req, res) => {
  var db = req.db;
  Post.findById(req.params.id, 'title description', function (error, post) {
    if (error) { console.error(error); }

    post.title = req.body.title
    post.description = req.body.description
    post.save(function (error) {
      if (error) {
        console.log(error)
      }
      res.send({
        success: true
      })
    })
  })
})

// Delete a post
app.delete('/posts/:id', (req, res) => {
  var db = req.db;
  Post.remove({
    _id: req.params.id
  }, function(err, post){
    if (err)
      res.send(err)
    res.send({
      success: true
    })
  })
})


app.listen(process.env.PORT || 8081)