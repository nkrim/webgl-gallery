import * as M from 'gl-matrix';
import { vec2, vec3, mat4 } from 'gl-matrix';
import { hash_2, gamma_to_linear, vec3_gamma_to_linear } from './utils';
import { Spotlight } from './spotlight';

// ROOM CLASS
// ==========
export class Room {
	// Initialization fields
	// ---------------------
	// MESH - vertices
	wall_paths:			Array<Array<number>>; // CCW ORDER
	wall_height:		number;
	wall_bias:			number;
	floor_indices:		Array<number>;
	room_scale: 		number;
	// MESH - material
	wall_albedo: 		vec3;
	wall_rough_metal:	vec2;
	floor_albedo:		vec3;
	floor_rough_metal:	vec2;
	ceil_albedo:		vec3;
	ceil_rough_metal:	vec2;
	// LIGHTS
	ambient_color:		vec3;
	ambient_intensity:	number;
	spotlights:			Array<Spotlight>;

	// Constructed values
	// ------------------
	// buffer info
	buffer_offset_v:	number;
	buffer_offset_i:	number;
	// wall geometry
	mesh_count_v: 		number;
	mesh_count_i: 		number;
	mesh_vertices:		Array<number>;
	mesh_normals: 		Array<number>;
	mesh_albedo:		Array<number>;
	mesh_rough_metal:	Array<number>;
	mesh_indices: 		Array<number>;

	/* ------------\
	| CONTSTRUCTOR |
	\------------ */
	constructor(
			wall_paths:			Array<Array<number>>, 
			wall_height:		number,
			wall_bias:			number,
			floor_indices:  	Array<number>,
			room_scale: 		number,

			wall_albedo: 		vec3,
			wall_rough_metal:	vec2,
			floor_albedo:		vec3,
			floor_rough_metal:	vec2,
			ceil_albedo:		vec3,
			ceil_rough_metal:	vec2,

			ambient_color:		vec3,
			ambient_intensity: 	number,
			spotlights:			Array<Spotlight>
	) {
		// Initialize fields
		// Mesh
		this.wall_paths = wall_paths;
		this.wall_height = wall_height;
		this.wall_bias = wall_bias;
		this.floor_indices = floor_indices;
		this.room_scale = room_scale;
		// copy colors (with gamma correction) and rough/metal
		this.wall_albedo = M.vec3.create(); vec3_gamma_to_linear(this.wall_albedo, wall_albedo);
		this.wall_rough_metal = M.vec2.create(); M.vec2.copy(this.wall_rough_metal, wall_rough_metal);
		this.floor_albedo = M.vec3.create(); vec3_gamma_to_linear(this.floor_albedo, floor_albedo);
		this.floor_rough_metal = M.vec2.create(); M.vec2.copy(this.floor_rough_metal, floor_rough_metal);
		this.ceil_albedo = M.vec3.create(); vec3_gamma_to_linear(this.ceil_albedo, ceil_albedo);
		this.ceil_rough_metal = M.vec2.create(); M.vec2.copy(this.ceil_rough_metal, ceil_rough_metal);
		// LIGHTS
		// ambient
		this.ambient_color = M.vec3.create(); vec3_gamma_to_linear(this.ambient_color, ambient_color);
		this.ambient_intensity = gamma_to_linear(ambient_intensity);
		// spotlights
		const xz_scale:vec3 = M.vec3.create(); M.vec3.set(xz_scale, room_scale, 1, room_scale);
		this.spotlights = spotlights; 
		for(let i:number=0; i<this.spotlights.length; i++) // scale spotlight.pos by room_scale
			M.vec3.mul(this.spotlights[i].cam.pos, this.spotlights[i].cam.pos, xz_scale);

		// Default values
		this.buffer_offset_v = -1;
		this.buffer_offset_i = -1;

		// Construct values
		this.build_geometry();
	}


