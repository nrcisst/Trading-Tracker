const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { dbClient } = require('./db-client');
const { requireEnv } = require('./config');

const GOOGLE_CLIENT_ID = requireEnv('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = requireEnv('GOOGLE_CLIENT_SECRET');

// In production we require a CALLBACK_URL to avoid redirect mismatch; in dev we fall back to localhost
const CALLBACK_URL = process.env.NODE_ENV === 'production'
  ? requireEnv('CALLBACK_URL')
  : (process.env.CALLBACK_URL || 'http://localhost:4000/auth/google/callback');

// Only configure Google OAuth if credentials are provided
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  console.log('Google OAuth configured');

  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
  }, (accessToken, refreshToken, profile, done) => {
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;

    if (!email) return done(new Error('No email from Google'));

    // Check if user exists with this Google ID
    dbClient.get('SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?',
      ['google', googleId], (err, user) => {
        if (err) return done(err);

        if (user) {
          return done(null, user);
        }

        // Check if email exists (link accounts)
        dbClient.get('SELECT * FROM users WHERE email = ? OR oauth_email = ?',
          [email, email], (err, existingUser) => {
            if (err) return done(err);

            if (existingUser) {
              // Link OAuth to existing account
              dbClient.run('UPDATE users SET oauth_provider = ?, oauth_id = ?, oauth_email = ? WHERE id = ?',
                ['google', googleId, email, existingUser.id], (err) => {
                  if (err) return done(err);
                  done(null, { ...existingUser, oauth_provider: 'google', oauth_id: googleId });
                });
            } else {
              // Create new user
              dbClient.run('INSERT INTO users (oauth_provider, oauth_id, oauth_email) VALUES (?, ?, ?)',
                ['google', googleId, email], function (err, result) {
                  if (err) return done(err);
                  const userId = this.lastID;
                  done(null, { id: userId, oauth_provider: 'google', oauth_id: googleId, oauth_email: email });
                });
            }
          });
      });
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    dbClient.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user));
  });
} else {
  console.log('Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  console.log('Email/password login will still work. See OAUTH_SETUP.md for setup instructions.');
}

module.exports = passport;
