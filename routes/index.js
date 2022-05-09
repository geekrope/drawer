"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const crypto = require("crypto");
const router = express.Router();
function randomKey() {
    const bytes = crypto.randomBytes(16);
    let key = "";
    bytes.forEach((byte) => { key += byte.toString(16); });
    return key;
}
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}
Point.Empty = new Point(NaN, NaN);
class Polyline {
    constructor(color, id) {
        this._color = color;
        this._id = id;
        this._points = [];
        this._ended = false;
    }
    get points() {
        return this._points;
    }
    get color() {
        return this._color;
    }
    get ended() {
        return this._ended;
    }
    get id() {
        return this._id;
    }
    writePoint(point) {
        if (!this._ended) {
            this._points.push(point);
        }
        if (this.onModified) {
            this.onModified(point, this);
        }
    }
    endPath(point) {
        this._ended = true;
        if (point) {
            this._points.push(point);
        }
        if (this.onEnded) {
            this.onEnded(this);
        }
    }
}
class User {
    constructor(id) {
        this._id = id;
        this._openedPaths = [];
        this._closedPaths = [];
    }
    get openedPaths() {
        return this._openedPaths;
    }
    get closedPaths() {
        return this._closedPaths;
    }
    get id() {
        return this._id;
    }
    findIndex(id) {
        return this._openedPaths.findIndex((value) => { return (value.id == id); });
    }
    pathClosed(sender) {
        const index = this.findIndex(sender.id);
        if (index != -1) {
            this._openedPaths.splice(index);
            this._closedPaths.push(sender);
        }
    }
    pathModified(point, sender) {
    }
    declarePath(color) {
        this._openedPaths.forEach((value) => {
            value.endPath();
        });
        const id = (this._openedPaths.length + this._closedPaths.length).toString(16);
        const polyline = new Polyline(color, id);
        polyline.onEnded = this.pathClosed.bind(this);
        polyline.onModified = this.pathModified.bind(this);
        this._openedPaths.push(polyline);
        return id;
    }
    find(id) {
        return this._openedPaths.find((value) => { return (value.id == id); });
    }
}
class Canvas {
    constructor() {
        this._users = [];
    }
    get openedPaths() {
        let paths = [];
        this._users.forEach((value) => {
            paths = paths.concat(value.openedPaths);
        });
        return paths;
    }
    get closedPaths() {
        let paths = [];
        this._users.forEach((value) => {
            paths = paths.concat(value.closedPaths);
        });
        return paths;
    }
    declareUser() {
        const user = new User(randomKey());
        this._users.push(user);
        return user.id;
    }
    find(userId) {
        return this._users.find((value) => { return (value.id == userId); });
    }
}
class Validator {
    static colorValidator(color) {
        const validator = /^[0-9A-F]{6}$/i;
        return validator.test(color);
    }
    static pointValidator(point) {
        const json = JSON.parse(point);
        const keys = Object.keys(json);
        const hasKeys = keys.indexOf("x") != -1 && keys.indexOf("y") != -1;
        const validTypes = typeof json["x"] == "number" && typeof json["y"] == "number";
        return hasKeys && validTypes;
    }
}
const canvas = new Canvas();
router.get("/user", (request, response) => {
    response.send(canvas.declareUser()).end();
});
router.get("/transaction", (request, response) => {
    const color = request.query.color;
    const userId = request.query.userId;
    if (color && userId) {
        const user = canvas.find(userId);
        if (Validator.colorValidator(color) && user) {
            response.send(user.declarePath(color)).end();
        }
        else {
            response.sendStatus(400).end();
        }
    }
    else {
        response.sendStatus(400).end();
    }
});
router.get("/data", (request, response) => {
    response.send({ openedPaths: canvas.openedPaths, closedPaths: canvas.closedPaths });
});
router.get("/", (request, response) => {
    response.sendFile(__dirname + "/index.html");
});
router.post("/writePoint", (request, response) => {
    const point = decodeURI(request.query.point);
    const id = decodeURI(request.query.id);
    const userId = decodeURI(request.query.userId);
    const end = decodeURI(request.query.end);
    if (point && id && end) {
        const user = canvas.find(userId);
        if (user) {
            const polyline = user.find(id);
            if (Validator.pointValidator(point) && polyline && Boolean(end)) {
                if (end == "true") {
                    polyline.endPath(JSON.parse(point));
                }
                else {
                    polyline.writePoint(JSON.parse(point));
                }
                response.sendStatus(200).end();
            }
            else {
                response.sendStatus(400).end();
            }
        }
        else {
            response.sendStatus(400).end();
        }
    }
    else {
        response.sendStatus(400).end();
    }
});
exports.default = router;
//# sourceMappingURL=index.js.map