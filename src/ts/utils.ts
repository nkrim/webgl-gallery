export const EPSILON:number = 0.00001;

export function float_eq(a:number, b:number):boolean {
	return Math.abs(a-b) < EPSILON;
}

export function clamp(x:number, a:number, b:number):number {
	if(x < a)
		return a;
	if(x > b)
		return b;
	return x;
}