"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const canvasApi = require("canvas");
const fs = require("fs");
const router = express.Router();
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
        this._points.push(point);
        this._ended = true;
        if (this.onEnded) {
            this.onEnded(this);
        }
    }
}
class Canvas {
    constructor(canvas) {
        this._openedPaths = [];
        this._closedPaths = [];
        this._canvas = canvas;
        this._canvasContext = canvas.getContext("2d");
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
        this.refresh();
    }
    refresh() {
        const thickness = 5;
        const circleThickness = 2;
        const circleRadius = 5;
        this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
        this._openedPaths.concat(this._closedPaths).forEach((value) => {
            if (value.points.length > 0) {
                this._canvasContext.strokeStyle = value.color;
                this._canvasContext.lineWidth = thickness;
                const startPoint = value.points[0];
                this._canvasContext.beginPath();
                this._canvasContext.moveTo(startPoint.x, startPoint.y);
                for (let index = 1; index < value.points.length; index++) {
                    const point = value.points[index];
                    this._canvasContext.lineTo(point.x, point.y);
                }
                this._canvasContext.closePath();
                this._canvasContext.stroke();
            }
        });
        this._openedPaths.forEach((value) => {
            if (value.points.length > 0) {
                this._canvasContext.strokeStyle = "#000000";
                this._canvasContext.lineWidth = circleThickness;
                const startPoint = value.points[value.points.length - 1];
                this._canvasContext.beginPath();
                this._canvasContext.arc(startPoint.x + circleRadius, startPoint.y + circleRadius, circleRadius, 0, Math.PI * 2);
                this._canvasContext.closePath();
                this._canvasContext.stroke();
            }
        });
    }
    get openedPaths() {
        return this._openedPaths;
    }
    get closedPaths() {
        return this._closedPaths;
    }
    find(id) {
        return this._openedPaths.find((value) => { return (value.id == id); });
    }
    declarePath(color) {
        const id = (this._openedPaths.length + this._closedPaths.length).toString(16);
        const polyline = new Polyline(color, id);
        polyline.onEnded = this.pathClosed.bind(this);
        polyline.onModified = this.refresh.bind(this);
        this._openedPaths.push(polyline);
        return id;
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
const renderedCanvas = canvasApi.createCanvas(2560, 1440, 'svg');
const canvas = new Canvas(renderedCanvas);
router.get("/transaction", (request, response) => {
    const color = request.query.color;
    if (color && typeof color == "string") {
        if (Validator.colorValidator(color)) {
            response.send(canvas.declarePath(color)).end();
        }
        else {
            response.statusMessage = "Invalid color";
            response.sendStatus(400).end();
        }
    }
    else {
        response.sendStatus(400).end();
    }
});
router.get("/img.svg", (request, response) => {
    fs.writeFile(__dirname + '/image.svg', renderedCanvas.toBuffer(), () => {
        response.sendFile(__dirname + "/image.svg");
    });
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
    const end = decodeURI(request.query.end);
    if (point && id && end) {
        const polyline = canvas.find(id);
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
});
exports.default = router;
//# sourceMappingURL=index.js.map