import { context } from './context';
// SHADER IMPORTS
import { deferred_pass_l, deferred_pass_v, deferred_pass_f } from '../shaders/deferred_pass.js';
import { deferred_combine_l, deferred_combine_v, deferred_combine_f } from '../shaders/deferred_combine.js';
import { ssao_pass_l, ssao_pass_v, ssao_pass_f, gen_ssao_kernel } from '../shaders/ssao_pass.ts';
import { ssao_blur_l, ssao_blur_v, gen_ssao_blur_f } from '../shaders/ssao_blur.js';
import { spotlight_pass_l, spotlight_pass_v, gen_spotlight_pass_f,  } from '../shaders/spotlight_pass.js';
import { fxaa_pass_l, fxaa_pass_v, gen_fxaa_pass_f, FXAA_QUALITY_SETTINGS } from '../shaders/fxaa_pass.ts';
import { shadowmap_pass_l, shadowmap_pass_v, shadowmap_pass_f } from '../shaders/shadowmap_pass.js';
import { evsm_pass_l, evsm_pass_v, evsm_pass_f } from '../shaders/evsm_pass.js';
import { evsm_prefilter_l, evsm_prefilter_v, gen_evsm_prefilter_f } from '../shaders/evsm_prefilter.js';

interface ShaderInfo {
	label: 	string;
	vs: 	string;
	fs: 	string;
	locs: 	object;
}
interface ShaderVariants {
	name:		string;
	variants:	Array<ShaderInfo>
}
interface ShaderData {
	prog: WebGLProgram;
	attribs: object;
	uniforms: object;
}

const evsm_kernel = lerp_gaussian_kernel_1d(15);
const shader_conf:Array<ShaderVariants> = [
	{ name:'deferred_pass',
		variants: [{ label: "", 	vs:deferred_pass_v, 	fs:deferred_pass_f, 		locs:deferred_pass_l },]
	},
	{ name:'shadowmap_pass',
		variants: [{ label: "",		vs:shadowmap_pass_v,	fs:shadowmap_pass_f,		locs:shadowmap_pass_l },]
	},
	{ name:'evsm_pass',
		variants: [{ label: "",		vs:evsm_pass_v,			fs:evsm_pass_f,				locs:evsm_pass_l },]
	},
	{ name:'evsm_prefilter_x',
		variants: [{ label: "",		vs:evsm_prefilter_v,	fs:gen_evsm_prefilter_f(evsm_kernel, true),	locs:evsm_prefilter_l },]
	},
	{ name:'evsm_prefilter_y',
		variants: [{ label: "",		vs:evsm_prefilter_v,	fs:gen_evsm_prefilter_f(evsm_kernel, false), locs:evsm_prefilter_l },]
	},
	{ name:'spotlight_pass',
		variants: [{ label: "",		vs:spotlight_pass_v,	fs:gen_spotlight_pass_f(),	locs:spotlight_pass_l },]
	},
	{ name:'ssao_pass',
		variants: [{ label: "", 	vs:ssao_pass_v, 		fs:ssao_pass_f, 			locs:ssao_pass_l },]
	},
	{ name:'ssao_blur',
		variants: [{ label: "", 	vs:ssao_blur_v, 		fs:gen_ssao_blur_f(),		locs:ssao_blur_l },]
	},
	{ name:'fxaa_pass',
		variants: [
			{label: "high",			vs:fxaa_pass_v,			fs:gen_fxaa_pass_f(FXAA_QUALITY_SETTINGS[0]), locs:fxaa_pass_l },
			{label: "low",			vs:fxaa_pass_v,			fs:gen_fxaa_pass_f(FXAA_QUALITY_SETTINGS[1]), locs:fxaa_pass_l },
		]
	},
	{ name:'deferred_combine',
		variants: [{ label: "", 	vs:deferred_combine_v, 	fs:deferred_combine_f, 		locs:deferred_combine_l },]
	},
];

export class ShaderManager {
	index_lookup: 	Map<string,number>;
	shader_list:	Array<ShaderData>;

	constructor(shader_conf:Array<ShaderInfo>) {
		// setup lookup and init shaders
		this.index_lookup = new Map();
		this.shader_list = [];
		for(let i=0; i<shader_conf.length; i++) {
			const info = shader_conf[i];
			this.index_lookup.set(info.name, this.shader_list.length);
			this.shader_list.push(init_shader_program(context.gl, info.vs, info.fs, info.locs));
		}
	}

	get_shader(index:number):ShaderData {
		return this.shader_list[index];
	}
	get_shader_index(name:string):number {
		if(!this.index_lookup.has(name)) {
			console.warn(`ShaderManager.get_shader_index: shader "${name}" not found.`);
			return -1;
		}
		return this.index_lookup.get(name);
	}
	get_shader_from_name(name:string):ShaderData {
		const index = this.get_shader_index(name);
		if(index < 0)
			return null;
		return this.shader_list[index];
	}

	swap_shader(info:ShaderInfo):boolean {
		const index = this.get_shader_index(info.name);
		if(index < 0)
			return false;
		context.gl.deleteShader(this.shader_list[index]);
		this.shader_list[index] = init_shader_program(context.gl, info.vs, info.fs, info.locs);
		return true;
	}
}

function load_shader(gl:WebGL2RenderingContext, type:number, source:string):WebGLShader {
  	const shader = gl.createShader(type);

  	// Send the source to the shader object
  	gl.shaderSource(shader, source);

  	// Compile the shader program
 	gl.compileShader(shader);

 	// See if it compiled successfully
  	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}

	return shader;
}

function init_shader_program(gl:WebGL2RenderingContext, vs_source:string, fs_source:string, loc_lookup:object):ShaderData {
	const vertex_shader = load_shader(gl, gl.VERTEX_SHADER, vs_source);
	const fragment_shader = load_shader(gl, gl.FRAGMENT_SHADER, fs_source);

	// Create the shader program
	const shader_program = gl.createProgram();
	gl.attachShader(shader_program, vertex_shader);
	gl.attachShader(shader_program, fragment_shader);
	gl.linkProgram(shader_program);

	// If creating the shader program failed, alert
	if (!gl.getProgramParameter(shader_program, gl.LINK_STATUS)) {
		alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shader_program));
		return null;
	}

	// Lookup locations and fill into shader_data
	let shader_data:ShaderData = {
		prog: shader_program,
		attribs: {},
		uniforms: {}
	};
	for(let [k, v] of Object.entries(loc_lookup.attribs))
		shader_data.attribs[k] = gl.getAttribLocation(shader_program, v);
	for(let [k, v] of Object.entries(loc_lookup.uniforms))
		shader_data.uniforms[k] = gl.getUniformLocation(shader_program, v);
	return shader_data;
}