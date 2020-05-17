'use strict'

function generate_cube_primitive() {
	let cube_p = {
		count: 36,
		vertices: [],
		indices: [],
	};
	let n = M.vec3.create();
	let v = M.vec3.create();
	let index = 0;
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
	console.log(cube_p);
	return cube_p;
}

const cube_p = generate_cube_primitive();