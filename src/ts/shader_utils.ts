import { pretty_float } from '../ts/utils';

export function float_array(arr:Array<number>, float_precision:number=8):string {
	let out = `float[](${pretty_float(arr[0],float_precision)}`;
	for(let i=1; i<arr.length; i++)
		out += `,${pretty_float(arr[i],float_precision)}`;
	out += ')';
	return out;
}

export function vec_array(arr:Array<Array<number>>, n:number, float_precision:number=8):string {
	const print_vec = function(v:Array<number>):string {
		let v_out = pretty_float(v[0], float_precision);
		for(let i=1; i<n; i++)
			v_out += `,${pretty_float(v[i],float_precision)}`;
		return v_out;
	}
	let out = `vec${n}[](vec${n}(${print_vec(arr[0])})`;
	for(let i=1; i<arr.length; i++)
		out += `,vec${n}(${print_vec(arr[i])})`;
	out += ')';
	return out;
}