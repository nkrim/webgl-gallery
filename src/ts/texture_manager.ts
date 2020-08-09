import * as M from 'gl-matrix';
import { vec2 } from 'gl-matrix';
import { gen_ssao_noise } from '../shaders/ssao_pass';

/* TEXTURE GLOBAL CONSTANTS
=========================== */
export const SHADOWMAP_SIZE = 1024;

/* TEXTURE MANAGER CLASS
============================ */
export class TextureManager {
	/* TEXTURE CONSTANTS
	-------------------- */
	default_texture_properties: any;
	default_depth_texture_properties:any;
	default_image_texture_properties:any;
	/* UNIVERSAL TEXTURES
	--------------------- */
	screen_depth:		WebGLTexture;
	gbuffer:			Array<WebGLTexture>;
	sm_depth_generic:	WebGLTexture;
	sm_linear_generic:	WebGLTexture;
	sm_prefilter_temp:	WebGLTexture;
	light_accum:		WebGLTexture;
	ssao_rot:			WebGLTexture;
	ssao_preblur:		WebGLTexture;
	ssao:				WebGLTexture;
	screen_out_a:		WebGLTexture;
	screen_out_b:		WebGLTexture;
	white:				WebGLTexture;
	black: 				WebGLTexture;
	// TEMP
	sm_evsm_generic: WebGLTexture;
	/* DYNAMIC TEXTURE DATA
	----------------------- */
	image_lookup: 				Map<string,number>;
	image_array:				Array<WebGLTexture>;
	image_loaded_count: 		number;
	all_images_loaded: 	Promise<void[]>;

	/* CONSTRUCTOR (init_universal_textures)
	---------------------------------------- */
	constructor(gl:WebGL2RenderingContext, screen_dims:vec2, image_list:Array<[string,string]>) {
		this.gen_default_texture_properties(gl, screen_dims);
		this.init_universal_textures(gl, screen_dims);

		this.image_lookup = new Map();
		this.image_array = [];
		this.image_loaded_count	= 0;
		this.load_all_images(gl, image_list)
	}

	init_universal_textures(gl:WebGL2RenderingContext, screen_dims:vec2):void {
		this.screen_depth = this.gen_depth_texture(gl);
		this.gbuffer = [];
		for(let i=0; i<6; i++)
			this.gbuffer.push(this.gen_texture(gl, {internal_format:gl.RGBA32F}));
		this.sm_depth_generic = this.gen_depth_texture(gl, {dimensions:[SHADOWMAP_SIZE,SHADOWMAP_SIZE]});
		this.sm_linear_generic = this.gen_texture(gl, {internal_format:gl.RGBA32F, dimensions:[SHADOWMAP_SIZE,SHADOWMAP_SIZE]});
		this.sm_prefilter_temp = this.gen_texture(gl, {internal_format:gl.RGBA32F, dimensions:[SHADOWMAP_SIZE,SHADOWMAP_SIZE]});
		this.light_accum = this.gen_texture(gl);
		this.ssao_rot = gen_ssao_noise(gl, this);
		this.ssao_preblur = this.gen_texture(gl, {filter_function:gl.NEAREST});
		this.ssao = this.gen_texture(gl);
		this.screen_out_a = this.gen_texture(gl);
		this.screen_out_b = this.gen_texture(gl);
		this.white = this.gen_texture(gl, {filter_function:gl.NEAREST, dimensions:[1,1], pixel:new Float32Array([1,1,1,1])});
		this.black = this.gen_texture(gl, {filter_function:gl.NEAREST, dimensions:[1,1], pixel:new Float32Array([0,0,0,1])});

		this.sm_evsm_generic = this.gen_texture(gl, {internal_format:gl.RGBA32F, dimensions:[SHADOWMAP_SIZE,SHADOWMAP_SIZE]});
	}

