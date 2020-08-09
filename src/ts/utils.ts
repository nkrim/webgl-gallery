import {vec3} from 'gl-matrix';

export const EPSILON:number = 0.00001;
export const DEG_TO_RAD:number = Math.PI/180;
export const RAD_TO_DEG:number = 180/Math.PI; 

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
				interlaced.push(arrays[j][(i*s + k)%arrays[j].length]);
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

export function gamma_to_linear(x:number):number {
	return Math.pow(x, 2.2);
}
export function vec3_gamma_to_linear(target:vec3, source?:vec3):void {
	if(source == undefined)
		source = target;
	vec3.set(target, gamma_to_linear(source[0]), gamma_to_linear(source[1]), gamma_to_linear(source[2]));
}

export function pretty_float(x:number, n:number) {
	return x.toFixed(n).match(/^(-?\d+\.(?:0|\d*[^0]))(0*)$/)[1];
}

// adapted from https://gist.github.com/kchapelier/b1fd7e71f5378b871e3d6daa5ae193dc
// changed to remove redundant repetitions, kernel[0] is center
const sqr2pi:number = Math.sqrt(2 * Math.PI);
export function gaussian_kernel_1d(size:number, sigma:number=undefined):Array<number> {
    // ensure size is even and prepare variables
    const width			:number 		= (size / 2) | 0; // integer division
    // following nvidia convention of kernel_radius = sigma*3
    if(!sigma) sigma = width/2;
    const kernel 		:Array<number> 	= new Array(width+1)
    const norm 			:number 		= 1.0 / (sqr2pi * sigma);
    const coefficient	:number 		= 2 * sigma * sigma;
    let total 			:number 		= 0;
    let x				:number;

    // set values and increment total
    for (x = 0; x <= width; x++) {
        total += (x==0 ? 1 : 2)*(kernel[x] = norm * Math.exp(-x * x / coefficient));
    }

    // divide by total to make sure the sum of all the values is equal to 1
    for (x = 0; x < kernel.length; x++) {
        kernel[x] /= total;
    }

    return kernel;
};
