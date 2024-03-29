import { pretty_float } from '../ts/utils.ts';
import { SAVSM_UINT } from '../js/app.js';

// CONSTANTS
export const PCF_POISSON_SAMPLE_COUNT = 32;
export const PCSS_POISSON_SAMPLE_COUNT = 32;

// LOCATIONS
export const spotlight_pass_l = {
    attribs: {
        vertex_pos: 'a_vert',
    },
    uniforms: {
        pos_tex: 'u_pos_tex',
        norm_tex: 'u_norm_tex',
        albedo_tex: 'u_albedo_tex',
        rough_metal_tex: 'u_rough_metal_tex',
        shadow_atlas_linear_tex: 'u_shadow_atlas_linear_tex',
        shadow_atlas_evsm_tex: 'u_shadow_atlas_evsm_tex',
        shadow_atlas_tex: 'u_shadow_atlas_tex',
        blue_noise_tex: 'u_blue_noise_tex',
        blue_noise_tex_1d: 'u_blue_noise_tex_1d',

        shadowmap_dims: 'u_shadowmap_dims',
        time: 'u_time',

        // camera_view_to_world: 'u_camera_view_to_world',
        camera_view_to_light_view: 'u_camera_view_to_light_view',
        light_proj: 'u_light_proj',

        light_pos: 'u_light_pos',
        light_dir: 'u_light_dir',
        light_color: 'u_light_color',
        light_int:     'u_light_int',
        light_i_angle: 'u_light_i_angle',
        light_o_angle: 'u_light_o_angle',
        light_falloff: 'u_light_falloff',
        light_size: 'u_light_size',
        light_min_bias: 'u_light_min_bias',
        light_max_bias: 'u_light_max_bias',
        light_znear: 'u_light_znear',
        light_zfar: 'u_light_zfar',
        light_exponents: 'u_light_exponents',
    }
}

// VERTEX SHADER
export const spotlight_pass_v = `#version 300 es

layout(location = 0) in vec3 a_vert;

out vec2 v_texcoord;

void main() {
	v_texcoord = (a_vert.xy) * 0.5 + vec2(0.5);
	gl_Position = vec4(a_vert, 1.0);
}
`;

