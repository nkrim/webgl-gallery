let default_shader_v = `

attribute vec4 aVertexPosition;
attribute vec3 aNormalDirection;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

varying vec3 vNormal;

void main() {
	vNormal = normalize(uModelViewMatrix * vec4(aNormalDirection, 0.0)).xyz;

 	gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
}

`;