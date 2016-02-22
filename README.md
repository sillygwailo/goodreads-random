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
