var express = require('express')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , session = require('express-session')
  , logger = require('morgan');
var passport = require('passport')
  , GoodreadsStrategy = require('passport-goodreads').Strategy
  , goodreads = require('goodreads')
//  , sqlite3 = require('sqlite3')
  , cache = require('memory-cache');
var os = require('os')
  , util = require('util');

var GOODREADS_KEY = process.env.GOODREADS_KEY;
var GOODREADS_SECRET = process.env.GOODREADS_SECRET;

var port = Number(process.env.PORT || 5000);

var gr = new goodreads.client({ key: GOODREADS_KEY, secret: GOODREADS_SECRET});

// database = new sqlite3.Database('db/goodreads.db');
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GoodreadsStrategy({
    consumerKey: GOODREADS_KEY,
    consumerSecret: GOODREADS_SECRET,
    callbackURL: 'http://' + os.hostname() + ":" + port + "/auth/goodreads/callback"
  }, function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // database.each("SELECT uid, oauth_token, oauth_secret FROM user WHERE uid = " + profile.id, function(e, r) {
      //   query = "UPDATE user set oauth_token = '" + accessToken + "' WHERE uid = " + profile.id;
      //   database.run(query);
      // }, function(e, r) {
      //  if (r == 0) {
      //    query = "INSERT INTO user values(" + profile.id + ", '" + accessToken + "');";
      //    database.run(query);
      //  }
      // });
      return done(null, profile);
    });
  }
));

var app = express();

// app.locals.inspect = require('util').inspect;

// configure Express
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(logger());
app.use(cookieParser());
app.use(bodyParser());
app.use(session({ secret: 'keyboard cat' }));
app.use(cookieParser('keyboard cat'));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__dirname + '/public'));

function getAllShelves(userID, callback) {
  if (!cache.get('shelves-' + userID)) {
    console.log('Uncached data for user ID ' + userID);
    var returnShelves = [];     
    gr.getShelves(userID, function(json) {
      if (json) {
        var shelvesArray = [];
        json.GoodreadsResponse.shelves[0].user_shelf.forEach(function (shelf) {
          shelvesArray.push(shelf.name[0]);
        });
        cache.put('shelves-' + userID, shelvesArray, 300000);
        callback(shelvesArray);
      }
    });
  }
  else {
    console.log('Serving cached shelf data for user ID ' + userID);
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
      bookList = json.GoodreadsResponse.books[0].book;
      if (typeof(bookList) != 'undefined' && bookList.length > 0) {
       while (next = bookList.pop()) {
         allBooks.push(next);
       }
       getAllBooks(userID, shelfName, page + 1, allBooksCallback, allBooks);
      } // if bookList
      else {
        cache.put('shelf-' + userID + '-' + shelfName, allBooks, 300000);
        allBooksCallback( '', allBooks);  
      } // else
    }); // getSingleShelf
 } // else
}

// http://jsfromhell.com/array/shuffle
// Not used, might be to mix up the shelves listing
shuffle = function(v){
    for(var j, x, i = v.length; i; j = parseInt(Math.random() * i), x = v[--i], v[i] = v[j], v[j] = x);
    return v;
};

app.post('/', ensureAuthenticated, function(req, res) {
  var profile = {}
  profile.id = req.session.passport.user.id;
  getAllBooks(profile.id, req.body.shelves, 1, function renderOneBook(err, allBooks) {
    justOneBook = {}
    cache.put('shelf-' + profile.id + '-' + req.body.shelves, allBooks);
    justOneBook = allBooks[Math.floor(Math.random() * (allBooks.length - 1))];
    getAllShelves(profile.id, function(allShelves) {
      req.session.book = {
        shelf: req.body.shelves,
        shelves: allShelves,
        submit: 'Get another book',
        book: justOneBook,
        user: req.user 
      }; // http://en.wikipedia.org/wiki/Post/Redirect/Get
      req.session.book.redirected = true;
      res.redirect('/');    
    }); // getAllShelves
  }); // getAllBooks
});

app.get('/', ensureAuthenticated, function(req, res){
  var profile = {}
  profile.id = req.session.passport.user.id;

  if (req.session.book) { // if redirected after a POST
    if (req.session.book.redirected) {
      delete req.session.book.redirected;
      res.render('book', req.session.book);
    }
    else { // GET after a POST, so just reload from the shelf stored in the session
      getAllBooks(profile.id, req.session.book.shelf, 1, function renderOneBook(err, allBooks) {
        differentBook = {}
        differentBook = allBooks[Math.floor(Math.random() * (allBooks.length - 1))];
        
        getAllShelves(profile.id, function(allShelves) {
          differentBookObj = {
            shelf: req.body.shelves,
            shelves: allShelves,
            submit: 'Get another book',
            book: differentBook,
            user: req.user 
          }; // http://en.wikipedia.org/wiki/Post/Redirect/Get
          res.render('book', differentBookObj);
        }); // getAllShelves
      });
    }
  }
  else { // not redirected from a POST, so just get the shelves and cache them
    // database.each("SELECT uid, oauth_token, oauth_secret FROM user WHERE uid = " + profile.id, function(e, r) {
    //   console.log(r);
    //   use this function when the oauth_token is needed to make a call
    // });
    gr.getShelves(profile.id, function(json) {
      if (json) {
        var shelvesArray = [];
        json.GoodreadsResponse.shelves[0].user_shelf.forEach(function (shelf) {
          shelvesArray.push(shelf.name[0]);
        });
        req.session.shelves = shelvesArray;
        cache.put('shelves-' +  profile.id, shelvesArray, 300000);
        res.render('shelves', {
          shelf: '',
          submit: 'Get a book',
          shelves: shelvesArray,
          user: req.user
        });
      }
    });
  } // else
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
  res.render('login', { user: req.user });
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

function clearCaches(caches, callback) {
  caches.forEach(function(cacheToDelete) {
    cache.del(cacheToDelete);
    console.log("Cache deleted: " . cacheToDelete);
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

app.listen(port);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}