// FRAGMENT SHADER
export function gen_spotlight_pass_f(screen_width, screen_height, pcf_samples, pcss_samples) { 
    const decimal_length = 8;
    const pretty_vec2 = function(a,b) { return `vec2(${pretty_float(a, decimal_length)},${pretty_float(b, decimal_length)})`; }
    // genereate pcf_samples string
    let pcf_samples_string = pretty_vec2(pcf_samples[0], pcf_samples[1]);
    for(let i=2; i<2*PCF_POISSON_SAMPLE_COUNT; i+=2)
        pcf_samples_string += `,${pretty_vec2(pcf_samples[i], pcf_samples[i+1])}`;
    // genereate pccc_samples string
    let pcss_samples_string = pretty_vec2(pcss_samples[0], pcss_samples[1]);
    for(let i=2; i<2*PCSS_POISSON_SAMPLE_COUNT; i+=2)
        pcss_samples_string += `,${pretty_vec2(pcss_samples[i], pcss_samples[i+1])}`;

    // generate pcf loop
    let pcf_loop = '';
    for(let i=0; i<PCF_POISSON_SAMPLE_COUNT; i++) {
        pcf_loop += `
    shadow += texture(u_shadow_atlas_tex, vec3(s_projcoord.xy + rot*(pcf_samples[${i}]*sample_width*sm_texel), s_projcoord.z+shadow_bias));`;
    }

    let evsm_pcf_loop = '';
    for(let i=0; i<PCF_POISSON_SAMPLE_COUNT; i++) {
        evsm_pcf_loop += `
    summed_moments += texture(u_shadow_atlas_evsm_tex, s_projcoord.xy + rot*(pcf_samples[${i}]*sample_width*sm_texel));`;
    }

    // generate pcss loop
    let pcss_loop = '';
    for(let i=0; i<PCSS_POISSON_SAMPLE_COUNT; i++) {
        pcss_loop += `
        offset = rot*(pcss_samples[${i}] * region_scale * sm_texel);
        blocker_sample = texture(u_shadow_atlas_linear_tex, s_texcoord + offset).x;
        if(blocker_sample < linear_z) blockers++;
        if(blocker_sample < linear_z) avg_blocker_depth += blocker_sample;`;
    }
    /*
    let pcss_mat = [
        [ 0.00,0.00,0.25,0.25,0.25,0.00,0.00 ],
        [ 0.00,0.50,0.50,0.50,0.50,0.50,0.00 ],
        [ 0.25,0.50,0.75,0.75,0.75,0.50,0.25 ],
        [ 0.25,0.50,0.75,1.00,0.75,0.50,0.25 ],
        [ 0.25,0.50,0.75,0.75,0.75,0.50,0.25 ],
        [ 0.00,0.50,0.50,0.50,0.50,0.50,0.00 ],
        [ 0.00,0.00,0.25,0.25,0.25,0.00,0.00 ]];
    for(let r=0; r<pcss_mat.length; r++) {
        for(let c=0; c<pcss_mat[r].length; c++) {
            const scale = pcss_mat[r][c];
            if(scale > 0) {
                pcss_loop += `
                // offset = rot*(sm_texel * vec2(${pretty_float(c-3.5,2)},${pretty_float(r-3.5,2)}));
                offset = rot*(region_scale * sm_texel * vec2(${pretty_float(c/6-0.5,2)},${pretty_float(r/6-0.5,2)}));
                blocker_sample = texture(u_shadow_atlas_linear_tex, s_texcoord + offset).x;
                if(blocker_sample < linear_z) f_blockers += ${pretty_float(scale,3)};
                if(blocker_sample < linear_z) avg_blocker_depth += ${pretty_float(scale,3)}*blocker_sample;`
            }
        }
    }*/

    return `#version 300 es
precision highp float;
precision highp sampler2DShadow;
precision highp int;
precision highp usampler2D;

// varyings
in vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_albedo_tex;
uniform sampler2D u_rough_metal_tex;
uniform sampler2D u_shadow_atlas_linear_tex;
uniform sampler2D u_shadow_atlas_evsm_tex;
uniform sampler2DShadow u_shadow_atlas_tex;
uniform sampler2D u_blue_noise_tex;
uniform sampler2D u_blue_noise_tex_1d;

// shadowmap constants
const int pcf_sample_count = ${PCF_POISSON_SAMPLE_COUNT};
const int pcss_sample_count = ${PCSS_POISSON_SAMPLE_COUNT};
// shadowmap arrays
const vec2 pcf_samples[pcf_sample_count] = vec2[](${pcf_samples_string});
const vec2 pcss_samples[pcss_sample_count] = vec2[](${pcss_samples_string});

// shadowmap uniforms
uniform vec3 u_shadowmap_dims;
uniform vec3 u_time;

// matrix uniforms
// uniform mat4 u_camera_view_to_world;
uniform mat4 u_camera_view_to_light_view;
uniform mat4 u_light_proj;

// light uniforms
uniform vec3 u_light_pos;
uniform vec3 u_light_dir;
uniform vec3 u_light_color;
uniform float u_light_int;
uniform float u_light_i_angle;
uniform float u_light_o_angle;
uniform float u_light_falloff;
uniform float u_light_size;
uniform float u_light_min_bias;
uniform float u_light_max_bias;
uniform float u_light_znear;
uniform float u_light_zfar;
uniform vec2 u_light_exponents;
//uniform float u_light_fov;

// out
out vec4 o_fragcolor;

// constants
const float PI = 3.14159265359;
const float penumbra_basis_resolution = 1024.0;
const float vsm_min_variance = 0.00025;
const float bleed_reduce = 0.2;


// FUNCTION DEFINITIONS
// ====================

// SHADOW FUNCTIONS
// ----------------
float linearize_depth(float proj_depth, float znear, float zfar) {
    return (2.0*znear) / (zfar + znear - proj_depth*(zfar - znear));
}
float random (vec2 uv) {
    return fract(sin(dot(uv.xy,vec2(12.9898, 121.233)))*43758.5453123);
}
// float shadowmap_pcf(vec3 s_projcoord, vec2 sm_resolution, float sample_width, float shadow_bias);
// vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_resolution, float region_scale, mat2 rot float bias);
float shadowmap_evsm(vec3 s_projcoord, vec2 sm_texel, float linear_z);
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias, float rand);

// PBR FUNCTIONS
// -------------
float DistributionGGX(vec3 N, vec3 H, float roughness);
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness);
vec3 fresnelSchlick(float cosTheta, vec3 F0);

// MAIN FUNCTION
// =============
void main() {
    // grab texture values
    // -------------------
	vec3 P = texture(u_pos_tex, v_texcoord).xyz;
	vec3 N = texture(u_norm_tex, v_texcoord).xyz;
	vec3 A = texture(u_albedo_tex, v_texcoord).xyz;
	vec2 RM = texture(u_rough_metal_tex, v_texcoord).xy;
    vec3 noise = texture(u_blue_noise_tex, (v_texcoord*vec2(${screen_width}.0,${screen_height}.0)/256.0) 
        + u_time.yz
        + vec2(0.53840,0.34029)).rgb;

	// spotlight intensity value
    // -------------------------
    vec3 p_to_l_full = u_light_pos - P;
	vec3 p_to_l = normalize(p_to_l_full);
    float cos_angle = dot(p_to_l, -u_light_dir);
    float n_dot_l = dot(N, p_to_l);
    if(n_dot_l < 0.0 || cos_angle < u_light_o_angle-0.0001) {
        discard;
    }
	float I = max(0.0, u_light_int * pow((cos_angle - u_light_o_angle) / (u_light_i_angle - u_light_o_angle), u_light_falloff));

    // shadowmapping
    // -------------
    // shadow map test
    vec4 P_from_light_view = u_camera_view_to_light_view * vec4(P, 1.0);
    vec4 P_from_light = u_light_proj * P_from_light_view;
    P_from_light.xyz /= P_from_light.w;
    P_from_light.xyz *= 0.5;
    P_from_light.xyz += 0.5;

    // calculate random cos_angle
    float rand = texture(u_blue_noise_tex_1d, (v_texcoord*vec2(${screen_width}.0,${screen_height}.0)/256.0) + u_time.yz).r;
    rand *= 2.0*PI;

    // calculate shadows
    float shadow_bias = -max(u_light_max_bias * (1.0 - n_dot_l), u_light_min_bias);
    // float shadow = shadowmap_pcss(P_from_light.xyz, P_from_light_view.z, P.z, u_light_size, shadow_bias, rand);

    vec2 sm_texel = 1.0/(u_shadowmap_dims.xy);
    float linear_z = P_from_light.z;//linearize_depth(P_from_light.z, u_light_znear, u_light_zfar);
    float shadow = shadowmap_evsm(P_from_light.xyz, sm_texel, linear_z);

    /*if(shadow > 1.0) {
        o_fragcolor = vec4(1.0,0.0,0.0,1.0);
        return;
    }*/

    if(shadow < 0.0001)
       discard;
    // shadow = clamp(shadow, 0.0, 1.0);
    // o_fragcolor = vec4(vec3(shadow), 1.0);
    // return;

    // pbr rendering
    // -------------
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, A, RM[1]);

    // calculate per-light radiance
    vec3 p_to_c = normalize(-P);
    vec3 H = normalize(p_to_c + p_to_l);
    // float distance    = length(p_to_l_full);
    // float attenuation = 1.0 / (distance * distance);
    vec3 radiance     = I*u_light_color;//u_light_color * attenuation;        
    
    // cook-torrance brdf
    float NDF = DistributionGGX(N, H, RM[0]);        
    float G   = GeometrySmith(N, p_to_c, p_to_l, RM[0]);      
    vec3 F    = fresnelSchlick(max(dot(H, p_to_c), 0.0), F0);       
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - RM[1];    
    
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, p_to_c), 0.0) * max(dot(N, p_to_l), 0.0);
    vec3 specular     = numerator / max(denominator, 0.001);  
        
    vec3 light_out = (kD * A / PI + specular) * radiance * max(n_dot_l, 0.0);
    light_out *= shadow;
    light_out += noise.rgb/255.0;
    // !!!! EXPERIMENTAL LINE (REMOVE SUBTRACTIVE ASPECT);
    light_out = max(light_out, 0.0);

    o_fragcolor = vec4(light_out, 1.0);
    return;
}

// SHADOW FUNCTIONS
// ================
float shadowmap_pcf(vec3 s_projcoord, vec2 sm_texel, float sample_width, mat2 rot, float shadow_bias) {
    float shadow = 0.0;
    ${pcf_loop}
    return shadow/(float(pcf_sample_count));
}
vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_texel, float region_scale, mat2 rot, float bias) {
    linear_z += bias;
    // average blocker distance 
    int blockers = 0;
    // float f_blockers = 0.0;
    float avg_blocker_depth = 0.0;
    vec2 offset;
    float blocker_sample;
    ${pcss_loop}
    float f_blockers = float(blockers);
    if(blockers > 0) avg_blocker_depth /= f_blockers;
    // if(f_blockers > 0.01) avg_blocker_depth /= f_blockers;
    return vec2(avg_blocker_depth, f_blockers);
}
float chebyshev_inequality(vec2 moments, float z, float min_variance) {
    float variance = moments.y - moments.x*moments.x;
    variance = max(variance, vsm_min_variance);
    float znorm = z - moments.x;
    float znorm2 = znorm*znorm;
    float p_max = variance/(variance + znorm2); 
    p_max = smoothstep(bleed_reduce, 1.0, p_max);
    return max(p_max, float(z <= moments.x));
}
float shadowmap_evsm(vec3 s_projcoord, vec2 sm_texel, float linear_z) {
    vec4 moments = texture(u_shadow_atlas_evsm_tex, s_projcoord.xy);

    // return moments.x;
    float dx = dFdx(moments.x);
    float dy = dFdy(moments.x);
    moments.y += 0.25*(dx*dx + dy*dy);
    
    linear_z = linear_z*2.0 - 1.0;
    vec2 exp_z = vec2(exp(u_light_exponents.x*linear_z),-exp(-u_light_exponents.y*linear_z));
    vec2 min_variances = 0.01*0.01 * u_light_exponents * exp_z;

    float pos_pmax = chebyshev_inequality(moments.xy, exp_z.x, min_variances.x);
    float neg_pmax = chebyshev_inequality(moments.zw, exp_z.y, min_variances.y);
    // return clamp(min(pos_pmax, neg_pmax), 0.0, 1.0);
    return clamp(min(pos_pmax, neg_pmax), 0.0, 10.0);
}
float variable_shadowmap_evsm(vec3 s_projcoord, vec2 sm_texel, float linear_z, mat2 rot, float sample_width) {
    vec4 summed_moments = vec4(0.0);
    ${evsm_pcf_loop}
    vec4 moments = summed_moments/float(pcf_sample_count);

    // return moment.x;
    float dx = dFdx(moments.x);
    float dy = dFdy(moments.x);
    moments.y += 0.25*(dx*dx + dy*dy);
    
    linear_z = linear_z*2.0 - 1.0;
    vec2 exp_z = vec2(exp(u_light_exponents.x*linear_z),-exp(-u_light_exponents.y*linear_z));
    vec2 min_variances = 0.01*0.01 * u_light_exponents * exp_z;

    float pos_pmax = chebyshev_inequality(moments.xy, exp_z.x, min_variances.x);
    float neg_pmax = chebyshev_inequality(moments.zw, exp_z.y, min_variances.y);
    return clamp(min(pos_pmax, neg_pmax), 0.0, 1.0);
    // return clamp(min(pos_pmax, neg_pmax), 0.0, 10.0);
}
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias, float rand) {
    // random rot
    float cos_rot = cos(rand); float sin_rot = sin(rand);
    mat2 rot = mat2(cos_rot, -sin_rot, sin_rot, cos_rot);

    vec2 sm_texel = 1.0/(u_shadowmap_dims.xy);
    float linear_z = linearize_depth(s_projcoord.z, u_light_znear, u_light_zfar);

    // perform shadowmap filtering
    float min_search = 0.1;
    float max_search = 30.0;
    float search_width = max(min_search,min(max_search, light_size * (light_z - u_light_znear) / min(eye_z, 1.0)));
    search_width *= u_shadowmap_dims.x/penumbra_basis_resolution; // normalize to basis resolution
    search_width = 7.0;
    vec2 blocker_res = pcss_blocker_distance(s_projcoord.xy, linear_z, sm_texel, search_width, rot, shadow_bias);
    if(blocker_res.y < 0.1)                   return 1.0;
    if(blocker_res.x >= linear_z+shadow_bias) return 1.0;

    float penumbra_size = light_size * (linear_z - blocker_res.x) / blocker_res.x;
    // penumbra_size *= u_light_znear/linear_z;
    penumbra_size *= u_shadowmap_dims.x/penumbra_basis_resolution; // normalize to basis resolution

    float shadow = variable_shadowmap_evsm(s_projcoord, sm_texel, linear_z, rot, penumbra_size);

    return shadow;
}
/*vec4 bilinear_uint_tex(vec2 texcoord, vec2 sm_texel) {
    vec2 texel_index = texcoord / sm_texel;
    vec2 texel_fract = fract(texel_index);
    vec2 texel_offset = sm_texel * 2.0*(step(0.5, texel_fract) - vec2(0.5));

    vec4 sample0 = vec4(texture(u_shadow_atlas_savsm_uint_tex, texcoord));
    vec4 sample1 = vec4(texture(u_shadow_atlas_savsm_uint_tex, texcoord + vec2(texel_offset.x, 0.0)));
    vec4 sample2 = vec4(texture(u_shadow_atlas_savsm_uint_tex, texcoord + vec2(0.0, texel_offset.y)));
    vec4 sample3 = vec4(texture(u_shadow_atlas_savsm_uint_tex, texcoord + texel_offset));

    vec2 texel_mix = abs(vec2(0.5) - texel_fract);
    vec4 mix0 = mix(sample0, sample1, texel_mix.x);
    vec4 mix1 = mix(sample2, sample3, texel_mix.x);
    return mix(mix0, mix1, texel_mix.y);
}*/

// PBR FUNCTIONS
// =============
// source: https://learnopengl.com/PBR/Lighting
float DistributionGGX(vec3 N, vec3 H, float roughness)
{
    float a      = roughness*roughness;
    float a2     = a*a;
    float NdotH  = max(dot(N, H), 0.0);
    float NdotH2 = NdotH*NdotH;
    
    float num   = a2;
    float denom = (NdotH2 * (a2 - 1.0) + 1.0);
    denom = PI * denom * denom;
    
    return num / denom;
}
float GeometrySchlickGGX(float NdotV, float roughness)
{
    float r = (roughness + 1.0);
    float k = (r*r) / 8.0;

    float num   = NdotV;
    float denom = NdotV * (1.0 - k) + k;
    
    return num / denom;
}
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness)
{
    float NdotV = max(dot(N, V), 0.0);
    float NdotL = max(dot(N, L), 0.0);
    float ggx2  = GeometrySchlickGGX(NdotV, roughness);
    float ggx1  = GeometrySchlickGGX(NdotL, roughness);
    
    return ggx1 * ggx2;
}
vec3 fresnelSchlick(float cosTheta, vec3 F0)
{
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}  

`};