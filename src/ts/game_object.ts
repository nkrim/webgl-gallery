let GO_ID_COUNTER = 0;
function register_game_object():number {
	return GO_ID_COUNTER++;
}

export abstract class GameObject {
	go_id: number;

	alive: boolean;		// true if the object is loaded into the current room setup
	active: boolean;	// true if the object is actively being updated
	visible: boolean;	// true if the object is actively being rendered

	abstract on_awake: 		(t:number) => void;
	abstract on_update: 	(t:number) => void;
	abstract on_release:	() => void;

	awake(t:number, active:boolean=true, visible:boolean=true):boolean { // TEMP FOR WHEN AN OBJECT COORDINATOR IS MADE
		if(this.alive)
			return false;
		this.set_active(active);
		this.set_visible(visible);
		this.on_awake(t);
		return true;
	}
	update(t:number):boolean {
		if(!this.active) 
			return false;
		this.on_update(t);
		return true;
	}
	release() {
		this.on_release();
		this.set_active(false);
		this.set_visible(false);
	}

	set_active(a:boolean): void { // TEMP FOR WHEN AN UPDATE COORDINATOR IS MADE
		this.active = a;
	}
	set_visible(a:boolean): void { // TEMP FOR WHEN A RENDER COORDINATER IS MADE
		this.visible = a;
	}

	constructor() {
		this.go_id = register_game_object();
		this.alive = false;
		this.active = false;
		this.visible = false;
	}
}