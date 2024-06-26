var express = require('express')
  , bodyParser = require('body-parser')
  , session = require('express-session')
var passport = require('passport')
  , GoodreadsStrategy = require('passport-goodreads').Strategy
  , goodreads = require('goodreads')
  , cache = require('memory-cache')
  , sha1 = require('sha1');

var GOODREADS_KEY = process.env.GOODREADS_KEY;
var GOODREADS_SECRET = process.env.GOODREADS_SECRET;
var CALLBACK_URL = process.env.CALLBACK_URL;
var CACHE_LIFETIME = process.env.CACHE_LIFETIME || 300000;

var port = Number(process.env.PORT || 5000);

var gr = new goodreads.client({ key: GOODREADS_KEY, secret: GOODREADS_SECRET});

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoodreadsStrategy({
    consumerKey: GOODREADS_KEY,
    consumerSecret: GOODREADS_SECRET,
    callbackURL: CALLBACK_URL
  }, function(accessToken, refreshToken, profile, done) {
    process.nextTick(function () {
      return done(null, profile);
    });
  }
));

var app = express();

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/assets'));

function getAllShelves(userID, callback) {
  if (!cache.get('shelves-' + userID)) {
    console.log('Uncached data for user ID (SHA-1) ' + sha1(userID));
    var returnShelves = [];
    gr.getShelves(userID, function(json) {
      if (json) {
        var shelvesArray = [];
        json.GoodreadsResponse.shelves[0].user_shelf.forEach(function (shelf) {
          shelvesArray.push(shelf.name[0]);
        });
        cache.put('shelves-' + userID, shelvesArray, CACHE_LIFETIME);
        callback(shelvesArray);
      }
    });
  }
  else {
    console.log('Serving cached shelf data for user ID (SHA-1) ' + sha1(userID));
    callback(cache.get('shelves-' + userID));
  }
}

function getAllBooks(userID, shelfName, page, allBooksCallback, allBooks) {
  var allBooks = allBooks || [];

  var allBooksCallback = allBooksCallback || function() {};

  cachedBooks = cache.get('shelf-' + userID + '-' + shelfName);
  if (cachedBooks) {
    allBooksCallback('', cachedBooks);
  }
  else {
    var goodreadsQueryOptions = {
      shelf: shelfName,
      per_page: 200,
      page: page,
      userID: userID
    };
    gr.getSingleShelf(goodreadsQueryOptions, function(json) {
      if (typeof(json.GoodreadsResponse) != 'undefined' && typeof(json.GoodreadsResponse.books) != 'undefined') {
        bookList = json.GoodreadsResponse.books[0].book;
        if (typeof(bookList) != 'undefined' && bookList.length > 0) {
         while (next = bookList.pop()) {
           allBooks.push(next);
         }
         getAllBooks(userID, shelfName, page + 1, allBooksCallback, allBooks);
        } // if bookList
        else {
          cache.put('shelf-' + userID + '-' + shelfName, allBooks, CACHE_LIFETIME);
          allBooksCallback( '', allBooks);
        } // else
      }
      else {
        console.log(json.GoodreadsResponse);
      }
    }); // getSingleShelf
 } // else
}

app.post('/', ensureAuthenticated, function(req, res) {
  var profile = {}
  profile.id = req.session.passport.user.id;
  getAllBooks(profile.id, req.body.shelves, 1, function renderOneBook(err, allBooks) {
    justOneBook = {}
    cache.put('shelf-' + profile.id + '-' + req.body.shelves, allBooks, CACHE_LIFETIME);
    justOneBook = allBooks[Math.floor(Math.random() * (allBooks.length))];
    getAllShelves(profile.id, function(allShelves) {
      if (req.body.shelves) { // give priority to data through a POST
        shelf = req.body.shelves;
      }
      else {
        shelf = req.session.shelf;
      }
      req.session.book = {
        shelf: shelf,
        shelves: allShelves,
        submit: 'Get another book',
        book: justOneBook,
        user: req.user
      }; // http://en.wikipedia.org/wiki/Post/Redirect/Get
      req.session.redirected = true;
      req.session.shelf = req.body.shelves;
      res.redirect('/');
    }); // getAllShelves
  }); // getAllBooks
});

