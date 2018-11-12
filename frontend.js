"use strict"
 //localStorage.clear("user");
function ChatComponent(setup) {
    const template = {
        window() {
            return `<div class="content-wrapper">
            <div class="content"></div>
            <div class="user-list"></div>
            </div>
            <div>
                <div class="status">Connecting...</div>
                <div>Name: <input name="fullname" type="text" disabled="disabled" /></div>
                <div>Message <input name="message" type="text" disabled="disabled" /></div>
            </div>`
        },
        message(list, data) {
            const options = user.id === data.userId ? "---" : "";
            return `<div data-id="msg_${data.id}" data-user-id="${data.userId}">
                <span class="name" style="color: ${colors[data.color]};">
                  ${data.name}
                </span>:
                <span class="text">${data.text}</span>
                <span class="date">${getFormattedTime(data.date)}</span>
                ${options}
            </div>`
        },
        user(data) {
            const color = getUsercolor(data.id);
            return `<div style="color: ${color};" data-id="${data.id}">
                ${data.name}
            </div>`;
        },
        users(list, mode = "overwrite") {
            let str = "";
            for ( const user of list) {
                str += this.user(user);
            }

            if (mode ==  "overwrite") {
                DOM.users.textContent = str;
            } else {
                DOM.users.insertAdjacentHTML("beforeend", str);
            }
        }
    },
    ws = {},
    user = getUser(),
    colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];

    let DOM, userList = {};

    window.WebSocket = window.WebSocket || window.MozWebSocket;
    if (!window.WebSocket) {
        alert("Your browser not support the WebSocket connection!");
        return;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        const root = document.querySelector(setup.rootSelector);

        if (!root) {
            alert("#root element not found in dom structure!");
        }

        root.innerHTML = template.window();

        DOM = {
            root: root,
            content: root.querySelector(`.content`),
            users: root.querySelector(`.user-list`),
            name: root.querySelector(`[name="fullname"]`),
            msg: root.querySelector(`[name="message"]`),
            status: root.querySelector(`.status`)
        };

        DOM.name.value = user.name;

        ws.con = new WebSocket(`ws://${setup.server}:${setup.port}`);

        ws.con.onopen = function () {
            DOM.name.disabled = false;
            userList[user.id] = user;
            setStatus('Connected!');
        };

        ws.con.onerror = function (error) {
            setStatus('Something wrong with connection');
        };

        // message from server (string form)
        ws.con.onmessage = function (message) {
            let msg;
            try {
              msg = JSON.parse(message.data);
            } catch (e) {
              return console.log('Invalid JSON: ', message.data, msg);
            }

            if (msg.type === 'user') {
                userList[msg.data.id] = msg.data;
                if (msg.data.id != user.id) {
                    template.users([msg.data], 'append');
                    console.log(`${msg.data.id} connected`);
                } else {
                    const userDiv = DOM.users.querySelector(`[data-id="${user.id}"]`);
                    userDiv && (userDiv.textContent = user.name);
                }
            } else if (msg.type === 'history') { // entire message history
                  userList = Object.assign(userList, msg.data.users);
                  template.users(Object.values(userList), 'append');
                  const msgs = msg.data.msg;
                  // insert every single message to the chat window
                  for (const msgData  of msgs) {
                      addMessage (msgData);
                  }
            } else if (msg.type === 'disconnect') {
                console.log(`${msg.data.userId} disconnected`);
                const userDiv = DOM.users.querySelector(`[data-id="${msg.data.userId}"]`);
                userDiv && userDiv.remove();
            } else if (msg.type === 'msg') {
                DOM.msg.disabled = false;
                addMessage (msg.data);
                DOM.content.scrollTop = DOM.content.scrollHeight;
            } else {
                console.log('Hmm..., I\'ve never seen JSON like this:', msg);
            }
        };

        DOM.name.onkeydown = ev => {
            const e = ev.target;
            if (ev.keyCode === 13) {
                if (!e.value.trim()) {
                    return alert('Please write a correct name');
                }
                DOM.name.disabled = true;
                DOM.msg.disabled = false;
                user.name = e.value;
                const json = JSON.stringify({user});
                localStorage.setItem("user", json);
                ws.con.send(json);
            }
        };

        DOM.msg.onkeydown = ev => {
          const e = ev.target;
          if (ev.keyCode === 13) {
              if (!user.name) {
                  return alert('You must have a name!');
              }

              const msg = e.value.trim();

              if (!msg) {
                return alert("empty field");
              }
              // send the message as an ordinary text
              ws.con.send(JSON.stringify({ msg }));
              e.value = '';
              // disable the input field to make the user wait until server
              // sends back response
              DOM.msg.disabled = true;
              DOM.name.disabled = true;
          }
        };

        function setStatus(msg) {
            DOM.status.textContent = msg;
        }

        setInterval(function() {
            if (ws.con.readyState !== 1) {
                setStatus('Error: Unable to communicate with the WebSocket server');
                DOM.msg.disabled = true;
                DOM.name.disabled = true;
            }
        }, 3000);

        function addMessage(data) {
            DOM.content.insertAdjacentHTML('beforeend', template.message(userList, data));
        }
    }



    function getUsercolor(id) {
        return colors[userList[id].color];
    }

    function RandomId(len = 8) {
    	  function s4() {
    		    return Math.floor((1 + Math.random()) * 0x10000)
    		      	.toString(16)
    		      	.substring(1);
    		}
    		return "s".repeat(len).replace(/s/g, s4);
    }

    function getUser() {
        const ls = localStorage.getItem("user");
        return ls ? JSON.parse(ls).user : {
            id: RandomId(),
            color: Math.round(Math.random() * 3) + 1,
            status: 0,
            name: 'Guest'
        };
    }

    function getFormattedTime(timestamp) {
        const d = new Date(timestamp);
    		return (
      			(d.getHours()+"").padStart(2, "0") + ":" +
      			(d.getMinutes()+"").padStart(2, "0") + ":" +
      			(d.getSeconds()+"").padStart(2, "0")
    		);
    }

  return {}
}

const setup = {
    rootSelector: "#root.chat",
    server: "172.17.0.2",
    port: "80"
}

new ChatComponent(setup);