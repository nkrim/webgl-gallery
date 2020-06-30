import * as M from 'gl-matrix';
import { vec3 } from 'gl-matrix';

// PRIMITIVE GENERATORS
// ====================
export function generate_cube_primitive():any {
	let cube_p:any = {
		vert_count: 24,
		elem_count: 36,
		vertices: [],
		indices: [],
	};
	let n:vec3 = M.vec3.create();
	let v:vec3 = M.vec3.create();
	let index:number = 0;
	// Positive faces values
	for(let negative=0; negative<=1; negative++) {
		for(let i=0; i<3; i++) {
			//Set normal
			M.vec3.zero(n);
			n[i] = negative ? -1 : 1;
			// Generate start vertex (1,1,1) or ()
			M.vec3.set(v, 1, 1, 1);
			if(negative)
				v[i] = -1;
			// Insert into vertices w normal
			cube_p.vertices.push(...v, ...n);
			// Generate other vectors
			let j=(i+1)%3, k=(i+2)%3;
			if(negative) {
				let j1 = j;
				j = k;
				k = j1;
			}
			// v2
			v[j] = -1;
			cube_p.vertices.push(...v, ...n);
			// v3
			v[k] = -1;
			cube_p.vertices.push(...v, ...n);
			// v4
			v[j] = 1;
			cube_p.vertices.push(...v, ...n);
			// Push indices
			cube_p.indices.push(
					index, index+1, index+2,
					index, index+2, index+3);
			index += 4;
		}
	}
	return cube_p;
}

// Const primitives
// ====================
const cube_p:any = generate_cube_primitive();
const quad_p:any = {
	vert_count: 4,
	elem_count: 6,
	vertices: interlace_2(
		[1,1,0,-1,1,0,-1,-1,0,1,-1,0], 
		[0,0,1,0,0,1,0,0,1,0,0,1], 
		3, 3, 4),
	indices: [0,1,2,0,2,3],
}