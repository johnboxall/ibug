if (!("console" in window) || !("firebug" in console)) {
(function() {

    // JOHN: Save a reference to the console for debugging ;)
    window._console = window.console

    window.console = {
        firebug: "ibug0.1",
        
        log: function() {
            logFormatted(arguments, "");
        },
        
        debug: function() {
            logFormatted(arguments, "debug");
        },
        
        info: function() {
            logFormatted(arguments, "info");
        },
        
        warn: function() {
            logFormatted(arguments, "warning");
        },
        
        error: function() {
            logFormatted(arguments, "error");
        },
        
        assert: function(truth, message) {
            if (!truth) {
                var args = [];
                for (var i = 1; i < arguments.length; ++i)
                    args.push(arguments[i]);
                
                logFormatted(args.length ? args : ["Assertion Failure"], "error");
                throw message ? message : "Assertion Failure";
            }
        },
        
        dir: function(object) {
            var html = [],
                pairs = [];
            
            for (var name in object) {
                try {
                    pairs.push([name, object[name]]);
                } catch (exc) { }
            }
            
            pairs.sort(function(a, b) { return a[0] < b[0] ? -1 : 1; });
            
            html.push('<table>');
            for (var i = 0; i < pairs.length; ++i) {
                var name = pairs[i][0], value = pairs[i][1];
                
                html.push('<tr>', 
                '<td class="propertyNameCell"><span class="propertyName">',
                    escapeHTML(name), '</span></td>', '<td><span class="propertyValue">');
                appendObject(value, html);
                html.push('</span></td></tr>');
            }
            html.push('</table>');
            
            logRow(html, "dir");
        },
        
        dirxml: function(node) {
            var html = [];
            
            appendNode(node, html);
            logRow(html, "dirxml");
        },
        
        group: function() {
            logRow(arguments, "group", pushGroup);
        },
        
        groupEnd: function() {
            logRow(arguments, "", popGroup);
        },
        
        time: function(name) {
            timeMap[name] = (new Date()).getTime();
        },
        
        timeEnd: function(name) {
            if (name in timeMap) {
                var delta = (new Date()).getTime() - timeMap[name];
                logFormatted([name+ ":", delta+"ms"]);
                delete timeMap[name];
            }
        },
        
        count: function() {
            this.warn(["count() not supported."]);
        },
        
        trace: function() {
            this.warn(["trace() not supported."]);
        },
        
        profile: function() {
            this.warn(["profile() not supported."]);
        },
        
        profileEnd: function() { },
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
       
        $: function(id) {
            return document.getElementById(id);
        },

        $$: function(selector) {
            // XXXjoe Make this into getElementsBySelector
            return document.getElementsByTagName(selector);
        },
        
        // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
        
        onError: function(msg, href, lineNo) {
            var html = [],        
                lastSlash = href.lastIndexOf("/"),
                fileName = lastSlash == -1 ? href : href.substr(lastSlash+1);
            
            html.push(
                '<span class="errorMessage">', msg, '</span>', 
                '<div class="objectBox-sourceLink">', fileName, ' (line ', lineNo, ')</div>'
            );
        
            logRow(html, "error");
        },
        
        command: function(text) {
            with (console) {
                try {
                    var result = eval(text);
                    console.log(result);
                }
                catch (exc) {
                    console.onError(exc.message, exc.sourceId+"", exc.line);
                }
            }
        }
    };


    // ********************************************************************************************
     
    var timeMap = {},
        queue = [],
        scriptCount = 0,
        iframe,
        ibugHost;
    
    // JOHN
    function init() {
        // Figure out what the correct host is.
        var scripts =  document.getElementsByTagName("script");
        for (var i = 0; i < scripts.length; i++) {
            var script = scripts[i];
            if (/ibug\.js/.test(script.src)) {
                ibugHost = script.src.split("/")[2];
            }
        }
    
        iframe = document.createElement("iframe");
        document.body.appendChild(iframe);
        iframe.style.display = "none";
        listen();
    }
    
    // JOHN
    function listen() {
        var script = document.createElement("script");
        script.src = "http://" + ibugHost + "/client?" + scriptCount++;
        script.onload = listen;
        // script.onerror = listen;
        iframe.contentDocument.body.appendChild(script);        

    }
        
    function sendMessage(message) {    
        var img = document.createElement("img");
        img.style.visibility = "hidden";
        document.body.appendChild(img);
        img.onerror = function() {
            img.parentNode.removeChild(img);
        }
    
        var message = escape(message);    
        img.src = "http://" + ibugHost + "/response?message=" + message;    
    }

    
    
        
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
               
    function appendText(object, html) {
        html.push(escapeHTML(objectToString(object)));
    }

    function appendNull(object, html) {
        html.push('<span class="objectBox-null">', escapeHTML(objectToString(object)), '</span>');
    }

    function appendString(object, html) {
        html.push('<span class="objectBox-string">&quot;', escapeHTML(objectToString(object)),
            '&quot;</span>');
    }

    function appendInteger(object, html) {
        html.push('<span class="objectBox-number">', escapeHTML(objectToString(object)), '</span>');
    }

    function appendFloat(object, html) {
        html.push('<span class="objectBox-number">', escapeHTML(objectToString(object)), '</span>');
    }

    function appendFunction(object, html) {
        var reName = /function ?(.*?)\(/;
        var m = reName.exec(objectToString(object));
        var name = m ? m[1] : "function";
        html.push('<span class="objectBox-function">', escapeHTML(name), '()</span>');
    }

    function appendArray(object, html) {
        html.push('<span class="arrayLeftBracket">[</span>');
        for (var i = 0; i < object.length; ++i) {
            if (i > 0) {
                html.push('<span class="arrayComma">,</span>');
            }
            appendObject(object[i], html);
        }
        html.push('<span class="arrayRightBracket">]</span>');
    }
    
    function appendObject(object, html) {
        try {
            if (object == undefined) {
                appendNull("undefined", html);
            } else if (object == null) {
                appendNull("null", html);
            } else if (typeof object == "string") {
                appendString(object, html);
            } else if (typeof object == "number") {
                appendInteger(object, html);
            } else if (object.nodeType == 1) {
                appendSelector(object, html);
            } else if (object == window || object == document) {
                appendObjectFormatted(object, html);
            } else if (typeof(object.length) == "number") {
                appendArray(object, html);
            } else if (typeof object == "object") {
                appendObjectFormatted(object, html);
            } else if (typeof object == "function") {
                appendFunction(object, html);
            } else {
                appendText(object, html);
            }
        } catch (exc) { }
    }
    
    function appendObjectFormatted(object, html) {
        var text = objectToString(object);
            reObject = /\[object (.*?)\]/,
            m = reObject.exec(text);

        html.push('<span class="objectBox-object">', m ? m[1] : text, '</span>')
    }
    
    function appendSelector(object, html) {
        html.push('<span class="objectBox-selector">');

        html.push('<span class="selectorTag">', escapeHTML(object.nodeName.toLowerCase()), '</span>');
        if (object.id)
            html.push('<span class="selectorId">#', escapeHTML(object.id), '</span>');
        if (object.className)
            html.push('<span class="selectorClass">.', escapeHTML(object.className), '</span>');

        html.push('</span>');
    }

    function appendNode(node, html) {
        if (node.nodeType == 1) {
            html.push(
                '<div class="objectBox-element">',
                    '&lt;<span class="nodeTag">', node.nodeName.toLowerCase(), '</span>');

            for (var i = 0; i < node.attributes.length; ++i) {
                var attr = node.attributes[i];
                if (!attr.specified)
                    continue;
                
                html.push('&nbsp;<span class="nodeName">', attr.nodeName.toLowerCase(),
                    '</span>=&quot;<span class="nodeValue">', escapeHTML(attr.nodeValue),
                    '</span>&quot;')
            }

            if (node.firstChild) {
                html.push('&gt;</div><div class="nodeChildren">');

                for (var child = node.firstChild; child; child = child.nextSibling)
                    appendNode(child, html);
                    
                html.push('</div><div class="objectBox-element">&lt;/<span class="nodeTag">', 
                    node.nodeName.toLowerCase(), '&gt;</span></div>');
            }
            else {
                html.push('/&gt;</div>');
            }
        } else if (node.nodeType == 3) {
            html.push('<div class="nodeText">', escapeHTML(node.nodeValue),
                '</div>');
        }
    }
        
    // * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *

    // JOHN TODO: Bring back the logic for doing multiple messages.
    function logRow(message, className, handler) {
    
        sendMessage(className + "||" + message.join(""));
    }
        
    function logFormatted(objects, className) {
        var html = [];

        var format = objects[0];
        var objIndex = 0;

        if (typeof format != "string") {
            format = "";
            objIndex = -1;
        }
        
        var parts = parseFormat(format);
        for (var i = 0; i < parts.length; ++i) {
            var part = parts[i];
            if (part && typeof(part) == "object") {
                var object = objects[++objIndex];
                part.appender(object, html);
            }
            else {
                appendText(part, html);
            }
        }

        for (var i = objIndex+1; i < objects.length; ++i) {
            appendText(" ", html);
            
            var object = objects[i];
            if (typeof(object) == "string") {
                appendText(object, html);
            } else {
                appendObject(object, html);
            }
        }
        
        if (!className && html.length == 1 && typeof objects[0] == "string") {
            className = "text";
        }
         
        logRow(html, className);
    }

    function parseFormat(format) {
        var parts = [];

        var reg = /((^%|[^\\]%)(\d+)?(\.)([a-zA-Z]))|((^%|[^\\]%)([a-zA-Z]))/;
        var appenderMap = {s: appendText, d: appendInteger, i: appendInteger, f: appendFloat};

        for (var m = reg.exec(format); m; m = reg.exec(format)) {
            var type = m[8] ? m[8] : m[5];
            var appender = type in appenderMap ? appenderMap[type] : appendObject;
            var precision = m[3] ? parseInt(m[3]) : (m[4] == "." ? -1 : 0);

            parts.push(format.substr(0, m[0][0] == "%" ? m.index : m.index+1));
            parts.push({appender: appender, precision: precision});

            format = format.substr(m.index+m[0].length);
        }

        parts.push(format);

        return parts;
    }

    function escapeHTML(value) {
        function replaceChars(ch) {
            switch (ch) {
                case "<":
                    return "&lt;";
                case ">":
                    return "&gt;";
                case "&":
                    return "&amp;";
                case "'":
                    return "&#39;";
                case '"':
                    return "&quot;";
            }
            return "?";
        };
        return String(value).replace(/[<>&"']/g, replaceChars);
    }

    function objectToString(object) {
        try {
            return object+"";
        } catch (exc) {
            return null;
        }
    }

    setTimeout(init, 0);
})();
}