require('dotenv').config();
const express = require('express');
const https = require('https');
const port = 3000;
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const flash = require('connect-flash');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const app = express();
const multer = require('multer');
const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET; // Load from environment variable

const YOUR_DOMAIN = 'http://everafter.pics';

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
      const userId = req.params.userId;
      const dir = `./eauploads/${userId}/`;
      if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
      }
      cb(null, dir);
    },
    filename: function(req, file, cb) {
      // Include userId and current date-time in the filename
      const userId = req.params.userId;
      const newFilename = `${userId}-${Date.now()}-${file.originalname}`;
      cb(null, newFilename);
    }
});

  const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
      const filetypes = /jpeg|jpg|png|gif/;
      const mimetype = filetypes.test(file.mimetype);
      const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
      if (mimetype && extname) {
        return cb(null, true);
      }
      cb("Error: File upload only supports the following filetypes - " + filetypes);
    }
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Session middleware should come before the flash middleware
app.use(session({
    secret: 'asdasd2qw323rqrarfafasdaw',
    resave: false,
    saveUninitialized: false,
    cookie: {
        
        secure: false  // Change this to false for now
    }
}));

app.use(passport.initialize());
app.use(passport.session()); // This should come after session middleware

app.use(flash());  // Now, flash comes after session

// Middleware setup  
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
});

app.use(express.static('public'));
app.set('view engine', 'ejs');

// Middleware to check the session
app.use((req, res, next) => {
    console.log("Session:", req.session);
    next();
});

//app.get('/dashboard_paid', ensurePaid, (req, res) => {
//    res.render('dashboard_paid', { user: req.user });
//});