	gen_default_texture_properties(gl:WebGL2RenderingContext, screen_dims:vec2):void {
		const tex_dims = M.vec2.create(); M.vec2.copy(tex_dims, screen_dims);
		this.default_texture_properties = {
			filter_function: gl.LINEAR,
			texture_wrap: gl.CLAMP_TO_EDGE,
			level: 0,
			internal_format: gl.RGBA16F,
			dimensions: tex_dims,
			border: 0,
			src_format: gl.RGBA,
			src_type: gl.FLOAT,
			pixel: null,
		};
		this.default_depth_texture_properties = {
			filter_function: gl.NEAREST,
			texture_wrap: gl.CLAMP_TO_EDGE,
			level: 0,
			internal_format: gl.DEPTH_COMPONENT16,
			dimensions: tex_dims,
			border: 0,
			src_format: gl.DEPTH_COMPONENT,
			src_type: gl.UNSIGNED_SHORT,
			pixel: null,
		};
		this.default_image_texture_properties = {
			filter_function: gl.NEAREST,
			texture_wrap: gl.REPEAT,
			level: 0,
			internal_format: gl.RGBA,
			src_format: gl.RGBA,
			src_type: gl.UNSIGNED_BYTE,
		};
	}

	gen_texture(gl:WebGL2RenderingContext, property_overrides?:any):WebGLTexture {
		// setup properties
		const p = Object.assign({}, this.default_texture_properties);
		Object.assign(p, property_overrides);
		if(Object.keys(p).length > Object.keys(this.default_texture_properties).length)
			console.warn('gen_texture: invalid properties included in overrides.',p);

		// gen texture
		const tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p.filter_function);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, p.filter_function);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, p.texture_wrap);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, p.texture_wrap);
		gl.texImage2D(gl.TEXTURE_2D, p.level, p.internal_format, p.dimensions[0], p.dimensions[1], 
						p.border, p.src_format, p.src_type, p.pixel);
		return tx;
	}

	gen_depth_texture(gl:WebGL2RenderingContext, property_overrides?:any, enable_compare_mode:boolean=false):WebGLTexture {
		// setup properties
		const p = Object.assign({}, this.default_depth_texture_properties);
		Object.assign(p, property_overrides);
		if(Object.keys(p).length > Object.keys(this.default_depth_texture_properties).length)
			console.warn('gen_depth_texture: invalid properties included in overrides.',p);

		// gen texture
		const tx = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tx);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p.filter_function);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, p.filter_function);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, p.texture_wrap);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, p.texture_wrap);
		if(enable_compare_mode) {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
		}
		gl.texImage2D(gl.TEXTURE_2D, p.level, p.internal_format, p.dimensions[0], p.dimensions[1], 
						p.border, p.src_format, p.src_type, p.pixel);
		return tx;
	}

	load_all_images(gl:WebGL2RenderingContext, image_list:Array<[string,string]>) {
		const image_promises:Array<Promise<void>> = [];
		for(let i=0; i<image_list.length; i++)
			image_promises.push(this.load_image(gl, image_list[i][0], image_list[i][1]));
		this.all_images_loaded = Promise.all(image_promises);
	}

	load_image(gl:WebGL2RenderingContext, name:string, src:string, property_overrides?:any):Promise<void> {
		// setup properties
		const p = Object.assign({}, this.default_image_texture_properties);
		Object.assign(p, property_overrides);
		if(Object.keys(p).length > Object.keys(this.default_image_texture_properties).length)
			console.warn('load_image: invalid properties included in overrides.',p);

		// add to lookup
		const index = this.image_array.length;
		this.image_array.push(null);
		this.image_lookup.set(name, index);

		// image event handler
		const image_load_func = ((resolve:any, image:any) => (() => {
			const tx = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tx);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, p.filter_function);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, p.filter_function);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, p.texture_wrap);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, p.texture_wrap);
			gl.texImage2D(gl.TEXTURE_2D, p.level, p.internal_format, p.src_format, p.src_type, image);
			this.image_array[index] = tx;
			this.image_loaded_count++;
			resolve();
		})).bind(this);

		// load image
		return new Promise(resolve => {
			const image = new Image();
			image.addEventListener('load', image_load_func(resolve, image));
			image.src = src;
		});
	}

	get_image(index:number) {
		return this.image_array[index];
	}
	get_image_index (name:string) {
		return this.image_lookup.get(name);
	}
	get_image_from_name(name:string) {
		return this.image_array[this.image_lookup.get(name)];
	}
}