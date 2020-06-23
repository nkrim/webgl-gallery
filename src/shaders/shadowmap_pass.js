// LOCATIONS
export const shadowmap_pass_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		proj_m: 'u_proj',
		mv_m: 'u_mv',
	}
}

// VERTEX SHADER
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

// FRAGMENT SHADER
export const shadowmap_pass_f = `
precision highp float;
const float near = 0.1;
const float far = 20.0;
void main() { 
	/* DEBUG STUFF */
	//float z = (2.0 * near) / (far + near - (gl_FragCoord.z) * (far - near));
	//gl_FragColor = vec4(vec3(z), 1.0);
	gl_FragColor = vec4(1.0,1.0,1.0,1.0); 
}
`

