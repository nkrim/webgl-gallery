import { pretty_float } from '../ts/utils.ts';

// CONSTANTS
export const PCF_POISSON_SAMPLE_COUNT = 64;
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
        shadow_atlas_tex: 'u_shadow_atlas_tex',

        shadowmap_dims: 'u_shadowmap_dims',

        camera_view_to_light_view: 'u_camera_view_to_light_view',
        light_proj: 'u_light_proj',

        light_pos: 'u_light_pos',
        light_dir: 'u_light_dir',
        light_color: 'u_light_color',
        light_int:     'u_light_int',
        light_i_angle: 'u_light_i_angle',
        light_o_angle: 'u_light_o_angle',
        light_falloff: 'u_light_falloff',
        light_znear: 'u_light_znear',
        light_zfar: 'u_light_zfar',
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
export function gen_spotlight_pass_f(pcf_samples, pcss_samples) { 
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
    shadow += 4.0*texture(u_shadow_atlas_tex, vec3(s_projcoord.xy + rot*(pcf_samples[${i}]*sample_width*sm_texel), s_projcoord.z+shadow_bias));`;
    }

    return `#version 300 es
precision mediump float;
precision mediump sampler2DShadow;

// varyings
in vec2 v_texcoord;

// texture uniforms
uniform sampler2D u_pos_tex;
uniform sampler2D u_norm_tex;
uniform sampler2D u_albedo_tex;
uniform sampler2D u_rough_metal_tex;
uniform sampler2D u_shadow_atlas_linear_tex;
uniform sampler2DShadow u_shadow_atlas_tex;

// shadowmap constants
const int pcf_sample_count = ${PCF_POISSON_SAMPLE_COUNT};
const int pcss_sample_count = ${PCSS_POISSON_SAMPLE_COUNT};
// shadowmap arrays
const vec2 pcf_samples[pcf_sample_count] = vec2[](${pcf_samples_string});
const vec2 pcss_samples[pcss_sample_count] = vec2[](${pcss_samples_string});

// shadowmap uniforms
uniform vec2 u_shadowmap_dims;

// matrix uniforms
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
uniform float u_light_znear;
uniform float u_light_zfar;
//uniform float u_light_fov;

// out
out vec4 o_fragcolor;

// constants
const float PI = 3.14159265359;

// pcss constants
const float light_size = 20.0;

// FUNCTION DEFINITIONS
// ====================

// SHADOW FUNCTIONS
// ----------------
float linearize_depth(float proj_depth, float znear, float zfar) {
    return (2.0*znear) / (zfar + znear - proj_depth*(zfar - znear));
}
float random (vec2 uv) {
    return fract(sin(dot(uv.xy,vec2(12.9898,78.233)))*43758.5453123);
}
float shadowmap_pcf(vec3 s_projcoord, vec2 sm_resolution, float sample_width, float shadow_bias);
vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_resolution, float region_scale);
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias);

// PBR FUNCTIONS
// -------------
float DistributionGGX(vec3 N, vec3 H, float roughness);
float GeometrySchlickGGX(float NdotV, float roughness);
float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness);

// MAIN FUNCTION
// =============
void main() {
	// grab texture values
	vec3 P = texture(u_pos_tex, v_texcoord).xyz;
	vec3 N = texture(u_norm_tex, v_texcoord).xyz;
	vec3 A = texture(u_albedo_tex, v_texcoord).xyz;
	vec2 RM = texture(u_rough_metal_tex, v_texcoord).xy;

	// spotlight intensity value
	vec3 l_to_p = normalize(P - u_light_pos);
    float cos_angle = dot(l_to_p, u_light_dir);
    float norm_dot = dot(N, -l_to_p);
    if(norm_dot < 0.0 || cos_angle < u_light_o_angle-0.0001) {
        discard;
    }
	float I = norm_dot * u_light_int * pow((cos_angle - u_light_o_angle) / (u_light_i_angle - u_light_o_angle), u_light_falloff);

    // shadow map test
    vec4 P_from_light_view = u_camera_view_to_light_view * vec4(P, 1.0);
    vec4 P_from_light = u_light_proj * P_from_light_view;
    P_from_light.xyz /= P_from_light.w;
    P_from_light.xyz *= 0.5;
    P_from_light.xyz += 0.5;

    float shadow_bias = max(0.001 * (1.0 - norm_dot), 0.0001);
    float shadow = shadowmap_pcss(P_from_light.xyz, P_from_light_view.z, P.z, light_size, shadow_bias);
    //shadow = 1.0-((1.0-shadow)*(1.0-shadow));
    shadow = clamp(shadow*2.0, 0.0, 1.0);

    if(shadow < 0.0001)
        discard;

    o_fragcolor = vec4(I*A*u_light_color*shadow, 1.0);
    //o_fragcolor = vec4(vec3(P_from_light.z-depth_sample), 1.0);
    //o_fragcolor = vec4(P_from_light.xy, 0.0, 1.0);
    return;
}

