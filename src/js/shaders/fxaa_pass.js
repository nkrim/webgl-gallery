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

export function gen_fxaa_pass_f(viewport_width, viewport_height, quality='DEFAULT_QUALITY') {
	let edge_step_count = '10';
	let edge_steps = ['1.0', '1.5', '2.0', '2.0', '2.0', '2.0', '2.0', '2.0', '2.0', '4.0'];
	let edge_guess = '8.0';
	if(quality === 'LOW_QUALITY') {
		edge_step_count = '4';
		edge_steps = ['1.0', '1.5', '2.0', '4.0'];
		edge_guess = '12.0';
	}
	const a = `
precision highp float;

// sampling constants
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

	// PRIMARY SUB-PIXEL BLENDING
	// --------------------------
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

	// discard (use original sample) if below thresholds
	if(contrast < ${FXAA_CONTRAST_THRESHOLD} || contrast < ${FXAA_RELATIVE_THRESHOLD}*l_high) {
		//discard;
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
	float pixel_blend = blend_factor * blend_factor * ${FXAA_FILTER_COEFFICIENT};

	// EDGE DIRECTION CALCULATION
	// --------------------------
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
	bool pos_dir = pos_grad < neg_grad;
	if(pos_dir) pixel_step *= -1.0;
	float opp_lum  = pos_dir ? neg_lum  : pos_lum;
	float gradient = pos_dir ? neg_grad : pos_grad;

	// LONGER EDGE BLENDING FACTOR
	// ---------------------------
	// set up edge stepping
	vec2 uv_edge   = (is_horiz ? vec2(0.0, pixel_step*0.5) : vec2(pixel_step*0.5, 0.0)) + v_texcoord;
	vec2 edge_step =  is_horiz ? vec2(texel_size.x, 0.0)   : vec2(0.0, texel_size.y);
	// get average along edge at middle point and develop threshold
	float edge_lum = (l_m + opp_lum) * 0.5;
	float grad_thresh = gradient * 0.25;
	// begin edge crawl
	vec2 pe_uv = uv_edge + edge_step * ${edge_steps[0]};
	vec2 ne_uv = uv_edge - edge_step * ${edge_steps[0]};
	float pe_lum_delta = sample_lum(pe_uv) - edge_lum;
	float ne_lum_delta = sample_lum(ne_uv) - edge_lum;
	bool pe_at_end = abs(pe_lum_delta) >= grad_thresh;
	bool ne_at_end = abs(ne_lum_delta) >= grad_thresh;
	bool pe_ne_at_end = pe_at_end && ne_at_end;

	// complete edge crawl
	`

	// unroll edge crawl loops
	let b = '';
	for(let i=0; i<edge_step_count-1; i++) {
		b += `
	if(!pe_ne_at_end) {
		if(!pe_at_end) pe_uv += edge_step * ${edge_steps[i]};
		if(!pe_at_end) pe_lum_delta = sample_lum(pe_uv) - edge_lum;
		if(!pe_at_end) pe_at_end = abs(pe_lum_delta) >= grad_thresh;
		if(!ne_at_end) ne_uv -= edge_step * ${edge_steps[i]};
		if(!ne_at_end) ne_lum_delta = sample_lum(ne_uv) - edge_lum;
		if(!ne_at_end) ne_at_end = abs(ne_lum_delta) >= grad_thresh;
		pe_ne_at_end = pe_at_end && ne_at_end;
	`;
	}
	for(let i=0; i<edge_step_count-1; i++) {
		b += `}`;
	}

	const c = `
	// push one texel further if not found
	if(!pe_at_end) pe_uv += edge_step * ${edge_guess};
	if(!ne_at_end) ne_uv += edge_step * ${edge_guess};

	// calculate edge end distance
	float pe_dist, ne_dist;
	pe_dist = is_horiz ? (pe_uv.x - v_texcoord.x) : (pe_uv.y - v_texcoord.y);
	ne_dist = is_horiz ? (v_texcoord.x - ne_uv.x) : (v_texcoord.y - ne_uv.y);
	bool pe_shorter = pe_dist <= ne_dist;
	float min_dist  = pe_shorter ? pe_dist : ne_dist;
	bool delta_sign = pe_shorter ? (pe_lum_delta >= 0.0) : (ne_lum_delta >= 0.0);
	// discard blurring on pixels moving away from edge
	float edge_blend = (delta_sign == ((l_m - edge_lum) >= 0.0)) ?
		0.0 : 0.5 - min_dist/(pe_dist + ne_dist);


	// FINAL COMPOSITION
	// -----------------
	// determine final blend w max of pixel blend and edge blend
	float final_blend = max(pixel_blend, edge_blend) * pixel_step;

	// gl_FragColor = vec4(vec3(edge_blend*2.0), 1.0);
	// return;

	// adjust uv and sample final color from screen
	vec2 final_uv = v_texcoord;
	final_uv += is_horiz ? vec2(0.0, final_blend) : vec2(final_blend, 0.0);
	
	vec3 final_sample = texture2D(u_screen_tex, final_uv).xyz;
	gl_FragColor = vec4(vec3(final_sample), 1.0);
	// debug original
	//gl_FragColor = vec4(original_pixel, 1.0);
	// debug color
	//gl_FragColor = pixel_step < 0.0 ? vec4(1.0,0.0,0.0,1.0) : vec4(0.0,1.0,0.0,1.0);
}
`
	return a + b + c;
};