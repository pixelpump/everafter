require('dotenv').config();


// TESTING KEYS //////////////////////////////////////////////////////////////////////////////////
//const stripe = require('stripe')('sk_test_GaC5n8imZIcK11aWtIjJXGEu');
//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
//console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY)

//const endpointSecret = 'whsec_30zsnokm0CKtRGppM20Mo8CoSPPn2N24';
//const endpointSecret = ('STRIPE_ENDPOINT_SECRET:', process.env.STRIPE_ENDPOINT_SECRET)
//console.log('STRIPE_ENDPOINT_SECRET:', process.env.STRIPE_ENDPOINT_SECRET)
///////////////////////////////////////////////////////////////////////////////////////////////////





// LIVE KEYS //////////////////////////////////////////////////////////////////////////////////
const stripe = require('stripe')('sk_live_QE4ZDUJgU1V6WYN4xwqlmcYI');
//const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
//console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY)

const endpointSecret = 'whsec_qXazbsVBbKHgQqtr2e7Ldc5z14FCmHGZ';
//const endpointSecret = ('STRIPE_ENDPOINT_SECRET:', process.env.STRIPE_ENDPOINT_SECRET)
//console.log('STRIPE_ENDPOINT_SECRET:', process.env.STRIPE_ENDPOINT_SECRET)
///////////////////////////////////////////////////////////////////////////////////////////////////


const express = require('express');
const https = require('https');
const port = 3000;
const mongoose = require('mongoose');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const passportLocalMongoose = require('passport-local-mongoose');
const session = require('express-session');


const flash = require('connect-flash');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const app = express();
const multer = require('multer');
const archiver = require('archiver');

const YOUR_DOMAIN = 'https://everafter.pics';
const options = {
  key: fs.readFileSync('/etc/letsencrypt/live/everafter.pics/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/everafter.pics/fullchain.pem')
};


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




 ////////////////////  STRIPE WEBHOOK  //////////////////////////////////

app.post('/webhook', express.raw({type: 'application/json'}), async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(request.body, sig, endpointSecret);
  } catch (err) {
    console.error("Error constructing event:", err);
    response.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log("Huzzahh!! Received Stripe Webhook event:", JSON.stringify(event, null, 2));

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      const userId = paymentIntent.metadata.userId;
  
      if (!userId) {
        console.error("UserId not found in metadata");
        break;
      }
  
      try {
        const updatedUser = await User.findByIdAndUpdate(userId, { hasPaid: true }, { new: true });
        console.log("User payment status updated:", updatedUser);
        // Handle successful update
      } catch (err) {
        console.error("Error updating user:", err);
        // Handle error
      }
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  // Return a 200 response to acknowledge receipt of the event
  response.send({received: true});
 

});

/////////////////////////// END STRIPE webhook //////////////////////////////















  function ensurePaid(req, res, next) {
    if (req.isAuthenticated() && req.user.hasPaid) {
      return next();
    }
    // Redirect to a payment page or some other page if the user hasn't paid
    res.redirect('/checkout');
  }

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
    hasPaid: { type: Boolean, default: false }   // set default to false, use true in the beta :)
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

//image moderation
app.delete('/eauploads/:userId/:imageName', (req, res) => {
  const { userId, imageName } = req.params;

  // Existing file path
  const currentFilePath = path.join(__dirname, 'eauploads', userId, imageName);

  // New "deleted" directory path
  const deletedDirPath = path.join(__dirname, 'eauploads', userId, 'deleted');
  
  // Make sure the "deleted" directory exists
  if (!fs.existsSync(deletedDirPath)) {
    fs.mkdirSync(deletedDirPath, { recursive: true });
  }

  // Path to move the deleted file
  const newFilePath = path.join(deletedDirPath, imageName);

  // Move the file
  fs.rename(currentFilePath, newFilePath, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send({ message: 'Failed to move file' });
    }
    res.status(200).send({ message: 'File moved to deleted directory' });
  });
});


// Routes  

///////////// ONE CLICK DOWNLOAD //////////////////////////////

