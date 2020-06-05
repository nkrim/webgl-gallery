let default_shader_v = `

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