// Connect to MongoDB 
 console.log(process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// User model Schema for MongoDB
const UserSchema = new mongoose.Schema({
    username: String,
    password: String,
    email: { type: String, unique: true, required: true },
    hasPaid: { type: Boolean, default: false }  // Add this line
});

UserSchema.plugin(passportLocalMongoose);

const User = mongoose.model('User', UserSchema);

// Passport setup
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser((user, done) => {
    done(null, user._id);
});


passport.deserializeUser(async (id, done) => {
    console.log("Deserializing user with ID:", id);
    try {
        const user = await User.findById(id);
        console.log("Deserialized user:", user);
        done(null, user);
    } catch (err) {
        console.error("Error during deserialization:", err);
        done(err, null);
    }
});


// Routes  


app.get('/dashboard_paid', ensurePaid, async (req, res) => {
    try {
        const qrCodeURL = `https://everafter.pics/public-upload/${req.user.username}`;
        const options = {scale: 20,   };
        const qrCodeDataURL = await QRCode.toDataURL(qrCodeURL, options);
        

        console.log("QR Code Data URL:", qrCodeDataURL);  // Log the data URL for debugging

        res.render('dashboard_paid', { user: req.user, qrCodeDataURL: qrCodeDataURL });
    } catch (error) {
        console.error("Error generating QR code:", error);
        res.render('dashboard_paid', { user: req.user });  // Fallback if QR code generation fails
    }
});



app.get('/get-public-latest-images/:userId', (req, res) => {
    const userId = req.params.userId;
    const dir = `./eauploads/${userId}/`;

    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Could not read directory' });
        }

        // Sort files by modified time
        files = files.map(file => ({
            name: file,
            time: fs.statSync(path.join(dir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)
        .map(file => file.name);

        res.json({ files });
    });
});



app.get('/get-latest-images/:userId', ensurePaid, (req, res) => {
    const userId = req.params.userId;
    const dir = `./eauploads/${userId}/`;

    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Could not read directory' });
        }

        // Sort files by modified time
        files = files.map(file => ({
            name: file,
            time: fs.statSync(path.join(dir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time)
        .map(file => file.name);

        res.json({ files });
    });
});



app.use('/eauploads', express.static(path.join(__dirname, 'eauploads'))); 



app.post('/public-upload/:userId/submit', upload.array('sampleFile', 10), (req, res) => {
    const fileInfos = req.files.map(file => ({ name: file.filename, path: `/eauploads/${req.params.userId}/${file.filename}` }));
    res.json({ success: true, files: fileInfos });
    
});


  
  app.get('/public-upload/:userId', (req, res) => {
    const userId = req.params.userId;
    // You may want to check if this userId corresponds to a paid user
    res.render('public-upload', { userId });
});

app.get('/loggingout', (req, res) => {
    console.log("Logging out route triggered");  // Add this line
    res.render('loggingout');
});

app.get('/upload', (req, res) => {
    res.render('upload');
  });

  app.post('/upload', upload.single('image'), (req, res, next) => {
    // Your logic here, e.g., save the file information to the database
    res.send('File uploaded successfully');
  });


  app.get('/public-upload/:userId', (req, res) => {
    const userId = req.params.userId;
    // You may want to check if this userId corresponds to a paid user
    res.render('public-upload', { userId });
  });
  
 // app.get('/dashboard_paid', ensurePaid, (req, res) => {
 //   res.render('dashboard_paid', { user: req.user, username: req.user.username });
//});

app.get('/signuplogin', (req, res) => {
    res.render('signuplogin'); 
});
  

app.get('/signup', (req, res) => {
    res.render('signup'); 
});

app.post('/signup', (req, res) => {
    const { username, password, email } = req.body;

    User.register(new User({ username: username, email: email }), password, (err, user) => {
        if (err) {
            console.error("Registration error:", err);
    
            // Check for MongoDB duplicate key error
            if (err.name === 'MongoError' && err.code === E11000) {
                req.flash('error', 'Email already registered.');
            } else {
                req.flash('error', err.message);
            }
    
            return res.redirect('/signup');
        }
        passport.authenticate('local', (err, user, info) => {
            if (err) {
                console.error("Authentication error after registration:", err);
                req.flash('error', 'There was an error during authentication.');
                return res.redirect('/signup');
            }
            if (!user) {
                console.error("Authentication failed after registration:", info.message);
                req.flash('error', info.message);
                return res.redirect('/signup');
            }
            req.logIn(user, (err) => {
                if (err) {
                    console.error("Error logging in after registration:", err);
                    req.flash('error', 'There was an error during login.');
                    return res.redirect('/signup');
                }
                console.log("User logged in successfully after registration");
                req.flash('success', 'Successfully signed up and logged in!');
                res.redirect('/dashboard');
            });
        })(req, res);
    });
});


////////////////////////////////////////////////////////////////////////////////////////////
//
//    #####  ####### ######  ### ######  ####### 
//   #     #    #    #     #  #  #     # #       
//   #          #    #     #  #  #     # #       
//    #####     #    ######   #  ######  #####   
//         #    #    #   #    #  #       #       
//   #     #    #    #    #   #  #       #       
//    #####     #    #     # ### #       ####### 
//
///////////////////////////////////////////////////////////////////////////////////////////




app.use(express.static("public"));

app.use(express.json());

///////////////////////  STRIPE CHECKOUT  /////////////////////////////////////////////////

const calculateOrderAmount = (items) => {
  // Replace this constant with a calculation of the order's amount
  // Calculate the order total on the server to prevent
  // people from directly manipulating the amount on the client
  return 1400;
};

app.post("/create-payment-intent", async (req, res) => {
  const { items } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calculateOrderAmount(items),
    currency: "cad",
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

 

  ////////////////////  STRIPE WEBHOOK  //////////////////////////////////

  app.post('/webhook', express.raw({type: 'application/json'}), (request, response) => {
    const sig = request.headers['stripe-signature'];
  
    let event;
  
    try {
      event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }
  
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntentSucceeded = event.data.object;
        const userId = paymentIntent.metadata.userId;
          
            User.findByIdAndUpdate(userId, { hasPaid: true }, { new: true }, (err, user) => {
              if (err) {
                console.error("Error updating user:", err);
                // Handle error
              } else {
                console.log("User payment status updated:", user);
                // Handle successful update
              }
            });
            break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  
    // Return a 200 response to acknowledge receipt of the event
    response.send();
  });



/////////////////////////// END STRIPE //////////////////////////////


//   ### ##    ## ##   ##  ###  #### ##  ### ###   ## ##   
//    ##  ##  ##   ##  ##   ##  # ## ##   ##  ##  ##   ##  
//    ##  ##  ##   ##  ##   ##    ##      ##      ####     
//    ## ##   ##   ##  ##   ##    ##      ## ##    #####   
//    ## ##   ##   ##  ##   ##    ##      ##          ###  
//    ##  ##  ##   ##  ##   ##    ##      ##  ##  ##   ##  
//   #### ##   ## ##    ## ##    ####    ### ###   ## ##   
                                                      

///////////////////////////////////////////////////////////////////////



app.get('/login', (req, res) => {
    res.render('login');
});


//app.post('/login', passport.authenticate('local', {
//    successRedirect: '/dashboard',
//    failureRedirect: '/login',
//    failureFlash: 'Invalid username or password.',
//    successFlash: 'Welcome!'
//}));

app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Invalid username or password.'
}), (req, res) => {
    if (req.user.hasPaid) {
        res.redirect('/dashboard_paid');
    } else {
        res.redirect('/dashboard');  // or any other default page for logged-in but unpaid users
    }
});

app.post('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });
 

app.get('/dashboard', (req, res) => {
    console.log("User object in dashboard route:", req.user);
    if (!req.isAuthenticated()) {
        console.log("User not authenticated for dashboard");
        return res.redirect('/login');
    }
    res.render('dashboard', { user: req.user });
});

app.get('/deleteall', (req, res) => {
    console.log("User object in deleteall route:", req.user);
    if (!req.isAuthenticated()) {
        console.log("User not authenticated for to delete images");
        return res.redirect('/login');
    }
    res.render('deleteall', { user: req.user });
});

  // Public live feed route
  app.get('/livefeed/:userId', async (req, res) => {
    const userId = req.params.userId;

    // You may want to check if this userId corresponds to a paid user
    // For now, let's assume it does and render the live feed
    res.render('livefeed', { userId });
});




app.get('/payment', (req, res) => {
    res.render('payment'); // This should be your payment.ejs 
});

//app.get('/checkout', (req, res) => {
//    res.render('checkout'); // This should be your checkout.ejs 
//});

app.get('/checkout', (req, res) => {
    res.render('checkout', { user: req.user });
});


app.get('/success', (req, res) => {
    res.render('success'); // This should be your checkout success page
});






app.post('/deleteall', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.redirect('/login');
    }
  
    const userId = req.user.username;
    const dir = `./eauploads/${userId}/`;
  
    fs.readdir(dir, (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        return res.status(500).send("An error occurred while reading the directory.");
      }
  
      for (const file of files) {
        fs.unlink(path.join(dir, file), err => {
          if (err) {
            console.error("Error deleting file:", err);
          }
        });
      }
  
      res.redirect('/dashboard_paid'); // Redirect to dashboard or any other page
    });
  });

