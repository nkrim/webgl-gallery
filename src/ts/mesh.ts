import * as M from 'gl-matrix';
import { vec2, vec3 } from 'gl-matrix';
import { sphere_p } from './geometry';
import { interlace_n } from './utils';

export class Mesh {
	// Initialization fields
	// ---------------------
	vertices:		Array<number>;
	normals:		Array<number>;
	albedo: 		Array<number>;
	rough_metal:	Array<number>;
	indices:		Array<number>;
	// System fields
	// -------------
	vertex_count: 	number;
	element_count:	number;
	buffer_offset: 	number;

	constructor(
			vertices: Array<number>,
			normals:		Array<number>,
			albedo: 		Array<number>,
			rough_metal:	Array<number>,
			indices:		Array<number>) {
		this.vertices = vertices;
		this.normals = normals;
		this.albedo = albedo;
		this.rough_metal = rough_metal;
		this.indices = indices;
		this.vertex_count = vertices.length/3;
		this.element_count = indices.length;
		this.buffer_offset = -1;
	}
}


export const attribute_locs:any = {
	position: 0,
	normal: 1,
	albedo: 2,
	rough_metal: 3,
}

// MESH IDS
export const SPHERE_ID = 1;

export const mesh_config:Map<number,Mesh> = new Map([
	[SPHERE_ID, new Mesh(sphere_p.vertices, sphere_p.normals, [0.1,0.1,0.1], [0.1,1.0], sphere_p.indices)],
]);
// contains vec2 of [element_count, buffer_offset_i]
export let mesh_buffer_info:Map<number,vec2> = new Map();

export function init_mesh_vao(gl:any):any {

	// DEBUG
	(<any>window).mesh_sphere = mesh_config.get(SPHERE_ID);

	// mesh buffer
	// ----------------------
	// build interlaced array
	let all_mesh_vertices = [];
	let all_mesh_indices = [];
	for(let [k,m] of mesh_config.entries()) {
		const offset_v = all_mesh_vertices.length;
		const offset_i = all_mesh_indices.length;
		mesh_buffer_info.set(k, [m.element_count, offset_i]);
		const interlaced = interlace_n(
			4,
			[m.vertices, m.normals, m.albedo, m.rough_metal],
			[3, 		 3, 	    3,        2],
			m.vertex_count
		);
		for(let j=0; j<interlaced.length; j++)
			all_mesh_vertices.push(interlaced[j]);
		for(let j=0; j<m.element_count; j++) {
			all_mesh_indices.push(m.indices[j] + offset_v);
		}
		// set room offset
		m.buffer_offset = offset_i;
	}
	// create vao
	const mesh_vao = gl.createVertexArray();
	gl.bindVertexArray(mesh_vao);
	// vertex buffer
	const mesh_vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, mesh_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(all_mesh_vertices), gl.STATIC_DRAW);
	// set attribute information
	const full_stride = 44; // 12+12+12+8
	gl.enableVertexAttribArray(attribute_locs.position);
	gl.vertexAttribPointer(attribute_locs.position, 3, gl.FLOAT, false, full_stride, 0);
	gl.enableVertexAttribArray(attribute_locs.normal);
	gl.vertexAttribPointer(attribute_locs.normal, 3, gl.FLOAT, false, full_stride, 12);
	gl.enableVertexAttribArray(attribute_locs.albedo);
	gl.vertexAttribPointer(attribute_locs.albedo, 3, gl.FLOAT, false, full_stride, 24);
	gl.enableVertexAttribArray(attribute_locs.rough_metal);
	gl.vertexAttribPointer(attribute_locs.rough_metal, 2, gl.FLOAT, false, full_stride, 36);
	// index buffer
	const mesh_index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh_index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(all_mesh_indices), gl.STATIC_DRAW);
	// unbind vao
	gl.bindVertexArray(null);

	return mesh_vao;
}