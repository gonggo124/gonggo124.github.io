import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => { res.render("home") });
app.get("/*", (_, res) => { res.redirect("/") });

const handleListen = () => { console.log(`Listening on http://localhost:8080`) };

const server = http.createServer(app);
const io = SocketIO(server);

class SpawnObjs {
    constructor(id) {
        this.bullet = {
            id: id,
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            draw: "function(){ctx.fillStyle = 'black';ctx.fillRect(this.x, this.y, this.width, this.height);}",
        };
        this.box = {
            id: id,
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            draw: "function(){ctx.fillStyle = 'green';ctx.fillRect(this.x, this.y, this.width, this.height);}",
        };
    }
}

const privateVal = {}
const limit = 700

function spawnObj(objName, posX, posY, width, height) {
    if (Object.keys(objs).length >= limit) { return }
    var { [objName]: spawnedObj } = new SpawnObjs(crypto.randomUUID())
    spawnedObj.x = posX ?? spawnedObj.x
    spawnedObj.y = posY ?? spawnedObj.y
    spawnedObj.width = width ?? spawnedObj.width
    spawnedObj.height = height ?? spawnedObj.height
    io.emit("spawn", encoder.encode(JSON.stringify(spawnedObj)))
    objs[spawnedObj.id] = spawnedObj
    privateVal[spawnedObj.id] = {}
    privateVal[spawnedObj.id].velocityX = 10
    privateVal[spawnedObj.id].velocityY = 10
}

const objs = {}
const encoder = new TextEncoder()
const decoder = new TextDecoder()

io.on("connect", (socket) => {
    socket["state"] = {}
    socket.join("global")
    socket.on("ping", (done) => {
        done();
    });
    Object.values(objs).forEach((value) => {
        socket.emit("spawn", encoder.encode(JSON.stringify(value)))
    })
    socket.on("spawn", (objName, posX, posY, width, height) => {
        spawnObj(objName, posX, posY, width, height)
    })
    socket.on("changeState", (state, value) => {
        switch (state) {
            case "location":
                socket.broadcast.emit("changePlayer", socket.id, "location", value)
                var dd = JSON.parse(decoder.decode(value))
                socket.state.x = dd.x
                socket.state.y = dd.y
                break
            case "setup":
                socket.state = value
                socket.broadcast.emit("newPlayer", socket.id, socket.state)// 새로운 플레이어 생성
                io.sockets.sockets.forEach((value, key, map) => { // 기존 플레이어 로드
                    if (key !== socket.id) {
                        io.to(socket.id).emit("newPlayer", value.id, value.state)
                    }
                });
                break
        }
    })
    socket.on("disconnecting", () => {
        io.emit("leavePlayer", socket.id)
    })
})

var changesOfObjs = []
var calcObjs = setInterval(() => {
    changesOfObjs = []
    Object.values(objs).forEach((value) => {
        privateVal[value.id].velocityY += 2
        value.y += privateVal[value.id].velocityY
        changesOfObjs.push(JSON.stringify(value))
        objs[value.id] = value
        if (value.y >= 500 || !objs.hasOwnProperty(value.id)) {
            io.emit("deleteObj", value.id)
            delete objs[value.id]
            delete privateVal[value.id]
        }
    })
    if (changesOfObjs.length !== 0) {
        io.emit("changeObj", encoder.encode(JSON.stringify(changesOfObjs)))
    }
}, 16)

//성능 테스트
// var spawnBox = setInterval(() => {
//     spawnObj("box", Math.floor((Math.random() * 500) + 1), 100, 50, 50)
// })

server.listen(8080, handleListen)