app.get('/download/:userId', function(req, res) {
  const userId = req.params.userId;
  const dir = `./eauploads/${userId}/`;

  // Check if the directory exists
  if (!fs.existsSync(dir)) {
    res.status(404).send('User directory does not exist.');
    return;
  }

  // Set the archive name
  const archiveName = `user_${userId}_files.zip`;
  
  // Create the ZIP stream
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  // Set headers for the browser to recognize a zip file
  res.writeHead(200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename=${archiveName}`
  });

  // Pipe the ZIP archive to the response
  archive.pipe(res);

  // Append files from a directory
  archive.directory(dir, false);

  // Finalize the archive
  archive.finalize();
});


////////////// End OC Downlaod /////////////////////////////


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

app.get('/livefeed', ensurePaid, async (req, res) => {
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
  const { userId } = req.params;
  const dirPath = path.join(__dirname, 'eauploads', userId);

  fs.readdir(dirPath, (err, files) => {
    if (err) {
      return res.status(500).send({ message: 'Failed to read directory' });
    }

    // Filter out the "deleted" directory and any other non-image files if needed
    const imageFiles = files.filter(file => file !== 'deleted' /* && other conditions, e.g., file extension checks */);
    
    res.json({ files: imageFiles });
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

app.post('/admin-upload/:userId/submit', upload.array('sampleFile', 10), (req, res) => {
  const fileInfos = req.files.map(file => ({ name: file.filename, path: `/eauploads/${req.params.userId}/${file.filename}` }));
  res.json({ success: true, files: fileInfos });
  
});


  

app.get('/admin-upload/:userId', (req, res) => {
  const userId = req.params.userId;
  // You may want to check if this userId corresponds to a paid user
  res.render('admin-upload', { userId });
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

  return 100;  /// SET THIS BACK TO 3500 WHEN LIVE
};

app.post("/create-payment-intent", async (req, res) => {
  const { items } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: calculateOrderAmount(items),
    currency: "USD",
    metadata: { userId: req.user._id.toString() },
    // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
    automatic_payment_methods: {
      enabled: true,
    },
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

 

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

app.get('/loginDemo', (req, res) => {
  res.render('loginDemo');
});



app.post('/login', passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: 'Invalid username or password.'
}), (req, res) => {
    if (req.user.hasPaid) {
        res.redirect('/dashboard_paid');
    } else {
        res.redirect('/checkout');  // or any other default page for logged-in but unpaid users
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



  // Public live feed route without image moderation
  app.get('/livefeed_public/:userId', async (req, res) => {
    const userId = req.params.userId;
    res.render('livefeed_public', { userId });
});

// Registered User live feed route
app.get('/livefeed/:userId', ensureAuthenticated, async (req, res) => {
  const userId = req.params.userId;
  res.render('livefeed', { userId });
});




//app.get('/payment', (req, res) => {
//    res.render('payment'); // This should be your payment.ejs 
//});


app.get('/checkout', (req, res) => {
    res.render('checkout', { user: req.user });
});

///STRIPE SUCCESS PAGE? ///
app.get('/success', (req, res) => {
    res.render('success'); // This should be your checkout success page
});







//////////////////////////////////////////////////////////////////////////////////////////
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






// send public to public livefeed
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
      return next();
  }
  // Redirect to the public live feed with the same userId if not authenticated
  res.redirect(`/livefeed_public/${req.params.userId}`);
}
                                                                                 
// Function to delete files in a directory
const deleteFilesInDir = (dirPath) => {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      fs.unlinkSync(fullPath);
    }
    // Handle directories here if needed
  }
};

// Set interval to delete files in "eauploads/demo" every 15 minutes (900000 milliseconds)
setInterval(() => {
  const demoDir = './eauploads/demo';
  
  if (fs.existsSync(demoDir)) {
    deleteFilesInDir(demoDir);
    console.log(`Deleted files in ${demoDir} at ${new Date().toISOString()}`);
  } else {
    console.log(`Directory ${demoDir} doesn't exist.`);
  }
  
}, 900000);


 



app.listen(3000, () => {
    console.log('Daniel, Your server is fired up on http://localhost:3000');
});