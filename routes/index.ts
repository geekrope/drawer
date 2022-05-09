import express = require('express');
import crypto = require('crypto');

const router = express.Router();

function randomKey()
{
	const bytes = crypto.randomBytes(16);

	let key = "";

	bytes.forEach((byte) => { key += byte.toString(16) });

	return key;
}

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
	public endPath(point?: Point)
	{
		this._ended = true;

		if (point)
		{
			this._points.push(point);
		}

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

class User
{
	private _id: string;

	private _openedPaths: Polyline[];
	private _closedPaths: Polyline[];

	public get openedPaths(): Polyline[]
	{
		return this._openedPaths;
	}
	public get closedPaths(): Polyline[]
	{
		return this._closedPaths;
	}
	public get id(): string
	{
		return this._id;
	}

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
	}
	private pathModified(point: Point, sender: Polyline)
	{

	}

	public declarePath(color: string): string
	{
		this._openedPaths.forEach((value) =>
		{
			value.endPath();
		});

		const id = (this._openedPaths.length + this._closedPaths.length).toString(16);
		const polyline = new Polyline(color, id);

		polyline.onEnded = this.pathClosed.bind(this);
		polyline.onModified = this.pathModified.bind(this);

		this._openedPaths.push(polyline);

		return id;
	}
	public find(id: string): Polyline | undefined
	{
		return this._openedPaths.find((value) => { return (value.id == id); });
	}

	public constructor(id: string)
	{
		this._id = id;
		this._openedPaths = [];
		this._closedPaths = [];
	}
}

class Canvas
{
	private _users: User[];

	public get openedPaths(): Polyline[]
	{
		let paths: Polyline[] = [];

		this._users.forEach((value) =>
		{
			paths = paths.concat(value.openedPaths);
		});

		return paths;
	}
	public get closedPaths(): Polyline[]
	{
		let paths: Polyline[] = [];

		this._users.forEach((value) =>
		{
			paths = paths.concat(value.closedPaths);
		});

		return paths;
	}

	public declareUser(): string
	{
		const user = new User(randomKey());

		this._users.push(user);

		return user.id;
	}
	public find(userId: string): User | undefined
	{
		return this._users.find((value) => { return (value.id == userId); });
	}

	public constructor()
	{
		this._users = [];
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

const canvas = new Canvas();

router.get("/user", (request: express.Request, response: express.Response) =>
{
	response.send(canvas.declareUser()).end();
});
router.get("/transaction", (request: express.Request, response: express.Response) =>
{
	const color = <string>request.query.color;
	const userId = <string>request.query.userId;

	if (color && userId)
	{
		const user = canvas.find(userId);

		if (Validator.colorValidator(color) && user)
		{
			response.send(user.declarePath(color)).end();
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
	const userId = decodeURI(<string>request.query.userId);
	const end = decodeURI(<string>request.query.end);

	if (point && id && end)
	{
		const user = canvas.find(userId);

		if (user)
		{
			const polyline = user.find(id);

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
	}
	else
	{
		response.sendStatus(400).end();
	}
});

export default router;