// app.get('/dashboard_paid', (req, res) => {
//    console.log("User object in dashboard route:", req.user);
//    if (!req.isAuthenticated()) {
//        console.log("User not authenticated for dashboard");
//        return res.redirect('/login');
//    }
//    res.render('dashboard_paid', { user: req.user });
// });

////////////////////////////////////////////////////////////////////////////////////////
//
//    ### ###  ##  ###  ###  ##   ## ##   #### ##    ####    ## ##   ###  ##   ## ##   
//     ##  ##  ##   ##    ## ##  ##   ##  # ## ##     ##    ##   ##    ## ##  ##   ##  
//     ##      ##   ##   # ## #  ##         ##        ##    ##   ##   # ## #  ####     
//     ## ##   ##   ##   ## ##   ##         ##        ##    ##   ##   ## ##    #####   
//     ##      ##   ##   ##  ##  ##         ##        ##    ##   ##   ##  ##      ###  
//     ##      ##   ##   ##  ##  ##   ##    ##        ##    ##   ##   ##  ##  ##   ##  
//    ####      ## ##   ###  ##   ## ##    ####      ####    ## ##   ###  ##   ## ##   
//
/////////////////////////////////////////////////////////////////////////////////////////
                                                                                 



function ensurePaid(req, res, next) {
    if (req.isAuthenticated() && req.user.hasPaid) {
        const dir = `./eauploads/${req.user.username}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return next();
    } else {
        // Redirect to a payment page or show an error message
        res.redirect('/checkout');
    }
}



function redirectToDashboardPaidIfPaid(req, res, next) {
    if (req.isAuthenticated() && req.user.hasPaid) {
        return res.redirect('/dashboard_paid');
    }
    next();
}
// folder creation by reg and logged in user
function createDirectoryForUser(req, res, next) {
    if (req.isAuthenticated() && req.user.hasPaid) {
      const dir = `./eauploads/${req.user._id}`;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    next();
  }



app.listen(3000, () => {
    console.log('Server started on http://localhost:3000');
});