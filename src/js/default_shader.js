export const default_shader_v = `

attribute vec4 aVertexPosition;
attribute vec3 aNormalDirection;

uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;

varying vec3 vNormal;

void main() {
	vNormal = normalize(uModel * vec4(aNormalDirection, 0.0)).xyz;

 	gl_Position = uProjection * uView * uModel * aVertexPosition;
}

`;

export const default_shader_f = `

precision mediump float;

varying vec3 vNormal;

const vec3 to_sun = normalize(vec3(1.0,1.0,0.5));
const vec3 sun_c = vec3(1.0,1.0,1.0);

const float mix_a = 0.1;



float diffuse(vec3 N, vec3 L) {
	float angle = dot(N, L);
	angle = clamp(angle, 0.0, 1.0);
	return angle;
}

void main() {
  	vec3 c = diffuse(vNormal, to_sun) * sun_c;
  	c = mix(c, vec3(1.0,1.0,1.0), mix_a);
  	gl_FragColor = vec4(c, 1.0);
}

`;