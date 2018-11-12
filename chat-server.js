"use strict";

// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'node-chat';

const wsPort = 80,
      webSocketServer = require('websocket').server,
      http = require('http'),
      clients = [],
      userList = {},
      server = http.createServer((request, response) => { /* we not use http */ });

let history = [];

server.listen(wsPort, () => {
    console.log((new Date()) + " Server is listening on port " + wsPort);
});

const wsServer = new webSocketServer({
    // WebSocket server is tied to a HTTP server. WebSocket
    // request is just an enhanced HTTP request. For more info
    // http://tools.ietf.org/html/rfc6455#page-6
    httpServer: server
});

// This callback function is called every time someone tries to connect to the WebSocket server
wsServer.on('request', request => {
    console.log(+Date.now() + ' Connection from origin ' + request.origin + '.');

    // accept connection - you should check 'request.origin' to
    // make sure that client is connecting from your website
    // (http://en.wikipedia.org/wiki/Same_origin_policy)
    // we need id for connections
    const connection = request.accept(null, request.origin);
    let index = clients.push(connection) - 1;

    console.log(+Date.now() + ' Connection accepted.');

    // send back chat history
    console.log(userList);
    (history.length > 0) && sendBroadcast('history', {msg: history, users: userList}, connection);

    /*
      if user send message or username then we register it
      the user message is json form then we send boardcast to clients
    */
    connection.on('message', message => {
        if (message.type !== 'utf8') {
            return;
        }

        let data, obj = null;
        try {
            data = JSON.parse(message.utf8Data);
        } catch (e) {
            return console.log('Invalid data: ', message.utf8Data, 'timestamp: ' + +Date.now());
        }

        let type = Object.keys(data)[0];

        if (type == "user") {
            obj = data.user;
            obj.name = htmlEntities(obj.name);
            console.log(`(${userList[obj.id || 0] ? 'Existing' : 'New'}) user change his or her name: ${obj.name}`);
            userList[obj.id] = obj;
            clients[index].userId = obj.id;
        } else if (type == "msg") {
            const user = userList[clients[index].userId];
            obj = {
                id: RandomId(),
                date: +Date.now(),
                name: user.name,
                color: user.color,
                userId: user.id,
                text: htmlEntities(data.msg)
            }
            console.log(`New message (${Date.now()}): ${obj.text}`);
            // we want to keep history of all sent messages
            history.push(obj);
            history = history.slice(-100);
        }
        obj && sendBroadcast(type, obj);
    });

    /*
      if user disconnected from server then we delete the user from userList
      log the disconnection, remove the client (connection)
      send boardcast to remain clients
    */
    connection.on('close', connection => {
        if (clients[index]) {
            const userId = clients[index].userId || false;
            console.log( (userId ? userList[userId].name : "Guest") + " disconnected.");
            if (userId) {
                delete userList[userId];
                sendBroadcast("disconnect", { userId })
            }
            clients.splice(index, 1);
        }
    });
});

function sendBroadcast(type, data, con = null) {
    const json = JSON.stringify({ type, data });
    if (con) {
        return con.sendUTF(json);
    }
    for (const client of clients) {
        client.sendUTF(json);
    }
}


function htmlEntities(str) {
  return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function RandomId(len = 8) {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return "s".repeat(len).replace(/s/g, s4);
}
