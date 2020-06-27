// LOCATIONS
export const shadowmap_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		proj_m: 'u_proj',
		mv_m: 'u_mv',
		znear: 'u_znear',
		zfar: 'u_zfar',
	}
}

// VERTEX SHADER
export const shadowmap_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

uniform mat4 u_mv;
uniform mat4 u_proj;

void main() {
 	gl_Position = u_proj * u_mv * vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export const shadowmap_pass_f = `#version 300 es
precision mediump float;

uniform float u_znear;
uniform float u_zfar;

out vec4 o_fragcolor;

void main() { 
	float z = (2.0 * u_znear) / (u_zfar + u_znear - gl_FragCoord.z*(u_zfar - u_znear));
	o_fragcolor = vec4(z,0.0,0.0,1.0); 
}
`

