import * as M from 'gl-matrix';
import { vec2 } from 'gl-matrix';
import * as S from './settings';
import { TextureManager } from './texture_manager';
import { ShaderManager } from './shader_manager';

/* CONTEXT CONFIG
================= */
export interface ContextConf {
	screen_dims: 	vec2;
	tex_image_list: Array<[string,string]>;

}

/* CONTEXT CLASS
================ */
export class Context {
	is_initialized:	boolean;
	/* init properties
	------------------ */
	screen_dims: 	vec2;

	/* contexts and managers
	------------------------ */
	gl:				WebGL2RenderingContext;
	textures:		TextureManager;
	shaders:	 	ShaderManager;

	/* constructor
	-------------- */
	constructor() {
		this.is_initialized = false;
	}

	initialize(conf:ContextConfig) {
		// pre-gl setup
		this.set_screen_dimensions(conf.screen_dims);
		// post-gl setup
		this.gl = get_webgl2_context();
		this.tx = new TextureManager(this.gl, this.screen_dims, conf.tex_image_list);

		// initialize
		this.is_initialized = true;
	}

	/* screen dimnesion adjust (needs gl init)
	------------------------------------------ */
	set_screen_dimensions(dims:vec2, ):boolean {
		if(M.equals(dims,this.screen_dims))
			return false;
		M.vec2.copy(this.screen_dims, dims);
		this.gl.canvas.width = dims[0];
		this.gl.canvas.height = dims[1];
		if(this.tx) {
			// @TODO -- PERFORM TEXTURE-RECONSTRUCTION FOR SCREEN TEXS
		}
	}
}
export const context = new Context();/*{
	tex_image_list: [['blue_noise', './img/LDR_RGB1_3.png'],['blue_noise_1d', './img/LDR_LLL1_3.png']],
}); */



/* INIT FUNCTIONS
================= */
function get_webgl2_context():WebGL2RenderingContext {
	const canvas:HTMLCanvasElement = document.querySelector('#glCanvas');
	const gl = canvas.getContext('webgl2', {antialias: false});
	if (gl === null) {
   		alert("Unable to initialize WebGL2. Your browser or machine may not support it.");
    	return;
  	}
  	return gl;
}