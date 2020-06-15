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

export function hash_2(a:number, b:number, m:number):number {
	return a*m + b;
}
export function unhash_2(h:number, m:number):[number,number] {
	return [h/m, h%m];
}

export function lerp(a:number, b:number, t:number):number {
	return a + t*(b - a);
}