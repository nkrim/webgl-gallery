export const fxaa_pass_v = `
#version 100

attribute vec3 a_vert;

varying vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}

`;

export function gen_fxaa_pass_f(viewport_width, viewport_height) {return `
precision highp float;

// noise sampling constants
const float viewport_width = ${viewport_width}.0;
const float viewport_height = ${viewport_height}.0;
const vec2 texel_size = vec2(1.0/viewport_width, 1.0/viewport_height);

// varyings
varying vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_screen_tex;

void main() {
	// sample luminance data from cross pattern around fragment (from green value)
	float l_m = texture2D(u_screen_tex, v_texcoord).g;
	float l_n = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(0.0,1.0))).g;
	float l_e = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(1.0,0.0))).g;
	float l_s = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(0.0,-1.0))).g;
	float l_w = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(-1.0,0.0))).g;
	// calculate contrast
	float l_high = max(max(max(max(l_m, l_n), l_e), l_s), l_w);
	float l_low = min(min(min(min(l_m, l_n), l_e), l_s), l_w);
	float contrast = l_high - l_low;

	gl_FragColor = vec4(vec3(contrast), 1.0);
}

`};