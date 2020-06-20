export const ssao_blur_v = `
#version 100

attribute vec3 a_vert;

varying vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}

`;

export function gen_ssao_blur_f(screen_width, screen_height) {
let a = `
precision highp float;

// varyings
varying vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_ssao_tex;

void main() {
	vec2 texel_size = 1.0/vec2(${screen_width}.0,${screen_height}.0);
	float res = 0.0;
	vec2 offset;
`;
	// blur kernel loop unfold
	let b = '';
	for(let x=-2; x<2; x++) {
		for(let y=-2; y<2; y++) {
			b += `
	offset = vec2(float(${x}), float(${y})) * texel_size;
	res += texture2D(u_ssao_tex, v_texcoord + offset).x;`
		}
	}

	let c =`
	gl_FragColor = vec4(vec3(res/16.0), 1.0); // 16.0 because 4.0*4.0 for noise texture dimensions
}
`
	return a + b + c;
};