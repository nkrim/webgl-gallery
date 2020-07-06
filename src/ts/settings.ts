import { FXAA_QUALITY_SETTINGS } from '../shaders/fxaa_pass';

export const DEFAULT_SETTINGS:any = {
	player: {
		model: false,
	},
	ssao: {
		enabled: false,
	},
	fxaa: {
		enabled: false,
		quality_index: 0,
	},
}

export function init_settings_handlers(pd:any):void {
	// player_model
	const player_model:any = document.querySelector('#playerModel');
	function player_model_button_state() {
			player_model.children[0].textContent = pd.settings.player.model?'ON':'OFF';
			player_model.classList.toggle('button-active', pd.settings.player.model); 
	};
	player_model_button_state();
	player_model.onclick = function() {
		pd.settings.player.model = !pd.settings.player.model;
		player_model_button_state();
	}
	// ssao_enabled
	const ssao_enabled:any = document.querySelector('#ssaoEnabled');
	function ssao_enabled_button_state() {
			ssao_enabled.children[0].textContent = pd.settings.ssao.enabled?'ON':'OFF';
			ssao_enabled.classList.toggle('button-active', pd.settings.ssao.enabled); 
	};
	ssao_enabled_button_state();
	ssao_enabled.onclick = function() {
		pd.settings.ssao.enabled = !pd.settings.ssao.enabled;
		ssao_enabled_button_state();
	}
	// fxaa_enabled
	const fxaa_enabled:any = document.querySelector('#fxaaEnabled');
	function fxaa_enabled_button_state() {
		fxaa_enabled.children[0].textContent = pd.settings.fxaa.enabled?'ON':'OFF';
		fxaa_enabled.classList.toggle('button-active', pd.settings.fxaa.enabled); 
	}
	fxaa_enabled_button_state();
	fxaa_enabled.onclick = function() {
		pd.settings.fxaa.enabled = !pd.settings.fxaa.enabled;
		fxaa_enabled_button_state();
	}
	// fxaa_quality
	let fxaa_quality:any = document.querySelector('#fxaaQuality');
	function fxaa_quality_button_state() {
		fxaa_quality.children[0].textContent = FXAA_QUALITY_SETTINGS[pd.settings.fxaa.quality_index].name;
		fxaa_quality.classList.toggle('button-active', FXAA_QUALITY_SETTINGS[pd.settings.fxaa.quality_index].name === 'DEFAULT'); 
	}
	fxaa_quality_button_state();
	fxaa_quality.onclick = function() {
		pd.settings.fxaa.quality_index = (++pd.settings.fxaa.quality_index)%FXAA_QUALITY_SETTINGS.length;
		fxaa_quality_button_state();
	}
}