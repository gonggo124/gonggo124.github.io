const socket = io()
const canvas = document.querySelector("canvas")
const ctx = canvas.getContext('2d')

canvas.width = 1500
canvas.height = 800

var ping = 1
setInterval(() => {
    const start = Date.now();

    socket.emit("ping", () => {
        const duration = Date.now() - start;
        ping = duration
    });
}, 1000);

var user = {
    _x: 10,
    _y: 200,
    x: 10,
    y: 200,
    width: 50,
    height: 50,
    speed: 1,
    draw() {
        ctx.fillStyle = 'tomato'
        ctx.fillRect(this.x, this.y, this.width, this.height)
    },
}

var changedData = 0
const encoder = new TextEncoder()
const decoder = new TextDecoder()

const userHandler = {
    set(target, prop, value) {
        if (prop === 'x' || prop === 'y') {
            if (Math.abs(value - target[prop]) > 0.3 || (Date.now() - changedData) > 50) {
                var jsonData = JSON.stringify({ x: target['x'], y: target['y'] })
                socket.emit("changeState", "location", encoder.encode(jsonData))
                changedData = Date.now()
            }
        }
        return Reflect.set(target, prop, value);
    }
}

const userProxy = new Proxy(user, userHandler)

var pingText = {
    x: 5,
    y: 15,
    lineWidth: 1,
    color: "green",
    font: "15px Arial",
    text: "loading",
    draw() {
        ctx.lineWidth = this.lineWidth
        ctx.fillStyle = this.color
        ctx.font = this.font
        ctx.fillText(this.text, this.x, this.y)
    }
}


var velocityX = 0
var velocityY = 0
var jump = false
function playerMovement() {
    var moveDir = { x: 0, y: 0 }
    velocityY++
    if (userProxy.y + userProxy.height >= 500) {
        jump = false
        userProxy.y = 500 - userProxy.height
        velocityY = 0
    }
    if (keyPress.get("KeyW") & !jump) {
        jump = true
        velocityY -= 20
        // socket.emit("spawn", "box", Math.floor((Math.random() * 500) + 1), 100)
    }
    if (keyPress.get("KeyA")) {
        moveDir.x--
    }
    if (keyPress.get("KeyD")) {
        moveDir.x++
    }
    // var magnitude = Math.sqrt(moveDir.x ** 2 + moveDir.y ** 2)
    // if (magnitude!==0){
    //     user.x += (moveDir.x / magnitude) * user.speed
    //     user.y += (moveDir.y / magnitude) * user.speed
    // }
    velocityX += moveDir.x * userProxy.speed
    userProxy.y += velocityY
    userProxy.x += velocityX
    velocityX *= .85
}

var keyPress = new Map()
const players = new Map()
const objects = {}
function gameLoop() {
    requestAnimationFrame(gameLoop)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    playerMovement()
    userProxy.draw()
    players.forEach((value) => {
        value.draw()
    })
    Object.values(objects).forEach((value) => {
        value.draw()
    })
    pingText.color = ping >= 500 ? "red" : ping >= 50 ? "yellow" : "green"
    pingText.text = `ping: ${ping}ms`
    pingText.draw()
}
gameLoop()

window.onkeydown = (e) => {
    keyPress.set(e.code, true)
}
window.onkeyup = (e) => {
    keyPress.delete(e.code)
}
// canvas.addEventListener("mousemove",(e)=>{
//     mouseX=e.offsetX
//     mouseY=e.offsetY
// })

canvas.addEventListener("click", (e) => {
    socket.emit("spawn", "box", e.offsetX, e.offsetY)
})

socket.on("connect", () => {
    socket.emit("changeState", "setup", userProxy)
})

socket.on("newPlayer", (userId, userState) => {
    userState.draw = function () {
        ctx.fillStyle = 'tomato'
        ctx.fillRect(this.x, this.y, this.width, this.height)
    }
    players.set(userId, userState)
})

socket.on("leavePlayer", (userId) => {
    players.delete(userId)
})

socket.on("changePlayer", (userId, state, value) => {
    var plrData = players.get(userId)
    if (state === "location") {
        var dd = JSON.parse(decoder.decode(value))
        plrData.x = dd.x
        plrData.y = dd.y
    } else {
        plrData[state] = value
    }
    players.set(userId, plrData)
})

socket.on("spawn", (objValue) => {
    const parseValue = JSON.parse(decoder.decode(objValue))
    parseValue.draw = new Function('return ' + parseValue.draw)()
    objects[parseValue.id] = parseValue
})

socket.on("changeObj", (objValue) => {
    const parseArray = JSON.parse(decoder.decode(objValue))
    parseArray.forEach((jsonValue) => {
        var parseValue = JSON.parse(jsonValue)
        if (parseValue.id in objects) {
            parseValue.draw = new Function('return ' + parseValue.draw)()
            objects[parseValue.id] = parseValue
        }
    })
})

socket.on("deleteObj", (objId) => {
    delete objects[objId]
})