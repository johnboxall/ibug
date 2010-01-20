import webbrowser
import socket
from urlparse import urlparse
from cgi import parse_qs
from urllib import unquote
import signal, thread, threading, time, sys
import BaseHTTPServer, SocketServer, mimetypes

# **************************************************************************************************
# Globals

global done, server, consoleCommand, phoneResponse

done = False
server = None
phoneResponseEvent = threading.Event()
consoleEvent = threading.Event()

webPort = 1840

# **************************************************************************************************

class WebServer(SocketServer.ThreadingMixIn, BaseHTTPServer.HTTPServer):
    pass
    
class WebRequestHandler(BaseHTTPServer.BaseHTTPRequestHandler):
    def do_GET(self):
        print "%s" % self.path

        host, path, params, query = parseURL(self.path)
        
        if path == "/command":
            postConsoleCommand(query.get("message"))
            response = waitForPhoneResponse()
            
            self.respond(200, "application/x-javascript")
            self << response
            
        elif path == "/response":
            postPhoneResponse(query.get("message"))

        elif path == "/browser":
            self.respond(200, "text/html")
            self.wfile.write(getFormattedFile("browser.html"))
            self.wfile.flush()

            while 1:
#                print 'waitForPhoneResponse'
                message = waitForPhoneResponse()
#                print 'sending to phone ...'
                msg = escapeJavaScript(message)
                self.wfile.write("<p>%s</p><script>command('%s')</script>" % (msg, msg))
                self.wfile.flush()

        elif path == "/phone":
            self.respond(200, "text/html")
            self << getFormattedFile("phone.html")
            self.wfile.flush()

            while 1:
#                print 'waitForConsoleCommand'
                message = waitForConsoleCommand()
                msg = escapeJavaScript(message)
#                print 'sending to console. ...'
                self.wfile.write("<p>%s</p><script>command('%s')</script>" % (msg, msg))
                self.wfile.flush()

        elif path in ["/ibug.js", "/firebug.js"]:
            header = "var ibugHost = '%(hostName)s:%(port)s';" % getHostInfo()
            self.sendFile(path[1:], header=header)

        else:
            if "favicon" in path:
                self.respond(200, "text/html")
                self << ""
            else:
                self.sendFile(path[1:])
    
    def respond(self, code=200, mimeType="text/plain"):
        self.send_response(code)
        self.send_header("Content-Type", mimeType)
        self.end_headers()
        #self << "HTTP/1.1 %s %s\n" % (code, "OK")
        #self << "Content-Type: %s\n" % mimeType
        #self << "\n"
    
    def sendFile(self, path, mimeType=None, header=None):
        if not mimeType:
            mimeType = mimetypes.guess_type(path)[0]
            
        self.respond(200, mimeType)
        if header:
            self << header
        self << file(path).read()
        
    def __lshift__(self, text):
        print text
        try:
            self.wfile.write(text)
        except:
            pass
        
# **************************************************************************************************

def serve():    
    signal.signal(signal.SIGINT, terminate)
    thread.start_new_thread(runServer, ())
    
    global done
    while not done:
        try:
            time.sleep(0.3)
        except IOError:
            pass
   
    global server
    server.server_close()
    
def runServer():
    print "Paste this code into the <head> of all HTML that will run on your iPhone:"
    print getFormattedFile("embed.html", getHostInfo())

    url = "http://%(hostName)s:%(port)s/firebug.html" % getHostInfo()
    if "launch" in sys.argv:
        print "Launching the console at:\n"
        webbrowser.open(url)
    else:
        print "Load this page in your browser:\n"

    print "    %s" % url
    
    print "\nFirebug server is running..."

    global server
    server = WebServer(("", webPort), WebRequestHandler)
    server.allow_reuse_address = True
    server.serve_forever()

def terminate(sig_num, frame):
    global done
    done = True    

# **************************************************************************************************

def postConsoleCommand(message):
    global consoleCommand
    consoleCommand = message
    consoleEvent.set()
    
def waitForConsoleCommand():
    consoleEvent.wait()
    consoleEvent.clear()

    global consoleCommand
    return consoleCommand

def postPhoneResponse(message):
    global phoneResponse
    phoneResponse = message
    phoneResponseEvent.set()
    
def waitForPhoneResponse():
    phoneResponseEvent.wait()
    phoneResponseEvent.clear()

    global phoneResponse
    return phoneResponse

# **************************************************************************************************

def parseURL(url):
    """ Parses a URL into a tuple (host, path, args) where args is a dictionary."""
    
    scheme, host, path, params, query, hash = urlparse(url)
    if not path: path = "/"

    args = parse_qs(query)

    escapedArgs = {}
    for name in args:
        if len(args[name]) == 1:
            escapedArgs[unquote(name)] = unquote(args[name][0])
        else:
            escapedArgs[unquote(name)] = escapedSet = []
            for item in args[name]:
                escapedSet.append(unquote(item))

    return host, path, params, escapedArgs

def escapeJavaScript(text):
    return text.replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    
def getFormattedFile(path, args={}):
    return file(path).read() % args

def getHostInfo():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("getfirebug.com", 80))
    hostName = s.getsockname()[0]
    s.close()
    
    return {"hostName": "m.com", "port": "1840"}
    ## return {"hostName": hostName, "port": webPort}

# **************************************************************************************************

if __name__ == "__main__":
    serve()
