export const deferred_combine_l = {
	attribs: {
		vertex_pos: 'a_vert',
	},
	uniforms: {
		view_m: 'u_view',
		pos_tex: 'u_pos_tex',
		norm_tex: 'u_norm_tex',
		color_tex: 'u_color_tex',
		ambient_tex: 'u_ambient_tex',
		ssao_tex: 'u_ssao_tex',
		light_tex: 'u_light_tex',
	}
}
export const deferred_combine_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

uniform mat4 u_view;

const vec4 to_sun = vec4(normalize(vec3(1.0,1.0,0.5)), 0.0);

out vec2 v_texcoord;
out vec3 v_to_sun;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	v_to_sun = (u_view * to_sun).xyz;
	gl_Position = vec4(a_vert, 1.0);
}
`;

export const deferred_combine_f = `#version 300 es
precision mediump float;

in vec2 v_texcoord;
in vec3 v_to_sun;

uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_color_tex;
uniform sampler2D u_ambient_tex;
uniform sampler2D u_ssao_tex;
uniform sampler2D u_light_tex;

out vec4 o_fragcolor;

// utility functions
vec3 diffuse(vec3 N, vec3 L, vec3 C) {
	return max(dot(N, L), 0.0) * C;
}
float luminance(vec3 v) {
    return dot(v, vec3(0.2126, 0.7152, 0.0722));
}

// tonemapping values and functions
const mat3 aces_in = transpose(mat3(	vec3(0.59719, 0.35458, 0.04823),
						    vec3(0.07600, 0.90834, 0.01566),
						    vec3(0.02840, 0.13383, 0.83777)));
const mat3 aces_out = transpose(mat3(	vec3( 1.60475, -0.53108, -0.07367),
						    vec3(-0.10208,  1.10813, -0.00605),
						    vec3(-0.00327, -0.07276,  1.07602)));
vec3 rtt_and_odt_fit(vec3 v) {
    vec3 a = v*(v + 0.0245786) - 0.000090537;
    vec3 b = v*(v*0.983729 + 0.4329510) + 0.238081;
    return a/b;
}
vec3 aces_fitted(vec3 v) {
    v = aces_in * v;
    v = rtt_and_odt_fit(v);
    return aces_out * v;
}

// main method
void main() {
	vec3 norm = texture(u_norm_tex, v_texcoord).xyz; 
	vec3 obj_color = texture(u_color_tex, v_texcoord).xyz;
	vec3 light_val = texture(u_light_tex, v_texcoord).xyz;

	//vec3 diffuse_v = diffuse(norm, v_to_sun, sun_c);
	vec3 ambient_v = texture(u_ambient_tex, v_texcoord).xyz * texture(u_ssao_tex, v_texcoord).x;
	vec3 final_c = (ambient_v + light_val) * obj_color;

	// aces tonemapping
	final_c = aces_fitted(final_c);


	// gamma encoding
	final_c = pow(final_c, vec3(1.0/2.2)); 

  	o_fragcolor = vec4(final_c, 1.0);
}

`;