// SHADOW FUNCTIONS
float shadowmap_pcf(vec3 s_projcoord, vec2 sm_texel, float sample_width, mat2 rot, float shadow_bias) {
    float shadow = 0.0;
    ${pcf_loop}
    return shadow/(4.0*float(pcf_sample_count));
}
vec2 pcss_blocker_distance(vec2 s_texcoord, float linear_z, vec2 sm_texel, float region_scale, mat2 rot) {
    int blockers = 0;
    float avg_blocker_depth = 0.0;
    for (int i=0; i<pcss_sample_count; i++) {
        vec2 offset = rot*(pcss_samples[i] * region_scale * sm_texel);
        //vec2 offset = pcss_samples[i] * region_scale * sm_texel;

        float blocker_sample = texture(u_shadow_atlas_linear_tex, s_texcoord + offset).x;
        if (blocker_sample < linear_z) {
            blockers++;
            avg_blocker_depth += blocker_sample;
        }
    }
    float f_blockers = float(blockers);
    if(blockers > 0) avg_blocker_depth /= f_blockers;
    return vec2(avg_blocker_depth, f_blockers);
}
float shadowmap_pcss(vec3 s_projcoord, float light_z, float eye_z, float light_size, float shadow_bias) {
    // random rot
    float rand = 2.0*PI*random(s_projcoord.xy*100.0);
    float cos_rot = cos(rand); float sin_rot = sin(rand);
    mat2 rot = mat2(cos_rot, -sin_rot, sin_rot, cos_rot);

    float max_penumbra = 0.1 * min(u_shadowmap_dims.x, u_shadowmap_dims.y);
    float max_search = max_penumbra/5.0;
    float min_search = 4.0;

    // perform shadowmap filtering
    vec2 sm_texel = 1.0/u_shadowmap_dims;
    float linear_z = linearize_depth(s_projcoord.z, u_light_znear, u_light_zfar);
    float search_width = max(min_search,min(max_search, light_size * (light_z - u_light_znear) / min(eye_z, 1.0)));
    vec2 blocker_res = pcss_blocker_distance(s_projcoord.xy, linear_z, sm_texel, search_width, rot);
    if(blocker_res.y < 0.9 || blocker_res.x >= linear_z+shadow_bias)
        return 1.0;

    float penumbra_size = min(max_penumbra, light_size * (linear_z - blocker_res.x) / blocker_res.x);
    float shadow = shadowmap_pcf(s_projcoord, sm_texel, penumbra_size, rot, shadow_bias);
    return shadow;
}







/*float I = 
        step(0.0, dot(N, -l_to_p))
        * step(u_light_o_angle-0.0001, cos_angle) 
        * pow(
              (cos_angle - u_light_o_angle) 
            / (u_light_i_angle - u_light_o_angle)
            , u_light_falloff);*/



    /*
// PBR stuff for later
/*void main_extra() {
    
    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, A, RM[1]);
	           
    // reflectance equation
    vec3 light_out = vec3(0.0);

    // calculate per-light radiance
    vec3 L = normalize(lightPositions[i] - WorldPos);
    vec3 H = normalize(V + L);
    float distance    = length(lightPositions[i] - WorldPos);
    float attenuation = 1.0 / (distance * distance);
    vec3 radiance     = lightColors[i] * attenuation;        
    
    // cook-torrance brdf
    float NDF = DistributionGGX(N, H, roughness);        
    float G   = GeometrySmith(N, V, L, roughness);      
    vec3 F    = fresnelSchlick(max(dot(H, V), 0.0), F0);       
    
    vec3 kS = F;
    vec3 kD = vec3(1.0) - kS;
    kD *= 1.0 - metallic;	  
    
    vec3 numerator    = NDF * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * max(dot(N, L), 0.0);
    vec3 specular     = numerator / max(denominator, 0.001);  
        
    // add to outgoing radiance Lo
    float NdotL = max(dot(N, L), 0.0);                
    Lo += (kD * albedo / PI + specular) * radiance * NdotL;
    
    o_fragcolor = vec4(I*u_light_color*A, 1.0);
}*/

// pbr functions
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

`};