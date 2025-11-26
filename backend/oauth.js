const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { db } = require('./db');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:4000/auth/google/callback';

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
    db.get('SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?', 
      ['google', googleId], (err, user) => {
        if (err) return done(err);
        
        if (user) {
          return done(null, user);
        }
        
        // Check if email exists (link accounts)
        db.get('SELECT * FROM users WHERE email = ? OR oauth_email = ?', 
          [email, email], (err, existingUser) => {
            if (err) return done(err);
            
            if (existingUser) {
              // Link OAuth to existing account
              db.run('UPDATE users SET oauth_provider = ?, oauth_provider_id = ?, oauth_email = ? WHERE id = ?',
                ['google', googleId, email, existingUser.id], (err) => {
                  if (err) return done(err);
                  done(null, { ...existingUser, oauth_provider: 'google', oauth_provider_id: googleId });
                });
            } else {
              // Create new user
              db.run('INSERT INTO users (oauth_provider, oauth_provider_id, oauth_email) VALUES (?, ?, ?)',
                ['google', googleId, email], function(err) {
                  if (err) return done(err);
                  done(null, { id: this.lastID, oauth_provider: 'google', oauth_provider_id: googleId, oauth_email: email });
                });
            }
          });
      });
  }));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => done(err, user));
  });
} else {
  console.log('⚠️  Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)');
  console.log('   Email/password login will still work. See OAUTH_SETUP.md for setup instructions.');
}

module.exports = passport;
