export const FXAA_CONTRAST_THRESHOLD = '0.0312';
export const FXAA_RELATIVE_THRESHOLD = '0.166';
export const FXAA_FILTER_COEFFICIENT = '1.0';
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
	vec3 original_pixel = texture2D(u_screen_tex, v_texcoord).rgb;
	float l_m = original_pixel.g;
	float l_n = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(0.0,1.0))).g;
	float l_e = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(1.0,0.0))).g;
	float l_s = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(0.0,-1.0))).g;
	float l_w = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(-1.0,0.0))).g;
	// calculate contrast
	float l_high = max(max(max(max(l_m, l_n), l_e), l_s), l_w);
	float l_low = min(min(min(min(l_m, l_n), l_e), l_s), l_w);
	float contrast = l_high - l_low;

	if(contrast < ${FXAA_CONTRAST_THRESHOLD} || contrast < ${FXAA_RELATIVE_THRESHOLD}*l_high) {
		gl_FragColor = vec4(original_pixel, 1.0);
		return;
	}

	// sample corner data now that some pixels have been discarded
	float l_ne = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(1.0,1.0))).g;
	float l_se = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(1.0,-1.0))).g;
	float l_sw = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(-1.0,-1.0))).g;
	float l_nw = texture2D(u_screen_tex, v_texcoord + (texel_size*vec2(-1.0,1.0))).g;
	// calculate average of all samples added with double weight on the cross
	float sample_average = 2.0*(l_n + l_e + l_s + l_w) + l_ne + l_nw + l_se + l_sw;
	sample_average /= 12.0;
	// calculate blend_factor from difference of average and middle pixel, normalized by contrast
	float blend_factor = abs(sample_average - l_m);
	blend_factor = smoothstep(0.0, 1.0, blend_factor/contrast);
	blend_factor *= blend_factor * ${FXAA_FILTER_COEFFICIENT};

	// calculate edge direction
	float horiz = abs(l_n + l_s - 2.0*l_m)*2.0 +
					abs(l_ne + l_se - 2.0*l_e) +
					abs(l_nw + l_sw - 2.0*l_w);
	float verti = abs(l_e + l_w - 2.0 * l_m) * 2.0 +
					abs(l_ne + l_nw - 2.0 * l_n) +
					abs(l_se + l_sw - 2.0 * l_s);
	bool is_horiz = horiz >= verti;
	float pos_lum = is_horiz ? l_n : l_e;
	float neg_lum = is_horiz ? l_s : l_w;
	float pos_grad = abs(pos_lum - l_m);
	float neg_grad = abs(neg_lum - l_m);
	float pixel_step = is_horiz ? texel_size.y : texel_size.x;
	if(pos_grad < neg_grad)
		pixel_step *= -1.0;
	float pixel_blend = pixel_step * blend_factor;

	// adjust uv and sample final color from screen
	vec2 final_uv = v_texcoord;
	if(is_horiz)
		final_uv.y += pixel_blend;
	else
		final_uv.x += pixel_blend;
	
	vec3 final_sample = texture2D(u_screen_tex, final_uv).xyz;
	gl_FragColor = vec4(vec3(final_sample), 1.0);
	// debug original
	//gl_FragColor = vec4(original_pixel, 1.0);
	// debug color
	//gl_FragColor = pixel_step < 0.0 ? vec4(1.0,0.0,0.0,1.0) : vec4(0.0,1.0,0.0,1.0);
}

`};