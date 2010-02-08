// Node documentation: http://nodejs.org/api.html
// Based on node_chat: http://github.com/ry/node_chat
var fu = require("./fu");
var sys = require("sys");
var url = require("url");
var qs = require("querystring");

var HOST = undefined; // localhost
var PORT = 8001;

if (process.ARGV.length > 2) {
    var _url = url.parse("http://" + process.ARGV[2]);
    HOST = _url.hostname;
    PORT = _url.port;    
}

sys.puts(HOST + PORT);


var escapeJS = function (s) {
    return s.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "")
}


var channel = new function () {
  var client =  { message: null
                , callback: null };
  var console = { message: null
                , callback: null };
  
  this.getQueue = function (queueName) {
    return (queueName == "client" && client) || console;
  }
  
  this.talk = function (queueName, message) {
    var queue = this.getQueue(queueName);
    if (queue.callback) {
        var callback = queue.callback;
        queue.callback = null;
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

fu.get("/response", function (req, res) {
  channel.talk("console", qs.parse(url.parse(req.url).query).message);
  res.simpleJSON(200, {});
});

fu.get("/client", function (req, res) {
  channel.listen("client", function (messages) {
    res.simpleScript(200, "parent.console.command('" + escapeJS(messages) + "');");
  });
});

fu.get("/command", function (req, res) {
  channel.talk("client", qs.parse(url.parse(req.url).query).message);
  res.simpleJSON(200, {});
});

fu.get("/console", function (req, res) {
  channel.listen("console", function (messages) {
    res.simpleScript(200, "parent.command('" + escapeJS(messages) + "');");
  });
});