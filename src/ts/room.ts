import * as M from 'gl-matrix';
import { vec3, mat4 } from 'gl-matrix';
import { hash_2 } from './utils';

// ROOM CLASS
// ==========
export class Room {
	// Initialization fields
	// ---------------------
	wall_paths:			Array<Array<number>>; // CCW ORDER
	wall_height:		number;
	floor_indices:		Array<number>;
	room_scale: 		number;

	// Constructed values
	// ------------------
	// buffer info
	buffer_offset_v:	number;
	buffer_offset_i:	number;
	// wall geometry
	wall_count_v: 	number;
	wall_count_i: 	number;
	wall_vertices:	Array<number>;
	wall_normals: 	Array<number>;
	wall_indices: 	Array<number>;

	/* ------------\
	| CONTSTRUCTOR |
	\------------ */
	constructor(
			wall_paths:		Array<Array<number>>, 
			wall_height:	number,
			floor_indices:  Array<number>,
			room_scale: 	number
	) {
		// Initialize fields
		this.wall_paths = wall_paths;
		this.wall_height = wall_height;
		this.floor_indices = floor_indices;
		this.room_scale = room_scale;

		// Default values
		this.buffer_offset_v = -1;
		this.buffer_offset_i = -1;

		// Construct values
		this.build_geometry();
	}


	// INITIALIZATION FUNCTIONS
	build_geometry(): void {
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

			// PATH BUILDING
			// --------------------------
			// Init vectors
			const v_cur_l:vec3 			= M.vec3.create();
			const v_cur_u:vec3 			= M.vec3.create();
			const v_prev_l:vec3 		= M.vec3.create();
			const v_prev_u:vec3 		= M.vec3.create();
			const v_normal:vec3 		= M.vec3.create();
			const v_height_add:vec3 	= M.vec3.create();
			// Init prev points and starting values
			M.vec3.set(v_height_add, 0, this.wall_height, 0);
			M.vec3.set(v_prev_l, path[0]*this.room_scale, 0, path[1]*this.room_scale);
			M.vec3.add(v_prev_u, v_prev_l, v_height_add);
			// Build path
			for(let i=2; i<path.length; i+=2) {
				// set cur vectors
				M.vec3.set(v_cur_l, path[i]*this.room_scale, 0, path[i+1]*this.room_scale);
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

			// FLOOR/CEIL BUILDING
			// ----------------------------
			const floor_offset_v:number = this.wall_count_v;
			const floor_offset_i:number = this.wall_count_i;
			// Init index map
			const m 	:number
				= 1 + this.floor_indices.reduce(function(a, b) {
				    return Math.max(a, b);
				});
			const memo	:Array<number> = new Array(hash_2(m-1,m-1,m)).fill(-1);
			// Re-use already initialized vec3
			const v 	:vec3 = v_cur_l;
			const n 	:vec3 = v_cur_u;
			M.vec3.set(n, 0, 1, 0);
			// Build floor
			for(let i=0; i<this.floor_indices.length; i+=2) {
				const path_index:number = this.floor_indices[i];
				const vert_index:number = this.floor_indices[i+1];
				const hashed	:number = hash_2(path_index, vert_index, m);
				// check index map
				let val:number;
				if((val = memo[hashed]) >= 0) {
					this.wall_indices.push(val);
					this.wall_count_i++;
				}
				// otherwise, construct new vertex
				else {
					const vert_x:number = this.wall_paths[path_index][vert_index*2];
					const vert_z:number = this.wall_paths[path_index][vert_index*2 + 1];
					M.vec3.set(v, vert_x*this.room_scale, 0, vert_z*this.room_scale);
					this.wall_vertices.push(...v);
					this.wall_normals.push(...n);
					this.wall_indices.push(this.wall_count_v);
					// place index in memo
					memo[hashed] = this.wall_count_v;
					// increment counts
					this.wall_count_v++;
					this.wall_count_i++;
				}
			}
			// Build ceil
			M.vec3.set(n, 0, -1, 0);
			const floor_length_v:number = this.wall_count_v - floor_offset_v;
			const floor_length_i:number = this.wall_count_i - floor_offset_i;
			// reconstruct floor vertices as ceiling
			for(let i=floor_offset_v; i<this.wall_count_v; i++) {
				this.wall_vertices.push(	this.wall_vertices[i*3], 
											this.wall_vertices[i*3 + 1] + this.wall_height, 
											this.wall_vertices[i*3 + 2]);
				this.wall_normals.push(...n);
			}
			this.wall_count_v += floor_length_v;
			// reconstruct floor indices as ceiling
			for(let i=0; i<floor_length_i; i+=3) {
				// reverse order when placing indices
				this.wall_indices.push(this.wall_indices[i + floor_offset_i] + floor_length_v);
				this.wall_indices.push(this.wall_indices[i+2 + floor_offset_i] + floor_length_v);
				this.wall_indices.push(this.wall_indices[i+1 + floor_offset_i] + floor_length_v);
			}
			this.wall_count_i += floor_length_i;
		}
	}
}


// EXPORTS
// ==============