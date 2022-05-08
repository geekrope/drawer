import express = require('express');
import canvasApi = require('canvas');
import fs = require('fs');

const router = express.Router();

interface OnModified
{
	(point: Point, sender: Polyline): void;
}

interface OnEnded
{
	(sender: Polyline): void;
}

class Point
{
	public x: number;
	public y: number;

	public static readonly Empty: Point = new Point(NaN, NaN);

	public constructor(x: number, y: number)
	{
		this.x = x;
		this.y = y;
	}
}

class Polyline
{
	private _points: Point[];
	private _color: string;
	private _ended: boolean;
	private _id: string;

	public get points(): Point[]
	{
		return this._points;
	}
	public get color(): string
	{
		return this._color;
	}
	public get ended(): boolean
	{
		return this._ended;
	}
	public get id(): string
	{
		return this._id;
	}

	public onModified: OnModified;
	public onEnded: OnEnded;

	public writePoint(point: Point)
	{
		if (!this._ended)
		{
			this._points.push(point);
		}

		if (this.onModified)
		{
			this.onModified(point, this);
		}
	}
	public endPath(point: Point)
	{
		this._points.push(point);
		this._ended = true;

		if (this.onEnded)
		{
			this.onEnded(this);
		}
	}

	public constructor(color: string, id: string)
	{
		this._color = color;
		this._id = id;

		this._points = [];
		this._ended = false;
	}
}

class Canvas
{
	private _openedPaths: Polyline[];
	private _closedPaths: Polyline[];
	private _canvas: canvasApi.Canvas;
	private _canvasContext: canvasApi.CanvasRenderingContext2D;

	private findIndex(id: string): number
	{
		return this._openedPaths.findIndex((value) => { return (value.id == id); });
	}
	private pathClosed(sender: Polyline)
	{
		const index = this.findIndex(sender.id);

		if (index != -1)
		{
			this._openedPaths.splice(index);
			this._closedPaths.push(sender);
		}

		this.refresh();
	}
	private refresh()
	{
		const thickness = 5;
		const circleThickness = 2;
		const circleRadius = 5;

		this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);

		this._openedPaths.concat(this._closedPaths).forEach((value) =>
		{
			if (value.points.length > 0)
			{
				this._canvasContext.strokeStyle = value.color;
				this._canvasContext.lineWidth = thickness;

				const startPoint = value.points[0];

				this._canvasContext.beginPath();
				this._canvasContext.moveTo(startPoint.x, startPoint.y);

				for (let index = 1; index < value.points.length; index++)
				{
					const point = value.points[index];
					this._canvasContext.lineTo(point.x, point.y);
				}

				this._canvasContext.closePath();
				this._canvasContext.stroke();
			}
		});

		this._openedPaths.forEach((value) =>
		{
			if (value.points.length > 0)
			{
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

	public get openedPaths(): Polyline[]
	{
		return this._openedPaths;
	}
	public get closedPaths(): Polyline[]
	{
		return this._closedPaths;
	}

	public find(id: string): Polyline | undefined
	{
		return this._openedPaths.find((value) => { return (value.id == id); });
	}
	public declarePath(color: string): string
	{
		const id = (this._openedPaths.length + this._closedPaths.length).toString(16);
		const polyline = new Polyline(color, id);

		polyline.onEnded = this.pathClosed.bind(this);
		polyline.onModified = this.refresh.bind(this);

		this._openedPaths.push(polyline);

		return id;
	}

	public constructor(canvas: canvasApi.Canvas)
	{
		this._openedPaths = [];
		this._closedPaths = [];

		this._canvas = canvas;
		this._canvasContext = canvas.getContext("2d");
	}
}

class Validator
{
	public static colorValidator(color: string): boolean
	{
		const validator = /^[0-9A-F]{6}$/i;
		return validator.test(color);
	}
	public static pointValidator(point: string): boolean
	{
		const json = JSON.parse(point);
		const keys = Object.keys(json);

		const hasKeys = keys.indexOf("x") != -1 && keys.indexOf("y") != -1;
		const validTypes = typeof json["x"] == "number" && typeof json["y"] == "number";

		return hasKeys && validTypes;
	}
}

const renderedCanvas = canvasApi.createCanvas(2560, 1440, 'svg');
const canvas = new Canvas(renderedCanvas);

router.get("/transaction", (request: express.Request, response: express.Response) =>
{
	const color = request.query.color;

	if (color && typeof color == "string")
	{
		if (Validator.colorValidator(color))
		{
			response.send(canvas.declarePath(<string>color)).end();
		}
		else
		{
			response.statusMessage = "Invalid color";
			response.sendStatus(400).end();
		}
	}
	else
	{
		response.sendStatus(400).end();
	}
});
router.get("/img.svg", (request: express.Request, response: express.Response) =>
{
	fs.writeFile(__dirname + '/image.svg', renderedCanvas.toBuffer(), () =>
	{
		response.sendFile(__dirname + "/image.svg");
	});
});
router.get("/data", (request: express.Request, response: express.Response) =>
{
	response.send({ openedPaths: canvas.openedPaths, closedPaths: canvas.closedPaths });
});
router.get("/", (request: express.Request, response: express.Response) =>
{
	response.sendFile(__dirname + "/index.html");
});

router.post("/writePoint", (request: express.Request, response: express.Response) =>
{
	const point = decodeURI(<string>request.query.point);
	const id = decodeURI(<string>request.query.id);
	const end = decodeURI(<string>request.query.end);

	if (point && id && end)
	{
		const polyline = canvas.find(id);

		if (Validator.pointValidator(point) && polyline && Boolean(end))
		{
			if (end == "true")
			{
				polyline.endPath(<Point>JSON.parse(point));
			}
			else
			{
				polyline.writePoint(<Point>JSON.parse(point));
			}
			response.sendStatus(200).end();
		}
		else
		{
			response.sendStatus(400).end();
		}
	}
	else
	{
		response.sendStatus(400).end();
	}
});

export default router;