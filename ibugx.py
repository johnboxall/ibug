"""
TODO: idea of external / internal ports

TODO: Cleanup!
TODO: Add idea of 'rooms'

    upstream ibugx {
        server 127.0.0.1:1840; 
    }

    server {
        listen 80;
        server_name ibugx.offdek.com

        location / {
            proxy_pass_header Server;
            proxy_set_header Host $http_host;
            proxy_redirect false;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Scheme $scheme;
            proxy_pass http://ibugx;
        }

    }


"""
import socket
import mimetypes
import logging
import os

import tornado.httpserver
import tornado.ioloop
import tornado.web

# http://code.google.com/p/fbug/source/browse/#svn/trunk/ibug
# http://m.com:1840/firebug.html

# Setup ************************************************************************

import platform

HOST, PORT = {
    "chalkboard": ("offdek.com", 1840),
    "john.local": ("m.com", 1840),

}[platform.node()]


# Utils ************************************************************************

def escape_js(s):
    return s.replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    
#def get_file(path, args=None):
#    args = args or {}
#    return file(path).read() % args

def get_host_info():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("getfirebug.com", 80))
    host = s.getsockname()[0]
    s.close()
    # return {"host": host, "port": port}
    # return {"host": "ibugx.offdek.com", "port": 80}
    return {"host": HOST, "port": PORT}


# Utils ************************************************************************

class MessageMixin(object):
    # TODO: Do we need the idea of a message queue?

    phone_waiters = []
    console_waiters = []

    
    def wait_for_phone_message(self, callback):
        MessageMixin.phone_waiters.append(callback)
        
    def new_phone_message(self, message):
        for callback in MessageMixin.phone_waiters:
            callback(message)
        MessageMixin.phone_waiters = []
        
    def wait_for_console_message(self, callback):
        MessageMixin.console_waiters.append(callback)
        
    def new_console_message(self, message):
        for callback in MessageMixin.console_waiters:
            callback(message)
        MessageMixin.console_waiters = []


# Handlers *********************************************************************

class CommandHandler(tornado.web.RequestHandler, MessageMixin):
    @tornado.web.asynchronous
    def get(self):
        message = self.request.arguments.get("message")[0]
        #print "CommandHandler.get: %s" % message
        
        self.new_phone_message(message)
        self.wait_for_console_message(self.async_callback(self.on_new_message))
    
    def on_new_message(self, message):
        if self.request.connection.stream.closed():
           return
        self.set_header("Content-Type", "application/x-javascript")
        self.finish(message)

class BrowserHandler(tornado.web.RequestHandler, MessageMixin):
    @tornado.web.asynchronous
    def get(self):
        self.write(file("browser.html").read())
        self.wait_for_console_message(self.async_callback(self.on_new_message))
    
    def on_new_message(self, message):
        if self.request.connection.stream.closed():
           return
        self.finish("<script>command('%s')</script>" % escape_js(message))


class ResponseHandler(tornado.web.RequestHandler, MessageMixin):
    def get(self):
        message = self.request.arguments.get("message")[0]
        
        #print message
        
        self.new_console_message(message)
        self.write('')


class PhoneHandler(tornado.web.RequestHandler, MessageMixin):
    @tornado.web.asynchronous
    def get(self):
        #print "PhoneHandler.get"
        self.write(file("phone.html").read())
        self.wait_for_phone_message(self.async_callback(self.on_new_message))
    
    def on_new_message(self, message):
        # print "PhoneHandler.on_new_message: %s" % message
        if self.request.connection.stream.closed():
           return
        self.finish("<script>command('%s')</script>" % escape_js(message))





class ScriptHandler(tornado.web.RequestHandler):
    def get(self):
        path = self.request.path.split("/")[-1]
        mimetype = mimetypes.guess_type(path)[0]
        self.set_header("Content-Type", mimetype)
        # @@@ Always run off 80.
        # self.write("var ibugHost = '%(host)s:%(port)s';" % get_host_info())
        self.write("var ibugHost = '%(host)s';" % get_host_info())
        self.write(file(path).read())


class FileHandler(tornado.web.RequestHandler):
    def get(self):
        path = self.request.path.split("/")[-1]
        mimetype = mimetypes.guess_type(path)[0]
        self.set_header("Content-Type", mimetype)
        
        try:
            self.write(file(path).read())
        except:
            self.write('')


# Application ******************************************************************

settings = {
    "static_path": os.path.join(os.path.dirname(__file__), "static"),
}

application = tornado.web.Application([
    (r"/ibugx/command", CommandHandler),
    (r"/ibugx/response", ResponseHandler),
    (r"/ibugx/browser", BrowserHandler),
    (r"/ibugx/phone", PhoneHandler),
    (r"/ibugx/\w+\.js", ScriptHandler),
    (r"/ibugx/.*", FileHandler)
], **settings)

# application = tornado.web.Application([
#     (r"/command", CommandHandler),
#     (r"/response", ResponseHandler),
#     (r"/browser", BrowserHandler),
#     (r"/phone", PhoneHandler),
#     (r"/\w+\.js", ScriptHandler),
#     (r".*", FileHandler)
# ])


if __name__ == "__main__":
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(PORT)
    tornado.ioloop.IOLoop.instance().start()
