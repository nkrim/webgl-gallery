// PROGRAMATIC MODEL SETUPS
// ========================

function room_model() {
	let room = {}

	// Init buffers with quad data
	room.vertex_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ARRAY_BUFFER, room.vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad_p.vertices), gl.STATIC_DRAW);
	// index buffer
	room.index_buffer = gl.createBuffer();
  	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, room.index_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(quad_p.indices), gl.STATIC_DRAW);

	// matrix buffer
	// let transforms
	// room.mvm_buffer = gl.createBuffer();
}