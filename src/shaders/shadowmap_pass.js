export const shadowmap_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		projection_m: 'u_proj',
		mv_m: 'u_mv',
	}
}
export const shadowmap_pass_v = `
#version 100

attribute vec3 a_vert;

uniform mat4 u_mv;
uniform mat4 u_proj;

varying vec4 v_model_pos;
varying vec4 v_eye_pos;
varying vec3 v_normal;
varying vec3 v_albedo;
varying vec2 v_rough_metal;

void main() {
 	gl_Position = u_proj * u_mv * vec4(a_vert, 1.0);
}
`;