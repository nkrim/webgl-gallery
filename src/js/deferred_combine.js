export const deferred_combine_v = `
#version 100

attribute vec3 a_vert;

uniform mat4 u_view;

const vec4 to_sun = vec4(normalize(vec3(1.0,1.0,0.5)), 0.0);

varying vec2 v_texcoord;
varying vec3 v_to_sun;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	v_to_sun = (u_view * to_sun).xyz;
	gl_Position = vec4(a_vert, 1.0);
}

`;

export const deferred_combine_f = `
precision highp float;

const float ambient_i = 0.1;
const vec3 ambient_c = vec3(1.0,1.0,1.0);

const vec3 sun_c = vec3(1.0,1.0,1.0);

varying vec2 v_texcoord;
varying vec3 v_to_sun;

uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_color_tex;

vec3 diffuse(vec3 N, vec3 L, vec3 C) {
	return max(dot(N, L), 0.0) * C;
}

void main() {
	vec3 norm = texture2D(u_norm_tex, v_texcoord).xyz; 
	vec3 diffuse_v = diffuse(norm, v_to_sun, sun_c);
	vec3 ambient_v = ambient_i * ambient_c;
	vec3 obj_color = vec3(1.0,1.0,1.0);//texture2D(u_color_tex, v_texcoord).xyz;
  	gl_FragColor = vec4((ambient_v + diffuse_v) * obj_color, 1.0);
}

`;