app.get('/', ensureAuthenticated, function(req, res){
  var profile = {}
  profile.id = req.session.passport.user.id;

  if (req.session.book) {
    if (req.session.redirected) { // if redirected after a POST
      req.session.redirected = null;
      res.render('book', makeUrlsHTTPS(removePlaceHolderCover(req.session.book)));
    }
    else { // GET after a POST, so just reload from the shelf stored in the session
      getAllBooks(profile.id, req.session.book.shelf, 1, function renderOneBook(err, allBooks) {
        differentBook = {}
        differentBook = allBooks[Math.floor(Math.random() * (allBooks.length))];

        getAllShelves(profile.id, function(allShelves) {
          if (req.session.shelf) {
            shelf = req.session.shelf;
          }
          else {
            shelf = '';
          }
          differentBookObj = {
            shelf: shelf,
            shelves: allShelves,
            submit: 'Get another book',
            book: differentBook,
            user: req.user
          }; // http://en.wikipedia.org/wiki/Post/Redirect/Get
          res.render('book', makeUrlsHTTPS(removePlaceHolderCover(differentBookObj)));
        }); // getAllShelves
      });
    }
  }
  else { // not redirected from a POST, so get a book from 'currently-reading' shelf and cache the shelves list
    gr.getShelves(profile.id, function(json) {
      if (json) {
        var shelvesArray = [];
        json.GoodreadsResponse.shelves[0].user_shelf.forEach(function (shelf) {
          shelvesArray.push(shelf.name[0]);
        });
        req.session.shelves = shelvesArray;
        if (req.session.shelf) {
          shelf = req.session.shelf;
        }
        else {
          shelf = 'currently-reading';
        }
        cache.put('shelves-' +  profile.id, shelvesArray, CACHE_LIFETIME);
        getAllBooks(profile.id, 'currently-reading', 1, function renderOneBook(err, allBooks) {
          justOneBook = {}
          cache.put('shelf-' + profile.id + '-' + req.body.shelves, allBooks, CACHE_LIFETIME);
          justOneBook = allBooks[Math.floor(Math.random() * (allBooks.length))];
          getAllShelves(profile.id, function(allShelves) {
            if (req.body.shelves) { // give priority to data through a POST
              shelf = req.body.shelves;
            }
            else if (req.session.shelf) {
              shelf = req.session.shelf;
            }
            else {
              shelf = 'currently-reading';
            }
            req.session.book = {
              shelf: shelf,
              shelves: allShelves,
              submit: 'Get another book',
              book: justOneBook,
              user: req.user
            }; // http://en.wikipedia.org/wiki/Post/Redirect/Get
            res.render('book', makeUrlsHTTPS(removePlaceHolderCover(req.session.book)));
          }); // getAllShelves
        }); // getAllBooks
      }
    });
  } // else
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  if (req.isAuthenticated()) {
    res.redirect('/');
    return;
  }
  res.render('login', { user: req.user, page_name: 'home' });
});

app.get('/about', function(req, res){
  res.render('about', { user: req.user, page_name: 'about' });
});

app.get('/auth/goodreads',
  passport.authenticate('goodreads'),
  function(req, res){
    // The request will be redirected to Goodreads for authentication, so this
    // function will not be called.
  });

app.get('/auth/goodreads/callback',
  passport.authenticate('goodreads', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

function removePlaceHolderCover(shelf) {
  if (typeof(shelf.book) != 'undefined' && typeof(shelf.book.image_url) != 'undefined' && shelf.book.image_url[0].indexOf('nophoto') > -1) {
      delete(shelf.book.image_url);
  }
  return shelf;
}

function makeUrlsHTTPS(shelf) {
  if (typeof(shelf.book) != 'undefined' && typeof(shelf.book.link) != 'undefined') {
    shelf.book.link[0] = shelf.book.link[0].replace(/^http:\/\//i, 'https://');
  }
  if (typeof(shelf.book) != 'undefined' && typeof(shelf.book.image_url) != 'undefined') {
    shelf.book.image_url[0] = shelf.book.image_url[0].replace(/^http:\/\//i, 'https://');
  }
  shelf.page_name = 'home';
  return shelf;
}

function clearCaches(caches, callback) {
  caches.forEach(function(cacheToDelete) {
    if (cache.del(cacheToDelete)) {
      console.log('Cache deleted: ' + cacheToDelete);
    }
    else {
      console.log('No cache was stored for: ' + cacheToDelete);
    }
  })
  callback();
}

app.get('/logout', ensureAuthenticated,function(req, res) {
  var caches = [];
  if (typeof(req.session.passport.user) != 'undefined') {
    var userID = req.session.passport.user.id;
    getAllShelves(userID, function clearShelfCache(shelves) {
      shelves.forEach(function addToCacheArray(shelf) {
        caches.push('shelf-' + userID + '-' + shelf);
      }); // shelves.forEach
      caches.push('shelves-' + userID);
      clearCaches(caches, function() {
        req.session.book = null;
        req.logout();
        res.redirect('/');
      }); // clearCaches;
    }); // getAllShelves
  }
});

app.listen(port, function() {
  console.log("Listening on " + port);
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}
