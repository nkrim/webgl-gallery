import * as M from 'gl-matrix';

// ROOM CLASS
// ==========
export class Room {
	// Initialization fields
	// ---------------------
	wall_paths:		Array<Array<number>>; // CCW ORDER
	wall_height:	number;

	// Constructed values
	// ------------------
	// wall geometry
	wall_count_v: 	number;
	wall_count_i: 	number;
	wall_vertices:	Array<number>;
	wall_normals: 	Array<number>;
	wall_indices: 	Array<number>;

	constructor(
			wall_paths:		Array<Array<number>>, 
			wall_height:	number
	) {
		// Initialize fields
		this.wall_paths = wall_paths;
		this.wall_height = wall_height;
		// Construct values
		this.build_geometry();
	}


	// INITIALIZATION FUNCTIONS
	build_geometry() {
		// Initialize values and arrays
		this.wall_count_v = 0;
		this.wall_count_i = 0;
		this.wall_vertices = [];
		this.wall_normals = [];
		this.wall_indices = [];

		// Construct geo for each path  
		for(let path_index=0; path_index<this.wall_paths.length; path_index++) {
			const path:Array<number> = this.wall_paths[path_index];
			if(path.length <= 3) {
				console.warn(`Room.build_geometry: path [${path_index}] of invalid length: ${path.length}`);
				continue;
			}

			// Init vectors
			const v_cur_l 		= M.vec3.create();
			const v_cur_u 		= M.vec3.create();
			const v_prev_l 		= M.vec3.create();
			const v_prev_u 		= M.vec3.create();
			const v_normal 		= M.vec3.create();
			const v_height_add 	= M.vec3.create();
			// Init prev points and starting values
			M.vec3.set(v_height_add, 0, this.wall_height, 0);
			M.vec3.set(v_prev_l, path[0], 0, path[1]);
			M.vec3.add(v_prev_u, v_prev_l, v_height_add);
			// Build path
			for(let i=2; i<path.length; i+=2) {
				// set cur vectors
				M.vec3.set(v_cur_l, path[i], 0, path[i+1]);
				M.vec3.add(v_cur_u, v_cur_l, v_height_add);
				// push vertices and indices
				this.wall_vertices.push(...v_prev_u, ...v_cur_u, ...v_cur_l, ...v_prev_l);
				this.wall_indices.push(	this.wall_count_v, this.wall_count_v+1, this.wall_count_v+2, 
									this.wall_count_v, this.wall_count_v+2, this.wall_count_v+3);
				// get v_normal (use prevs as temps for directional vectors)
				M.vec3.sub(v_prev_l, v_prev_l, v_cur_l); // Get prev_l - cur_l , stored in prev_l (a vector)
				M.vec3.sub(v_prev_u, v_cur_u, v_cur_l); // Get cur_u - cur_l , stored in prev_u (b vector)
				M.vec3.cross(v_normal, v_prev_l, v_prev_u);
				M.vec3.normalize(v_normal, v_normal);
				// push normals (one for each vertex)
				this.wall_normals.push(...v_normal, ...v_normal, ...v_normal, ...v_normal);
				// set prev holders
				M.vec3.copy(v_prev_l, v_cur_l);
				M.vec3.copy(v_prev_u, v_cur_u);
				// add to wall_count numbers
				this.wall_count_v += 4;
				this.wall_count_i += 6;
			}
		}
	}
}


// EXPORTS
// ==============