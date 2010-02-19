// Node documentation: http://nodejs.org/api.html
// Based on node_chat: http://github.com/ry/node_chat
var fu = require("./fu");
var sys = require("sys");
var url = require("url");
var qs = require("querystring");

var HOST = undefined; // localhost
var PORT = 8001;

if (process.ARGV.length > 2) {
    var _url;
    // if its just an init then port#
    //if (process.ARGV[2].parseInt())

    var _url = url.parse("http://" + process.ARGV[2]);
    HOST = _url.hostname;
    PORT = _url.port;    
}

var escapeJS = function (s) {
    return s.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "")
}

var channel = new function () {
  var client =  { queue: {}
                , callback: null };
  var console = { queue: {}
                , callback: null };
  
  this.getQueue = function (queueName) {
    return (queueName == "client" && client) || console;
  }
  
  // Message are broken into bits, so queue them until we recieve all the bits.
  this.queue = function (queueName, encodedBit, messageNumber, bitLength, bitNumber) {
    var queue = this.getQueue(queueName);
    
    // [bit1, bit2, bit3, ..., bitx, number_of_bits_recieved]
    if (!queue[messageNumber]) {
      queue[messageNumber] = [];
      queue[messageNumber][bitLength] = 1;
    } else {
        queue[messageNumber][bitLength]++;
    }
    
    queue[messageNumber][bitNumber] = encodedBit
        
    // If all bits in a message are here, send it.
    if (queue[messageNumber][bitLength] == bitLength && queue.callback) {
      var message;
      var callback = queue.callback;
      queue.callback = null;
      
      // Don't send # of bits recieved.
      queue[messageNumber].pop();
      
      message = queue[messageNumber].join("");
      
      try {
        message = decodeURIComponent(message);
      } catch (err) {};
      
      delete queue[messageNumber];
    
      callback(message);
    }
  };
  
  this.listen = function (queueName, callback) {
    var queue = this.getQueue(queueName);
    queue.callback = callback;
  };

};

fu.listen(PORT, HOST);
fu.get("/", fu.staticHandler("firebug.html"));
fu.get("/firebug.css", fu.staticHandler("firebug.css"));
fu.get("/firebug.js", fu.staticHandler("firebug.js"));
fu.get("/ibug.js", fu.staticHandler("ibug.js"));

// TODO: DRY us up!

fu.get("/response", function (req, res) {
  // HACK: The message has been split, so don't decode it until it's all here.
  var m = req.url.match(/\?n=(.*?)&l=(.*?)&b=(.*?)&m=(.*)/);
  var messageNumber = m[1];
  var bitLength = m[2]
  var bitNumber = m[3];
  var encodedBit = m[4];
    
  channel.queue("console", encodedBit, messageNumber, bitLength, bitNumber);
  res.simpleJSON(200, {});
});

fu.get("/command", function (req, res) {
  // HACK: The message has been split, so don't decode it until it's all here.
  var m = req.url.match(/\?n=(.*?)&l=(.*?)&b=(.*?)&m=(.*)/);
  var messageNumber = m[1];
  var bitLength = m[2]
  var bitNumber = m[3];
  var encodedBit = m[4];
    
  channel.queue("client", encodedBit, messageNumber, bitLength, bitNumber);
  res.simpleJSON(200, {});
});

fu.get("/client", function (req, res) {
  channel.listen("client", function (message) {
    var s = qs.parse(url.parse(req.url).query).s;
    res.simpleScript(200, "parent.console.command('" + escapeJS(message) + "'); parent.console.lastScriptLoaded = " + s + ";");
  });
});

fu.get("/console", function (req, res) {
  channel.listen("console", function (message) {
    res.simpleScript(200, "parent.command('" + escapeJS(message) + "');");
  });
});