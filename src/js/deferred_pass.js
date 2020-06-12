export const deferred_pass_v = `

attribute vec3 a_vert;
attribute vec3 a_norm;

uniform mat4 u_mv;
uniform mat4 u_it_mv;
uniform mat4 u_proj;

varying vec4 v_model_pos;
varying vec4 v_eye_pos;
varying vec3 v_normal;

void main() {
	v_model_pos = vec4(a_vert, 1.0);
	v_eye_pos = u_mv * vec4(a_vert, 1.0);
	v_normal = (u_it_mv * vec4(a_norm, 0.0)).xyz;

 	gl_Position = u_proj * v_eye_pos;
}

`;

export const deferred_pass_f = `
#extension GL_EXT_draw_buffers : require

precision highp float;

varying vec4 v_model_pos;
varying vec4 v_eye_pos;
varying vec3 v_normal;

const float far = 100.0;
const float near = 0.1;

void main() {
	float z = (2.0 * near) / (far + near - (gl_FragCoord.z) * (far - near));
	gl_FragData[0] = vec4(vec3(z), 1.0);
  	gl_FragData[1] = vec4(v_eye_pos.xyz, 1.0);
  	gl_FragData[2] = vec4(normalize(v_normal), 1.0);
  	gl_FragData[3] = vec4(1.0,1.0,1.0,1.0);//vec4(v_model_pos.xyz, 1.0);
}

`;