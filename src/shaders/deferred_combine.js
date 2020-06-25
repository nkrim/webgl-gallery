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

vec3 diffuse(vec3 N, vec3 L, vec3 C) {
	return max(dot(N, L), 0.0) * C;
}

void main() {
	vec3 norm = texture(u_norm_tex, v_texcoord).xyz; 
	vec3 obj_color = texture(u_color_tex, v_texcoord).xyz;
	vec3 light_val = texture(u_light_tex, v_texcoord).xyz;

	//vec3 diffuse_v = diffuse(norm, v_to_sun, sun_c);
	vec3 ambient_v = texture(u_ambient_tex, v_texcoord).xyz * texture(u_ssao_tex, v_texcoord).x;
	vec3 final_c = (ambient_v + light_val) * obj_color;

	// gamma encoding
	final_c = pow(final_c, vec3(1.0/2.2)); 

  	o_fragcolor = vec4(final_c, 1.0);
}

`;