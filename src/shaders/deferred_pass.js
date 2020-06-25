export const deferred_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
		normal_dir: 'a_norm',
		albedo: 'a_albedo',
		rough_metal: 'a_rough_metal',
	},
	uniforms: {
		proj_m: 'u_proj',
		mv_m: 'u_mv',
		it_mv_m: 'u_it_mv',
		ambient_c: 'u_ambient_c',
		ambient_i: 'u_ambient_i',
	}
}
export const deferred_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;
layout(location = 1) in vec3 a_norm;
layout(location = 2) in vec3 a_albedo;
layout(location = 3) in vec2 a_rough_metal;

uniform mat4 u_mv;
uniform mat4 u_it_mv;
uniform mat4 u_proj;

out vec4 v_model_pos;
out vec4 v_eye_pos;
out vec3 v_normal;
out vec3 v_albedo;
out vec2 v_rough_metal;

void main() {
	v_model_pos = vec4(a_vert, 1.0);
	v_eye_pos = u_mv * vec4(a_vert, 1.0);
	v_normal = (u_it_mv * vec4(a_norm, 0.0)).xyz;
	v_albedo = a_albedo;
	v_rough_metal = a_rough_metal;

 	gl_Position = u_proj * v_eye_pos;
}
`;

export const deferred_pass_f = `#version 300 es
precision mediump float;

const float far = 100.0;
const float near = 0.1;

in vec4 v_model_pos;
in vec4 v_eye_pos;
in vec3 v_normal;
in vec3 v_albedo;
in vec2 v_rough_metal;

uniform vec3 u_ambient_c;
uniform float u_ambient_i;

layout(location = 0) out vec4 o_depth;
layout(location = 1) out vec4 o_pos;
layout(location = 2) out vec4 o_norm;
layout(location = 3) out vec4 o_albedo;
layout(location = 4) out vec4 o_rough_metal;
layout(location = 5) out vec4 o_ambient;

void main() {
	float z = (2.0 * near) / (far + near - (gl_FragCoord.z) * (far - near));
	o_depth			= vec4(vec3(z), 1.0);
  	o_pos			= vec4(v_eye_pos.xyz, 1.0);
  	o_norm			= vec4(normalize(v_normal), 1.0);
  	o_albedo		= vec4(v_albedo, 1.0);
  	o_rough_metal	= vec4(v_rough_metal, 0.0, 1.0);
  	o_ambient		= vec4(u_ambient_i*u_ambient_c, 1.0);
}

`;