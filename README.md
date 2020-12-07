# goodreads-random

Pick a random book from one of your Goodreads shelves. Useful for deciding which book to read next, or which book in your unread pile to pick up again.

# Installation

1. Clone the repository.
2. `npm install`
3. Get your Goodreads developer key from https://www.goodreads.com/api/keys
4. `export GOODREADS_KEY=YourGoodreadsKeyHere`
5. `export GOODREADS_SECRET=YourGoodreadsSecretHere`
6. `export CALLBACK_URL=http://localhost:5000/auth/goodreads/callback` # replace localhost:5000 with the hostname (and, optionally, port) of where you're hosting the app
7. `node app.js`

Or, just click the button below to deploy to Heroku.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

The `CALLBACK_URL` convig var is optional at build in Heroku. Create a config var in the app's settings after it the build completes and set it to `https://app-name-12345.herokuapp.com/login` (replace `app-name-12345` with the name you or Heroku gave to the app).

# Similar Ideas

* [How Tara used the Goodreads API to pick her next read](https://dev.to/tara/how-i-used-the-goodreads-api-to-pick-my-next-read-2le9)
* [Pick a Book](https://berniwittmann.github.io/pick-a-book/)
* [Goodreads random book](https://medium.com/@kjbrazil/goodreads-random-next-book-selection-f6c6b325b273)
