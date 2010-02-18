(function() {
    var host = document.location.host;
    var consoleFrame,
        consoleBody,
        commandLine,
        commandHistory = [""],
        commandPointer = 0,
        commandInsertPointer = -1,
        commandHistoryMax = 1000,
        frameVisible = false,
        messageQueue = [],
        groupStack = [],
        timeMap = {},
        clPrefix = ">>> ",
        greeting = 'Paste this into the head of any HTML pages you want to debug:',
        codeToPaste = '<script type="application/x-javascript" src="http://' + host + '/ibug.js"></script>',
        // JOHN
        iframe,
        scriptCount = 0;
    
    // ********************************************************************************************
    
    function init() {
        consoleFrame = document.getElementById("inner");
        consoleBody = document.getElementById("log");
        commandLine = document.getElementById("commandLine");
        
        addEvent(commandLine, "keydown", onCommandLineKeyDown);
        
        layout();
        
        commandLine.focus();
        commandLine.select();
        
        logRow([greeting], "info");
        logRow([escapeHTML(codeToPaste)], "text");
        
        // JOHN
        iframe = document.createElement("iframe");
        iframe.style.border = "none";       
        document.body.appendChild(iframe);
        listen();
    }

    // JOHN:    
    function listen() {
        var script = document.createElement("script");
        // Use scriptCount to avoid caching interfering with results.
        script.src = "http://" + host + "/console?" + scriptCount++;
        script.onload = listen;
        iframe.contentDocument.body.appendChild(script);
    }
    
    function focusCommandLine() {
        toggleConsole(true);
        if (commandLine) {
            commandLine.focus();
        }
    }

    function evalCommandLine() {
        var text = commandLine.value;
        commandLine.value = "";
        
        appendToHistory(text);
        logRow([clPrefix, text], "command");
        
        sendCommand(text);
    }
    
    function sendCommand(text) {
        var message = escape(text).replace("+", "%2B");
        var request = new XMLHttpRequest();
        // Hack: Hardcoded to a single message.
        //       Command length is limited to the max uri of the browser.
        request.open("GET", "command?n=1&l=1&b=0&m=" + message, true);
        request.send(null);
    }
    
    function appendToHistory(command, unique) {
        if (unique && commandHistory[commandInsertPointer] == command) {
            return;
        }
        
        ++commandInsertPointer;
        if (commandInsertPointer >= commandHistoryMax) {
            commandInsertPointer = 0;
        }
        
        commandPointer = commandInsertPointer + 1;
        commandHistory[commandInsertPointer] = command;
    }
    
    function cycleCommandHistory(dir) {
        commandHistory[commandPointer] = commandLine.value;
        
        if (dir < 0) {
            --commandPointer;
            if (commandPointer < 0) {
                commandPointer = 0;
            }
        }
        else {
            ++commandPointer;
            if (commandPointer > commandInsertPointer+1) {
                commandPointer = commandInsertPointer+1;
            }
        }
        
        var command = commandHistory[commandPointer];
        
        commandLine.value = command;
        commandLine.setSelectionRange(command.length, command.length);
    }
    
    function layout() {
        var toolbar = consoleBody.ownerDocument.getElementById("toolbar");
        var height = consoleFrame.offsetHeight - (toolbar.offsetHeight + commandLine.offsetHeight);
        consoleBody.style.top = toolbar.offsetHeight + "px";
        consoleBody.style.height = height + "px";
    }
    
    // ********************************************************************************************
    
    function logRow(message, className, handler) {
        var isScrolledToBottom = consoleBody.scrollTop + consoleBody.offsetHeight >= consoleBody.scrollHeight;
        
        if (!handler) {
            handler = writeRow;
        }
        
        handler(message, className);
        
        if (isScrolledToBottom) {
            consoleBody.scrollTop = consoleBody.scrollHeight - consoleBody.offsetHeight;
        }
    }
    
    function logFormatted(objects, className) {
        var html = [],
            format = objects[0],
            objIndex = 0;
        
        if (typeof(format) != "string") {
            format = "";
            objIndex = -1;
        }

        var parts = parseFormat(format);
        for (var i = 0; i < parts.length; ++i) {
            var part = parts[i];
            if (part && typeof(part) == "object") {
                var object = objects[++objIndex];
                part.appender(object, html);
            } else {
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
        
        logRow(html, className);
    }

    function writeRow(message, className) {
        var row = consoleBody.ownerDocument.createElement("div");
        row.className = "logRow" + (className ? " logRow-"+className : "");
        row.innerHTML = message.join("");
        appendRow(row);        
    }

    function appendRow(row) {
        //console.log("appendROW:", row);
        var container = groupStack.length ? groupStack[groupStack.length-1] : consoleBody;
        container.appendChild(row);
    }

    function parseFormat(format) {
        var parts = [];

        var reg = /((^%|[^\\]%)(\d+)?(\.)([a-zA-Z]))|((^%|[^\\]%)([a-zA-Z]))/;    
        var appenderMap = {
            s: appendText, 
            d: appendInteger, 
            i: appendInteger, 
            f: appendFloat
        };

        for (var m = reg.exec(format); m; m = reg.exec(format)) {
            var type = m[8] ? m[8] : m[5];
                appender = type in appenderMap ? appenderMap[type] : appendObject;
                precision = m[3] ? parseInt(m[3], 10) : (m[4] == "." ? -1 : 0);
            
            parts.push(format.substr(0, m[0][0] == "%" ? m.index : m.index+1));
            parts.push({appender: appender, precision: precision});
            
            format = format.substr(m.index+m[0].length);
        }

        parts.push(format);

        return parts;
    }

    // ********************************************************************************************

    function addEvent(object, name, handler) {
        if (document.all) {
            object.attachEvent("on"+name, handler);
        } else {
            object.addEventListener(name, handler, false);
        }
    }
    
    function removeEvent(object, name, handler) {
        if (document.all) {
            object.detachEvent("on"+name, handler);
        } else {
            object.removeEventListener(name, handler, false);
        }
    }
    
    function cancelEvent(event) {
        if (document.all) {
            event.cancelBubble = true;
        } else {
            event.stopPropagation();
        }
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
        
    function onCommandLineKeyDown(event) {
        if (event.keyCode == 13) {
            evalCommandLine();
        } else if (event.keyCode == 27) {
            commandLine.value = "";
        } else if (event.keyCode == 38) {
            cycleCommandHistory(-1);
        } else if (event.keyCode == 40) {
            cycleCommandHistory(1);
        }
    }

    window.command = function(text) {
        // JOHN: I've had trouble with the \0 character.
        // var lines = text.split("\0");
        var lines = text.split("||");
        var className, html;
        
        // JOHN HACK
        if (lines.length == 1) {
            html = lines[0];
        } else {
            className = lines[0];
            html = lines[1];
        }
        logRow([html], className);
    };
    
    window.clearConsole = function() {
        consoleBody.innerHTML = "";    
    };

    init();
    
})();
