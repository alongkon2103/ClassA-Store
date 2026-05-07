const ngrok = require('ngrok');

(async function() {
  try {
    const url = await ngrok.connect(3000);
    console.log('NGROK_URL:' + url);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
