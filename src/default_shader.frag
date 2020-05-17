let default_shader_f = `

precision mediump float;

varying vec3 vNormal;


const vec3 to_sun = normalize(vec3(1.0,1.0,0.5));
const vec3 sun_c = vec3(1.0,1.0,1.0);



float diffuse(vec3 N, vec3 L) {
	float angle = dot(N, L);
	angle = clamp(angle, 0.0, 1.0);
	return angle;
}

void main() {
  	vec3 c = diffuse(vNormal, to_sun) * sun_c;
  	gl_FragColor = vec4(c, 1.0);
}

`;