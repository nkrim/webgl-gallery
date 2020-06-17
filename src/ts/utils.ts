export const EPSILON:number = 0.00001;

export function interlace_2(a:Array<number>, b:Array<number>, a_stride:number, b_stride:number, count:number) {
	const interlaced = [];
	for(let i=0; i<count; i++) {
		for(let j=0; j<a_stride; j++)
			interlaced.push(a[i*a_stride + j]);
		for(let j=0; j<b_stride; j++)
			interlaced.push(b[i*b_stride + j]);
	}
	return interlaced;
}
export function interlace_n(n:number, arrays:Array<Array<number>>, strides:Array<number>, count:number) {
	// Error handling
	if(n > arrays.length) {
		console.error('interlace_n: n too large for arrays length.');
		return [];
	}
	if(arrays.length !== strides.length) {
		console.error('interlace_n: arrays and strides mismatched length.')
		return [];
	}

	// Build interlaced
	const interlaced = [];
	for(let i=0; i<count; i++) {
		for(let j=0; j<n; j++) {
			const s = strides[j];
			for(let k=0; k<s; k++) {
				interlaced.push(arrays[j][i*s + k]);
			}
		}
	}
	return interlaced;
}

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

export const DEG_TO_RAD:number = Math.PI/180;
export const RAD_TO_DEG:number = 180/Math.PI; 