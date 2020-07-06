import * as M from 'gl-matrix';
import { vec3 } from 'gl-matrix';
//import { Mesh } from './mesh';

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

export function generate_sphere_primitve(radial_segments:number = 16, vertical_segments:number = 8):any {
	const vertices:Array<number> = [];
	const normals :Array<number> = [];
	const indices :Array<number> = [];
	let n:vec3 = M.vec3.create();
	let v:vec3 = M.vec3.create();
	let index:number = 0;
	// start at north pole
	M.vec3.set(v, 0,1,0);
	M.vec3.copy(n, v);
	vertices.push(...v);
	normals.push(...n);
	// build first radial disc
	let y = Math.cos(1/vertical_segments * Math.PI);
	let r = Math.sin(1/vertical_segments * Math.PI);
	for(let i=0; i<radial_segments; i++) {
		let theta = i/radial_segments * 2*Math.PI;
		M.vec3.set(v, r*Math.sin(theta), y, r*Math.cos(theta));
		M.vec3.normalize(n, v);
		vertices.push(...v);
		normals.push(...n);
	}
	for(let i=1; i<radial_segments; i++) {
		indices.push(0,i,i+1);
	}
	indices.push(0,radial_segments,1);
	// build radial discs up to the bottom pole
	let prev_disc_i = 1;
	for(let s=2; s<vertical_segments; s++) {
		let cur_disc_i = prev_disc_i + radial_segments;
		y = Math.cos(s/vertical_segments * Math.PI);
		r = Math.sin(s/vertical_segments * Math.PI);
		for(let i=0; i<radial_segments; i++) {
			let theta = i/radial_segments * 2*Math.PI;
			M.vec3.set(v, r*Math.sin(theta), y, r*Math.cos(theta));
			M.vec3.normalize(n, v);
			vertices.push(...v);
			normals.push(...n);
		}
		for(let i=0; i<radial_segments-1; i++) {
			indices.push(prev_disc_i+i, cur_disc_i+i,   cur_disc_i+i+1);
			indices.push(prev_disc_i+i, cur_disc_i+i+1, prev_disc_i+i+1);
		}
		indices.push(cur_disc_i-1, cur_disc_i+radial_segments-1, cur_disc_i);
		indices.push(cur_disc_i-1, cur_disc_i,                   prev_disc_i);
		// set next values
		prev_disc_i = cur_disc_i;
	}
	// build bottom pole disc
	const bottom_index = prev_disc_i+radial_segments;
	M.vec3.set(v, 0, -1, 0);
	M.vec3.copy(n, v);
	vertices.push(...v);
	normals.push(...n)
	for(let i=0; i<radial_segments-1; i++) {
		indices.push(bottom_index, prev_disc_i+i+1, prev_disc_i+i);
	}
	indices.push(bottom_index, prev_disc_i, bottom_index-1);

	return {
		vertices: vertices,
		normals: normals,
		indices: indices,
	}
}

// Const primitives
// ====================
export const cube_p:any = generate_cube_primitive();
export const sphere_p:any = generate_sphere_primitve();
/*export const quad_p:any = {
	vert_count: 4,
	elem_count: 6,
	vertices: interlace_2(
		[1,1,0,-1,1,0,-1,-1,0,1,-1,0], 
		[0,0,1,0,0,1,0,0,1,0,0,1], 
		3, 3, 4),
	indices: [0,1,2,0,2,3],
}*/