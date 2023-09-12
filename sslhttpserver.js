const https = require('https');
const fs = require('fs');

// readFileSync function must use __dirname get current directory
// require use ./ refer to current directory.

const options = {
   key: fs.readFileSync(__dirname + '/private.key', 'utf8'),
  cert: fs.readFileSync(__dirname + '/public.cert', 'utf8')
};


 // Create HTTPs server.

 var server = https.createServer(options, app);