import socket
import mimetypes
import logging
import os

import tornado.httpserver
import tornado.ioloop
import tornado.web

# Doesn't seem to work w/ localhost, so fake it with /etc/hosts
HOST = "m.com"

# Port _MUST_ be 80 in this implementation.
PORT = 80


# Utils ************************************************************************

def escape_js(s):
    return s.replace("'", "\\'").replace("\n", "\\n").replace("\r", "")
    
def get_host_info():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.connect(("getfirebug.com", 80))
    host = s.getsockname()[0]
    s.close()    
    # return {"host": host, "port": port}
    return {"host": HOST, "port": PORT}


# Utils ************************************************************************

class MessageMixin(object):
    """
    Based on: 
        http://github.com/facebook/tornado/blob/master/demos/chat/chatdemo.py
    
    """
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
        self.new_phone_message(message)
        print 'waiting for console'
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
        self.new_console_message(message)
        self.write('')


class PhoneHandler(tornado.web.RequestHandler, MessageMixin):
    @tornado.web.asynchronous
    def get(self):
        self.write(file("phone.html").read())
        self.wait_for_phone_message(self.async_callback(self.on_new_message))
    
    def on_new_message(self, message):
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
    (r"/command", CommandHandler),
    (r"/response", ResponseHandler),
    (r"/browser", BrowserHandler),
    (r"/phone", PhoneHandler),
    (r"/\w+\.js", ScriptHandler),
    (r".*", FileHandler)
])


if __name__ == "__main__":
    http_server = tornado.httpserver.HTTPServer(application)
    http_server.listen(PORT)
    tornado.ioloop.IOLoop.instance().start()
