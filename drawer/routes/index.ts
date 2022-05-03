import express = require('express');
import fs = require('fs');
import uuid = require('uuid');

const router = express.Router();

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
	public points: Point[];
	public color: string;
}

class Canvas
{
	private edits: Polyline[];
	private _users: Map<string, { pointer: Point, active: boolean }>;
	private activeUsers: Map<string, Point>;
	private readonly fileName: string;

	private set users(users: Map<string, { pointer: Point, active: boolean }>)
	{
		this._users = users;		
	}
	private get users()
	{
		return this._users;
	}

	private writeFile()
	{
		fs.writeFile(this.fileName, JSON.stringify(this.edits), () => { });
	}
	private activateUsers()
	{
		this.activeUsers.clear();

		this.users.forEach((value, key) =>
		{
			this.activeUsers.set(key, value.pointer);
		});
	}

	public push(polyline: Polyline, user: string)
	{
		this.edits.push(polyline);
		this.users.get(user).active = false;
		this.activateUsers();

		this.writeFile();
	}
	public register(): string
	{
		const id = uuid.v4();

		this.users.set(id, { pointer: Point.Empty, active: false });

		return;
	}
	public unregister(id: string)
	{
		this.users.delete(id);
	}
	public activate(id: string)
	{
		this.users.get(id).active = true;
		this.activateUsers();
	}
	public incomingEdits(lastIndex: number): Polyline[]
	{
		let edits: Polyline[] = [];
		for (let index = lastIndex; index < this.edits.length; index++)
		{
			edits.push(this.edits[index]);
		}
		return edits;
	}

	public constructor(fileName: string)
	{
		this.fileName = fileName;
		this.edits = JSON.parse(fs.readFileSync(fileName, 'utf8'));
		this._users = new Map<string, { pointer: Point, active: boolean }>();
		this.activeUsers = new Map<string, Point>();
	}
}

export default router;