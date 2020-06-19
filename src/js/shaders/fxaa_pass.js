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

// sample function
float sample_lum(vec2 uv) {
	return texture2D(u_screen_tex, uv).g;
}

// main function
void main() {
	// main subpixel blending
	// ----------------------
	// sample luminance data from cross pattern around fragment (from green value)
	vec3 original_pixel = texture2D(u_screen_tex, v_texcoord).rgb;
	float l_m = original_pixel.g;
	float l_n = sample_lum(v_texcoord + (texel_size*vec2(0.0,1.0)));
	float l_e = sample_lum(v_texcoord + (texel_size*vec2(1.0,0.0)));
	float l_s = sample_lum(v_texcoord + (texel_size*vec2(0.0,-1.0)));
	float l_w = sample_lum(v_texcoord + (texel_size*vec2(-1.0,0.0)));
	// calculate contrast
	float l_high = max(max(max(max(l_m, l_n), l_e), l_s), l_w);
	float l_low = min(min(min(min(l_m, l_n), l_e), l_s), l_w);
	float contrast = l_high - l_low;

	if(contrast < ${FXAA_CONTRAST_THRESHOLD} || contrast < ${FXAA_RELATIVE_THRESHOLD}*l_high) {
		discard;
		gl_FragColor = vec4(original_pixel, 1.0);
		return;
	}

	// sample corner data now that some pixels have been discarded
	float l_ne = sample_lum(v_texcoord + (texel_size*vec2(1.0,1.0)));
	float l_se = sample_lum(v_texcoord + (texel_size*vec2(1.0,-1.0)));
	float l_sw = sample_lum(v_texcoord + (texel_size*vec2(-1.0,-1.0)));
	float l_nw = sample_lum(v_texcoord + (texel_size*vec2(-1.0,1.0)));
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
	// use gradient to determine pos/negative direction, store opposite for longer edge blend
	float opp_lum, gradient;
	if(pos_grad < neg_grad) {
		pixel_step *= -1.0;
		opp_lum = neg_lum;
		gradient = neg_grad;
	}
	else {
		opp_lum = pos_lum;
		gradient = pos_grad;
	}
	float pixel_blend = pixel_step * blend_factor;

	// longer edge blending factor
	// ---------------------------
	//
	vec2 uv_edge = v_texcoord;
	vec2 edge_step;
	if(is_horiz) {
		uv_edge.y += pixel_step * 0.5;
		edge_step = vec2(texel_size.x, 0.0);
	}
	else {
		uv_edge.x += pixel_step * 0.5;
		edge_step = vec2(0.0, texel_size.y);
	}
	// get average along edge at middle point and develop threshold
	float edge_lum = (l_m + opp_lum) * 0.5;
	float grad_thresh = gradient * 0.25;
	// begin edge crawl
	vec2 e_uv = uv_edge + edge_step;
	float e_lum_delta = sample_lum(e_uv) - edge_lum;
	bool e_at_end = abs(e_lum_delta) >= grad_thresh;

	gl_FragColor = vec4(vec3(e_at_end), 1.0);
	return;


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