	// INITIALIZATION FUNCTIONS
	build_geometry(): void {
		// Initialize values and arrays
		this.mesh_count_v = 0;
		this.mesh_count_i = 0;
		this.mesh_vertices = [];
		this.mesh_normals = [];
		this.mesh_albedo = [];
		this.mesh_rough_metal = [];
		this.mesh_indices = [];

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
			M.vec3.set(v_height_add, 0, this.wall_height + 2*this.wall_bias, 0);
			M.vec3.set(v_prev_l, path[0]*this.room_scale, -this.wall_bias, path[1]*this.room_scale);
			M.vec3.add(v_prev_u, v_prev_l, v_height_add);
			// Build path
			for(let i=2; i<path.length; i+=2) {
				// set cur vectors
				M.vec3.set(v_cur_l, path[i]*this.room_scale, -this.wall_bias, path[i+1]*this.room_scale);
				M.vec3.add(v_cur_u, v_cur_l, v_height_add);
				// push vertices and indices
				this.mesh_vertices.push(...v_prev_u, ...v_cur_u, ...v_cur_l, ...v_prev_l);
				this.mesh_indices.push(	this.mesh_count_v, this.mesh_count_v+1, this.mesh_count_v+2, 
									this.mesh_count_v, this.mesh_count_v+2, this.mesh_count_v+3);
				// get v_normal (use prevs as temps for directional vectors)
				M.vec3.sub(v_prev_l, v_prev_l, v_cur_l); // Get prev_l - cur_l , stored in prev_l (a vector)
				M.vec3.sub(v_prev_u, v_cur_u, v_cur_l); // Get cur_u - cur_l , stored in prev_u (b vector)
				M.vec3.cross(v_normal, v_prev_l, v_prev_u);
				M.vec3.normalize(v_normal, v_normal);
				// push normals (one for each vertex)
				this.mesh_normals.push(...v_normal, ...v_normal, ...v_normal, ...v_normal);
				// push albedo and rough/metal
				this.mesh_albedo.push(...this.wall_albedo, ...this.wall_albedo, ...this.wall_albedo, ...this.wall_albedo);
				this.mesh_rough_metal.push(...this.wall_rough_metal, ...this.wall_rough_metal, ...this.wall_rough_metal, ...this.wall_rough_metal);
				// set prev holders
				M.vec3.copy(v_prev_l, v_cur_l);
				M.vec3.copy(v_prev_u, v_cur_u);
				// add to mesh_count numbers
				this.mesh_count_v += 4;
				this.mesh_count_i += 6;
			}
		}

		// FLOOR/CEIL BUILDING
		// ----------------------------
		if(this.floor_indices.length === 0)
			return;
		const floor_offset_v:number = this.mesh_count_v;
		const floor_offset_i:number = this.mesh_count_i;
		// Init index map
		const m 	:number
			= 1 + this.floor_indices.reduce(function(a, b) {
			    return Math.max(a, b);
			});
		const memo	:Array<number> = new Array(hash_2(m-1,m-1,m)).fill(-1);
		// Re-use already initialized vec3
		const v 	:vec3 = M.vec3.create();
		const n 	:vec3 = M.vec3.create();
		M.vec3.set(n, 0, 1, 0);
		// Build floor
		for(let i=0; i<this.floor_indices.length; i+=2) {
			const path_index:number = this.floor_indices[i];
			const vert_index:number = this.floor_indices[i+1];
			const hashed	:number = hash_2(path_index, vert_index, m);
			// check index map
			let val:number;
			if((val = memo[hashed]) >= 0) {
				this.mesh_indices.push(val);
				this.mesh_count_i++;
			}
			// otherwise, construct new vertex
			else {
				const vert_x:number = this.wall_paths[path_index][vert_index*2];
				const vert_z:number = this.wall_paths[path_index][vert_index*2 + 1];
				M.vec3.set(v, vert_x*this.room_scale, 0, vert_z*this.room_scale);
				this.mesh_vertices.push(...v);
				this.mesh_normals.push(...n);
				this.mesh_albedo.push(...this.floor_albedo);
				this.mesh_rough_metal.push(...this.floor_rough_metal);
				this.mesh_indices.push(this.mesh_count_v);
				// place index in memo
				memo[hashed] = this.mesh_count_v;
				// increment counts
				this.mesh_count_v++;
				this.mesh_count_i++;
			}
		}
		// Build ceil
		M.vec3.set(n, 0, -1, 0);
		const floor_length_v:number = this.mesh_count_v - floor_offset_v;
		const floor_length_i:number = this.mesh_count_i - floor_offset_i;
		// reconstruct floor vertices as ceiling
		for(let i=floor_offset_v; i<this.mesh_count_v; i++) {
			this.mesh_vertices.push(	this.mesh_vertices[i*3], 
										this.mesh_vertices[i*3 + 1] + this.wall_height, 
										this.mesh_vertices[i*3 + 2]);
			this.mesh_normals.push(...n);
			this.mesh_albedo.push(...this.ceil_albedo);
			this.mesh_rough_metal.push(...this.ceil_rough_metal);
		}
		this.mesh_count_v += floor_length_v;
		// reconstruct floor indices as ceiling
		for(let i=0; i<floor_length_i; i+=3) {
			// reverse order when placing indices
			this.mesh_indices.push(this.mesh_indices[i + floor_offset_i] + floor_length_v);
			this.mesh_indices.push(this.mesh_indices[i+2 + floor_offset_i] + floor_length_v);
			this.mesh_indices.push(this.mesh_indices[i+1 + floor_offset_i] + floor_length_v);
		}
		this.mesh_count_i += floor_length_i;
	}
}


// EXPORTS
// ==============